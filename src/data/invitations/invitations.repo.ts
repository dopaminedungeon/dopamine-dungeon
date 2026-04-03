import { db } from "../../firebase/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Invitation } from "../../domain/invitations/invitation.types";

const COLLECTION_NAME = "invitations";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createInvitation(
  input: Omit<
    Invitation,
    "id" | "status" | "createdAt" | "acceptedAt" | "acceptedByUserId" | "normalizedEmail"
  >
): Promise<Invitation> {
  const normalizedEmail = normalizeEmail(input.email);

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...input,
    normalizedEmail,
    status: "pending",
    createdAt: Date.now(),
  });

  return {
    id: docRef.id,
    ...input,
    normalizedEmail,
    status: "pending",
    createdAt: Date.now(),
  };
}

export async function getPendingInvitationsByEmail(email: string): Promise<Invitation[]> {
  const normalizedEmail = normalizeEmail(email);

  const q = query(
    collection(db, COLLECTION_NAME),
    where("normalizedEmail", "==", normalizedEmail),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Invitation, "id">),
  }));
}

export async function markInvitationAccepted(
  invitationId: string,
  userId: string
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, invitationId);

  await updateDoc(ref, {
    status: "accepted",
    acceptedAt: Date.now(),
    acceptedByUserId: userId,
  });
}