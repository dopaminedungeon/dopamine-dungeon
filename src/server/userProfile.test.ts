import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import { users } from "../../db/schema/users.js";

const mocks = vi.hoisted(() => {
  const state = { setValues: [] as unknown[], whereValues: [] as unknown[] };
  const returning = vi.fn();
  const where = vi.fn((value: unknown) => {
    state.whereValues.push(value);
    return { returning };
  });
  const set = vi.fn((value: unknown) => {
    state.setValues.push(value);
    return { where };
  });

  return { db: { update: vi.fn(() => ({ set })) }, returning, set, state, where };
});

vi.mock("./db.js", () => ({ db: mocks.db }));

import {
  getProfileUpdate,
  toUserProfile,
  updateUserProfile,
  UserProfileInputError,
} from "./userProfile.js";

const firstUser = {
  id: "00000000-0000-4000-8000-000000000030",
  firebaseUid: "first-firebase-uid",
  reducedMotion: false,
};
const secondUser = {
  id: "00000000-0000-4000-8000-000000000031",
  firebaseUid: "second-firebase-uid",
  reducedMotion: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.setValues.length = 0;
  mocks.state.whereValues.length = 0;
});

test("accepts only the retained reduced-motion preference", () => {
  assert.deepEqual(getProfileUpdate({ reducedMotion: true }), { reducedMotion: true });
  assert.throws(
    () => getProfileUpdate({ reducedMotion: false, userId: secondUser.id }),
    UserProfileInputError
  );
  assert.throws(() => getProfileUpdate({ displayName: "Client supplied" }), UserProfileInputError);
  assert.throws(() => getProfileUpdate({ reducedMotion: "true" }), UserProfileInputError);
});

test("updates only the authenticated Neon user and returns the retained preference", async () => {
  mocks.returning.mockResolvedValue([{ ...firstUser, reducedMotion: true }]);

  const profile = await updateUserProfile(firstUser as typeof users.$inferSelect, {
    reducedMotion: true,
  });

  assert.deepEqual(profile, { reducedMotion: true });
  assert.deepEqual(mocks.state.setValues, [{ reducedMotion: true }]);
  assert.equal(mocks.state.whereValues.length, 1);
  assert.equal(toUserProfile({ ...secondUser, reducedMotion: true } as typeof users.$inferSelect).reducedMotion, true);
});
