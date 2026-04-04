import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { Character } from "../../domain/characters/character.types";

const CHARACTERS_COLLECTION = "characters";

export async function getCharacterById(characterId: string): Promise<Character | null> {
  const snapshot = await getDoc(doc(db, CHARACTERS_COLLECTION, characterId));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Character, "id">),
  };
}

export async function getCharactersByCampaign(campaignId: string): Promise<Character[]> {
  const q = query(
    collection(db, CHARACTERS_COLLECTION),
    where("campaignId", "==", campaignId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Character, "id">),
  }));
}

export async function getCharactersByUser(userId: string): Promise<Character[]> {
  const q = query(
    collection(db, CHARACTERS_COLLECTION),
    where("ownerUserId", "==", userId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Character, "id">),
  }));
}

export async function createCharacter(character: Character): Promise<void> {
  await setDoc(doc(db, CHARACTERS_COLLECTION, character.id), character);
}

export async function updateCharacter(
  characterId: string,
  updates: Partial<Omit<Character, "id">>
): Promise<void> {
  await updateDoc(doc(db, CHARACTERS_COLLECTION, characterId), updates);
}

export async function deleteCharacter(characterId: string): Promise<void> {
  await deleteDoc(doc(db, CHARACTERS_COLLECTION, characterId));
}