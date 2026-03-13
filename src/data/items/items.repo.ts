import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

export const itemsRepo = {
  async getAll(campaignId: string) {
    const snap = await getDocs(
      collection(db, "campaigns", campaignId, "items")
    );

    return snap.docs?.map((d) => ({ id: d.id, ...d.data() })) ?? [];
  },

  async upsert(campaignId: string, item: any) {
    await setDoc(
      doc(db, "campaigns", campaignId, "items", item.id),
      item
    );
  },

  async remove(campaignId: string, id: string) {
    await deleteDoc(doc(db, "campaigns", campaignId, "items", id));
  },
};