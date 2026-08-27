import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";

const passwordLinkAttempts = new WeakMap();

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
