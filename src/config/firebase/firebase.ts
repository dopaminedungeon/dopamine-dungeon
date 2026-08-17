import { initializeApp } from "firebase/app";
import { firebaseDevConfig } from "./firebase.dev";
import { firebaseProdConfig } from "./firebase.prod";
import { firebaseTestConfig } from "./firebase.test";

const vercelEnv = import.meta.env.VITE_VERCEL_ENV;
const requestedAuthTestMode = import.meta.env.VITE_AUTH_TEST_MODE === "true";

if (import.meta.env.MODE === "test" && !requestedAuthTestMode) {
  throw new Error("Vite test mode requires the Firebase Auth emulator flag.");
}

if (requestedAuthTestMode && import.meta.env.MODE !== "test") {
  throw new Error("Firebase Auth test mode requires Vite --mode test.");
}

if (requestedAuthTestMode && vercelEnv) {
  throw new Error("Firebase Auth test mode cannot run in a Vercel environment.");
}

export const isAuthTestMode =
  requestedAuthTestMode && import.meta.env.MODE === "test" && !vercelEnv;

// Vercel:
// - production → real prod
// - preview → should use dev
// Local dev → undefined → should use dev
const isProd = vercelEnv === "production";

const config = isAuthTestMode
  ? firebaseTestConfig
  : isProd
    ? firebaseProdConfig
    : firebaseDevConfig;

if (!config.apiKey || !config.projectId || !config.appId) {
  throw new Error(
    `Missing Firebase config for ${isProd ? "PROD" : "DEV"} environment.`
  );
}

export const app = initializeApp(config);

console.log("Firebase env:", { vercelEnv, isProd, isAuthTestMode });
