import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import {
  hasProductionAuditClaim,
  validateProductionAuditTarget,
  PRODUCTION_FIREBASE_PROJECT,
  PRODUCTION_NEON_DATABASE,
  PRODUCTION_NEON_HOST,
} from "./productionReadOnlyAudit.js";

const valid = {
  VERCEL_ENV: "production",
  FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_PROJECT,
  FIREBASE_CLIENT_EMAIL: "audit@example.invalid",
  FIREBASE_PRIVATE_KEY: "temporary-test-key",
  DATABASE_URL: `postgres://audit:secret@${PRODUCTION_NEON_HOST}/${PRODUCTION_NEON_DATABASE}`,
};

test("Production audit target guard validates before datastore access", () => {
  assert.equal(validateProductionAuditTarget(valid).ok, true);
  assert.equal(validateProductionAuditTarget({ ...valid, VERCEL_ENV: "preview" }).ok, false);
  assert.equal(validateProductionAuditTarget({ ...valid, FIREBASE_PROJECT_ID: "wrong" }).ok, false);
  assert.equal(validateProductionAuditTarget({ ...valid, DATABASE_URL: "postgres://wrong/neondb" }).ok, false);
  assert.equal(validateProductionAuditTarget({ ...valid, DATABASE_URL: "not-a-url" }).ok, false);
});

test("audit authorization requires the explicit temporary Firebase claim", () => {
  assert.equal(hasProductionAuditClaim({ productionAudit: true }), true);
  assert.equal(hasProductionAuditClaim({ admin: true }), false);
  assert.equal(hasProductionAuditClaim({}), false);
});

test("temporary audit module has no mutation capability or sensitive output", () => {
  const source = readFileSync(new URL("./productionReadOnlyAudit.ts", import.meta.url), "utf8");
  for (const forbidden of ["INSERT", "UPDATE", "DELETE", ".insert(", ".update(", ".delete(", "BREVO_API_KEY", "JSON.stringify(process.env)"]) {
    assert.equal(source.includes(forbidden), false, `unexpected ${forbidden}`);
  }
  assert.match(source, /SELECT/);
  assert.match(source, /getFirestore/);
});

test("audit route is an existing-function branch and remains GET-only/authenticated", () => {
  const source = readFileSync(new URL("../../api/worldbuilding.ts", import.meta.url), "utf8");
  assert.match(source, /productionReadOnlyAudit/);
  assert.match(source, /verifyAuthHeader/);
  assert.match(source, /req\.method !== "GET"/);
  assert.doesNotMatch(source, /api\/production/);
});
