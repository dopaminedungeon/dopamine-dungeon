import { getApps, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getServerAuthRuntime } from "../auth/authEmulatorSafety.js";
import { AuthenticationError } from "./apiErrors.js";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const authRuntime = getServerAuthRuntime(process.env);
const authTestAppName = "dopamine-dungeon-auth-test";

if (!authRuntime.useAuthEmulator && (!projectId || !clientEmail || !privateKey)) {
  throw new Error("Missing Firebase Admin environment variables");
}

const app = authRuntime.useAuthEmulator
  ? getApps().find((candidate) => candidate.name === authTestAppName) ??
    initializeApp({ projectId: authRuntime.projectId }, authTestAppName)
  : getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

export async function verifyFirebaseToken(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice("Bearer ".length);
  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    throw new AuthenticationError("Invalid authentication token");
  }

  return decodedToken;
}

export async function verifyAuthHeader(authHeader?: string) {
  const decodedToken = await verifyFirebaseToken(authHeader);

  if (decodedToken.email_verified !== true) {
    throw new AuthenticationError("Email verification required");
  }

  return decodedToken;
}
