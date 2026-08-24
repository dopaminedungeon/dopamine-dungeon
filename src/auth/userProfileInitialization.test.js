import assert from "node:assert/strict";
import { test } from "vitest";

import { initializeUserProfile } from "../domain/users/userProfileInitialization.js";

test("same-email Firebase UIDs initialize as isolated profiles", async () => {
  const profiles = new Map();
  const writeProfile = async (userId, profile) => profiles.set(userId, profile);

  await initializeUserProfile({
    userId: "old-firebase-uid",
    email: "recreated@example.test",
    displayName: "Old profile",
    now: 1,
    writeProfile,
  });
  const oldProfileBeforeRecreation = structuredClone(
    profiles.get("old-firebase-uid")
  );

  await initializeUserProfile({
    userId: "new-firebase-uid",
    email: "recreated@example.test",
    displayName: "",
    now: 2,
    writeProfile,
  });

  assert.equal(profiles.size, 2);
  assert.deepEqual(profiles.get("old-firebase-uid"), oldProfileBeforeRecreation);
  assert.deepEqual(profiles.get("new-firebase-uid"), {
    id: "new-firebase-uid",
    email: "recreated@example.test",
    normalizedEmail: "recreated@example.test",
    displayName: "",
    photoURL: "",
    onboardingState: "active",
    lastLoginAt: 2,
    updatedAt: 2,
  });
});

test("profile initialization requires the canonical Firebase UID", async () => {
  await assert.rejects(
    initializeUserProfile({
      userId: "",
      email: "player@example.test",
      writeProfile: async () => {},
    }),
    /Firebase UID/
  );
});
