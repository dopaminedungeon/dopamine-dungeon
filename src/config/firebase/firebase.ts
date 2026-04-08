import { initializeApp } from "firebase/app";
import { firebaseDevConfig } from "./firebase.dev";
import { firebaseProdConfig } from "./firebase.prod";

const vercelEnv = import.meta.env.VITE_VERCEL_ENV;

// Vercel:
// - production → real prod
// - preview → should use dev
// Local dev → undefined → should use dev
const isProd = vercelEnv === "production";

const config = isProd ? firebaseProdConfig : firebaseDevConfig;

if (!config.apiKey || !config.projectId || !config.appId) {
  throw new Error(
    `Missing Firebase config for ${isProd ? "PROD" : "DEV"} environment.`
  );
}

export const app = initializeApp(config);

console.log("Firebase env:", { vercelEnv, isProd });