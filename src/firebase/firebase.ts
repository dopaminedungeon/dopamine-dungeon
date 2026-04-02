import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { app } from "../config/firebase/firebase";

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);