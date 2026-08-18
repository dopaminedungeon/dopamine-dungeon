const STORAGE_KEY = "dd_pendingInvitationContext";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasInvitationQuery(search = window.location.search) {
  return new URLSearchParams(search).get("invited") === "true";
}

export function preserveInvitationContext(search = window.location.search) {
  if (!hasInvitationQuery(search)) return hasPendingInvitationContext();

  storage()?.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now() }));
  return true;
}

export function hasPendingInvitationContext() {
  const value = storage()?.getItem(STORAGE_KEY);
  if (!value) return false;

  try {
    const parsed = JSON.parse(value);
    if (Date.now() - Number(parsed.savedAt) <= MAX_AGE_MS) return true;
  } catch {
    // Invalid state is removed below.
  }

  storage()?.removeItem(STORAGE_KEY);
  return false;
}

export function clearInvitationContext() {
  storage()?.removeItem(STORAGE_KEY);
}

export function getPostVerificationPath() {
  return hasPendingInvitationContext() ? "/welcome?invited=true" : "/";
}
