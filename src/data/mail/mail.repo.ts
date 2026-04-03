import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase/firebase";

export type MailPayload = {
  to: string[];
  message: {
    subject: string;
    html: string;
  };
};

const MAIL_COLLECTION = "mail";

export async function createMail(mail: MailPayload) {
  await addDoc(collection(db, MAIL_COLLECTION), mail);
}