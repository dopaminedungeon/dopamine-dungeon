import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

const USERS_COLLECTION = "users";

export async function getUsersByNormalizedEmail(normalizedEmail: string) {
  const q = query(
    collection(db, USERS_COLLECTION),
    where("normalizedEmail", "==", normalizedEmail)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function upsertUserProfile(userId: string, data: Record<string, unknown>) {
  await setDoc(doc(db, USERS_COLLECTION, userId), data, { merge: true });
}