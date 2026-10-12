import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "vitest";

const browserFirestoreInitialization = /firebase\/firestore|getFirestore|connectFirestoreEmulator/;

function assertBrowserFirestoreInitializationRetired(source: string) {
  assert.doesNotMatch(source, browserFirestoreInitialization);
}

test("browser tenant, campaign, and bootstrap Firestore paths remain retired", () => {
  const retiredFiles = [
    "src/data/tenants/tenant.repo.ts",
    "src/data/campaigns/campaigns.repo.ts",
    "src/domain/bootstrap/workspaceBootstrap.service.ts",
  ];
  retiredFiles.forEach((file) => assert.equal(existsSync(file), false, `${file} must stay retired`));
  assertBrowserFirestoreInitializationRetired(readFileSync("src/firebase/firebase.ts", "utf8"));
});

test("negative control rejects a reintroduced browser Firestore initialization", () => {
  const reintroducedInitialization = "import { getFirestore } from 'firebase/firestore';";
  assert.throws(
    () => assertBrowserFirestoreInitializationRetired(reintroducedInitialization),
    { name: "AssertionError" },
  );
});
