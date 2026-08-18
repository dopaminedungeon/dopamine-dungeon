import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase/firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  reload,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { ensureUserProfile } from "../domain/users/userProfile.service";
import {
  getApplicationUser,
  requiresEmailVerification,
} from "../auth/authState";
import { isAuthTestMode } from "../config/firebase/firebase";
import { requestVerificationEmail } from "../data/api/apiClient";
import {
  hasPendingInvitationContext,
  preserveInvitationContext,
} from "../auth/invitationContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [verificationUser, setVerificationUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [profileInitializationFailed, setProfileInitializationFailed] = useState(false);
  const [profileInitializationUser, setProfileInitializationUser] = useState(null);
  const [verificationEmailSentAt, setVerificationEmailSentAt] = useState(null);

  useEffect(() => {
    let authChangeSequence = 0;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const sequence = ++authChangeSequence;
      const needsVerification = requiresEmailVerification(firebaseUser);

      setVerificationUser(needsVerification ? firebaseUser : null);
      setUser(null);
      setProfileInitializationFailed(false);
      setProfileInitializationUser(null);

      if (!firebaseUser || needsVerification) {
        setAuthStatus("ready");
        return;
      }

      setAuthStatus("loading");

      if (!isAuthTestMode) {
        try {
          await ensureUserProfile({
            userId: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            displayName: firebaseUser.displayName ?? "",
            photoURL: firebaseUser.photoURL ?? "",
          });
        } catch (error) {
          console.error("[AuthContext] Failed to sync user profile", error);
          if (sequence === authChangeSequence) {
            setProfileInitializationFailed(true);
            setProfileInitializationUser(firebaseUser);
            setAuthStatus("ready");
          }
          return;
        }
      }

      if (sequence === authChangeSequence) {
        setUser(
          getApplicationUser(firebaseUser, "ready", isAuthTestMode)
        );
        setAuthStatus("ready");
      }
    });

    return () => unsub();
  }, []);

  const retryProfileInitialization = async () => {
    const currentUser = profileInitializationUser ?? auth.currentUser;
    if (!currentUser || requiresEmailVerification(currentUser)) return false;

    setAuthStatus("loading");
    try {
      await ensureUserProfile({
        userId: currentUser.uid,
        email: currentUser.email ?? "",
        displayName: currentUser.displayName ?? "",
        photoURL: currentUser.photoURL ?? "",
      });
      setProfileInitializationFailed(false);
      setProfileInitializationUser(null);
      setUser(getApplicationUser(currentUser, "ready", isAuthTestMode));
      return true;
    } catch (error) {
      console.error("[AuthContext] Failed to retry user profile sync", error);
      setProfileInitializationFailed(true);
      setProfileInitializationUser(currentUser);
      return false;
    } finally {
      setAuthStatus("ready");
    }
  };

  const signInWithGoogle = async () => {
    preserveInvitationContext();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email, password) => {
    preserveInvitationContext();
    return signInWithEmailAndPassword(auth, email, password);
  };

  const sendBrandedVerificationEmail = async (firebaseUser) => {
    if (!firebaseUser) throw new Error("No account is waiting for verification.");
    await requestVerificationEmail(hasPendingInvitationContext());
    setVerificationEmailSentAt(Date.now());
  };

  const registerWithEmail = async (email, password) => {
    preserveInvitationContext();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendBrandedVerificationEmail(credential.user);
    return credential;
  };

  const resendVerification = async () => {
    const currentUser = verificationUser ?? auth.currentUser;
    await sendBrandedVerificationEmail(currentUser);
  };

  const continueVerifiedSession = async (currentUser = verificationUser ?? auth.currentUser) => {
    if (!currentUser) return false;
    await currentUser.getIdToken(true);
    if (!isAuthTestMode) {
      try {
        await ensureUserProfile({
          userId: currentUser.uid,
          email: currentUser.email ?? "",
          displayName: currentUser.displayName ?? "",
          photoURL: currentUser.photoURL ?? "",
        });
      } catch (error) {
        setVerificationUser(null);
        setUser(null);
        setProfileInitializationFailed(true);
        setProfileInitializationUser(currentUser);
        throw error;
      }
    }

    setVerificationUser(null);
    setUser(getApplicationUser(currentUser, "ready", isAuthTestMode));
    return true;
  };

  const checkEmailVerification = async () => {
    const currentUser = verificationUser ?? auth.currentUser;
    if (!currentUser) return false;

    await reload(currentUser);
    if (!currentUser.emailVerified) return false;
    return continueVerifiedSession(currentUser);
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
        profileInitializationFailed,
        verificationEmailSentAt,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerification,
        checkEmailVerification,
        continueVerifiedSession,
        retryProfileInitialization,
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
