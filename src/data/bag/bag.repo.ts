import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

export const bagRepo = {
  async get(campaignId: string) {
    const snap = await getDoc(
      doc(db, "campaigns", campaignId, "meta", "bag")
    );

    return snap.exists() ? snap.data() : { itemIds: [], currency: {} };
  },

  async save(campaignId: string, bag: any) {
    await setDoc(
      doc(db, "campaigns", campaignId, "meta", "bag"),
      bag
    );
  },
};