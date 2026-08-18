import {
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

const USERS_COLLECTION = "users";

export async function upsertUserProfile(userId: string, data: Record<string, unknown>) {
  await setDoc(doc(db, USERS_COLLECTION, userId), data, { merge: true });
}
