import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase/firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { ensureUserProfile } from "../domain/users/userProfile.service";
import { requiresEmailVerification } from "../auth/authState";
import { isAuthTestMode } from "../config/firebase/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [verificationUser, setVerificationUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const needsVerification = requiresEmailVerification(firebaseUser);

      setVerificationUser(needsVerification ? firebaseUser : null);
      setUser(needsVerification ? null : firebaseUser ?? null);

      if (firebaseUser && !needsVerification && !isAuthTestMode) {
        try {
          await ensureUserProfile({
            userId: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            displayName: firebaseUser.displayName ?? "",
            photoURL: firebaseUser.photoURL ?? "",
          });
        } catch (error) {
          console.error("[AuthContext] Failed to sync user profile", error);
        }
      }

      setAuthStatus("ready");
    });

    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    return credential;
  };

  const resendVerification = async () => {
    const currentUser = verificationUser ?? auth.currentUser;
    if (!currentUser) throw new Error("No account is waiting for verification.");
    await sendEmailVerification(currentUser);
  };

  const checkEmailVerification = async () => {
    const currentUser = verificationUser ?? auth.currentUser;
    if (!currentUser) return false;

    await reload(currentUser);
    if (!currentUser.emailVerified) return false;

    await currentUser.getIdToken(true);
    if (!isAuthTestMode) {
      await ensureUserProfile({
        userId: currentUser.uid,
        email: currentUser.email ?? "",
        displayName: currentUser.displayName ?? "",
        photoURL: currentUser.photoURL ?? "",
      });
    }

    setVerificationUser(null);
    setUser(currentUser);
    return true;
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        verificationUser,
        authStatus,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerification,
        checkEmailVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// The provider and its hook intentionally share this module as the existing public API.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
