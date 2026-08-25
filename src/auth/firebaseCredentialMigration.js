import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";

export function linkPasswordToFirebaseUser(firebaseUser, email, password) {
  const credential = EmailAuthProvider.credential(email, password);
  return linkWithCredential(firebaseUser, credential);
}

export function reauthenticateFirebaseUserWithGoogle(firebaseUser) {
  return reauthenticateWithPopup(firebaseUser, new GoogleAuthProvider());
}
