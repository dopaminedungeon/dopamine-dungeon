import {
  markPendingCredentialVerificationRequested,
  markPendingCredentialVerificationSent,
  readPendingCredentialMigration,
} from "./credentialMigration";

export function createPendingCredentialVerificationRequests(
  sendVerificationEmail
) {
  const automaticRequests = new Map();

  function requestAutomatic(firebaseUser, invited) {
    const pending = readPendingCredentialMigration(firebaseUser?.uid);
    if (!pending) {
      return Promise.reject(new Error("Credential setup is not pending."));
    }

    const existing = automaticRequests.get(firebaseUser.uid);
    if (existing) return existing;
    if (pending.verificationEmailRequestedAt) {
      return Promise.resolve(pending.verificationEmailSentAt ?? null);
    }

    markPendingCredentialVerificationRequested(firebaseUser.uid);
    const request = Promise.resolve()
      .then(() => sendVerificationEmail(invited))
      .then(() => markPendingCredentialVerificationSent(firebaseUser.uid));

    automaticRequests.set(firebaseUser.uid, request);
    const clearRequest = () => {
      if (automaticRequests.get(firebaseUser.uid) === request) {
        automaticRequests.delete(firebaseUser.uid);
      }
    };
    request.then(clearRequest, clearRequest);
    return request;
  }

  async function requestManual(firebaseUser, invited) {
    if (!readPendingCredentialMigration(firebaseUser?.uid)) {
      throw new Error("Credential setup is not pending.");
    }

    await sendVerificationEmail(invited);
    return markPendingCredentialVerificationSent(firebaseUser.uid) ?? Date.now();
  }

  return { requestAutomatic, requestManual };
}
