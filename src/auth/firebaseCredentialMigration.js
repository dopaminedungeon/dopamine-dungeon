import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
} from "firebase/auth";

const passwordLinkAttempts = new WeakMap();
const googleLinkAttempts = new Map();

export function linkPasswordToFirebaseUser(firebaseUser, email, password) {
  const existing = passwordLinkAttempts.get(firebaseUser);
  if (existing) return existing;

  const attempt = Promise.resolve().then(() => {
    const credential = EmailAuthProvider.credential(email, password);
    return linkWithCredential(firebaseUser, credential);
  });
  passwordLinkAttempts.set(firebaseUser, attempt);
  const clearAttempt = () => {
    if (passwordLinkAttempts.get(firebaseUser) === attempt) {
      passwordLinkAttempts.delete(firebaseUser);
    }
  };
  attempt.then(clearAttempt, clearAttempt);
  return attempt;
}

export function reauthenticateFirebaseUserWithGoogle(firebaseUser) {
  return reauthenticateWithPopup(firebaseUser, new GoogleAuthProvider());
}

export function getPendingGoogleCredentialFromError(error) {
  return GoogleAuthProvider.credentialFromError(error);
}

export function linkGoogleToFirebaseUser(firebaseUser) {
  const attemptKey = firebaseUser?.uid;
  const existing = googleLinkAttempts.get(attemptKey);
  if (existing) return existing;

  const attempt = linkWithPopup(firebaseUser, new GoogleAuthProvider());
  googleLinkAttempts.set(attemptKey, attempt);
  const clearAttempt = () => {
    if (googleLinkAttempts.get(attemptKey) === attempt) {
      googleLinkAttempts.delete(attemptKey);
    }
  };
  attempt.then(clearAttempt, clearAttempt);
  return attempt;
}

export function reauthenticatePasswordUser(firebaseUser, email, password) {
  const credential = EmailAuthProvider.credential(email, password);
  return reauthenticateWithCredential(firebaseUser, credential);
}

export function updateFirebaseUserPassword(firebaseUser, password) {
  return updatePassword(firebaseUser, password);
}

export function linkPendingGoogleCredentialToFirebaseUser(
  firebaseUser,
  googleCredential
) {
  return linkWithCredential(firebaseUser, googleCredential);
}
