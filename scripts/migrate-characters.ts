import { and, eq } from "drizzle-orm";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { db } from "../src/server/db.js";
import { campaigns } from "../db/schema/campaigns.js";
import { characters } from "../db/schema/characters.js";

const shouldApply = process.argv.includes("--apply");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Missing Firebase Admin environment variables");
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const firestore = getFirestore();

type FirestoreCharacterData = Record<string, unknown>;
type CharacterInsert = typeof characters.$inferInsert;

type CampaignSummary = {
  slug: string;
  found: number;
  inserted: number;
  updated: number;
};

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value: unknown) {
  if (value instanceof Date) return value;

  if (value && typeof value === "object" && "toDate" in value) {
    const maybeDate = (value as { toDate?: () => unknown }).toDate?.();
    if (maybeDate instanceof Date) return maybeDate;
  }

  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
}

function toJsonCompatible(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();

  if (value && typeof value === "object" && "toDate" in value) {
    const maybeDate = (value as { toDate?: () => unknown }).toDate?.();
    if (maybeDate instanceof Date) return maybeDate.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonCompatible(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toJsonCompatible(entry),
      ])
    );
  }

  return value;
}

async function resolvePostgresCampaign(campaignSlug: string) {
  const matchingCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, campaignSlug))
    .limit(1);

  return matchingCampaigns[0] ?? null;
}

async function characterExists(params: {
  postgresCampaignId: string;
  characterId: string;
}) {
  const existingCharacters = await db
    .select({ rowId: characters.rowId })
    .from(characters)
    .where(
      and(
        eq(characters.campaignId, params.postgresCampaignId),
        eq(characters.id, params.characterId)
      )
    )
    .limit(1);

  return Boolean(existingCharacters[0]);
}

function toCharacterValues(params: {
  postgresCampaignId: string;
  firestoreCharacterId: string;
  data: FirestoreCharacterData;
}): CharacterInsert {
  const { postgresCampaignId, firestoreCharacterId, data } = params;
  const visibility = normalizeString(data.visibility, "player") || "player";
  const isPlayerVisible =
    typeof data.isPlayerVisible === "boolean"
      ? data.isPlayerVisible
      : visibility === "player";
  const ownerUserId = normalizeString(data.ownerUserId);

  return {
    campaignId: postgresCampaignId,
    // Preserve the app-safe Firestore character doc id used by frontend routes.
    id: firestoreCharacterId,
    name: normalizeString(data.name),
    level: normalizeNumber(data.level, 1),
    visibility,
    isPlayerVisible,
    ownerUserId,
    data: toJsonCompatible({
      ...data,
      id: firestoreCharacterId,
      visibility,
      isPlayerVisible,
      ownerUserId,
    }) as Record<string, unknown>,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

async function upsertCharacter(values: CharacterInsert) {
  await db
    .insert(characters)
    .values(values)
    .onConflictDoUpdate({
      target: [characters.campaignId, characters.id],
      set: {
        name: values.name,
        level: values.level,
        visibility: values.visibility,
        isPlayerVisible: values.isPlayerVisible,
        ownerUserId: values.ownerUserId,
        data: values.data,
        updatedAt: values.updatedAt,
      },
    });
}

async function main() {
  console.log(
    shouldApply
      ? "Applying Firestore characters migration to Postgres."
      : "Dry run only. Re-run with --apply to write characters to Postgres."
  );

  const firestoreCampaigns = await firestore.collection("campaigns").get();
  const summaries: CampaignSummary[] = [];
  const skippedCampaigns: string[] = [];

  for (const campaignDoc of firestoreCampaigns.docs) {
    const campaignSlug = campaignDoc.id;
    const postgresCampaign = await resolvePostgresCampaign(campaignSlug);

    if (!postgresCampaign) {
      skippedCampaigns.push(campaignSlug);
      console.log(`\nCampaign ${campaignSlug}`);
      console.log("  Skipped: no Postgres campaign with matching slug.");
      continue;
    }

    const charactersSnap = await firestore
      .collection("campaigns")
      .doc(campaignSlug)
      .collection("characters")
      .get();

    let inserted = 0;
    let updated = 0;

    for (const characterDoc of charactersSnap.docs) {
      const exists = await characterExists({
        postgresCampaignId: postgresCampaign.id,
        characterId: characterDoc.id,
      });

      if (exists) {
        updated += 1;
      } else {
        inserted += 1;
      }

      if (!shouldApply) {
        continue;
      }

      await upsertCharacter(
        toCharacterValues({
          postgresCampaignId: postgresCampaign.id,
          firestoreCharacterId: characterDoc.id,
          data: characterDoc.data(),
        })
      );
    }

    summaries.push({
      slug: campaignSlug,
      found: charactersSnap.size,
      inserted,
      updated,
    });

    console.log(`\nCampaign ${campaignSlug}`);
    console.log(`  Characters found: ${charactersSnap.size}`);
    console.log(
      `  Characters ${shouldApply ? "inserted" : "would insert"}: ${inserted}`
    );
    console.log(
      `  Characters ${shouldApply ? "updated" : "would update"}: ${updated}`
    );
  }

  const totalFound = summaries.reduce((sum, row) => sum + row.found, 0);
  const totalInserted = summaries.reduce((sum, row) => sum + row.inserted, 0);
  const totalUpdated = summaries.reduce((sum, row) => sum + row.updated, 0);

  console.log("\nSummary");
  console.log(`  Campaigns scanned: ${firestoreCampaigns.size}`);
  console.log(`  Skipped campaigns: ${skippedCampaigns.length}`);
  console.log(`  Characters found: ${totalFound}`);
  console.log(
    `  Characters ${shouldApply ? "inserted" : "would insert"}: ${totalInserted}`
  );
  console.log(
    `  Characters ${shouldApply ? "updated" : "would update"}: ${totalUpdated}`
  );

  if (skippedCampaigns.length > 0) {
    console.log(`  Skipped campaign slugs: ${skippedCampaigns.join(", ")}`);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to migrate characters:", error);
    process.exit(1);
  });
