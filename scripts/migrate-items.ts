import { and, eq } from "drizzle-orm";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { db } from "../src/server/db.js";
import { campaigns } from "../db/schema/campaigns.js";
import { items } from "../db/schema/items.js";

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

type FirestoreItemData = Record<string, unknown>;
type ItemInsert = typeof items.$inferInsert;

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

async function itemExists(params: { postgresCampaignId: string; itemId: string }) {
  const existingItems = await db
    .select({ rowId: items.rowId })
    .from(items)
    .where(
      and(
        eq(items.campaignId, params.postgresCampaignId),
        eq(items.id, params.itemId)
      )
    )
    .limit(1);

  return Boolean(existingItems[0]);
}

function toItemValues(params: {
  postgresCampaignId: string;
  firestoreItemId: string;
  data: FirestoreItemData;
}): ItemInsert {
  const { postgresCampaignId, firestoreItemId, data } = params;
  const visibility =
    normalizeString(data.visibility, "public") === "gm-only"
      ? "gm-only"
      : "public";

  return {
    campaignId: postgresCampaignId,
    // Preserve the app-safe Firestore item doc id used by frontend routes.
    id: firestoreItemId,
    name: normalizeString(data.name),
    type: normalizeString(data.type, "Other") || "Other",
    rarity: normalizeString(data.rarity, "Common") || "Common",
    power: normalizeNumber(data.power, 0),
    visibility,
    data: toJsonCompatible({
      ...data,
      id: firestoreItemId,
      visibility,
    }) as Record<string, unknown>,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

async function upsertItem(values: ItemInsert) {
  await db
    .insert(items)
    .values(values)
    .onConflictDoUpdate({
      target: [items.campaignId, items.id],
      set: {
        name: values.name,
        type: values.type,
        rarity: values.rarity,
        power: values.power,
        visibility: values.visibility,
        data: values.data,
        updatedAt: values.updatedAt,
      },
    });
}

async function main() {
  console.log(
    shouldApply
      ? "Applying Firestore items migration to Postgres."
      : "Dry run only. Re-run with --apply to write items to Postgres."
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

    const itemsSnap = await firestore
      .collection("campaigns")
      .doc(campaignSlug)
      .collection("items")
      .get();

    let inserted = 0;
    let updated = 0;

    for (const itemDoc of itemsSnap.docs) {
      const exists = await itemExists({
        postgresCampaignId: postgresCampaign.id,
        itemId: itemDoc.id,
      });

      if (exists) {
        updated += 1;
      } else {
        inserted += 1;
      }

      if (!shouldApply) {
        continue;
      }

      await upsertItem(
        toItemValues({
          postgresCampaignId: postgresCampaign.id,
          firestoreItemId: itemDoc.id,
          data: itemDoc.data(),
        })
      );
    }

    summaries.push({
      slug: campaignSlug,
      found: itemsSnap.size,
      inserted,
      updated,
    });

    console.log(`\nCampaign ${campaignSlug}`);
    console.log(`  Items found: ${itemsSnap.size}`);
    console.log(`  Items ${shouldApply ? "inserted" : "would insert"}: ${inserted}`);
    console.log(`  Items ${shouldApply ? "updated" : "would update"}: ${updated}`);
  }

  const totalFound = summaries.reduce((sum, row) => sum + row.found, 0);
  const totalInserted = summaries.reduce((sum, row) => sum + row.inserted, 0);
  const totalUpdated = summaries.reduce((sum, row) => sum + row.updated, 0);

  console.log("\nSummary");
  console.log(`  Campaigns scanned: ${firestoreCampaigns.size}`);
  console.log(`  Skipped campaigns: ${skippedCampaigns.length}`);
  console.log(`  Items found: ${totalFound}`);
  console.log(`  Items ${shouldApply ? "inserted" : "would insert"}: ${totalInserted}`);
  console.log(`  Items ${shouldApply ? "updated" : "would update"}: ${totalUpdated}`);

  if (skippedCampaigns.length > 0) {
    console.log(`  Skipped campaign slugs: ${skippedCampaigns.join(", ")}`);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to migrate items:", error);
    process.exit(1);
  });
