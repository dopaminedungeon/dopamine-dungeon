import { createHash } from "node:crypto";

export const KNOWN_TOP_LEVEL_COLLECTIONS = [
  "users",
  "tenants",
  "tenantMembers",
  "campaigns",
  "campaignMembers",
  "invitations",
  "characterAssignments",
  "mail",
  "_authVerificationCooldowns",
  "_authPasswordRecoveryCooldowns",
  "_authPasswordRecoveryIpCooldowns",
] as const;

export const KNOWN_CAMPAIGN_SUBCOLLECTIONS = [
  "characters",
  "sessions",
  "items",
  "meta",
  "npcs",
  "locations",
  "lore",
] as const;

export type TargetEnvironment = "development" | "preview" | "production";
export type ToolMode = "inventory" | "reconcile" | "limiter-export";
export type EnvironmentSource = "file" | "process";
export type ReconciliationClass =
  | "CANONICAL_IN_NEON"
  | "NEEDS_RECONCILIATION"
  | "ARCHIVE_ONLY"
  | "EXPLICITLY_RETIRED"
  | "UNRESOLVED";

export type SecondaryFindingCode =
  | "MISSING_COUNTERPART"
  | "ORPHANED_USER"
  | "ORPHANED_WORKSPACE"
  | "ORPHANED_CAMPAIGN"
  | "ORPHANED_CHARACTER"
  | "ROLE_MISMATCH"
  | "SCOPE_MISMATCH"
  | "CANONICAL_FIELD_MISMATCH"
  | "RETIRED_FIELD_PRESENT"
  | "LEGACY_ONLY_FIELD"
  | "LEGACY_COMPATIBILITY_REQUIRED"
  | "MALFORMED_RELATIONSHIP"
  | "DUPLICATE_RELATIONSHIP"
  | "AMBIGUOUS_MAPPING"
  | "UNEXPECTED_COLLECTION"
  | "UNEXPECTED_SUBCOLLECTION"
  | "LIFECYCLE_MISMATCH";

export type RecordSecondaryFinding = {
  code: SecondaryFindingCode;
  detail: string;
};

export type RecordClassification = {
  domain: string;
  sourceRef: string;
  primary: ReconciliationClass;
  secondary: RecordSecondaryFinding[];
};

export type FirestoreDocumentRecord = {
  path: string;
  id: string;
  data: Record<string, unknown>;
};

export type CollectionRead = {
  canonicalPath: string;
  sourcePath: string;
  documents: FirestoreDocumentRecord[];
  discovered: boolean;
};

export type FieldShape = {
  types: string[];
  present: number;
  nulls: number;
  timestamps: number;
  likelyReference: boolean;
  sensitive: boolean;
};

export type CollectionInventory = {
  path: string;
  count: number;
  discovered: boolean;
  fields: Record<string, FieldShape>;
  classification: ReconciliationClass;
};

export type ReconciliationIssue = {
  code:
    | "MISSING_NEON_COUNTERPART"
    | "ROLE_MISMATCH"
    | "SCOPE_MISMATCH"
    | "ORPHANED_RECORD"
    | "LEGACY_CSV_CHARACTER_IDS"
    | "WORKSPACE_ONLY_INVITATION"
    | "UNEXPECTED_COLLECTION"
    | "LEGACY_ONLY_FIELDS";
  domain: string;
  sourceRef: string;
  detail: string;
};

export type NeonReconciliationSnapshot = {
  firebaseUids: Set<string>;
  workspaceIdsBySlug: Map<string, string>;
  campaignBySlug: Map<string, { id: string; workspaceId: string }>;
  workspaceOwnerUids?: Map<string, string>;
  campaignDetails?: Map<string, Record<string, unknown>>;
  workspaceMembershipRoles: Map<string, string>;
  campaignMembershipRoles: Map<string, string>;
  characterIdsByCampaign: Map<string, Set<string>>;
  invitationCharacterIds: Set<string>;
  invitationById?: Map<string, Record<string, unknown>>;
  invitationCharacterIdsByInvitation?: Map<string, Set<string>>;
  assignmentKeys: Set<string>;
  campaignEntityKeys: Map<string, Set<string>>;
  bagCampaignIds: Set<string>;
};

export type ParsedArguments = {
  target: TargetEnvironment;
  modes: ToolMode[];
  envFile?: string;
  environmentSource: EnvironmentSource;
  firebaseProject: string;
  outputRoot: string;
  confirmation: string;
};

export const RECONCILIATION_ENVIRONMENT_KEYS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "DATABASE_URL",
] as const;

export function selectProcessEnvironment(source: Record<string, string | undefined>) {
  return Object.fromEntries(RECONCILIATION_ENVIRONMENT_KEYS.map((key) => [key, source[key] ?? ""])) as Record<string, string>;
}

const SENSITIVE_FIELD = /(?:email|token|code|link|url|html|text|body|content|note|secret|password|fingerprint|ip|recipient)/i;
const REFERENCE_FIELD = /(?:^id$|Id$|By$|owner|member|campaign|tenant|workspace|user|character)/;
const TIMESTAMP_FIELD = /(?:At$|_at$|timestamp|date)/i;

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function opaqueRef(path: string) {
  return `sha256:${sha256(path).slice(0, 20)}`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function valueType(value: unknown): string {
  if (value === null) return "null";
  if (value instanceof Date) return "timestamp";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    return "timestamp";
  }
  return typeof value;
}

export function summarizeCollection(read: CollectionRead): CollectionInventory {
  const fields = new Map<string, FieldShape>();
  for (const document of read.documents) {
    for (const [name, value] of Object.entries(document.data)) {
      const existing = fields.get(name) ?? {
        types: [],
        present: 0,
        nulls: 0,
        timestamps: 0,
        likelyReference: REFERENCE_FIELD.test(name),
        sensitive: SENSITIVE_FIELD.test(name),
      };
      const type = valueType(value);
      if (!existing.types.includes(type)) existing.types.push(type);
      existing.present += 1;
      if (value === null) existing.nulls += 1;
      if (type === "timestamp" || TIMESTAMP_FIELD.test(name)) existing.timestamps += 1;
      fields.set(name, existing);
    }
  }

  return {
    path: read.canonicalPath,
    count: read.documents.length,
    discovered: read.discovered,
    fields: Object.fromEntries(
      [...fields.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, shape]) => [name, { ...shape, types: shape.types.sort() }])
    ),
    classification: classifyCollection(read.canonicalPath, read.discovered),
  };
}

export function classifyCollection(path: string, discovered: boolean): ReconciliationClass {
  if (discovered) return "UNRESOLVED";
  if (path === "mail") return "ARCHIVE_ONLY";
  if (path.startsWith("_auth")) return "ARCHIVE_ONLY";
  if (path === "invitations") return "NEEDS_RECONCILIATION";
  if (path === "characterAssignments") return "NEEDS_RECONCILIATION";
  if (path === "tenantMembers" || path === "campaignMembers") return "NEEDS_RECONCILIATION";
  if (path === "users" || path === "tenants" || path === "campaigns") return "NEEDS_RECONCILIATION";
  if (/^campaigns\/\{campaignId\}\/(characters|sessions|items|meta\/bag|npcs|locations|lore)$/.test(path)) {
    return "NEEDS_RECONCILIATION";
  }
  return "UNRESOLVED";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function key(...parts: string[]) {
  return parts.join("\u0000");
}

function addIssue(
  issues: ReconciliationIssue[],
  code: ReconciliationIssue["code"],
  domain: string,
  path: string,
  detail: string
) {
  issues.push({ code, domain, sourceRef: opaqueRef(path), detail });
}

function campaignIdFor(snapshot: NeonReconciliationSnapshot, firestoreCampaignId: string) {
  return snapshot.campaignBySlug.get(firestoreCampaignId)?.id;
}

export function reconcileFirestoreRecords(
  reads: CollectionRead[],
  neon: NeonReconciliationSnapshot
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const byCanonicalPath = new Map(reads.map((read) => [read.canonicalPath, read]));
  const users = byCanonicalPath.get("users")?.documents ?? [];
  const tenants = byCanonicalPath.get("tenants")?.documents ?? [];
  const campaigns = byCanonicalPath.get("campaigns")?.documents ?? [];

  for (const user of users) {
    if (!neon.firebaseUids.has(user.id)) {
      addIssue(issues, "MISSING_NEON_COUNTERPART", "users", user.path, "Firebase UID has no Neon user counterpart");
    }
    const legacyFields = Object.keys(user.data).filter((field) => !["email", "displayName", "photoURL", "reducedMotion", "emailVerifiedAt", "createdAt", "updatedAt"].includes(field));
    if (legacyFields.length) addIssue(issues, "LEGACY_ONLY_FIELDS", "users", user.path, `Legacy-only fields: ${legacyFields.sort().join(", ")}`);
  }

  for (const tenant of tenants) {
    if (!neon.workspaceIdsBySlug.has(tenant.id)) {
      addIssue(issues, "MISSING_NEON_COUNTERPART", "tenants", tenant.path, "Workspace slug has no Neon counterpart");
    }
  }

  for (const campaign of campaigns) {
    const neonCampaign = neon.campaignBySlug.get(campaign.id);
    if (!neonCampaign) {
      addIssue(issues, "MISSING_NEON_COUNTERPART", "campaigns", campaign.path, "Campaign slug has no Neon counterpart");
      continue;
    }
    const firestoreTenant = text(campaign.data.tenantId);
    const expectedWorkspace = firestoreTenant ? neon.workspaceIdsBySlug.get(firestoreTenant) : undefined;
    if (expectedWorkspace && expectedWorkspace !== neonCampaign.workspaceId) {
      addIssue(issues, "SCOPE_MISMATCH", "campaigns", campaign.path, "Firestore tenant scope does not match Neon campaign workspace");
    }
  }

  for (const member of byCanonicalPath.get("tenantMembers")?.documents ?? []) {
    const workspaceId = neon.workspaceIdsBySlug.get(text(member.data.tenantId));
    const uid = text(member.data.userId);
    if (!workspaceId || !neon.firebaseUids.has(uid)) {
      addIssue(issues, "ORPHANED_RECORD", "tenantMembers", member.path, "Workspace membership references a missing workspace or Firebase UID");
      continue;
    }
    const expectedRole = text(member.data.role);
    const actualRole = neon.workspaceMembershipRoles.get(key(workspaceId, uid));
    if (!actualRole) addIssue(issues, "MISSING_NEON_COUNTERPART", "tenantMembers", member.path, "Workspace membership has no Neon counterpart");
    else if (expectedRole && expectedRole !== actualRole) addIssue(issues, "ROLE_MISMATCH", "tenantMembers", member.path, "Workspace membership role differs from Neon");
  }

  for (const member of byCanonicalPath.get("campaignMembers")?.documents ?? []) {
    const campaignId = campaignIdFor(neon, text(member.data.campaignId));
    const uid = text(member.data.userId);
    if (!campaignId || !neon.firebaseUids.has(uid)) {
      addIssue(issues, "ORPHANED_RECORD", "campaignMembers", member.path, "Campaign membership references a missing campaign or Firebase UID");
      continue;
    }
    const expectedRole = text(member.data.role);
    const actualRole = neon.campaignMembershipRoles.get(key(campaignId, uid));
    if (!actualRole) addIssue(issues, "MISSING_NEON_COUNTERPART", "campaignMembers", member.path, "Campaign membership has no Neon counterpart");
    else if (expectedRole && expectedRole !== actualRole) addIssue(issues, "ROLE_MISMATCH", "campaignMembers", member.path, "Campaign membership role differs from Neon");
  }

  for (const invitation of byCanonicalPath.get("invitations")?.documents ?? []) {
    const campaignSlug = text(invitation.data.campaignId);
    if (!campaignSlug) addIssue(issues, "WORKSPACE_ONLY_INVITATION", "invitations", invitation.path, "Workspace-only invitation is explicitly retired historical input");
    else if (!campaignIdFor(neon, campaignSlug)) addIssue(issues, "ORPHANED_RECORD", "invitations", invitation.path, "Invitation references no Neon campaign");
    const characterIds = invitation.data.characterIds ?? invitation.data.characterId;
    const normalized = Array.isArray(characterIds) ? characterIds.map(text) : text(characterIds).split(",").map((value) => value.trim()).filter(Boolean);
    if (typeof invitation.data.characterId === "string" && invitation.data.characterId.includes(",")) {
      addIssue(issues, "LEGACY_CSV_CHARACTER_IDS", "invitations", invitation.path, "Legacy multi-character CSV requires typed relationship reconciliation");
    }
    const campaignId = campaignIdFor(neon, campaignSlug);
    if (campaignId) {
      const characters = neon.characterIdsByCampaign.get(campaignId) ?? new Set<string>();
      if (normalized.some((id) => !characters.has(id))) addIssue(issues, "ORPHANED_RECORD", "invitations", invitation.path, "Invitation references a missing or cross-campaign character");
    }
  }

  for (const assignment of byCanonicalPath.get("characterAssignments")?.documents ?? []) {
    const campaignId = campaignIdFor(neon, text(assignment.data.campaignId));
    const uid = text(assignment.data.userId);
    const characterId = text(assignment.data.characterId);
    if (!campaignId || !neon.firebaseUids.has(uid) || !characterId) {
      addIssue(issues, "ORPHANED_RECORD", "characterAssignments", assignment.path, "Assignment references a missing campaign, Firebase UID, or character");
      continue;
    }
    if (!(neon.characterIdsByCampaign.get(campaignId) ?? new Set<string>()).has(characterId)) {
      addIssue(issues, "SCOPE_MISMATCH", "characterAssignments", assignment.path, "Assignment character is absent from the resolved campaign");
    }
    if (!neon.assignmentKeys.has(key(campaignId, uid, characterId))) {
      addIssue(issues, "MISSING_NEON_COUNTERPART", "characterAssignments", assignment.path, "Character assignment has no Neon counterpart");
    }
  }

  for (const read of reads.filter((candidate) => candidate.canonicalPath.startsWith("campaigns/{campaignId}/"))) {
    const pathParts = read.canonicalPath.split("/");
    const domain = pathParts[pathParts.length - 1] ?? "unknown";
    for (const document of read.documents) {
      const firestoreCampaignId = document.path.split("/")[1] ?? "";
      const campaignId = campaignIdFor(neon, firestoreCampaignId);
      if (!campaignId) {
        addIssue(issues, "ORPHANED_RECORD", domain, document.path, "Campaign subcollection belongs to a Firestore campaign with no Neon counterpart");
        continue;
      }
      if (domain === "bag") {
        if (!neon.bagCampaignIds.has(campaignId)) addIssue(issues, "MISSING_NEON_COUNTERPART", "bag", document.path, "Firestore bag has no Neon bag-currency counterpart");
        continue;
      }
      if (domain === "characters") {
        if (!(neon.characterIdsByCampaign.get(campaignId) ?? new Set<string>()).has(document.id)) {
          addIssue(issues, "MISSING_NEON_COUNTERPART", "characters", document.path, "Character has no same-campaign Neon counterpart");
        }
        continue;
      }
      const neonDomain = domain === "npcs" || domain === "locations" || domain === "lore" || domain === "sessions" || domain === "items" ? domain : undefined;
      if (neonDomain && !(neon.campaignEntityKeys.get(neonDomain) ?? new Set<string>()).has(key(campaignId, document.id))) {
        addIssue(issues, "MISSING_NEON_COUNTERPART", neonDomain, document.path, "Campaign entity has no same-campaign Neon counterpart");
      }
    }
  }

  for (const read of reads.filter((candidate) => candidate.discovered)) {
    for (const document of read.documents) addIssue(issues, "UNEXPECTED_COLLECTION", "discovered", document.path, `Unexpected collection path: ${read.canonicalPath}`);
  }

  return issues.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

const RETIRED_CAMPAIGN_FIELDS = [
  "publicLore",
  "privateLore",
  "hiddenFactions",
  "hiddenTimelines",
  "metaCommentary",
  "tags",
];

const RETAINED_CAMPAIGN_FIELDS = [
  "name",
  "description",
  "status",
  "system",
  "playerSummary",
  "gmNotes",
  "startDate",
  "endDate",
];

function addRecordFinding(
  record: RecordClassification,
  code: SecondaryFindingCode,
  detail: string
) {
  if (!record.secondary.some((finding) => finding.code === code && finding.detail === detail)) {
    record.secondary.push({ code, detail });
  }
}

function record(
  domain: string,
  path: string,
  primary: ReconciliationClass
): RecordClassification {
  return { domain, sourceRef: opaqueRef(path), primary, secondary: [] };
}

function sortedRecord(recordValue: RecordClassification) {
  recordValue.secondary.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return recordValue;
}

function campaignDetailsFor(snapshot: NeonReconciliationSnapshot, campaignId: string) {
  return snapshot.campaignDetails?.get(campaignId) ?? {};
}

function invitationCharacterIds(data: Record<string, unknown>) {
  const raw = data.characterIds ?? data.characterId;
  if (Array.isArray(raw)) return raw.map(text).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((value) => value.trim()).filter(Boolean);
  return [];
}

export type ReconciliationResult = {
  records: RecordClassification[];
  primaryClassificationTotals: Record<ReconciliationClass, number>;
  secondaryFindingTotals: Record<string, number>;
  unresolved: RecordClassification[];
};

export function classifyFirestoreRecords(
  reads: CollectionRead[],
  neon: NeonReconciliationSnapshot
): ReconciliationResult {
  const records: RecordClassification[] = [];
  const byPath = new Map(reads.map((read) => [read.canonicalPath, read]));
  const users = byPath.get("users")?.documents ?? [];
  const tenants = byPath.get("tenants")?.documents ?? [];
  const campaigns = byPath.get("campaigns")?.documents ?? [];
  const add = (value: RecordClassification) => records.push(sortedRecord(value));

  for (const source of users) {
    const value = record("users", source.path, source.id ? (neon.firebaseUids.has(source.id) ? "CANONICAL_IN_NEON" : "NEEDS_RECONCILIATION") : "UNRESOLVED");
    for (const field of Object.keys(source.data).filter((fieldName) => ["onboardingState", "lastLoginAt", "normalizedEmail"].includes(fieldName))) {
      addRecordFinding(value, "LEGACY_ONLY_FIELD", `Legacy-only user field present: ${field}`);
    }
    add(value);
  }

  for (const source of tenants) {
    const workspaceId = neon.workspaceIdsBySlug.get(source.id);
    const value = record("tenants", source.path, workspaceId ? "CANONICAL_IN_NEON" : "NEEDS_RECONCILIATION");
    const ownerUid = text(source.data.createdBy);
    if (workspaceId && ownerUid && neon.workspaceOwnerUids && neon.workspaceOwnerUids.get(workspaceId) !== ownerUid) {
      addRecordFinding(value, "SCOPE_MISMATCH", "Workspace owner Firebase UID differs from Neon owner");
    }
    if (Object.prototype.hasOwnProperty.call(source.data, "description")) {
      addRecordFinding(value, "LEGACY_ONLY_FIELD", "Legacy workspace description is retained as archive evidence");
    }
    add(value);
  }

  for (const source of campaigns) {
    const mapped = neon.campaignBySlug.get(source.id);
    const value = record("campaigns", source.path, mapped ? "CANONICAL_IN_NEON" : "NEEDS_RECONCILIATION");
    if (!mapped) addRecordFinding(value, "MISSING_COUNTERPART", "Campaign slug has no Neon counterpart");
    const expectedWorkspace = neon.workspaceIdsBySlug.get(text(source.data.tenantId));
    if (mapped && expectedWorkspace && expectedWorkspace !== mapped.workspaceId) addRecordFinding(value, "SCOPE_MISMATCH", "Campaign workspace scope differs from Neon");
    const details = campaignDetailsFor(neon, mapped?.id ?? "");
    for (const field of RETAINED_CAMPAIGN_FIELDS) {
      if (mapped && Object.prototype.hasOwnProperty.call(source.data, field) && String(source.data[field] ?? "") !== String(details[field] ?? "")) {
        addRecordFinding(value, "CANONICAL_FIELD_MISMATCH", `Retained campaign field differs: ${field}`);
      }
    }
    for (const field of RETIRED_CAMPAIGN_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(source.data, field)) addRecordFinding(value, "RETIRED_FIELD_PRESENT", `Retired campaign field present: ${field}`);
    }
    add(value);
  }

  for (const source of byPath.get("tenantMembers")?.documents ?? []) {
    const workspaceId = neon.workspaceIdsBySlug.get(text(source.data.tenantId));
    const uid = text(source.data.userId);
    const value = record("tenantMembers", source.path, !workspaceId || !neon.firebaseUids.has(uid) ? "UNRESOLVED" : "NEEDS_RECONCILIATION");
    if (!workspaceId) addRecordFinding(value, "ORPHANED_WORKSPACE", "Workspace does not resolve by deterministic slug");
    if (!neon.firebaseUids.has(uid)) addRecordFinding(value, "ORPHANED_USER", "Firebase UID has no Neon user counterpart");
    if (workspaceId && neon.firebaseUids.has(uid)) {
      const role = neon.workspaceMembershipRoles.get(key(workspaceId, uid));
      if (!role) addRecordFinding(value, "MISSING_COUNTERPART", "Workspace membership has no Neon counterpart");
      else if (text(source.data.role) && text(source.data.role) !== role) addRecordFinding(value, "ROLE_MISMATCH", "Workspace membership role differs from Neon");
      else value.primary = "CANONICAL_IN_NEON";
    }
    add(value);
  }

  for (const source of byPath.get("campaignMembers")?.documents ?? []) {
    const campaignId = campaignIdFor(neon, text(source.data.campaignId));
    const uid = text(source.data.userId);
    const value = record("campaignMembers", source.path, !campaignId || !neon.firebaseUids.has(uid) ? "UNRESOLVED" : "NEEDS_RECONCILIATION");
    if (!campaignId) addRecordFinding(value, "ORPHANED_CAMPAIGN", "Campaign does not resolve by deterministic slug");
    if (!neon.firebaseUids.has(uid)) addRecordFinding(value, "ORPHANED_USER", "Firebase UID has no Neon user counterpart");
    if (campaignId && neon.firebaseUids.has(uid)) {
      const role = neon.campaignMembershipRoles.get(key(campaignId, uid));
      if (!role) addRecordFinding(value, "MISSING_COUNTERPART", "Campaign membership has no Neon counterpart");
      else if (text(source.data.role) && text(source.data.role) !== role) addRecordFinding(value, "ROLE_MISMATCH", "Campaign membership role differs from Neon");
      else value.primary = "CANONICAL_IN_NEON";
    }
    add(value);
  }

  for (const source of byPath.get("invitations")?.documents ?? []) {
    const campaignSlug = text(source.data.campaignId);
    const value = record("invitations", source.path, campaignSlug ? "UNRESOLVED" : "EXPLICITLY_RETIRED");
    if (!campaignSlug) {
      addRecordFinding(value, "UNEXPECTED_COLLECTION", "Workspace-only invitation is explicitly retired historical input");
      add(value);
      continue;
    }
    const campaignId = campaignIdFor(neon, campaignSlug);
    if (!campaignId) addRecordFinding(value, "ORPHANED_CAMPAIGN", "Invitation campaign does not resolve deterministically");
    const firestoreCharacters = invitationCharacterIds(source.data);
    if (new Set(firestoreCharacters).size !== firestoreCharacters.length) addRecordFinding(value, "DUPLICATE_RELATIONSHIP", "Firestore invitation character list contains duplicate IDs");
    if (typeof source.data.characterId === "string" && source.data.characterId.includes(",")) addRecordFinding(value, "LEGACY_COMPATIBILITY_REQUIRED", "Legacy CSV character IDs remain present");
    const invitationId = [source.id, text(source.data.id)].find((candidate) => candidate && neon.invitationById?.has(candidate));
    if (!invitationId || !neon.invitationById) {
      addRecordFinding(value, "AMBIGUOUS_MAPPING", "No exact Firestore document/record ID maps to a Neon invitation; email is not used");
      add(value);
      continue;
    }
    const canonical = neon.invitationById.get(invitationId) ?? {};
    value.primary = "CANONICAL_IN_NEON";
    if (campaignId && canonical.campaignId !== campaignId) addRecordFinding(value, "SCOPE_MISMATCH", "Invitation campaign differs from Neon");
    if (text(source.data.campaignRole) && text(source.data.campaignRole) !== text(canonical.campaignRole)) addRecordFinding(value, "ROLE_MISMATCH", "Invitation campaign role differs from Neon");
    if (text(source.data.status) && text(source.data.status) !== text(canonical.status)) addRecordFinding(value, "LIFECYCLE_MISMATCH", "Invitation lifecycle status differs from Neon");
    const canonicalCharacters = neon.invitationCharacterIdsByInvitation?.get(invitationId) ?? new Set<string>();
    const campaignCharacters = campaignId ? neon.characterIdsByCampaign.get(campaignId) ?? new Set<string>() : new Set<string>();
    if (firestoreCharacters.some((characterId) => !campaignCharacters.has(characterId))) addRecordFinding(value, "MALFORMED_RELATIONSHIP", "Invitation character reference is missing or cross-campaign");
    if (firestoreCharacters.length !== canonicalCharacters.size || firestoreCharacters.some((characterId) => !canonicalCharacters.has(characterId))) {
      addRecordFinding(value, "MISSING_COUNTERPART", "Invitation character relationships differ from Neon relational rows");
    }
    add(value);
  }

  for (const source of byPath.get("characterAssignments")?.documents ?? []) {
    const campaignId = campaignIdFor(neon, text(source.data.campaignId));
    const uid = text(source.data.userId);
    const characterId = text(source.data.characterId);
    const value = record("characterAssignments", source.path, campaignId && neon.firebaseUids.has(uid) && characterId ? "NEEDS_RECONCILIATION" : "UNRESOLVED");
    if (!campaignId) addRecordFinding(value, "ORPHANED_CAMPAIGN", "Assignment campaign does not resolve deterministically");
    if (!neon.firebaseUids.has(uid)) addRecordFinding(value, "ORPHANED_USER", "Assignment Firebase UID has no Neon user counterpart");
    if (campaignId && !(neon.characterIdsByCampaign.get(campaignId) ?? new Set<string>()).has(characterId)) addRecordFinding(value, "ORPHANED_CHARACTER", "Assignment character does not belong to the campaign");
    if (campaignId && neon.assignmentKeys.has(key(campaignId, uid, characterId))) value.primary = "CANONICAL_IN_NEON";
    else if (campaignId && neon.firebaseUids.has(uid) && characterId) addRecordFinding(value, "MISSING_COUNTERPART", "Assignment has no Neon counterpart");
    add(value);
  }

  for (const source of reads.filter((read) => read.canonicalPath === "mail" || read.canonicalPath.startsWith("_auth"))) {
    for (const document of source.documents) add(record(source.canonicalPath, document.path, "ARCHIVE_ONLY"));
  }

  for (const source of reads.filter((read) => read.canonicalPath.startsWith("campaigns/{campaignId}/"))) {
    const pathParts = source.canonicalPath.split("/");
    const domain = pathParts[pathParts.length - 1] ?? "unknown";
    for (const document of source.documents) {
      const campaignId = campaignIdFor(neon, document.path.split("/")[1] ?? "");
      const value = record(domain, document.path, campaignId ? "NEEDS_RECONCILIATION" : "UNRESOLVED");
      if (!campaignId) addRecordFinding(value, "ORPHANED_CAMPAIGN", "Campaign subcollection has no deterministic Neon campaign");
      else if (domain === "characters") {
        if ((neon.characterIdsByCampaign.get(campaignId) ?? new Set<string>()).has(document.id)) value.primary = "CANONICAL_IN_NEON";
        else addRecordFinding(value, "MISSING_COUNTERPART", "Character has no same-campaign Neon counterpart");
      } else if (domain === "bag") {
        if (neon.bagCampaignIds.has(campaignId)) value.primary = "CANONICAL_IN_NEON";
        else addRecordFinding(value, "MISSING_COUNTERPART", "Bag has no Neon counterpart");
      } else if ((neon.campaignEntityKeys.get(domain) ?? new Set<string>()).has(key(campaignId, document.id))) value.primary = "CANONICAL_IN_NEON";
      else addRecordFinding(value, "MISSING_COUNTERPART", "Campaign entity has no same-campaign Neon counterpart");
      add(value);
    }
  }

  for (const source of reads.filter((read) => read.discovered)) {
    for (const document of source.documents) {
      const value = record("discovered", document.path, "UNRESOLVED");
      addRecordFinding(value, "UNEXPECTED_COLLECTION", `Unexpected collection path: ${source.canonicalPath}`);
      add(value);
    }
  }

  const primaryClassificationTotals = {
    CANONICAL_IN_NEON: 0,
    NEEDS_RECONCILIATION: 0,
    ARCHIVE_ONLY: 0,
    EXPLICITLY_RETIRED: 0,
    UNRESOLVED: 0,
  } as Record<ReconciliationClass, number>;
  const secondaryFindingTotals: Record<string, number> = {};
  for (const value of records) {
    primaryClassificationTotals[value.primary] += 1;
    for (const finding of value.secondary) secondaryFindingTotals[finding.code] = (secondaryFindingTotals[finding.code] ?? 0) + 1;
  }
  return {
    records: records.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
    primaryClassificationTotals,
    secondaryFindingTotals: Object.fromEntries(Object.entries(secondaryFindingTotals).sort(([left], [right]) => left.localeCompare(right))),
    unresolved: records.filter((value) => value.primary === "NEEDS_RECONCILIATION" || value.primary === "UNRESOLVED"),
  };
}

function toMillis(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (value && typeof value === "object") {
    const candidate = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
    if (typeof candidate.toDate === "function") return candidate.toDate().getTime();
  }
  return undefined;
}

function limiterScopeFor(path: string) {
  if (path === "_authVerificationCooldowns") return "verification" as const;
  if (path === "_authPasswordRecoveryCooldowns") return "recovery_email" as const;
  if (path === "_authPasswordRecoveryIpCooldowns") return "recovery_ip" as const;
  return undefined;
}

export type LimiterExportRecord = {
  scope: "verification" | "recovery_email" | "recovery_ip";
  subjectKey: string;
  occurredAt: string;
  sourceCollection: string;
};

export function buildManifest(params: {
  target: TargetEnvironment;
  firebaseProject: string;
  executedAt: string;
  modes: ToolMode[];
  collectionCounts: Record<string, number>;
  unresolvedRecordCount: number;
  reportHashes: Record<string, string>;
  database?: { hostname: string; database: string };
  environmentFile?: string;
  environmentSource?: EnvironmentSource;
}) {
  const reportHashes = Object.fromEntries(Object.entries(params.reportHashes).sort(([left], [right]) => left.localeCompare(right)));
  return {
    tool: "firestore-reconciliation",
    toolVersion: "1",
    target: params.target,
    firebaseProject: params.firebaseProject,
    environmentFile: params.environmentFile,
    environmentSource: params.environmentSource ?? "file",
    executedAt: params.executedAt,
    modes: [...params.modes].sort(),
    database: params.database,
    sanitization: "field names/types/counts and opaque record references; limiter export contains only opaque subject keys and timestamps",
    collectionCounts: Object.fromEntries(Object.entries(params.collectionCounts).sort(([left], [right]) => left.localeCompare(right))),
    unresolvedRecordCount: params.unresolvedRecordCount,
    reportHashes,
    manifestChecksum: `sha256:${sha256(canonicalJson(reportHashes))}`,
  };
}

export function buildLimiterExport(reads: CollectionRead[], now = Date.now()) {
  const lowerBound = now - 24 * 60 * 60 * 1000;
  const records: LimiterExportRecord[] = [];
  const malformed: Array<{ sourceRef: string; sourceCollection: string; reason: string }> = [];
  for (const read of reads) {
    const scope = limiterScopeFor(read.canonicalPath);
    if (!scope) continue;
    for (const document of read.documents) {
      const rawAttempts = document.data.attempts;
      const candidates = Array.isArray(rawAttempts)
        ? rawAttempts
        : rawAttempts === undefined && document.data.lastSentAt !== undefined
          ? [document.data.lastSentAt]
          : [];
      if (rawAttempts !== undefined && !Array.isArray(rawAttempts)) {
        malformed.push({ sourceRef: opaqueRef(document.path), sourceCollection: read.canonicalPath, reason: "attempts is not an array" });
        continue;
      }
      for (const value of candidates) {
        const milliseconds = toMillis(value);
        if (milliseconds === undefined) {
          malformed.push({ sourceRef: opaqueRef(document.path), sourceCollection: read.canonicalPath, reason: "attempt timestamp is invalid" });
          continue;
        }
        if (milliseconds > lowerBound && milliseconds <= now) {
          records.push({ scope, subjectKey: document.id, occurredAt: new Date(milliseconds).toISOString(), sourceCollection: read.canonicalPath });
        }
      }
    }
  }
  const deterministicRecords = records.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const payload = { horizonStart: new Date(lowerBound).toISOString(), horizonEnd: new Date(now).toISOString(), records: deterministicRecords };
  return {
    ...payload,
    sourceCollectionCounts: Object.fromEntries(
      [...new Set(deterministicRecords.map((record) => record.sourceCollection))]
        .sort()
        .map((sourceCollection) => [sourceCollection, deterministicRecords.filter((record) => record.sourceCollection === sourceCollection).length])
    ),
    checksum: `sha256:${sha256(canonicalJson(payload))}`,
    malformed: malformed.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
  };
}

export function parseToolArguments(argv: string[]): ParsedArguments {
  const values = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    values.set(name, [...(values.get(name) ?? []), value]);
    index += 1;
  }
  const one = (name: string) => {
    const entries = values.get(name) ?? [];
    if (entries.length !== 1) throw new Error(`Require exactly one --${name}`);
    return entries[0];
  };
  const target = one("target") as TargetEnvironment;
  if (!(["development", "preview", "production"] as string[]).includes(target)) throw new Error("--target must be development, preview, or production");
  const modes = one("mode").split(",").map((mode) => mode.trim()) as ToolMode[];
  if (!modes.length || modes.some((mode) => !(["inventory", "reconcile", "limiter-export"] as string[]).includes(mode))) {
    throw new Error("--mode must contain inventory, reconcile, and/or limiter-export");
  }
  const confirmation = one(`confirm-${target}`);
  const expectedConfirmation = target === "production" ? "READ_PRODUCTION_FIRESTORE" : target;
  if (confirmation !== expectedConfirmation) throw new Error(`--confirm-${target} must equal ${expectedConfirmation}`);
  const envFile = values.get("env-file") ?? [];
  const envSource = values.get("env-source") ?? [];
  if (envFile.length + envSource.length !== 1) throw new Error("Select exactly one configuration source: --env-file or --env-source process");
  if (envSource.length === 1 && envSource[0] !== "process") throw new Error("--env-source must equal process");
  return {
    target,
    modes: [...new Set(modes)].sort(),
    envFile: envFile[0],
    environmentSource: envSource.length === 1 ? "process" : "file",
    firebaseProject: one("firebase-project"),
    outputRoot: values.get("output-root")?.[0] ?? "reports/firestore-reconciliation",
    confirmation,
  };
}
