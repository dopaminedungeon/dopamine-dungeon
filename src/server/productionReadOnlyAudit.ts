/**
 * Temporary #298 Production read-only audit. Remove immediately after the
 * Production evidence capture is complete. This module deliberately exposes
 * no mutation client or write-capable operation.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import postgres from "postgres";
import {
  buildLimiterExport,
  classifyFirestoreRecords,
  KNOWN_CAMPAIGN_SUBCOLLECTIONS,
  KNOWN_TOP_LEVEL_COLLECTIONS,
  summarizeCollection,
  type CollectionRead,
  type FirestoreDocumentRecord,
  type NeonReconciliationSnapshot,
} from "../../scripts/firestore-reconciliation/lib.js";

export const PRODUCTION_FIREBASE_PROJECT = "dopamine-dungeon-prod";
export const PRODUCTION_NEON_HOST = "ep-restless-breeze-alhtna7q-pooler.c-3.eu-central-1.aws.neon.tech";
export const PRODUCTION_NEON_DATABASE = "neondb";

export type AuditEnvironment = Record<string, string | undefined>;

export function hasProductionAuditClaim(token: Record<string, unknown>) {
  return token.productionAudit === true;
}

export function validateProductionAuditTarget(environment: AuditEnvironment) {
  if (environment.VERCEL_ENV !== "production") return { ok: false as const, reason: "production environment required" };
  if (environment.FIREBASE_PROJECT_ID !== PRODUCTION_FIREBASE_PROJECT) return { ok: false as const, reason: "Firebase project target mismatch" };
  if (!environment.FIREBASE_CLIENT_EMAIL?.trim() || !environment.FIREBASE_PRIVATE_KEY?.trim()) return { ok: false as const, reason: "Firebase credentials unavailable" };
  const raw = environment.DATABASE_URL?.trim();
  if (!raw) return { ok: false as const, reason: "DATABASE_URL is unavailable" };
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false as const, reason: "DATABASE_URL is malformed" }; }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (url.hostname !== PRODUCTION_NEON_HOST || database !== PRODUCTION_NEON_DATABASE) return { ok: false as const, reason: "Neon target mismatch" };
  return { ok: true as const, hostname: url.hostname, database };
}

function safeDatabaseMetadata(url: string) {
  const parsed = new URL(url);
  return { hostname: parsed.hostname, database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) };
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function key(...parts: string[]) { return parts.join("\u0000"); }
function rows<T>(value: unknown) { return value as T[]; }

function appForProduction() {
  const name = "dd298-production-read-only-audit";
  return getApps().find((candidate) => candidate.name === name) ?? initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  }, name);
}

async function readFirestore(): Promise<CollectionRead[]> {
  const firestore = getFirestore(appForProduction());
  async function documents(path: string): Promise<FirestoreDocumentRecord[]> {
    const reference = firestore.collection(path);
    const snapshot = await reference.get();
    return snapshot.docs.map((document) => ({ path: document.ref.path, id: document.id, data: document.data() }));
  }
  const reads: CollectionRead[] = [];
  const topLevel = (await firestore.listCollections()).map((collection) => collection.id);
  for (const id of [...new Set([...KNOWN_TOP_LEVEL_COLLECTIONS, ...topLevel])].sort()) {
    const known = KNOWN_TOP_LEVEL_COLLECTIONS.includes(id as (typeof KNOWN_TOP_LEVEL_COLLECTIONS)[number]);
    reads.push({ canonicalPath: known ? id : `discovered/${id}`, sourcePath: id, documents: await documents(id), discovered: !known });
  }
  const campaigns = reads.find((read) => read.canonicalPath === "campaigns")?.documents ?? [];
  for (const campaign of campaigns) {
    const collections = await firestore.doc(campaign.path).listCollections();
    for (const collection of collections) {
      const known = KNOWN_CAMPAIGN_SUBCOLLECTIONS.includes(collection.id as (typeof KNOWN_CAMPAIGN_SUBCOLLECTIONS)[number]);
      const canonicalPath = known ? (collection.id === "meta" ? "campaigns/{campaignId}/meta/bag" : `campaigns/{campaignId}/${collection.id}`) : `campaigns/{campaignId}/discovered/${collection.id}`;
      const snapshot = await collection.get();
      reads.push({ canonicalPath, sourcePath: `${campaign.path}/${collection.id}`, documents: snapshot.docs.map((document) => ({ path: document.ref.path, id: document.id, data: document.data() })), discovered: !known });
    }
  }
  return reads;
}

async function readNeonSnapshot(url: string): Promise<NeonReconciliationSnapshot> {
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const availableTables = new Set((await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`).map((row) => String((row as { table_name: string }).table_name)));
    const [users, workspaces, campaigns, workspaceMembers, campaignMembers, characters, assignments, invitations, invitationCharacters, entityRows, bags] = await Promise.all([
      sql`SELECT firebase_uid, id FROM users`,
      sql`SELECT workspaces.slug, workspaces.id, users.firebase_uid AS owner_uid FROM workspaces JOIN users ON users.id = workspaces.owner_user_id`,
      sql`SELECT slug, id, workspace_id, name, description, status, system FROM campaigns`,
      sql`SELECT workspace_id, firebase_uid, role FROM workspace_memberships JOIN users ON users.id = workspace_memberships.user_id`,
      sql`SELECT campaign_id, firebase_uid, role FROM campaign_memberships JOIN users ON users.id = campaign_memberships.user_id`,
      sql`SELECT campaign_id, id FROM characters`,
      sql`SELECT campaign_id, firebase_uid, character_id FROM character_assignments JOIN users ON users.id = character_assignments.user_id`,
      sql`SELECT id, workspace_id AS "workspaceId", campaign_id AS "campaignId", workspace_role AS "workspaceRole", campaign_role AS "campaignRole", status FROM invitations`,
      availableTables.has("invitation_character_assignments") ? sql`SELECT invitation_id, character_id FROM invitation_character_assignments` : Promise.resolve([]),
      sql`SELECT 'sessions' AS domain, campaign_id, id FROM sessions UNION ALL SELECT 'items', campaign_id, id FROM items UNION ALL SELECT 'npcs', campaign_id, id FROM npcs UNION ALL SELECT 'locations', campaign_id, id FROM locations UNION ALL SELECT 'lore', campaign_id, id FROM lore`,
      sql`SELECT campaign_id FROM bag_currency`,
    ]);
    const campaignBySlug = new Map(rows<{ slug: string; id: string; workspace_id: string }>(campaigns).map((row) => [row.slug, { id: row.id, workspaceId: row.workspace_id }]));
    const characterIdsByCampaign = new Map<string, Set<string>>();
    for (const row of rows<{ campaign_id: string; id: string }>(characters)) (characterIdsByCampaign.get(row.campaign_id) ?? (characterIdsByCampaign.set(row.campaign_id, new Set()), characterIdsByCampaign.get(row.campaign_id)!)).add(row.id);
    const invitationCharacterIdsByInvitation = new Map<string, Set<string>>();
    for (const row of rows<{ invitation_id: string; character_id: string }>(invitationCharacters)) (invitationCharacterIdsByInvitation.get(row.invitation_id) ?? (invitationCharacterIdsByInvitation.set(row.invitation_id, new Set()), invitationCharacterIdsByInvitation.get(row.invitation_id)!)).add(row.character_id);
    const campaignEntityKeys = new Map<string, Set<string>>();
    for (const row of rows<{ domain: string; campaign_id: string; id: string }>(entityRows)) (campaignEntityKeys.get(row.domain) ?? (campaignEntityKeys.set(row.domain, new Set()), campaignEntityKeys.get(row.domain)!)).add(key(row.campaign_id, row.id));
    return {
      firebaseUids: new Set(rows<{ firebase_uid: string }>(users).map((row) => row.firebase_uid)),
      workspaceIdsBySlug: new Map(rows<{ slug: string; id: string }>(workspaces).map((row) => [row.slug, row.id])),
      workspaceOwnerUids: new Map(rows<{ slug: string; id: string; owner_uid: string }>(workspaces).map((row) => [row.id, row.owner_uid])),
      campaignBySlug,
      campaignDetails: new Map(rows<{ id: string; [key: string]: unknown }>(campaigns).map((row) => [row.id, row])),
      workspaceMembershipRoles: new Map(rows<{ workspace_id: string; firebase_uid: string; role: string }>(workspaceMembers).map((row) => [key(row.workspace_id, row.firebase_uid), row.role])),
      campaignMembershipRoles: new Map(rows<{ campaign_id: string; firebase_uid: string; role: string }>(campaignMembers).map((row) => [key(row.campaign_id, row.firebase_uid), row.role])),
      characterIdsByCampaign,
      invitationCharacterIds: new Set(rows<{ invitation_id: string; character_id: string }>(invitationCharacters).map((row) => key(row.invitation_id, row.character_id))),
      invitationById: new Map(rows<{ id: string; [key: string]: unknown }>(invitations).map((row) => [row.id, row])),
      invitationCharacterIdsByInvitation,
      assignmentKeys: new Set(rows<{ campaign_id: string; firebase_uid: string; character_id: string }>(assignments).map((row) => key(row.campaign_id, row.firebase_uid, row.character_id))),
      campaignEntityKeys,
      bagCampaignIds: new Set(rows<{ campaign_id: string }>(bags).map((row) => row.campaign_id)),
    };
  } finally { await sql.end({ timeout: 5 }); }
}

async function schemaBaseline(url: string) {
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const rowsResult = await sql`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('workspaces','campaigns','users','invitations','invitation_character_assignments','auth_email_rate_limit_subjects','auth_email_rate_limit_attempts') ORDER BY table_name, ordinal_position`;
    const ledgerTables = await sql`SELECT table_schema FROM information_schema.tables WHERE table_name = '__drizzle_migrations' AND table_schema IN ('public','drizzle')`;
    const ledgerSchema = (ledgerTables[0] as { table_schema?: string } | undefined)?.table_schema;
    const ledger = ledgerSchema
      ? await sql.unsafe(`SELECT id, hash, created_at FROM "${ledgerSchema}"."__drizzle_migrations" ORDER BY id`)
      : [];
    const tables = new Map<string, Array<{ column: string; type: string }>>();
    for (const row of rows<{ table_name: string; column_name: string; data_type: string }>(rowsResult)) (tables.get(row.table_name) ?? (tables.set(row.table_name, []), tables.get(row.table_name)!)).push({ column: row.column_name, type: row.data_type });
    return { tables: Object.fromEntries([...tables.entries()].sort()), requiredMigrations: ["0015","0016","0017","0018","0019","0020","0021"], migrationLedger: ledgerSchema ? { schema: ledgerSchema, rows: rows<Record<string, unknown>>(ledger).map(({ id, hash, created_at }) => ({ id, hash, created_at })) } : { status: "NOT_FOUND" } };
  } finally { await sql.end({ timeout: 5 }); }
}

export async function runProductionReadOnlyAudit() {
  const target = validateProductionAuditTarget(process.env);
  if (!target.ok) throw new Error("Production audit target validation failed");
  const reads = await readFirestore();
  const neon = await readNeonSnapshot(process.env.DATABASE_URL!);
  const inventory = reads.map(summarizeCollection);
  const reconciliation = classifyFirestoreRecords(reads, neon);
  const limiter = buildLimiterExport(reads);
  const safetySql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  let migrationSafety;
  try {
    const availableColumns = new Set((await safetySql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`).map((row) => `${String((row as { table_name: string }).table_name)}.${String((row as { column_name: string }).column_name)}`));
    const workspaceCheck = availableColumns.has("workspaces.creation_request_key")
      ? safetySql`SELECT COUNT(*)::int AS count FROM (SELECT owner_user_id, creation_request_key FROM workspaces WHERE creation_request_key IS NOT NULL GROUP BY owner_user_id, creation_request_key HAVING COUNT(*) > 1) duplicates`
      : Promise.resolve([{ count: 0 }]);
    const campaignCheck = availableColumns.has("campaigns.creation_request_key") && availableColumns.has("campaigns.created_by_user_id")
      ? safetySql`SELECT COUNT(*)::int AS count FROM (SELECT workspace_id, created_by_user_id, creation_request_key FROM campaigns WHERE creation_request_key IS NOT NULL GROUP BY workspace_id, created_by_user_id, creation_request_key HAVING COUNT(*) > 1) duplicates`
      : Promise.resolve([{ count: 0 }]);
    const invitationCheck = availableColumns.has("invitation_character_assignments.invitation_id")
      ? safetySql`SELECT COUNT(*)::int AS count FROM (SELECT invitation_id, character_id FROM invitation_character_assignments GROUP BY invitation_id, character_id HAVING COUNT(*) > 1) duplicates`
      : Promise.resolve([{ count: 0 }]);
    const [duplicateWorkspaceKeys, duplicateCampaignKeys, duplicateInvitationCharacters] = await Promise.all([workspaceCheck, campaignCheck, invitationCheck]);
    migrationSafety = { duplicateWorkspaceKeys: Number(rows<{ count: number }>(duplicateWorkspaceKeys)[0]?.count ?? 0), duplicateCampaignKeys: Number(rows<{ count: number }>(duplicateCampaignKeys)[0]?.count ?? 0), duplicateInvitationCharacters: Number(rows<{ count: number }>(duplicateInvitationCharacters)[0]?.count ?? 0), skippedChecks: [...(!availableColumns.has("workspaces.creation_request_key") ? ["workspace creation key absent"] : []), ...(!availableColumns.has("campaigns.creation_request_key") ? ["campaign creation key absent"] : []), ...(!availableColumns.has("invitation_character_assignments.invitation_id") ? ["invitation relationship table absent"] : [])] };
  } finally { await safetySql.end({ timeout: 5 }); }
  return {
    ok: true,
    environment: "production",
    topology: { firebaseProjectId: PRODUCTION_FIREBASE_PROJECT, neon: safeDatabaseMetadata(process.env.DATABASE_URL!) },
    schema: await schemaBaseline(process.env.DATABASE_URL!),
    migrationSafety,
    inventory,
    reconciliation: { primaryClassificationTotals: reconciliation.primaryClassificationTotals, secondaryFindingTotals: reconciliation.secondaryFindingTotals, unresolvedRecordCount: reconciliation.unresolved.length },
    limiter: { sourceCollectionCounts: limiter.sourceCollectionCounts, activeAttemptCount: limiter.records.length, malformedCount: limiter.malformed.length, checksum: limiter.checksum, horizonStart: limiter.horizonStart, horizonEnd: limiter.horizonEnd },
    operationalCapture: ["Firestore rules", "Firestore indexes", "Firestore TTL policies", "Trigger Email extension configuration"],
    readOnly: { neonMutations: false, firestoreMutations: false, authMutations: false, mailSending: false, migrations: false },
  };
}
