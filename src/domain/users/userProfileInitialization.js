export async function initializeUserProfile({
  displayName = "",
  email,
  now = Date.now(),
  photoURL = "",
  userId,
  writeProfile,
}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!userId) {
    throw new Error("Cannot ensure user profile without a Firebase UID.");
  }

  if (!normalizedEmail) {
    throw new Error("Cannot ensure user profile without email.");
  }

  await writeProfile(userId, {
    id: userId,
    email,
    normalizedEmail,
    displayName,
    photoURL,
    onboardingState: "active",
    lastLoginAt: now,
    updatedAt: now,
  });

  return userId;
}
