import assert from "node:assert/strict";
import { test } from "vitest";

import {
  applyGoogleOnlyVerificationEntry,
  buildGoogleOnlyVerificationManifest,
  type FirebaseMigrationUser,
  type GoogleOnlyVerificationRepository,
} from "./googleOnlyVerificationMigration.js";

const target = {
  target: "development" as const,
  firebaseProjectId: "development-firebase",
  neonHost: "development.neon.test",
  neonDatabase: "neondb",
};

function googleOnlyUser(overrides: Partial<FirebaseMigrationUser> = {}): FirebaseMigrationUser {
  return {
    uid: "firebase-google-only",
    email: "google-only@example.test",
    disabled: false,
    emailVerified: false,
    providerData: [{ providerId: "google.com" }],
    ...overrides,
  };
}

function repository(initial: { id?: string; emailVerifiedAt?: Date | null } = {}) {
  const state = {
    rows: initial.id === undefined
      ? []
      : [{ id: initial.id, emailVerifiedAt: initial.emailVerifiedAt ?? null }],
    findUids: [] as string[],
    timestampUpdates: [] as Array<{ uid: string; at: Date }>,
    failTimestampUpdate: false,
  };
  const value: GoogleOnlyVerificationRepository = {
    async findByFirebaseUid(uid) {
      state.findUids.push(uid);
      return state.rows.map((row) => ({ ...row }));
    },
    async setEmailVerifiedAtIfNull(uid, at) {
      state.timestampUpdates.push({ uid, at });
      if (state.failTimestampUpdate) throw new Error("neon unavailable");
      const row = state.rows[0];
      if (!row || row.emailVerifiedAt) return [];
      row.emailVerifiedAt = at;
      return [{ ...row }];
    },
  };
  return { repository: value, state };
}

function firebaseAdmin(users: FirebaseMigrationUser[]) {
  const state = {
    users: new Map(users.map((user) => [String(user.uid), { ...user }])),
    getUids: [] as string[],
    updates: [] as Array<[string, { emailVerified: true }]>,
    failUpdate: false,
    secondReadOverride: null as FirebaseMigrationUser | null,
    reads: 0,
  };
  return {
    admin: {
      async listUsers(_maxResults?: number, pageToken?: string) {
        if (!pageToken) return { users: users.slice(0, 1), pageToken: users.length > 1 ? "page-2" : undefined };
        return { users: users.slice(1) };
      },
      async getUser(uid: string) {
        state.getUids.push(uid);
        state.reads += 1;
        if (state.secondReadOverride && state.reads === 2) return state.secondReadOverride;
        const user = state.users.get(uid);
        if (!user) throw new Error("missing firebase user");
        return { ...user };
      },
      async updateUser(uid: string, properties: { emailVerified: true }) {
        state.updates.push([uid, properties]);
        if (state.failUpdate) throw new Error("firebase unavailable");
        const user = state.users.get(uid);
        if (!user) throw new Error("missing firebase user");
        user.emailVerified = true;
      },
    },
    state,
  };
}

test("dry run accepts only exact enabled Google-only Firebase identities mapped by UID", async () => {
  const { repository: neon, state: neonState } = repository({ id: "neon-google-only" });
  const users = [
    googleOnlyUser(),
    googleOnlyUser({ uid: "disabled", disabled: true }),
    googleOnlyUser({ uid: "missing-email", email: "" }),
    googleOnlyUser({ uid: "password", providerData: [{ providerId: "google.com" }, { providerId: "password" }] }),
    googleOnlyUser({ uid: "other-provider", providerData: [{ providerId: "github.com" }] }),
  ];
  const { admin } = firebaseAdmin(users);
  const { manifest, results } = await buildGoogleOnlyVerificationManifest({
    firebaseAdmin: admin,
    repository: neon,
    target,
    now: new Date("2026-09-04T12:00:00.000Z"),
  });

  assert.equal(manifest.candidates.length, 1);
  assert.deepEqual(manifest.candidates[0], {
    firebaseUid: "firebase-google-only",
    neonUserId: "neon-google-only",
    emailFingerprint: "fe4f9b6e2a8cae4e5fe83e39aaa16171cad2d83e887a2f684b571e97bf74f995",
    firebaseEmailVerified: false,
    neonEmailVerifiedAt: null,
  });
  assert.deepEqual(
    results.map((result) => result.status === "skipped" ? result.reason : result.status),
    ["eligible", "disabled", "missing-email", "provider-conflict", "provider-conflict"]
  );
  assert.doesNotMatch(JSON.stringify(manifest), /google-only@example\.test/);
  assert.deepEqual(neonState.findUids, ["firebase-google-only"]);
});

test("dry run skips missing and duplicate UID-keyed Neon mappings without any email lookup", async () => {
  const { repository: neon, state } = repository();
  const { admin } = firebaseAdmin([googleOnlyUser()]);
  const missing = await buildGoogleOnlyVerificationManifest({ firebaseAdmin: admin, repository: neon, target });
  assert.equal(missing.results[0]?.status, "skipped");
  assert.equal((missing.results[0] as { reason: string }).reason, "missing-neon-identity");

  state.rows.push(
    { id: "neon-one", emailVerifiedAt: null },
    { id: "neon-two", emailVerifiedAt: null }
  );
  const duplicate = await buildGoogleOnlyVerificationManifest({ firebaseAdmin: admin, repository: neon, target });
  assert.equal(duplicate.results[0]?.status, "skipped");
  assert.equal((duplicate.results[0] as { reason: string }).reason, "duplicate-neon-identity");
  assert.deepEqual(state.findUids, ["firebase-google-only", "firebase-google-only"]);
});

test("apply re-reads Firebase, updates only verification, and writes a null-only UID timestamp", async () => {
  const { repository: neon, state: neonState } = repository({ id: "neon-google-only" });
  const { admin, state: firebaseState } = firebaseAdmin([googleOnlyUser()]);
  const { manifest } = await buildGoogleOnlyVerificationManifest({ firebaseAdmin: admin, repository: neon, target });
  const result = await applyGoogleOnlyVerificationEntry({
    entry: manifest.candidates[0]!,
    firebaseAdmin: admin,
    repository: neon,
    now: new Date("2026-09-04T13:00:00.000Z"),
  });

  assert.deepEqual(result, {
    firebaseUid: "firebase-google-only",
    status: "completed",
    firebaseUpdated: true,
    neonUpdated: true,
    neonUserId: "neon-google-only",
  });
  assert.deepEqual(firebaseState.updates, [["firebase-google-only", { emailVerified: true }]]);
  assert.deepEqual(neonState.timestampUpdates.map(({ uid }) => uid), ["firebase-google-only"]);
  assert.equal(neonState.rows[0]?.emailVerifiedAt?.toISOString(), "2026-09-04T13:00:00.000Z");
});

test("apply preserves a historical timestamp and makes no Firebase or Neon mutation when already verified", async () => {
  const historical = new Date("2026-08-18T08:00:00.000Z");
  const { repository: neon, state: neonState } = repository({
    id: "neon-google-only",
    emailVerifiedAt: historical,
  });
  const { admin, state: firebaseState } = firebaseAdmin([googleOnlyUser({ emailVerified: true })]);
  const { manifest } = await buildGoogleOnlyVerificationManifest({ firebaseAdmin: admin, repository: neon, target });
  const result = await applyGoogleOnlyVerificationEntry({ entry: manifest.candidates[0]!, firebaseAdmin: admin, repository: neon });

  assert.equal(result.status, "completed");
  assert.deepEqual(firebaseState.updates, []);
  assert.deepEqual(neonState.timestampUpdates, []);
  assert.equal(neonState.rows[0]?.emailVerifiedAt, historical);
});

test("a Firebase success followed by Neon failure is partial and a retry fills only the remaining timestamp", async () => {
  const { repository: neon, state: neonState } = repository({ id: "neon-google-only" });
  const { admin, state: firebaseState } = firebaseAdmin([googleOnlyUser()]);
  const { manifest } = await buildGoogleOnlyVerificationManifest({ firebaseAdmin: admin, repository: neon, target });
  neonState.failTimestampUpdate = true;
  const partial = await applyGoogleOnlyVerificationEntry({ entry: manifest.candidates[0]!, firebaseAdmin: admin, repository: neon });
  assert.equal(partial.status, "partial");
  assert.equal(firebaseState.updates.length, 1);

  neonState.failTimestampUpdate = false;
  const retry = await applyGoogleOnlyVerificationEntry({ entry: manifest.candidates[0]!, firebaseAdmin: admin, repository: neon });
  assert.equal(retry.status, "completed");
  assert.equal(firebaseState.updates.length, 1);
  assert.equal(neonState.timestampUpdates.length, 2);
  assert.ok(neonState.rows[0]?.emailVerifiedAt);
});

test("Firebase update failure prevents every Neon timestamp mutation", async () => {
  const { repository: neon, state: neonState } = repository({ id: "neon-google-only" });
  const { admin, state: firebaseState } = firebaseAdmin([googleOnlyUser()]);
  const { manifest } = await buildGoogleOnlyVerificationManifest({ firebaseAdmin: admin, repository: neon, target });
  firebaseState.failUpdate = true;

  const result = await applyGoogleOnlyVerificationEntry({ entry: manifest.candidates[0]!, firebaseAdmin: admin, repository: neon });
  assert.deepEqual(result, {
    firebaseUid: "firebase-google-only",
    status: "failed",
    reason: "firebase-update-failed",
  });
  assert.deepEqual(neonState.timestampUpdates, []);
});

test("apply skips changed UID/email/provider state before mutation", async () => {
  const { repository: neon, state: neonState } = repository({ id: "neon-google-only" });
  const { admin, state: firebaseState } = firebaseAdmin([googleOnlyUser()]);
  const { manifest } = await buildGoogleOnlyVerificationManifest({ firebaseAdmin: admin, repository: neon, target });
  firebaseState.users.set("firebase-google-only", googleOnlyUser({ email: "changed@example.test" }));

  const result = await applyGoogleOnlyVerificationEntry({ entry: manifest.candidates[0]!, firebaseAdmin: admin, repository: neon });
  assert.deepEqual(result, {
    firebaseUid: "firebase-google-only",
    status: "skipped",
    reason: "state-changed",
  });
  assert.deepEqual(firebaseState.updates, []);
  assert.deepEqual(neonState.timestampUpdates, []);
});
