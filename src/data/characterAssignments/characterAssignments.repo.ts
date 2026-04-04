import { collection, doc, setDoc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { CharacterAssignment } from "../../domain/characterAssignments/characterAssignment.types";

const COLLECTION = "characterAssignments";

export const createCharacterAssignments = async (
  assignments: CharacterAssignment[]
): Promise<void> => {
  await Promise.all(
    assignments.map((assignment) =>
      setDoc(doc(db, COLLECTION, assignment.id), assignment)
    )
  );
};

export const getAssignmentsForCampaign = async (
  campaignId: string
): Promise<CharacterAssignment[]> => {
  const q = query(
    collection(db, COLLECTION),
    where("campaignId", "==", campaignId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as CharacterAssignment);
};

export const getAssignmentsForUserInCampaign = async (
  campaignId: string,
  userId: string
): Promise<CharacterAssignment[]> => {
  const q = query(
    collection(db, COLLECTION),
    where("campaignId", "==", campaignId),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as CharacterAssignment);
};

export const removeCharacterAssignment = async (
  assignmentId: string
): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, assignmentId));
};