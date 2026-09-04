import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "vitest";

test("browser tenant, campaign, and bootstrap Firestore paths remain retired", () => {
  const retiredFiles = [
    "src/data/tenants/tenant.repo.ts",
    "src/data/campaigns/campaigns.repo.ts",
    "src/domain/bootstrap/workspaceBootstrap.service.ts",
  ];
  retiredFiles.forEach((file) => assert.equal(existsSync(file), false, `${file} must stay retired`));
  assert.doesNotMatch(readFileSync("src/firebase/firebase.ts", "utf8"), /firebase\/firestore|getFirestore|connectFirestoreEmulator/);
});
