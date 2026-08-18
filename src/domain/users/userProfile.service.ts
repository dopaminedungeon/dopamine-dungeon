import { upsertUserProfile } from "../../data/users/users.repo";
import { initializeUserProfile } from "./userProfileInitialization.js";

export async function ensureUserProfile(params: {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}) {
  const { userId, email, displayName, photoURL } = params;

  return initializeUserProfile({
    userId,
    email,
    displayName: displayName ?? "",
    photoURL: photoURL ?? "",
    writeProfile: upsertUserProfile,
  });
}
