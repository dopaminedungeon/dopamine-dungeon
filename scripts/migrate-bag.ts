import { and, eq } from "drizzle-orm";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { db } from "../src/server/db.js";
import { bagCurrency, bagEntries } from "../db/schema/bag.js";
import { campaigns } from "../db/schema/campaigns.js";

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

type BagCurrency = Partial<Record<"gp" | "sp" | "cp" | "ep" | "pp", number>>;
type FirestoreBagData = {
  currency?: BagCurrency;
  looseItems?: unknown[];
  linkedEntries?: unknown[];
};
type BagEntryInsert = typeof bagEntries.$inferInsert;

type CampaignSummary = {
  slug: string;
  found: number;
  inserted: number;
  updated: number;
  currencyInserted: number;
  currencyUpdated: number;
};

function normalizeString(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCurrency(input?: BagCurrency): Required<BagCurrency> {
  return {
    gp: Math.max(0, Math.floor(normalizeNumber(input?.gp, 0))),
    sp: Math.max(0, Math.floor(normalizeNumber(input?.sp, 0))),
    cp: Math.max(0, Math.floor(normalizeNumber(input?.cp, 0))),
    ep: Math.max(0, Math.floor(normalizeNumber(input?.ep, 0))),
    pp: Math.max(0, Math.floor(normalizeNumber(input?.pp, 0))),
  };
}

function toDateFromMs(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(Number(value));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
}

function normalizeLooseItems(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>)
    .filter((item) => item.id && item.name);
}

function normalizeLinkedEntries(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => entry as Record<string, unknown>)
    .filter((entry) => entry.itemId);
}

async function resolvePostgresCampaign(campaignSlug: string) {
  const matchingCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, campaignSlug))
    .limit(1);

  return matchingCampaigns[0] ?? null;
}

async function currencyExists(postgresCampaignId: string) {
  const rows = await db
    .select({ campaignId: bagCurrency.campaignId })
    .from(bagCurrency)
    .where(eq(bagCurrency.campaignId, postgresCampaignId))
    .limit(1);

  return Boolean(rows[0]);
}

async function entryExists(params: { postgresCampaignId: string; entryId: string }) {
  const rows = await db
    .select({ rowId: bagEntries.rowId })
    .from(bagEntries)
    .where(
      and(
        eq(bagEntries.campaignId, params.postgresCampaignId),
        eq(bagEntries.id, params.entryId)
      )
    )
    .limit(1);

  return Boolean(rows[0]);
}

function toLooseEntryValues(
  postgresCampaignId: string,
  item: Record<string, unknown>
): BagEntryInsert {
  return {
    campaignId: postgresCampaignId,
    // Preserve the app-safe Firestore bag entry id used by the current UI.
    id: normalizeString(item.id),
    sourceType: "loose",
    itemId: null,
    name: normalizeString(item.name),
    category: normalizeString(item.type, "Other") || "Other",
    quantity: Math.max(1, Math.floor(normalizeNumber(item.qty, 1))),
    worthGp: Math.max(0, normalizeNumber(item.worth, 0)),
    notes: item.notes != null ? normalizeString(item.notes) : null,
    addedBy: item.addedBy != null ? normalizeString(item.addedBy) : null,
    createdAt: toDateFromMs(item.createdAt),
    updatedAt: new Date(),
  };
}

function toLinkedEntryValues(
  postgresCampaignId: string,
  entry: Record<string, unknown>
): BagEntryInsert {
  return {
    campaignId: postgresCampaignId,
    id: normalizeString(entry.id, crypto.randomUUID()),
    sourceType: "linked",
    itemId: normalizeString(entry.itemId),
    name: "",
    category: null,
    quantity: Math.max(1, Math.floor(normalizeNumber(entry.quantity, 1))),
    worthGp: 0,
    notes: entry.note != null ? normalizeString(entry.note) : null,
    addedBy: entry.addedBy != null ? normalizeString(entry.addedBy) : null,
    createdAt: toDateFromMs(entry.createdAt),
    updatedAt: toDateFromMs(entry.updatedAt),
  };
}

async function upsertCurrency(postgresCampaignId: string, currency: Required<BagCurrency>) {
  const now = new Date();

  await db
    .insert(bagCurrency)
    .values({
      campaignId: postgresCampaignId,
      ...currency,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: bagCurrency.campaignId,
      set: {
        cp: currency.cp,
        sp: currency.sp,
        ep: currency.ep,
        gp: currency.gp,
        pp: currency.pp,
        updatedAt: now,
      },
    });
}

async function upsertEntry(values: BagEntryInsert) {
  await db
    .insert(bagEntries)
    .values(values)
    .onConflictDoUpdate({
      target: [bagEntries.campaignId, bagEntries.id],
      set: {
        sourceType: values.sourceType,
        itemId: values.itemId,
        name: values.name,
        category: values.category,
        quantity: values.quantity,
        worthGp: values.worthGp,
        notes: values.notes,
        addedBy: values.addedBy,
        updatedAt: values.updatedAt,
      },
    });
}

async function main() {
  console.log(
    shouldApply
      ? "Applying Firestore Bag of Holding migration to Postgres."
      : "Dry run only. Re-run with --apply to write Bag of Holding data to Postgres."
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

    const bagSnap = await firestore
      .collection("campaigns")
      .doc(campaignSlug)
      .collection("meta")
      .doc("bag")
      .get();

    if (!bagSnap.exists) {
      console.log(`\nCampaign ${campaignSlug}`);
      console.log("  Bag document not found.");
      summaries.push({
        slug: campaignSlug,
        found: 0,
        inserted: 0,
        updated: 0,
        currencyInserted: 0,
        currencyUpdated: 0,
      });
      continue;
    }

    const bagData = bagSnap.data() as FirestoreBagData;
    const looseItems = normalizeLooseItems(bagData.looseItems);
    const linkedEntries = normalizeLinkedEntries(bagData.linkedEntries);
    const entryValues = [
      ...looseItems.map((item) => toLooseEntryValues(postgresCampaign.id, item)),
      ...linkedEntries.map((entry) => toLinkedEntryValues(postgresCampaign.id, entry)),
    ];

    let inserted = 0;
    let updated = 0;

    for (const values of entryValues) {
      const exists = await entryExists({
        postgresCampaignId: postgresCampaign.id,
        entryId: values.id,
      });

      if (exists) {
        updated += 1;
      } else {
        inserted += 1;
      }

      if (shouldApply) {
        await upsertEntry(values);
      }
    }

    const hasCurrency = await currencyExists(postgresCampaign.id);
    const currencyInserted = hasCurrency ? 0 : 1;
    const currencyUpdated = hasCurrency ? 1 : 0;

    if (shouldApply) {
      await upsertCurrency(postgresCampaign.id, normalizeCurrency(bagData.currency));
    }

    summaries.push({
      slug: campaignSlug,
      found: entryValues.length,
      inserted,
      updated,
      currencyInserted,
      currencyUpdated,
    });

    console.log(`\nCampaign ${campaignSlug}`);
    console.log(`  Bag entries found: ${entryValues.length}`);
    console.log(`  Bag entries ${shouldApply ? "inserted" : "would insert"}: ${inserted}`);
    console.log(`  Bag entries ${shouldApply ? "updated" : "would update"}: ${updated}`);
    console.log(
      `  Currency ${shouldApply ? "inserted" : "would insert"}: ${currencyInserted}`
    );
    console.log(
      `  Currency ${shouldApply ? "updated" : "would update"}: ${currencyUpdated}`
    );
  }

  const totalFound = summaries.reduce((sum, row) => sum + row.found, 0);
  const totalInserted = summaries.reduce((sum, row) => sum + row.inserted, 0);
  const totalUpdated = summaries.reduce((sum, row) => sum + row.updated, 0);
  const totalCurrencyInserted = summaries.reduce(
    (sum, row) => sum + row.currencyInserted,
    0
  );
  const totalCurrencyUpdated = summaries.reduce(
    (sum, row) => sum + row.currencyUpdated,
    0
  );

  console.log("\nSummary");
  console.log(`  Campaigns scanned: ${firestoreCampaigns.size}`);
  console.log(`  Skipped campaigns: ${skippedCampaigns.length}`);
  console.log(`  Bag entries found: ${totalFound}`);
  console.log(`  Bag entries ${shouldApply ? "inserted" : "would insert"}: ${totalInserted}`);
  console.log(`  Bag entries ${shouldApply ? "updated" : "would update"}: ${totalUpdated}`);
  console.log(
    `  Currency ${shouldApply ? "inserted" : "would insert"}: ${totalCurrencyInserted}`
  );
  console.log(
    `  Currency ${shouldApply ? "updated" : "would update"}: ${totalCurrencyUpdated}`
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
    console.error("Failed to migrate Bag of Holding:", error);
    process.exit(1);
  });
