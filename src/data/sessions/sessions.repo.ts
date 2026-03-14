import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

export const sessionsRepo = {
  async getAll(campaignId: string) {
    const snap = await getDocs(
      collection(db, "campaigns", campaignId, "sessions")
    );

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async upsert(campaignId: string, session: any) {
    await setDoc(
      doc(db, "campaigns", campaignId, "sessions", session.id),
      session
    );
  },

  async remove(campaignId: string, id: string) {
    await deleteDoc(doc(db, "campaigns", campaignId, "sessions", id));
  },
};