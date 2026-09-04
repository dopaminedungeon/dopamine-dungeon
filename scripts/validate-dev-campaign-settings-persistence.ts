import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type Environment = Record<string, string>;

function readLocalEnvironment(): Environment {
  const values: Environment = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
  if (!values.DATABASE_URL) throw new Error(".env.local DATABASE_URL is missing");
  if (!values.VITE_FIREBASE_API_KEY_DEV) throw new Error("Development Firebase API key is missing");
  return values;
}

const localEnvironment = readLocalEnvironment();
const validationApiBaseUrl = process.env.DD_SETTINGS_VALIDATION_API_BASE_URL?.replace(/\/$/, "");
delete process.env.DATABASE_URL;
delete process.env.NEON_DATABASE_URL;
for (const [key, value] of Object.entries(localEnvironment)) {
  if (key === "DATABASE_URL" || key.startsWith("FIREBASE_") || key.startsWith("VITE_FIREBASE_")) {
    process.env[key] = value;
  }
}

const [
  { default: campaignContentHandler },
  { default: meHandler },
  { adminAuth },
  { db },
  { users },
  { workspaces },
  { campaigns },
  { workspaceMemberships, campaignMemberships },
] = await Promise.all([
  import("../api/campaign-content.js"),
  import("../api/me.js"),
  import("../src/server/auth.js"),
  import("../src/server/db.js"),
  import("../db/schema/users.js"),
  import("../db/schema/workspaces.js"),
  import("../db/schema/campaigns.js"),
  import("../db/schema/memberships.js"),
]);

function responseCapture() {
  const result: { body?: unknown; status?: number } = {};
  const response = {
    end: () => response,
    json: (body: unknown) => {
      result.body = body;
      return response;
    },
    setHeader: () => response,
    status: (status: number) => {
      result.status = status;
      return response;
    },
  } as unknown as VercelResponse;
  return { response, result };
}

function settingsRequest(params: {
  method: "GET" | "PATCH";
  token?: string;
  campaignSlug: string;
  mode?: "gm" | "player";
  body?: Record<string, unknown>;
}) {
  return {
    body: params.body,
    headers: {
      ...(params.token ? { authorization: `Bearer ${params.token}` } : {}),
      ...(params.mode ? { "x-dd-mode": params.mode } : {}),
    },
    method: params.method,
    query: { campaignId: params.campaignSlug, resource: "campaignSettings" },
  } as unknown as VercelRequest;
}

async function invokeSettings(params: Parameters<typeof settingsRequest>[0]) {
  if (validationApiBaseUrl) {
    const response = await fetch(
      `${validationApiBaseUrl}/api/campaign-content?resource=campaignSettings&campaignId=${encodeURIComponent(params.campaignSlug)}`,
      {
        method: params.method,
        headers: {
          ...(params.token ? { authorization: `Bearer ${params.token}` } : {}),
          ...(params.mode ? { "x-dd-mode": params.mode } : {}),
          ...(params.method === "PATCH" ? { "content-type": "application/json" } : {}),
        },
        ...(params.body ? { body: JSON.stringify(params.body) } : {}),
      }
    );
    return { status: response.status, body: await response.json() };
  }

  const capture = responseCapture();
  await campaignContentHandler(settingsRequest(params), capture.response);
  return capture.result;
}

async function getIdToken(firebaseUid: string) {
  const customToken = await adminAuth.createCustomToken(firebaseUid);
  const reply = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(localEnvironment.VITE_FIREBASE_API_KEY_DEV)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!reply.ok) throw new Error("Development Firebase custom-token exchange failed");
  const payload = (await reply.json()) as { idToken?: unknown };
  if (typeof payload.idToken !== "string") throw new Error("Development Firebase returned no ID token");
  return payload.idToken;
}

async function provisionThroughMe(token: string) {
  if (validationApiBaseUrl) {
    const response = await fetch(`${validationApiBaseUrl}/api/me`, {
      headers: { authorization: `Bearer ${token}`, "x-dd-mode": "player" },
    });
    assert.equal(response.status, 200);
    return (await response.json()) as { campaigns: Array<Record<string, unknown>> };
  }

  const capture = responseCapture();
  await meHandler(
    { body: {}, headers: { authorization: `Bearer ${token}`, "x-dd-mode": "player" }, method: "GET", query: {} } as unknown as VercelRequest,
    capture.response
  );
  assert.equal(capture.result.status, 200);
  return capture.result.body as { campaigns: Array<Record<string, unknown>> };
}

function campaignPayload(body: unknown) {
  const payload = body as { campaign?: Record<string, unknown> };
  assert.ok(payload.campaign);
  return payload.campaign;
}

const runId = randomUUID();
const firebaseUids = [
  `dd-298-settings-${runId}-gm`,
  `dd-298-settings-${runId}-player`,
  `dd-298-settings-${runId}-other-campaign-gm`,
  `dd-298-settings-${runId}-campaign-only`,
  `dd-298-settings-${runId}-other-workspace`,
];
const [gmUid, playerUid, otherCampaignGmUid, campaignOnlyUid, otherWorkspaceUid] = firebaseUids;
const createdFirebaseUids = new Set<string>();
const createdWorkspaceIds = new Set<string>();
const createdCampaignIds = new Set<string>();
let cleanupComplete = false;

try {
  const targetRows = await db.execute(sql`
    select current_database() as database_name,
      current_setting('neon.project_id', true) as project_id,
      current_setting('neon.branch_id', true) as branch_id
  `);
  const target = targetRows[0];
  assert.deepEqual(target, {
    database_name: "neondb",
    project_id: "icy-cloud-05910629",
    branch_id: "br-odd-sound-alamav7v",
  });

  for (const uid of firebaseUids) {
    await adminAuth.createUser({
      uid,
      email: `${uid}@example.invalid`,
      emailVerified: true,
      displayName: "DD 298 Campaign Settings Validator",
    });
    createdFirebaseUids.add(uid);
  }
  const [gmToken, playerToken, otherCampaignGmToken, campaignOnlyToken, otherWorkspaceToken] =
    await Promise.all(firebaseUids.map(getIdToken));
  await Promise.all([gmToken, playerToken, otherCampaignGmToken, campaignOnlyToken, otherWorkspaceToken].map(provisionThroughMe));

  const userRows = await db.select().from(users).where(inArray(users.firebaseUid, firebaseUids));
  const usersByUid = new Map(userRows.map((user) => [user.firebaseUid, user]));
  const gm = usersByUid.get(gmUid);
  const player = usersByUid.get(playerUid);
  const otherCampaignGm = usersByUid.get(otherCampaignGmUid);
  const campaignOnly = usersByUid.get(campaignOnlyUid);
  const otherWorkspaceUser = usersByUid.get(otherWorkspaceUid);
  assert.ok(gm && player && otherCampaignGm && campaignOnly && otherWorkspaceUser);

  const [workspace] = await db.insert(workspaces).values({
    name: "DD 298 campaign-settings validation workspace",
    slug: `workspace-${runId}`,
    ownerUserId: gm.id,
    creationRequestKey: randomUUID(),
  }).returning();
  const [otherWorkspace] = await db.insert(workspaces).values({
    name: "DD 298 campaign-settings other workspace",
    slug: `workspace-${randomUUID()}`,
    ownerUserId: otherWorkspaceUser.id,
    creationRequestKey: randomUUID(),
  }).returning();
  createdWorkspaceIds.add(workspace.id);
  createdWorkspaceIds.add(otherWorkspace.id);
  await db.insert(workspaceMemberships).values([
    { workspaceId: workspace.id, userId: gm.id, role: "owner" },
    { workspaceId: workspace.id, userId: player.id, role: "player" },
    { workspaceId: workspace.id, userId: otherCampaignGm.id, role: "gm" },
    { workspaceId: otherWorkspace.id, userId: otherWorkspaceUser.id, role: "owner" },
  ]);

  const sharedName = "DD 298 campaign-settings same-name isolation";
  const [campaignA, campaignB] = await db.insert(campaigns).values([
    {
      workspaceId: workspace.id, createdByUserId: gm.id, creationRequestKey: randomUUID(), name: sharedName,
      slug: `campaign-${runId}-a`, description: "", system: "", status: "active",
    },
    {
      workspaceId: workspace.id, createdByUserId: gm.id, creationRequestKey: randomUUID(), name: sharedName,
      slug: `campaign-${runId}-b`, description: "Other campaign", system: "Other", status: "active",
      playerSummary: "Other player summary", gmNotes: "Other GM note", startDate: "2027-01-01", endDate: "2027-12-31",
    },
  ]).returning();
  createdCampaignIds.add(campaignA.id);
  createdCampaignIds.add(campaignB.id);
  await db.insert(campaignMemberships).values([
    { campaignId: campaignA.id, userId: gm.id, role: "gm" },
    { campaignId: campaignA.id, userId: player.id, role: "player" },
    { campaignId: campaignA.id, userId: campaignOnly.id, role: "gm" },
    { campaignId: campaignB.id, userId: otherCampaignGm.id, role: "gm" },
  ]);

  const unauthenticated = await invokeSettings({ method: "GET", campaignSlug: campaignA.slug });
  assert.equal(unauthenticated.status, 401);

  const initialRead = await invokeSettings({ method: "GET", token: gmToken, mode: "gm", campaignSlug: campaignA.slug });
  assert.equal(initialRead.status, 200);
  const initialSettings = campaignPayload(initialRead.body);
  assert.equal(initialSettings.gmNotes, "");
  const initialUpdatedAt = new Date(String(initialSettings.updatedAt)).getTime();

  const values = {
    name: "DD 298 validated campaign settings",
    description: "Validated canonical description",
    status: "paused",
    system: "Validated system",
    playerSummary: "Validated player-safe summary",
    gmNotes: "Validated GM-only note",
    startDate: "2026-09-01",
    endDate: "2027-09-01",
  };
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const saved = await invokeSettings({
    method: "PATCH", token: gmToken, mode: "gm", campaignSlug: campaignA.slug,
    body: { campaignId: campaignA.slug, ...values },
  });
  assert.equal(saved.status, 200);
  const savedSettings = campaignPayload(saved.body);
  for (const [key, value] of Object.entries(values)) assert.equal(savedSettings[key], value);
  assert.ok(new Date(String(savedSettings.updatedAt)).getTime() > initialUpdatedAt);

  const storedRows = await db.select().from(campaigns).where(eq(campaigns.id, campaignA.id));
  const stored = storedRows[0];
  assert.ok(stored);
  for (const [key, value] of Object.entries(values)) assert.equal(stored[key as keyof typeof stored], value);
  assert.equal(
    Math.floor(new Date(String(stored.updatedAt)).getTime() / 1_000),
    Math.floor(new Date(String(savedSettings.updatedAt)).getTime() / 1_000)
  );

  const reloaded = await invokeSettings({ method: "GET", token: gmToken, mode: "gm", campaignSlug: campaignA.slug });
  assert.equal(reloaded.status, 200);
  const reloadedSettings = campaignPayload(reloaded.body);
  for (const [key, value] of Object.entries(values)) assert.equal(reloadedSettings[key], value);
  assert.equal(
    Math.floor(new Date(String(reloadedSettings.updatedAt)).getTime() / 1_000),
    Math.floor(new Date(String(stored.updatedAt)).getTime() / 1_000)
  );

  const playerRead = await invokeSettings({ method: "GET", token: playerToken, mode: "player", campaignSlug: campaignA.slug });
  assert.equal(playerRead.status, 200);
  const playerSettings = campaignPayload(playerRead.body);
  assert.equal("gmNotes" in playerSettings, false);
  for (const key of ["name", "description", "status", "system", "playerSummary", "startDate", "endDate"]) {
    assert.equal(playerSettings[key], values[key as keyof typeof values]);
  }
  const gmPlayerModeRead = await invokeSettings({ method: "GET", token: gmToken, mode: "player", campaignSlug: campaignA.slug });
  assert.equal(gmPlayerModeRead.status, 200);
  assert.equal("gmNotes" in campaignPayload(gmPlayerModeRead.body), false);
  const playerMe = await provisionThroughMe(playerToken);
  assert.ok(playerMe.campaigns.every((candidate) => !("gmNotes" in candidate)));

  const playerPatch = await invokeSettings({ method: "PATCH", token: playerToken, mode: "player", campaignSlug: campaignA.slug, body: { campaignId: campaignA.slug, name: "blocked" } });
  assert.equal(playerPatch.status, 403);
  const gmPlayerModePatch = await invokeSettings({ method: "PATCH", token: gmToken, mode: "player", campaignSlug: campaignA.slug, body: { campaignId: campaignA.slug, name: "blocked" } });
  assert.equal(gmPlayerModePatch.status, 403);
  const otherCampaignPatch = await invokeSettings({ method: "PATCH", token: otherCampaignGmToken, mode: "gm", campaignSlug: campaignA.slug, body: { campaignId: campaignA.slug, name: "blocked" } });
  assert.equal(otherCampaignPatch.status, 403);
  const missingWorkspace = await invokeSettings({ method: "GET", token: campaignOnlyToken, mode: "gm", campaignSlug: campaignA.slug });
  assert.equal(missingWorkspace.status, 403);
  const otherWorkspaceAccess = await invokeSettings({ method: "GET", token: otherWorkspaceToken, mode: "gm", campaignSlug: campaignA.slug });
  assert.equal(otherWorkspaceAccess.status, 403);

  const privileged = await invokeSettings({
    method: "PATCH", token: gmToken, mode: "gm", campaignSlug: campaignA.slug,
    body: { campaignId: campaignA.slug, name: "blocked", workspaceId: otherWorkspace.id, role: "gm", ownerUserId: otherWorkspaceUser.id, memberId: "client", createdByUserId: otherWorkspaceUser.id, creationRequestKey: randomUUID(), updatedAt: "client", lastUpdated: "client", mystery: "client" },
  });
  assert.equal(privileged.status, 400);
  const afterFailedSave = await invokeSettings({ method: "GET", token: gmToken, mode: "gm", campaignSlug: campaignA.slug });
  assert.equal(afterFailedSave.status, 200);
  const afterFailedSettings = campaignPayload(afterFailedSave.body);
  for (const [key, value] of Object.entries(values)) assert.equal(afterFailedSettings[key], value);

  const switchedCampaign = await invokeSettings({ method: "GET", token: otherCampaignGmToken, mode: "gm", campaignSlug: campaignB.slug });
  assert.equal(switchedCampaign.status, 200);
  const switchedSettings = campaignPayload(switchedCampaign.body);
  assert.equal(switchedSettings.name, sharedName);
  assert.equal(switchedSettings.playerSummary, "Other player summary");
  assert.equal(switchedSettings.gmNotes, "Other GM note");
  const unchangedOtherRows = await db.select().from(campaigns).where(eq(campaigns.id, campaignB.id));
  assert.equal(unchangedOtherRows[0]?.gmNotes, "Other GM note");
  assert.equal(unchangedOtherRows[0]?.name, sharedName);

  console.log(JSON.stringify({
    targetVerified: true,
    gmReadWriteAndReloadPersisted: true,
    updatedAtServerOwned: true,
    playerSafeProjectionVerified: true,
    gmNotesAbsentFromPlayerAndMeResponses: true,
    authorizationAndIsolationVerified: true,
    failedSaveDidNotPersist: true,
    sameNameCampaignIsolationVerified: true,
    cleanupComplete: false,
  }));
} finally {
  if (createdCampaignIds.size) {
    await db.delete(campaignMemberships).where(inArray(campaignMemberships.campaignId, [...createdCampaignIds]));
    await db.delete(campaigns).where(inArray(campaigns.id, [...createdCampaignIds]));
  }
  if (createdWorkspaceIds.size) {
    await db.delete(workspaceMemberships).where(inArray(workspaceMemberships.workspaceId, [...createdWorkspaceIds]));
    await db.delete(workspaces).where(inArray(workspaces.id, [...createdWorkspaceIds]));
  }
  await db.delete(users).where(inArray(users.firebaseUid, firebaseUids));
  await Promise.all([...createdFirebaseUids].map((uid) => adminAuth.deleteUser(uid)));

  const [remainingUsers, remainingWorkspaces, remainingCampaigns] = await Promise.all([
    db.select({ id: users.id }).from(users).where(inArray(users.firebaseUid, firebaseUids)),
    createdWorkspaceIds.size ? db.select({ id: workspaces.id }).from(workspaces).where(inArray(workspaces.id, [...createdWorkspaceIds])) : [],
    createdCampaignIds.size ? db.select({ id: campaigns.id }).from(campaigns).where(inArray(campaigns.id, [...createdCampaignIds])) : [],
  ]);
  assert.equal(remainingUsers.length, 0);
  assert.equal(remainingWorkspaces.length, 0);
  assert.equal(remainingCampaigns.length, 0);
  cleanupComplete = true;
  console.log(JSON.stringify({ cleanupComplete }));
}
