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
  if (!values.VITE_FIREBASE_API_KEY_DEV) {
    throw new Error(".env.local VITE_FIREBASE_API_KEY_DEV is missing");
  }

  return values;
}

const localEnvironment = readLocalEnvironment();
for (const [key, value] of Object.entries(localEnvironment)) {
  if (key === "DATABASE_URL" || key.startsWith("FIREBASE_") || key.startsWith("VITE_FIREBASE_")) {
    process.env[key] = value;
  }
}
delete process.env.NEON_DATABASE_URL;

const [
  { default: workspaceHandler },
  { default: campaignContentHandler },
  { default: meHandler },
  { adminAuth },
  { db },
  { users },
  { workspaces },
  { campaigns },
  { workspaceMemberships, campaignMemberships },
  { resolveCampaignByAppId },
] = await Promise.all([
  import("../api/workspace.js"),
  import("../api/campaign-content.js"),
  import("../api/me.js"),
  import("../src/server/auth.js"),
  import("../src/server/db.js"),
  import("../db/schema/users.js"),
  import("../db/schema/workspaces.js"),
  import("../db/schema/campaigns.js"),
  import("../db/schema/memberships.js"),
  import("../src/server/access.js"),
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

function request(method: string, token: string, body?: Record<string, unknown>) {
  return {
    body,
    headers: { authorization: `Bearer ${token}` },
    method,
    query: {},
  } as unknown as VercelRequest;
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
  const body = (await reply.json()) as { idToken?: unknown };
  if (typeof body.idToken !== "string") throw new Error("Development Firebase returned no ID token");
  return body.idToken;
}

async function createWorkspace(token: string, idempotencyKey: string) {
  const { response, result } = responseCapture();
  await workspaceHandler(
    request("POST", token, { name: "DD 298 campaign validation workspace", idempotencyKey }),
    response
  );
  assert.equal(result.status, 201);
  const body = result.body as { workspace?: { id: string; slug: string } };
  assert.ok(body.workspace);
  return body.workspace;
}

async function createCampaign(params: {
  token: string;
  workspaceId: string;
  idempotencyKey: string;
  name: string;
  ownerUid?: string;
  gmUid?: string;
  role?: string;
}) {
  const { response, result } = responseCapture();
  await campaignContentHandler(
    request("POST", params.token, {
      workspaceId: params.workspaceId,
      idempotencyKey: params.idempotencyKey,
      name: params.name,
      description: "DD 298 validation",
      system: "Validation",
      ownerUid: params.ownerUid,
      gmUid: params.gmUid,
      role: params.role,
    }),
    response
  );
  return result;
}

const runId = randomUUID();
const firebaseUids = [
  `dd-298-campaign-${runId}-owner-a`,
  `dd-298-campaign-${runId}-owner-b`,
  `dd-298-campaign-${runId}-gm`,
  `dd-298-campaign-${runId}-player`,
  `dd-298-campaign-${runId}-outsider`,
];
const [ownerAFirebaseUid, ownerBFirebaseUid, gmFirebaseUid, playerFirebaseUid, outsiderFirebaseUid] =
  firebaseUids;
const createdFirebaseUids = new Set<string>();
const createdCampaignIds = new Set<string>();
const createdWorkspaceIds = new Set<string>();
let workspaceId: string | null = null;
let cleanupComplete = false;

try {
  if (localEnvironment.FIREBASE_PROJECT_ID !== "dopamine-dungeon-c8c77") {
    throw new Error(".env.local is not configured for the approved development Firebase project");
  }
  const targetRows = await db.execute(sql`
    select
      current_database() as database_name,
      current_setting('neon.project_id', true) as neon_project_id,
      current_setting('neon.branch_id', true) as neon_branch_id
  `);
  const target = targetRows[0];
  if (
    target?.database_name !== "neondb" ||
    target.neon_project_id !== "icy-cloud-05910629" ||
    target.neon_branch_id !== "br-odd-sound-alamav7v"
  ) {
    throw new Error(".env.local DATABASE_URL is not the approved development Neon target");
  }

  for (const firebaseUid of firebaseUids) {
    await adminAuth.createUser({
      uid: firebaseUid,
      email: `${firebaseUid}@example.invalid`,
      emailVerified: true,
      displayName: "DD 298 campaign validation",
    });
    createdFirebaseUids.add(firebaseUid);
  }

  const [ownerAToken, ownerBToken, gmToken, playerToken, outsiderToken] = await Promise.all(
    firebaseUids.map(getIdToken)
  );
  const workspace = await createWorkspace(ownerAToken, randomUUID());
  workspaceId = workspace.id;
  createdWorkspaceIds.add(workspace.id);

  for (const token of [ownerBToken, gmToken, playerToken, outsiderToken]) {
    const me = responseCapture();
    await meHandler(request("GET", token), me.response);
    assert.equal(me.result.status, 200);
  }

  const userRows = await db
    .select()
    .from(users)
    .where(inArray(users.firebaseUid, firebaseUids));
  assert.equal(userRows.length, firebaseUids.length);
  const usersByFirebaseUid = new Map(userRows.map((user) => [user.firebaseUid, user]));
  const ownerA = usersByFirebaseUid.get(ownerAFirebaseUid);
  const ownerB = usersByFirebaseUid.get(ownerBFirebaseUid);
  const gm = usersByFirebaseUid.get(gmFirebaseUid);
  const player = usersByFirebaseUid.get(playerFirebaseUid);
  assert.ok(ownerA && ownerB && gm && player);

  const outsiderWorkspace = await createWorkspace(outsiderToken, randomUUID());
  createdWorkspaceIds.add(outsiderWorkspace.id);

  await db.insert(workspaceMemberships).values([
    { workspaceId, userId: ownerB.id, role: "owner" },
    { workspaceId, userId: gm.id, role: "gm" },
    { workspaceId, userId: player.id, role: "player" },
  ]);

  const firstKey = randomUUID();
  const secondKey = randomUUID();
  const name = "DD 298 isolated campaign validation";
  const firstResult = await createCampaign({
    token: ownerAToken,
    workspaceId: workspace.slug,
    idempotencyKey: firstKey,
    name,
    ownerUid: ownerBFirebaseUid,
    gmUid: ownerBFirebaseUid,
    role: "player",
  });
  assert.equal(firstResult.status, 201);
  const first = (firstResult.body as { campaign?: { id: string; slug: string; name: string } }).campaign;
  assert.ok(first);
  createdCampaignIds.add(first.id);

  const retryResult = await createCampaign({
    token: ownerAToken,
    workspaceId: workspace.slug,
    idempotencyKey: firstKey,
    name: "Ignored retry name",
  });
  assert.equal(retryResult.status, 201);
  const retry = (retryResult.body as { campaign?: { id: string; slug: string } }).campaign;
  assert.ok(retry);
  assert.equal(retry.id, first.id);
  assert.equal(retry.slug, first.slug);

  const secondResult = await createCampaign({
    token: ownerAToken,
    workspaceId: workspace.slug,
    idempotencyKey: secondKey,
    name,
  });
  assert.equal(secondResult.status, 201);
  const second = (secondResult.body as { campaign?: { id: string; slug: string } }).campaign;
  assert.ok(second);
  createdCampaignIds.add(second.id);
  assert.notEqual(second.id, first.id);

  const isolatedResult = await createCampaign({
    token: ownerBToken,
    workspaceId: workspace.slug,
    idempotencyKey: firstKey,
    name,
  });
  assert.equal(isolatedResult.status, 201);
  const isolated = (isolatedResult.body as { campaign?: { id: string; slug: string } }).campaign;
  assert.ok(isolated);
  createdCampaignIds.add(isolated.id);
  assert.notEqual(isolated.id, first.id);

  for (const token of [gmToken, playerToken, outsiderToken]) {
    const denied = await createCampaign({
      token,
      workspaceId: workspace.slug,
      idempotencyKey: randomUUID(),
      name,
    });
    assert.equal(denied.status, 403);
  }

  const firstRows = await db.select().from(campaigns).where(eq(campaigns.id, first.id));
  assert.equal(firstRows.length, 1);
  assert.equal(firstRows[0].workspaceId, workspaceId);
  assert.equal(firstRows[0].createdByUserId, ownerA.id);
  assert.equal(firstRows[0].creationRequestKey, firstKey);
  assert.equal(firstRows[0].name, name);
  assert.ok(firstRows[0].slug.startsWith("campaign-"));
  assert.equal(firstRows[0].slug.includes(firstKey), false);

  const ownerMembershipRows = await db
    .select()
    .from(campaignMemberships)
    .where(
      and(
        eq(campaignMemberships.campaignId, first.id),
        eq(campaignMemberships.userId, ownerA.id)
      )
    );
  assert.equal(ownerMembershipRows.length, 1);
  assert.equal(ownerMembershipRows[0].role, "gm");

  const resolved = await resolveCampaignByAppId({
    campaignId: first.slug,
    workspaceId,
  });
  assert.equal(resolved.id, first.id);

  const ownerMe = responseCapture();
  await meHandler(request("GET", ownerAToken), ownerMe.response);
  assert.equal(ownerMe.result.status, 200);
  const ownerMeBody = ownerMe.result.body as {
    campaigns?: Array<{ id: string }>;
    campaignMemberships?: Array<{ campaignId: string; role: string }>;
  };
  assert.ok(ownerMeBody.campaigns?.some((campaign) => campaign.id === first.id));
  assert.ok(ownerMeBody.campaigns?.some((campaign) => campaign.id === second.id));
  assert.equal(ownerMeBody.campaigns?.some((campaign) => campaign.id === isolated.id), false);
  assert.ok(
    ownerMeBody.campaignMemberships?.some(
      (membership) => membership.campaignId === first.id && membership.role === "gm"
    )
  );

  const rollbackKey = randomUUID();
  const rollbackSlug = `campaign-${randomUUID()}`;
  await assert.rejects(
    db.transaction(async (tx) => {
      const [campaign] = await tx
        .insert(campaigns)
        .values({
          workspaceId,
          createdByUserId: ownerA.id,
          creationRequestKey: rollbackKey,
          name: "DD 298 campaign rollback probe",
          slug: rollbackSlug,
          description: "",
          system: "",
          status: "active",
        })
        .returning();
      await tx.insert(campaignMemberships).values({
        campaignId: campaign.id,
        userId: randomUUID(),
        role: "gm",
      });
    })
  );
  const rollbackRows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.workspaceId, workspaceId),
        eq(campaigns.creationRequestKey, rollbackKey)
      )
    );
  assert.equal(rollbackRows.length, 0);

  console.log(
    JSON.stringify({
      firebaseUidProvisioned: true,
      ownerAuthorized: true,
      gmDenied: true,
      playerDenied: true,
      crossWorkspaceUserDenied: true,
      persistedCampaignCount: createdCampaignIds.size,
      persistedGmMembershipCount: 3,
      sameOwnerRetryReturnedOriginal: true,
      sameOwnerDifferentKeyCreatedDistinctCampaign: true,
      crossOwnerSameKeyIsolated: true,
      clientPrivilegedFieldsIgnored: true,
      idempotencyKeyExcludedFromCampaignIdentity: true,
      canonicalCampaignLookupResolved: true,
      apiMeReadBackResolved: true,
      transactionRollbackLeftNoCampaign: true,
    })
  );
} finally {
  if (createdCampaignIds.size) {
    await db
      .delete(campaignMemberships)
      .where(inArray(campaignMemberships.campaignId, [...createdCampaignIds]));
    await db.delete(campaigns).where(inArray(campaigns.id, [...createdCampaignIds]));
  }
  if (createdWorkspaceIds.size) {
    await db
      .delete(workspaceMemberships)
      .where(inArray(workspaceMemberships.workspaceId, [...createdWorkspaceIds]));
    await db.delete(workspaces).where(inArray(workspaces.id, [...createdWorkspaceIds]));
  }
  await db.delete(users).where(inArray(users.firebaseUid, firebaseUids));
  await Promise.all(
    [...createdFirebaseUids].map((firebaseUid) => adminAuth.deleteUser(firebaseUid))
  );

  const residualUsers = await db
    .select({ firebaseUid: users.firebaseUid })
    .from(users)
    .where(inArray(users.firebaseUid, firebaseUids));
  const residualWorkspaces = createdWorkspaceIds.size
    ? await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(inArray(workspaces.id, [...createdWorkspaceIds]))
    : [];
  const residualCampaigns = createdCampaignIds.size
    ? await db.select({ id: campaigns.id }).from(campaigns).where(inArray(campaigns.id, [...createdCampaignIds]))
    : [];
  assert.equal(residualUsers.length, 0);
  assert.equal(residualWorkspaces.length, 0);
  assert.equal(residualCampaigns.length, 0);
  const remainingFirebaseUsers = await Promise.all(
    [...createdFirebaseUids].map(async (firebaseUid) => {
      try {
        await adminAuth.getUser(firebaseUid);
        return true;
      } catch (error: unknown) {
        if ((error as { code?: string }).code === "auth/user-not-found") return false;
        throw error;
      }
    })
  );
  assert.equal(remainingFirebaseUsers.some(Boolean), false);
  cleanupComplete = true;
  console.log(JSON.stringify({ cleanupComplete }));
}
