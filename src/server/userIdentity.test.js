import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { test } from "vitest";

import { users } from "../../db/schema/users.ts";
import { buildUserIdentityUpsert } from "./userIdentityQuery.js";

const database = drizzle.mock();

test("user provisioning is an atomic upsert keyed by Firebase UID", () => {
  const query = buildUserIdentityUpsert(database, users, {
    firebaseUid: "firebase-user-1",
    email: "player@example.test",
    displayName: "Player",
    emailVerifiedAt: new Date("2026-08-18T08:00:00.000Z"),
  }, sql).toSQL();

  assert.match(query.sql, /^insert into "users"/);
  assert.match(
    query.sql,
    /on conflict \("firebase_uid"\) do update set "email" = \$5, "display_name" = \$6, "email_verified_at" = coalesce\("users"\."email_verified_at", excluded\.email_verified_at\)/
  );
  assert.match(query.sql, /returning/);
});

test("a recreated Firebase user with the same email remains a distinct identity", () => {
  const firstQuery = buildUserIdentityUpsert(database, users, {
    firebaseUid: "firebase-user-old",
    email: "recreated@example.test",
    displayName: null,
    emailVerifiedAt: new Date("2026-08-18T08:00:00.000Z"),
  }, sql).toSQL();
  const recreatedQuery = buildUserIdentityUpsert(database, users, {
    firebaseUid: "firebase-user-new",
    email: "recreated@example.test",
    displayName: null,
    emailVerifiedAt: new Date("2026-08-18T08:00:00.000Z"),
  }, sql).toSQL();

  assert.equal(firstQuery.params[0], "firebase-user-old");
  assert.equal(recreatedQuery.params[0], "firebase-user-new");
  assert.equal(firstQuery.params[1], recreatedQuery.params[1]);
  assert.doesNotMatch(recreatedQuery.sql, /conflict \("email"\)/);
});

test("verified-email reconciliation preserves the first verified timestamp", () => {
  const query = buildUserIdentityUpsert(database, users, {
    firebaseUid: "firebase-user-1",
    email: "player@example.test",
    displayName: "Player",
    emailVerifiedAt: new Date("2026-08-18T08:00:00.000Z"),
  }, sql).toSQL();

  assert.match(
    query.sql,
    /coalesce\("users"\."email_verified_at", excluded\.email_verified_at\)/
  );
});
