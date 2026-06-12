import { and, eq } from "drizzle-orm";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { db } from "../src/server/db.js";
import { campaigns } from "../db/schema/campaigns.js";
import { sessions } from "../db/schema/sessions.js";

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

type FirestoreSessionData = Record<string, unknown>;

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

function normalizeGmPrep(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
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

function toSessionValues(params: {
  postgresCampaignId: string;
  firestoreSessionId: string;
  data: FirestoreSessionData;
}) {
  const { postgresCampaignId, firestoreSessionId, data } = params;

  return {
    campaignId: postgresCampaignId,
    // Preserve the app-safe Firestore session doc id used by existing routes.
    id: firestoreSessionId,
    sessionNumber: normalizeNumber(data.sessionNumber, 1),
    name: normalizeString(data.name, "Untitled session") || "Untitled session",
    players: normalizeNumber(data.players, 0),
    maxPlayers: normalizeNumber(data.maxPlayers, 0),
    duration: normalizeString(data.duration, "—") || "—",
    status: normalizeString(data.status, "scheduled") || "scheduled",
    startTime: normalizeString(data.startTime),
    map: normalizeString(data.map),
    difficulty: normalizeString(data.difficulty, "Normal") || "Normal",
    progress: normalizeNumber(data.progress, 0),
    visibility:
      normalizeString(data.visibility, "public") === "gm-only"
        ? "gm-only"
        : "public",
    summary: normalizeString(data.summary),
    timeline: normalizeString(data.timeline),
    moments: normalizeString(data.moments),
    quotes: normalizeString(data.quotes),
    gmNotes: normalizeString(data.gmNotes),
    gmSecrets: normalizeString(data.gmSecrets),
    gmPrep: normalizeGmPrep(data.gmPrep),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

async function resolvePostgresCampaign(campaignSlug: string) {
  const matchingCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, campaignSlug))
    .limit(1);

  return matchingCampaigns[0] ?? null;
}

async function sessionExists(params: {
  postgresCampaignId: string;
  sessionId: string;
}) {
  const existingSessions = await db
    .select({ rowId: sessions.rowId })
    .from(sessions)
    .where(
      and(
        eq(sessions.campaignId, params.postgresCampaignId),
        eq(sessions.id, params.sessionId)
      )
    )
    .limit(1);

  return Boolean(existingSessions[0]);
}

async function upsertSession(
  values: ReturnType<typeof toSessionValues>
) {
  await db
    .insert(sessions)
    .values(values)
    .onConflictDoUpdate({
      target: [sessions.campaignId, sessions.id],
      set: {
        sessionNumber: values.sessionNumber,
        name: values.name,
        players: values.players,
        maxPlayers: values.maxPlayers,
        duration: values.duration,
        status: values.status,
        startTime: values.startTime,
        map: values.map,
        difficulty: values.difficulty,
        progress: values.progress,
        visibility: values.visibility,
        summary: values.summary,
        timeline: values.timeline,
        moments: values.moments,
        quotes: values.quotes,
        gmNotes: values.gmNotes,
        gmSecrets: values.gmSecrets,
        gmPrep: values.gmPrep,
        updatedAt: values.updatedAt,
      },
    });
}

async function main() {
  console.log(
    shouldApply
      ? "Applying Firestore sessions migration to Postgres."
      : "Dry run only. Re-run with --apply to write sessions to Postgres."
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

    const sessionsSnap = await firestore
      .collection("campaigns")
      .doc(campaignSlug)
      .collection("sessions")
      .get();

    let inserted = 0;
    let updated = 0;

    for (const sessionDoc of sessionsSnap.docs) {
      const exists = await sessionExists({
        postgresCampaignId: postgresCampaign.id,
        sessionId: sessionDoc.id,
      });

      if (exists) {
        updated += 1;
      } else {
        inserted += 1;
      }

      if (!shouldApply) {
        continue;
      }

      await upsertSession(
        toSessionValues({
          postgresCampaignId: postgresCampaign.id,
          firestoreSessionId: sessionDoc.id,
          data: sessionDoc.data(),
        })
      );
    }

    summaries.push({
      slug: campaignSlug,
      found: sessionsSnap.size,
      inserted,
      updated,
    });

    console.log(`\nCampaign ${campaignSlug}`);
    console.log(`  Sessions found: ${sessionsSnap.size}`);
    console.log(
      `  Sessions ${shouldApply ? "inserted" : "would insert"}: ${inserted}`
    );
    console.log(
      `  Sessions ${shouldApply ? "updated" : "would update"}: ${updated}`
    );
  }

  const totalFound = summaries.reduce((sum, row) => sum + row.found, 0);
  const totalInserted = summaries.reduce((sum, row) => sum + row.inserted, 0);
  const totalUpdated = summaries.reduce((sum, row) => sum + row.updated, 0);

  console.log("\nSummary");
  console.log(`  Campaigns scanned: ${firestoreCampaigns.size}`);
  console.log(`  Skipped campaigns: ${skippedCampaigns.length}`);
  console.log(`  Sessions found: ${totalFound}`);
  console.log(
    `  Sessions ${shouldApply ? "inserted" : "would insert"}: ${totalInserted}`
  );
  console.log(
    `  Sessions ${shouldApply ? "updated" : "would update"}: ${totalUpdated}`
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
    console.error("Failed to migrate sessions:", error);
    process.exit(1);
  });
