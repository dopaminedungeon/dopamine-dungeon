// src/firebase/auth.ts
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "./firebase";

const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export async function logout() {
  return signOut(auth);
}