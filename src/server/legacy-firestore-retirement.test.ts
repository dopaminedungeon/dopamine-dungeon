import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
