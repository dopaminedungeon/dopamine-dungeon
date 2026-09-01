import { getApiMe } from "../../data/api/apiClient";

export async function ensureUserProfile(_legacyIdentity?: unknown) {
  return getApiMe();
}
