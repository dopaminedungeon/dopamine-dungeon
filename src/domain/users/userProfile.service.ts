import { getUsersByNormalizedEmail, upsertUserProfile } from "../../data/users/users.repo";

function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureUserProfile(params: {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}) {
  const { userId, email, displayName, photoURL } = params;

  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();

  if (!normalizedEmail) {
    throw new Error("Cannot ensure user profile without email.");
  }

  const matches = await getUsersByNormalizedEmail(normalizedEmail);

  if (matches.length > 1) {
    throw new Error(
      `Multiple user profiles found for normalizedEmail=${normalizedEmail}`
    );
  }

  if (matches.length === 1 && matches[0].id !== userId) {
    throw new Error(
      `Existing user profile ${matches[0].id} conflicts with current auth user ${userId}`
    );
  }

  await upsertUserProfile(userId, {
    id: userId,
    email,
    normalizedEmail,
    displayName: displayName ?? "",
    photoURL: photoURL ?? "",
    onboardingState: "active",
    lastLoginAt: now,
    updatedAt: now,
  });

  return userId;
}