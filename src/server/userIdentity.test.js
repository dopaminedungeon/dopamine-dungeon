import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";

import { users } from "../../db/schema/users.ts";
import { buildUserIdentityUpsert } from "./userIdentityQuery.js";

const database = drizzle.mock();

test("user provisioning is an atomic upsert keyed by Firebase UID", () => {
  const query = buildUserIdentityUpsert(database, users, {
    firebaseUid: "firebase-user-1",
    email: "player@example.test",
    displayName: "Player",
  }).toSQL();

  assert.match(query.sql, /^insert into "users"/);
  assert.match(
    query.sql,
    /on conflict \("firebase_uid"\) do update set "email" = \$4, "display_name" = \$5/
  );
  assert.match(query.sql, /returning/);
});

test("a recreated Firebase user with the same email remains a distinct identity", () => {
  const firstQuery = buildUserIdentityUpsert(database, users, {
    firebaseUid: "firebase-user-old",
    email: "recreated@example.test",
    displayName: null,
  }).toSQL();
  const recreatedQuery = buildUserIdentityUpsert(database, users, {
    firebaseUid: "firebase-user-new",
    email: "recreated@example.test",
    displayName: null,
  }).toSQL();

  assert.equal(firstQuery.params[0], "firebase-user-old");
  assert.equal(recreatedQuery.params[0], "firebase-user-new");
  assert.equal(firstQuery.params[1], recreatedQuery.params[1]);
  assert.doesNotMatch(recreatedQuery.sql, /conflict \("email"\)/);
});
