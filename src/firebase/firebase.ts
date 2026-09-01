import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";

import { app, isAuthTestMode } from "../config/firebase/firebase";

export const auth = getAuth(app);
export const storage = getStorage(app);

if (isAuthTestMode) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
