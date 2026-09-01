import { eq } from "drizzle-orm";

import { users } from "../../db/schema/users.js";
import { db } from "./db.js";

type User = typeof users.$inferSelect;

export class UserProfileInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserProfileInputError";
  }
}

export function toUserProfile(user: User) {
  return { reducedMotion: user.reducedMotion };
}

export function getProfileUpdate(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new UserProfileInputError("Profile update is invalid");
  }

  const values = body as Record<string, unknown>;
  const keys = Object.keys(values);

  if (keys.length !== 1 || keys[0] !== "reducedMotion" || typeof values.reducedMotion !== "boolean") {
    throw new UserProfileInputError("Profile update is invalid");
  }

  return { reducedMotion: values.reducedMotion };
}

export async function updateUserProfile(user: User, body: unknown) {
  const update = getProfileUpdate(body);
  const updatedRows = await db
    .update(users)
    .set(update)
    .where(eq(users.id, user.id))
    .returning();
  const updatedUser = updatedRows[0];

  if (!updatedUser) {
    throw new Error("Authenticated profile update returned no user");
  }

  return toUserProfile(updatedUser);
}
