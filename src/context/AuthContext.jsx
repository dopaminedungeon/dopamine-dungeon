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
import {
  getIdentityContinuity,
  requestVerificationEmail,
} from "../data/api/apiClient";
import {
  hasPendingInvitationContext,
  preserveInvitationContext,
} from "../auth/invitationContext";
import {
  clearPendingCredentialMigration,
  hasConnectedProvider,
  PASSWORD_PROVIDER_ID,
  readPendingCredentialMigration,
} from "../auth/credentialMigration";
import { createPendingCredentialVerificationRequests } from "../auth/pendingCredentialVerification";

const AuthContext = createContext(null);
const pendingCredentialVerificationRequests =
  createPendingCredentialVerificationRequests(requestVerificationEmail);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [verificationUser, setVerificationUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [profileInitializationFailed, setProfileInitializationFailed] = useState(false);
  const [profileInitializationUser, setProfileInitializationUser] = useState(null);
  const [verificationEmailSentAt, setVerificationEmailSentAt] = useState(null);
  const [verificationEmailAutoError, setVerificationEmailAutoError] = useState("");
  const [credentialSetupRevision, setCredentialSetupRevision] = useState(0);

  useEffect(() => {
    let authChangeSequence = 0;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const sequence = ++authChangeSequence;
      const needsVerification = requiresEmailVerification(firebaseUser);

      setVerificationUser(needsVerification ? firebaseUser : null);
      setUser(null);
      setProfileInitializationFailed(false);
      setProfileInitializationUser(null);
      setVerificationEmailAutoError("");

      if (!firebaseUser || needsVerification) {
        setAuthStatus("ready");
        if (firebaseUser && readPendingCredentialMigration(firebaseUser.uid)) {
          pendingCredentialVerificationRequests.requestAutomatic(
            firebaseUser,
            hasPendingInvitationContext()
          )
            .then((sentAt) => {
              if (sequence === authChangeSequence && sentAt) {
                setVerificationEmailSentAt(sentAt);
              }
            })
            .catch(() => {
              if (sequence === authChangeSequence) {
                setVerificationEmailAutoError(
                  "Could not send the verification email automatically. Please try again."
                );
              }
            });
        }
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

  const sendInitialBrandedVerificationEmail = async (firebaseUser) => {
    if (!firebaseUser) throw new Error("No account is waiting for verification.");
    await requestVerificationEmail(hasPendingInvitationContext());
    const sentAt = Date.now();
    setVerificationEmailSentAt(sentAt);
    setVerificationEmailAutoError("");
  };

  const registerWithEmail = async (email, password) => {
    preserveInvitationContext();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendInitialBrandedVerificationEmail(credential.user);
    return credential;
  };

  const resendVerification = async () => {
    const currentUser = verificationUser ?? auth.currentUser;
    if (!currentUser) throw new Error("No account is waiting for verification.");
    const sentAt = readPendingCredentialMigration(currentUser.uid)
      ? await pendingCredentialVerificationRequests.requestManual(
          currentUser,
          hasPendingInvitationContext()
        )
      : await requestVerificationEmail(hasPendingInvitationContext()).then(() => Date.now());
    setVerificationEmailSentAt(sentAt);
    setVerificationEmailAutoError("");
  };

  const continueVerifiedSession = async (currentUser = verificationUser ?? auth.currentUser) => {
    if (!currentUser) return false;
    await currentUser.getIdToken(true);

    const pending = readPendingCredentialMigration(currentUser.uid);
    if (pending && hasConnectedProvider(currentUser, PASSWORD_PROVIDER_ID)) {
      try {
        const continuity = await getIdentityContinuity();
        if (continuity?.neonUserId === pending.neonUserId) {
          clearPendingCredentialMigration();
          setCredentialSetupRevision((revision) => revision + 1);
        }
      } catch {
        // Optional setup remains recoverable in Profile Settings and never blocks the app.
      }
    }
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

  const beginCredentialSetupVerification = async (currentUser) => {
    if (
      !currentUser ||
      currentUser.uid !== auth.currentUser?.uid ||
      currentUser.emailVerified ||
      !hasConnectedProvider(currentUser, PASSWORD_PROVIDER_ID) ||
      !readPendingCredentialMigration(currentUser.uid)
    ) {
      return false;
    }

    setUser(null);
    setVerificationUser(currentUser);
    setVerificationEmailAutoError("");
    setAuthStatus("ready");
    try {
      const sentAt = await pendingCredentialVerificationRequests.requestAutomatic(
        currentUser,
        hasPendingInvitationContext()
      );
      if (sentAt) setVerificationEmailSentAt(sentAt);
      return true;
    } catch {
      setVerificationEmailAutoError(
        "Could not send the verification email automatically. Please try again."
      );
      return false;
    }
  };

  const completeCredentialSetup = async (currentUser) => {
    if (
      !currentUser ||
      currentUser.uid !== auth.currentUser?.uid ||
      !currentUser.emailVerified ||
      !hasConnectedProvider(currentUser, PASSWORD_PROVIDER_ID) ||
      !readPendingCredentialMigration(currentUser.uid)
    ) {
      return false;
    }

    clearPendingCredentialMigration();
    setCredentialSetupRevision((revision) => revision + 1);
    setUser(getApplicationUser(currentUser, "ready", isAuthTestMode));
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        verificationUser,
        authStatus,
        profileInitializationFailed,
        verificationEmailSentAt,
        verificationEmailAutoError,
        credentialSetupRevision,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerification,
        checkEmailVerification,
        continueVerifiedSession,
        retryProfileInitialization,
        beginCredentialSetupVerification,
        completeCredentialSetup,
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
