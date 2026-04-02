import { initializeApp } from "firebase/app";
import { firebaseDevConfig } from "./firebase.dev";
import { firebaseProdConfig } from "./firebase.prod";

const isProd = import.meta.env.MODE === "production";
const config = isProd ? firebaseProdConfig : firebaseDevConfig;

if (!config.apiKey || !config.projectId || !config.appId) {
  throw new Error(
    `Missing Firebase config for ${isProd ? "PROD" : "DEV"} environment.`
  );
}

export const app = initializeApp(config);