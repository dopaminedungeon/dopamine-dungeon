import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import {
  buildLimiterExport,
  buildManifest,
  classifyFirestoreRecords,
  canonicalJson,
  opaqueRef,
  parseToolArguments,
  reconcileFirestoreRecords,
  sha256,
  summarizeCollection,
  selectProcessEnvironment,
  type CollectionRead,
  type NeonReconciliationSnapshot,
} from "./firestore-reconciliation/lib.js";

function read(path: string, documents: CollectionRead["documents"], discovered = false): CollectionRead {
  return { canonicalPath: path, sourcePath: path, documents, discovered };
}

function neon(overrides: Partial<NeonReconciliationSnapshot> = {}): NeonReconciliationSnapshot {
  return {
    firebaseUids: new Set(["uid-a"]),
    workspaceIdsBySlug: new Map([["workspace-a", "workspace-id-a"]]),
    campaignBySlug: new Map([["campaign-a", { id: "campaign-id-a", workspaceId: "workspace-id-a" }]]),
    workspaceMembershipRoles: new Map(),
    campaignMembershipRoles: new Map(),
    characterIdsByCampaign: new Map([["campaign-id-a", new Set(["character-a"])]]),
    invitationCharacterIds: new Set(),
    assignmentKeys: new Set(),
    campaignEntityKeys: new Map(),
    bagCampaignIds: new Set(),
    ...overrides,
  };
}

test("requires an explicit matching target confirmation and Firebase project", () => {
  assert.throws(() => parseToolArguments(["--target", "development", "--mode", "inventory", "--env-file", ".env.local", "--firebase-project", "project"]));
  assert.throws(() => parseToolArguments(["--target", "production", "--mode", "inventory", "--env-file", ".env.local", "--firebase-project", "project", "--confirm-production", "production"]));
  assert.deepEqual(
    parseToolArguments(["--target", "development", "--mode", "inventory,limiter-export", "--env-file", ".env.local", "--firebase-project", "project", "--confirm-development", "development"]).modes,
    ["inventory", "limiter-export"]
  );
  assert.throws(() => parseToolArguments(["--target", "development", "--mode", "inventory", "--firebase-project", "project", "--confirm-development", "development"]));
  assert.throws(() => parseToolArguments(["--target", "development", "--mode", "inventory", "--env-file", ".env.local", "--env-source", "process", "--firebase-project", "project", "--confirm-development", "development"]));
  const processArgs = parseToolArguments(["--target", "preview", "--mode", "inventory,reconcile", "--env-source", "process", "--firebase-project", "preview-project", "--confirm-preview", "preview"]);
  assert.equal(processArgs.environmentSource, "process");
  assert.equal(processArgs.envFile, undefined);
});

test("process environment selection is allowlisted and never serializes the environment", () => {
  const selected = selectProcessEnvironment({ FIREBASE_PROJECT_ID: "project", FIREBASE_CLIENT_EMAIL: "server@example.invalid", FIREBASE_PRIVATE_KEY: "private", DATABASE_URL: "postgresql://user:password@example/neondb", UNRELATED_SECRET: "do-not-copy" });
  assert.deepEqual(Object.keys(selected).sort(), ["DATABASE_URL", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_PROJECT_ID"]);
  assert.equal(selected["UNRELATED_SECRET"], undefined);
});

test("collection summaries describe structure without copying document values", () => {
  const summary = summarizeCollection(read("invitations", [{ path: "invitations/secret-token", id: "secret-token", data: { email: "private@example.invalid", createdAt: new Date(), campaignId: "campaign-a", gmNotes: "private" } }]));
  assert.equal(summary.count, 1);
  assert.equal(summary.fields.email.sensitive, true);
  assert.equal(summary.fields.createdAt.timestamps, 1);
  assert.equal(summary.fields.campaignId.likelyReference, true);
  assert.equal(JSON.stringify(summary).includes("private@example.invalid"), false);
  assert.equal(JSON.stringify(summary).includes("secret-token"), false);
});

test("reconciliation maps users only by Firebase UID, never email", () => {
  const issues = reconcileFirestoreRecords([
    read("users", [{ path: "users/uid-other", id: "uid-other", data: { email: "same@example.invalid" } }]),
  ], neon({ firebaseUids: new Set(["uid-a"]) }));
  assert.equal(issues.some((issue) => issue.code === "MISSING_NEON_COUNTERPART" && issue.domain === "users"), true);
  assert.equal(issues[0].sourceRef, opaqueRef("users/uid-other"));
});

test("reconciliation reports role, orphan, legacy CSV, workspace-only, and unknown paths", () => {
  const issues = reconcileFirestoreRecords([
    read("tenantMembers", [{ path: "tenantMembers/member-a", id: "member-a", data: { tenantId: "workspace-a", userId: "uid-a", role: "player" } }]),
    read("campaignMembers", [{ path: "campaignMembers/member-b", id: "member-b", data: { campaignId: "missing", userId: "uid-a", role: "player" } }]),
    read("invitations", [
      { path: "invitations/workspace-only", id: "workspace-only", data: { tenantId: "workspace-a" } },
      { path: "invitations/csv", id: "csv", data: { tenantId: "workspace-a", campaignId: "campaign-a", characterId: "character-a,missing" } },
    ]),
    read("campaigns/{campaignId}/discovered/unknown", [{ path: "campaigns/campaign-a/unknown/x", id: "x", data: {} }], true),
  ], neon({ workspaceMembershipRoles: new Map([["workspace-id-a\u0000uid-a", "owner"]]) }));
  assert.equal(issues.some((issue) => issue.code === "ROLE_MISMATCH"), true);
  assert.equal(issues.some((issue) => issue.code === "ORPHANED_RECORD" && issue.domain === "campaignMembers"), true);
  assert.equal(issues.some((issue) => issue.code === "WORKSPACE_ONLY_INVITATION"), true);
  assert.equal(issues.some((issue) => issue.code === "LEGACY_CSV_CHARACTER_IDS"), true);
  assert.equal(issues.some((issue) => issue.code === "UNEXPECTED_COLLECTION"), true);
});

test("limiter export retains only opaque keys and active valid timestamps deterministically", () => {
  const now = Date.UTC(2026, 7, 31, 12, 0, 0);
  const reads = [read("_authVerificationCooldowns", [{
    path: "_authVerificationCooldowns/firebase-uid", id: "firebase-uid", data: {
      attempts: [new Date(now - 1_000), new Date(now - 25 * 60 * 60 * 1_000), "invalid"],
    },
  }])];
  const first = buildLimiterExport(reads, now);
  const second = buildLimiterExport(reads, now);
  assert.equal(first.records.length, 1);
  assert.equal(first.records[0].subjectKey, "firebase-uid");
  assert.equal(first.records[0].scope, "verification");
  assert.equal(first.malformed.length, 1);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksum, `sha256:${sha256(canonicalJson({ horizonStart: first.horizonStart, horizonEnd: first.horizonEnd, records: first.records }))}`);
  assert.deepEqual(first.sourceCollectionCounts, { _authVerificationCooldowns: 1 });
});

test("manifest checksum is deterministic and excludes environment secrets", () => {
  const manifest = buildManifest({
    target: "development",
    firebaseProject: "project",
    environmentFile: ".env.local",
    executedAt: "2026-08-31T12:00:00.000Z",
    modes: ["reconcile", "inventory"],
    collectionCounts: { campaigns: 2, users: 1 },
    unresolvedRecordCount: 3,
    reportHashes: { "summary.md": "sha256:b", "inventory.json": "sha256:a" },
  });
  assert.equal(manifest.manifestChecksum, `sha256:${sha256(canonicalJson({ "inventory.json": "sha256:a", "summary.md": "sha256:b" }))}`);
  assert.equal(JSON.stringify(manifest).includes("DATABASE_URL"), false);
});

test("manifest identifies process source without a file path or secret values", () => {
  const manifest = buildManifest({ target: "preview", firebaseProject: "project", executedAt: "2026-08-31T12:00:00.000Z", modes: ["inventory"], collectionCounts: {}, unresolvedRecordCount: 0, reportHashes: {}, environmentSource: "process" });
  assert.equal(manifest.environmentSource, "process");
  assert.equal(manifest.environmentFile, undefined);
  assert.equal(JSON.stringify(manifest).includes("password"), false);
});

test("read-only tooling has no Firestore mutation API call", () => {
  const source = readFileSync(new URL("./firestore-reconciliation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:WriteBatch|BulkWriter|runTransaction)\b/);
  assert.doesNotMatch(source, /firestore\.(?:collection|doc)\([^\n]+\)\.(?:set|create|update|delete|add)\s*\(/);
  assert.doesNotMatch(source, /\.insert\s*\(/);
  const sqlStatements = [...source.matchAll(/sql`([^`]*)`/g)].map((match) => match[1].trim());
  assert.ok(sqlStatements.length > 0);
  sqlStatements.forEach((statement) => assert.match(statement, /^SELECT\b/i));
});

test("record classifications separate canonical state from secondary legacy findings", () => {
  const result = classifyFirestoreRecords([
    read("users", [{ path: "users/uid-a", id: "uid-a", data: { onboardingState: "complete" } }]),
    read("campaigns", [{ path: "campaigns/campaign-a", id: "campaign-a", data: { name: "Campaign", publicLore: "retired" } }]),
    read("mail", [{ path: "mail/m1", id: "m1", data: { message: { html: "private" } } }]),
    read("invitations", [{ path: "invitations/i1", id: "i1", data: { id: "neon-i1", campaignId: "campaign-a", campaignRole: "player", characterIds: ["character-a"] } }]),
  ], neon({
    campaignDetails: new Map([["campaign-id-a", { name: "Campaign", description: "", status: "active", system: "", playerSummary: "", gmNotes: "", startDate: "", endDate: "" }]]),
    invitationById: new Map([["neon-i1", { campaignId: "campaign-id-a", campaignRole: "player", status: "pending" }]]),
    invitationCharacterIdsByInvitation: new Map([["neon-i1", new Set(["character-a"])]]),
  }));
  const campaign = result.records.find((entry) => entry.domain === "campaigns");
  assert.equal(campaign?.primary, "CANONICAL_IN_NEON");
  assert.equal(campaign?.secondary.some((finding) => finding.code === "RETIRED_FIELD_PRESENT"), true);
  assert.equal(result.records.find((entry) => entry.domain === "users")?.primary, "CANONICAL_IN_NEON");
  assert.equal(result.records.find((entry) => entry.domain === "mail")?.primary, "ARCHIVE_ONLY");
  assert.equal(result.records.find((entry) => entry.domain === "invitations")?.primary, "CANONICAL_IN_NEON");
  assert.equal(result.primaryClassificationTotals.CANONICAL_IN_NEON, 3);
  assert.equal(result.primaryClassificationTotals.ARCHIVE_ONLY, 1);
  assert.equal(result.secondaryFindingTotals.RETIRED_FIELD_PRESENT, 1);
  assert.equal(result.unresolved.length, 0);
});

test("invitation mappings refuse email-only matches and compare relational characters", () => {
  const result = classifyFirestoreRecords([
    read("invitations", [
      { path: "invitations/no-id", id: "no-id", data: { campaignId: "campaign-a", email: "same@example.invalid", characterIds: ["character-a"] } },
      { path: "invitations/mapped", id: "mapped", data: { campaignId: "campaign-a", characterIds: ["character-a", "character-a"] } },
      { path: "invitations/csv", id: "csv", data: { campaignId: "campaign-a", characterId: "character-a,character-a" } },
      { path: "invitations/workspace-only", id: "workspace-only", data: { tenantId: "workspace-a" } },
    ]),
  ], neon({
    invitationById: new Map([["mapped", { campaignId: "campaign-id-a", campaignRole: "player", status: "pending" }]]),
    invitationCharacterIdsByInvitation: new Map([["mapped", new Set(["character-a"])]]),
  }));
  const unresolved = result.records.find((entry) => entry.sourceRef === opaqueRef("invitations/no-id"));
  assert.equal(unresolved?.primary, "UNRESOLVED");
  assert.equal(unresolved?.secondary.some((finding) => finding.code === "AMBIGUOUS_MAPPING"), true);
  const mapped = result.records.find((entry) => entry.sourceRef === opaqueRef("invitations/mapped"));
  assert.equal(mapped?.primary, "CANONICAL_IN_NEON");
  assert.equal(mapped?.secondary.some((finding) => finding.code === "DUPLICATE_RELATIONSHIP"), true);
  const csv = result.records.find((entry) => entry.sourceRef === opaqueRef("invitations/csv"));
  assert.equal(csv?.primary, "UNRESOLVED");
  assert.equal(csv?.secondary.some((finding) => finding.code === "LEGACY_COMPATIBILITY_REQUIRED"), true);
  assert.equal(result.records.find((entry) => entry.sourceRef === opaqueRef("invitations/workspace-only"))?.primary, "EXPLICITLY_RETIRED");
});

test("scope findings require a deterministic workspace mapping", () => {
  const result = classifyFirestoreRecords([
    read("tenants", [{ path: "tenants/missing", id: "missing", data: { createdBy: "uid-a" } }]),
    read("tenantMembers", [{ path: "tenantMembers/missing", id: "missing", data: { tenantId: "missing", userId: "uid-a", role: "player" } }]),
    read("campaigns", [{ path: "campaigns/campaign-a", id: "campaign-a", data: { tenantId: "missing" } }]),
    read("invitations", [{ path: "invitations/i1", id: "i1", data: { campaignId: "missing" } }]),
    read("characterAssignments", [{ path: "characterAssignments/a1", id: "a1", data: { campaignId: "missing", userId: "uid-a", characterId: "character-a" } }]),
  ], neon({
    workspaceIdsBySlug: new Map(),
    campaignBySlug: new Map([["campaign-a", { id: "campaign-id-a", workspaceId: "workspace-id-a" }]]),
    invitationById: new Map([["i1", { campaignId: "campaign-id-a", campaignRole: "player", status: "pending" }]]),
    workspaceOwnerUids: new Map([["workspace-id-a", "uid-other"]]),
  }));

  const missingTenant = result.records.find((entry) => entry.sourceRef === opaqueRef("tenants/missing"));
  assert.equal(missingTenant?.secondary.some((finding) => finding.code === "SCOPE_MISMATCH"), false);
  assert.equal(result.secondaryFindingTotals.ORPHANED_WORKSPACE, 1);
  assert.equal(result.records.filter((entry) => entry.secondary.some((finding) => finding.code === "SCOPE_MISMATCH")).length, 0);
});

test("mapped workspaces distinguish correct scope from a real owner mismatch", () => {
  const correct = classifyFirestoreRecords([
    read("tenants", [{ path: "tenants/workspace-a", id: "workspace-a", data: { createdBy: "uid-a" } }]),
  ], neon({ workspaceOwnerUids: new Map([["workspace-id-a", "uid-a"]]) }));
  assert.equal(correct.secondaryFindingTotals.SCOPE_MISMATCH ?? 0, 0);

  const mismatch = classifyFirestoreRecords([
    read("tenants", [{ path: "tenants/workspace-a", id: "workspace-a", data: { createdBy: "uid-other" } }]),
  ], neon({ workspaceOwnerUids: new Map([["workspace-id-a", "uid-a"]]) }));
  assert.equal(mismatch.secondaryFindingTotals.SCOPE_MISMATCH, 1);
});
