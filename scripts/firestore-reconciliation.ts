/**
 * Read-only Firestore inventory and reconciliation reporter for #298.
 *
 * This program has no apply mode and intentionally never creates a Firestore
 * batch/transaction or a Neon mutation client. Reports are ignored by Git
 * because a limiter export contains opaque HMAC subject keys needed for the
 * later, separately approved Production import.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import postgres from "postgres";
import {
  KNOWN_CAMPAIGN_SUBCOLLECTIONS,
  KNOWN_TOP_LEVEL_COLLECTIONS,
  buildLimiterExport,
  buildManifest,
  classifyFirestoreRecords,
  parseToolArguments,
  selectProcessEnvironment,
  sha256,
  summarizeCollection,
  type CollectionRead,
  type FirestoreDocumentRecord,
  type NeonReconciliationSnapshot,
} from "./firestore-reconciliation/lib.js";

const arguments_ = parseToolArguments(process.argv.slice(2));

function parseEnv(contents: string) {
  return Object.fromEntries(
    contents.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (!match) return [];
      return [[match[1], match[2].replace(/^['"]|['"]$/g, "")]];
    })
  ) as Record<string, string>;
}

function safeDatabaseMetadata(url: string) {
  const parsed = new URL(url);
  return { hostname: parsed.hostname, database: parsed.pathname.replace(/^\//, "") || "(default)" };
}

const environment = arguments_.environmentSource === "file"
  ? parseEnv(await readFile(arguments_.envFile!, "utf8"))
  : selectProcessEnvironment(process.env);
for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]) {
  if (!environment[key]) throw new Error(`Missing ${key} in explicitly supplied environment file`);
}
if (environment.FIREBASE_PROJECT_ID !== arguments_.firebaseProject) {
  throw new Error("--firebase-project does not match FIREBASE_PROJECT_ID in the explicitly supplied environment file");
}
if (arguments_.modes.includes("reconcile") && !environment.DATABASE_URL) {
  throw new Error("Reconciliation requires DATABASE_URL in the explicitly supplied environment file");
}

console.log(JSON.stringify({
  preflight: true,
  target: arguments_.target,
  firebaseProject: arguments_.firebaseProject,
  environmentSource: arguments_.environmentSource,
  environmentFile: arguments_.envFile ? basename(arguments_.envFile) : undefined,
  modes: arguments_.modes,
  neon: arguments_.modes.includes("reconcile") ? safeDatabaseMetadata(environment.DATABASE_URL) : undefined,
  readOnly: true,
}, null, 2));

const appName = `firestore-reconciliation-read-only-${arguments_.target}`;
const app = getApps().find((candidate) => candidate.name === appName) ?? initializeApp({
  credential: cert({
    projectId: environment.FIREBASE_PROJECT_ID,
    clientEmail: environment.FIREBASE_CLIENT_EMAIL,
    privateKey: environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
}, appName);
const firestore = getFirestore(app);

async function collectionDocuments(path: string): Promise<FirestoreDocumentRecord[]> {
  const parts = path.split("/");
  let reference: ReturnType<typeof firestore.collection> | ReturnType<typeof firestore.doc> = firestore.collection(parts[0]);
  for (let index = 1; index < parts.length; index += 1) {
    reference = index % 2 === 1
      ? (reference as ReturnType<typeof firestore.collection>).doc(parts[index])
      : (reference as ReturnType<typeof firestore.doc>).collection(parts[index]);
  }
  const snapshot = await (reference as ReturnType<typeof firestore.collection>).get();
  return snapshot.docs.map((document) => ({ path: document.ref.path, id: document.id, data: document.data() }));
}

async function subcollectionIds(documentPath: string) {
  const collections = await firestore.doc(documentPath).listCollections();
  return collections.map((collection) => collection.id).sort();
}

function canonicalTopLevelPath(id: string) {
  return KNOWN_TOP_LEVEL_COLLECTIONS.includes(id as (typeof KNOWN_TOP_LEVEL_COLLECTIONS)[number]) ? id : `discovered/${id}`;
}

async function readInventory(): Promise<CollectionRead[]> {
  const topLevelIds = (await firestore.listCollections()).map((collection) => collection.id);
  const allTopLevel = [...new Set([...KNOWN_TOP_LEVEL_COLLECTIONS, ...topLevelIds])].sort();
  const reads: CollectionRead[] = [];
  const rawCampaigns = await collectionDocuments("campaigns");

  for (const subcollection of KNOWN_CAMPAIGN_SUBCOLLECTIONS) {
    reads.push({
      canonicalPath: subcollection === "meta" ? "campaigns/{campaignId}/meta/bag" : `campaigns/{campaignId}/${subcollection}`,
      sourcePath: `campaigns/{campaignId}/${subcollection}`,
      documents: [],
      discovered: false,
    });
  }

  for (const collectionId of allTopLevel) {
    const known = KNOWN_TOP_LEVEL_COLLECTIONS.includes(collectionId as (typeof KNOWN_TOP_LEVEL_COLLECTIONS)[number]);
    reads.push({
      canonicalPath: canonicalTopLevelPath(collectionId),
      sourcePath: collectionId,
      documents: collectionId === "campaigns" ? rawCampaigns : await collectionDocuments(collectionId),
      discovered: !known,
    });
  }

  for (const campaign of rawCampaigns) {
    const discoveredSubcollections = await subcollectionIds(campaign.path);
    for (const subcollection of discoveredSubcollections) {
      const known = KNOWN_CAMPAIGN_SUBCOLLECTIONS.includes(subcollection as (typeof KNOWN_CAMPAIGN_SUBCOLLECTIONS)[number]);
      const canonicalPath = known
        ? subcollection === "meta"
          ? "campaigns/{campaignId}/meta/bag"
          : `campaigns/{campaignId}/${subcollection}`
        : `campaigns/{campaignId}/discovered/${subcollection}`;
      if (subcollection === "meta") {
        const metaDocuments = await collectionDocuments(`${campaign.path}/meta`);
        const bag = metaDocuments.filter((document) => document.id === "bag");
        reads.push({ canonicalPath, sourcePath: `${campaign.path}/meta/bag`, documents: bag, discovered: false });
        for (const document of metaDocuments.filter((candidate) => candidate.id !== "bag")) {
          reads.push({
            canonicalPath: "campaigns/{campaignId}/discovered/meta-document",
            sourcePath: document.path,
            documents: [document],
            discovered: true,
          });
        }
      } else {
        reads.push({
          canonicalPath,
          sourcePath: `${campaign.path}/${subcollection}`,
          documents: await collectionDocuments(`${campaign.path}/${subcollection}`),
          discovered: !known,
        });
      }
    }
  }
  return reads;
}

function mergeInventory(reads: CollectionRead[]) {
  const grouped = new Map<string, CollectionRead>();
  for (const read of reads) {
    const existing = grouped.get(read.canonicalPath);
    if (existing) existing.documents.push(...read.documents);
    else grouped.set(read.canonicalPath, { ...read, documents: [...read.documents] });
  }
  return [...grouped.values()]
    .sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath))
    .map(summarizeCollection);
}

async function readNeonSnapshot(databaseUrl: string): Promise<NeonReconciliationSnapshot> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [users, workspaces, campaigns, workspaceMembers, campaignMembers, characters, assignments, invitations, invitationCharacters, entityRows, bagCurrencies] = await Promise.all([
      sql`SELECT firebase_uid, id FROM users`,
      sql`SELECT workspaces.slug, workspaces.id, users.firebase_uid AS owner_uid FROM workspaces JOIN users ON users.id = workspaces.owner_user_id`,
      sql`SELECT slug, id, workspace_id, name, description, status, system, player_summary AS "playerSummary", gm_notes AS "gmNotes", start_date AS "startDate", end_date AS "endDate" FROM campaigns`,
      sql`SELECT workspace_id, firebase_uid, role FROM workspace_memberships JOIN users ON users.id = workspace_memberships.user_id`,
      sql`SELECT campaign_id, firebase_uid, role FROM campaign_memberships JOIN users ON users.id = campaign_memberships.user_id`,
      sql`SELECT campaign_id, id FROM characters`,
      sql`SELECT campaign_id, firebase_uid, character_id FROM character_assignments JOIN users ON users.id = character_assignments.user_id`,
      sql`SELECT id, workspace_id AS "workspaceId", campaign_id AS "campaignId", workspace_role AS "workspaceRole", campaign_role AS "campaignRole", status, expires_at AS "expiresAt", invited_by_user_id AS "invitedByUserId", accepted_by_user_id AS "acceptedByUserId", created_at AS "createdAt", accepted_at AS "acceptedAt" FROM invitations`,
      sql`SELECT invitation_id, character_id FROM invitation_character_assignments`,
      sql`SELECT 'sessions' AS domain, campaign_id, id FROM sessions UNION ALL SELECT 'items', campaign_id, id FROM items UNION ALL SELECT 'npcs', campaign_id, id FROM npcs UNION ALL SELECT 'locations', campaign_id, id FROM locations UNION ALL SELECT 'lore', campaign_id, id FROM lore`,
      sql`SELECT campaign_id FROM bag_currency`,
    ]);
    const campaignEntityKeys = new Map<string, Set<string>>();
    for (const row of entityRows as Array<{ domain: string; campaign_id: string; id: string }>) {
      const set = campaignEntityKeys.get(row.domain) ?? new Set<string>();
      set.add(`${row.campaign_id}\u0000${row.id}`);
      campaignEntityKeys.set(row.domain, set);
    }
    const characterIdsByCampaign = new Map<string, Set<string>>();
    for (const row of characters as Array<{ campaign_id: string; id: string }>) {
      const set = characterIdsByCampaign.get(row.campaign_id) ?? new Set<string>();
      set.add(row.id);
      characterIdsByCampaign.set(row.campaign_id, set);
    }
    const invitationCharacterIdsByInvitation = new Map<string, Set<string>>();
    for (const row of invitationCharacters as Array<{ invitation_id: string; character_id: string }>) {
      const set = invitationCharacterIdsByInvitation.get(row.invitation_id) ?? new Set<string>();
      set.add(row.character_id);
      invitationCharacterIdsByInvitation.set(row.invitation_id, set);
    }
    return {
      firebaseUids: new Set((users as Array<{ firebase_uid: string }>).map((row) => row.firebase_uid)),
      workspaceIdsBySlug: new Map((workspaces as Array<{ slug: string; id: string }>).map((row) => [row.slug, row.id])),
      workspaceOwnerUids: new Map((workspaces as Array<{ slug: string; id: string; owner_uid: string }>).map((row) => [row.id, row.owner_uid])),
      campaignBySlug: new Map((campaigns as Array<{ slug: string; id: string; workspace_id: string }>).map((row) => [row.slug, { id: row.id, workspaceId: row.workspace_id }])),
      campaignDetails: new Map((campaigns as Array<{ id: string; [key: string]: unknown }>).map((row) => [row.id, row])),
      workspaceMembershipRoles: new Map((workspaceMembers as Array<{ workspace_id: string; firebase_uid: string; role: string }>).map((row) => [`${row.workspace_id}\u0000${row.firebase_uid}`, row.role])),
      campaignMembershipRoles: new Map((campaignMembers as Array<{ campaign_id: string; firebase_uid: string; role: string }>).map((row) => [`${row.campaign_id}\u0000${row.firebase_uid}`, row.role])),
      characterIdsByCampaign,
      invitationCharacterIds: new Set((invitationCharacters as Array<{ invitation_id: string; character_id: string }>).map((row) => `${row.invitation_id}\u0000${row.character_id}`)),
      invitationById: new Map((invitations as Array<{ id: string; [key: string]: unknown }>).map((row) => [row.id, row])),
      invitationCharacterIdsByInvitation,
      assignmentKeys: new Set((assignments as Array<{ campaign_id: string; firebase_uid: string; character_id: string }>).map((row) => `${row.campaign_id}\u0000${row.firebase_uid}\u0000${row.character_id}`)),
      campaignEntityKeys,
      bagCampaignIds: new Set((bagCurrencies as Array<{ campaign_id: string }>).map((row) => row.campaign_id)),
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function summaryMarkdown(params: { target: string; project: string; inventory: ReturnType<typeof mergeInventory>; issues: number; primary: Record<string, number>; secondary: Record<string, number>; limiterRecords: number; outputDir: string }) {
  const rows = params.inventory.map((entry) => `| \`${entry.path}\` | ${entry.count} | ${entry.classification} |`).join("\n");
  const primaryRows = Object.entries(params.primary).map(([name, count]) => `| ${name} | ${count} |`).join("\n");
  const secondaryRows = Object.entries(params.secondary).map(([name, count]) => `| ${name} | ${count} |`).join("\n");
  return `# Firestore reconciliation report\n\n- Target: \`${params.target}\`\n- Firebase project: \`${params.project}\`\n- Sanitization: field names, types, counts, and opaque record references only. \`limiter-export.json\` intentionally contains opaque UID/HMAC subject keys required for a future approved import.\n- Unresolved records: ${params.issues}\n- Active limiter attempts exported: ${params.limiterRecords}\n\n## Primary record classifications\n\n| Classification | Records |\n| --- | ---: |\n${primaryRows}\n\n## Secondary findings (not mutually exclusive)\n\n| Finding | Records |\n| --- | ---: |\n${secondaryRows || "| None | 0 |"}\n\n## Collections\n\n| Collection | Count | Collection disposition |\n| --- | ---: | --- |\n${rows}\n\nReports are operational evidence and must not be committed. Output: \`${params.outputDir}\`.\n`;
}

const reads = await readInventory();
const inventory = mergeInventory(reads);
const outputTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = resolve(arguments_.outputRoot, arguments_.target, outputTimestamp);
await mkdir(outputDir, { recursive: true });

let reconciliation = {
  records: [],
  primaryClassificationTotals: {
    CANONICAL_IN_NEON: 0,
    NEEDS_RECONCILIATION: 0,
    ARCHIVE_ONLY: 0,
    EXPLICITLY_RETIRED: 0,
    UNRESOLVED: 0,
  },
  secondaryFindingTotals: {},
  unresolved: [],
};
if (arguments_.modes.includes("reconcile")) {
  reconciliation = classifyFirestoreRecords(reads, await readNeonSnapshot(environment.DATABASE_URL));
}
const limiterExport = arguments_.modes.includes("limiter-export") ? buildLimiterExport(reads) : undefined;

const artifacts: Record<string, unknown> = {
  "inventory.json": { target: arguments_.target, firebaseProject: arguments_.firebaseProject, collections: inventory },
  "reconciliation.json": {
    target: arguments_.target,
    records: reconciliation.records,
    primaryClassificationTotals: reconciliation.primaryClassificationTotals,
    secondaryFindingTotals: reconciliation.secondaryFindingTotals,
  },
  "unresolved.json": { target: arguments_.target, records: reconciliation.unresolved },
};
if (limiterExport) artifacts["limiter-export.json"] = limiterExport;
for (const [name, artifact] of Object.entries(artifacts)) {
  await writeFile(resolve(outputDir, name), `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
}
await writeFile(resolve(outputDir, "summary.md"), summaryMarkdown({ target: arguments_.target, project: arguments_.firebaseProject, inventory, issues: reconciliation.unresolved.length, primary: reconciliation.primaryClassificationTotals, secondary: reconciliation.secondaryFindingTotals, limiterRecords: limiterExport?.records.length ?? 0, outputDir }), { mode: 0o600 });
const reportHashes = Object.fromEntries(await Promise.all(Object.keys(artifacts).concat("summary.md").sort().map(async (name) => [name, `sha256:${sha256(await readFile(resolve(outputDir, name), "utf8"))}`])));
const manifest = buildManifest({
  target: arguments_.target,
  firebaseProject: arguments_.firebaseProject,
  executedAt: new Date().toISOString(),
  modes: arguments_.modes,
  collectionCounts: Object.fromEntries(inventory.map((entry) => [entry.path, entry.count])),
  unresolvedRecordCount: reconciliation.unresolved.length,
  reportHashes,
  environmentFile: arguments_.envFile ? basename(arguments_.envFile) : undefined,
  environmentSource: arguments_.environmentSource,
  database: arguments_.modes.includes("reconcile") ? safeDatabaseMetadata(environment.DATABASE_URL) : undefined,
});
await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

console.log(JSON.stringify({
  ok: true,
  target: arguments_.target,
  firebaseProject: arguments_.firebaseProject,
  modes: arguments_.modes,
  outputDirectory: outputDir,
  collectionCount: inventory.length,
  unresolvedRecordCount: reconciliation.unresolved.length,
  limiterRecordCount: limiterExport?.records.length ?? 0,
}, null, 2));
