import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

test("legacy Firestore membership, invitation, and assignment application paths are retired", () => {
  const retiredPaths = [
    "data/tenantMembers/tenantMembers.repo.ts",
    "data/campaignMembers/campaignMembers.repo.ts",
    "data/invitations/invitations.repo.ts",
    "data/characterAssignments/characterAssignments.repo.ts",
    "domain/invitations/invitation.service.ts",
    "services/workspaceMembers.service.ts",
  ];

  retiredPaths.forEach((relativePath) => {
    assert.equal(
      existsSync(new URL(relativePath, new URL(`file://${sourceRoot}/`))),
      false,
      `${relativePath} must not be restored as an application persistence path`
    );
  });
});

test("authentication-email runtime no longer depends on Firestore limiter state", () => {
  const runtimePaths = [
    "auth.ts",
    "verificationEmail.ts",
    "passwordRecoveryEmail.ts",
    "neonAuthEmailRateLimit.ts",
  ];
  const forbidden = [
    "firebase-admin/firestore",
    "_authVerificationCooldowns",
    "_authPasswordRecoveryCooldowns",
    "_authPasswordRecoveryIpCooldowns",
  ];

  for (const relativePath of runtimePaths) {
    const source = readFileSync(new URL(`server/${relativePath}`, new URL(`file://${sourceRoot}/`)), "utf8");
    for (const value of forbidden) {
      assert.equal(source.includes(value), false, `${relativePath} must not reference ${value}`);
    }
  }
});
