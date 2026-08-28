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
  if (
    key === "DATABASE_URL" ||
    key.startsWith("FIREBASE_") ||
    key.startsWith("VITE_FIREBASE_")
  ) {
    process.env[key] = value;
  }
}
delete process.env.NEON_DATABASE_URL;

const [
  { default: meHandler },
  { adminAuth },
  { db },
  { users },
  { workspaces },
  { campaigns },
  { workspaceMemberships, campaignMemberships },
  { provisionUserIdentity },
] = await Promise.all([
  import("../api/me.js"),
  import("../src/server/auth.js"),
  import("../src/server/db.js"),
  import("../db/schema/users.js"),
  import("../db/schema/workspaces.js"),
  import("../db/schema/campaigns.js"),
  import("../db/schema/memberships.js"),
  import("../src/server/userIdentity.js"),
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
  if (typeof body.idToken !== "string") {
    throw new Error("Development Firebase returned no ID token");
  }
  return body.idToken;
}

async function getMe(token: string) {
  const { response, result } = responseCapture();
  await meHandler(request("GET", token), response);
  assert.equal(result.status, 200);
  return result.body as {
    campaigns: Array<{ id: string }>;
    campaignMemberships: Array<{ campaignId: string; role: string }>;
    profile: { reducedMotion: boolean };
    user: { displayName: string | null; email: string | null; id: string };
    workspaceMemberships: Array<{ workspaceId: string; role: string }>;
    workspaces: Array<{ id: string }>;
  };
}

async function patchProfile(token: string, body: Record<string, unknown>) {
  const { response, result } = responseCapture();
  await meHandler(request("PATCH", token, body), response);
  return result;
}

const runId = randomUUID();
const firebaseUids = [
  `dd-298-profile-${runId}-a`,
  `dd-298-profile-${runId}-b`,
];
const [firstFirebaseUid, secondFirebaseUid] = firebaseUids;
const createdFirebaseUids = new Set<string>();
const createdWorkspaceIds = new Set<string>();
const createdCampaignIds = new Set<string>();

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

  await Promise.all(
    firebaseUids.map(async (uid, index) => {
      await adminAuth.createUser({
        uid,
        email: `${uid}@example.invalid`,
        emailVerified: true,
        displayName: `DD 298 Profile ${index + 1}`,
        photoURL: `https://example.invalid/profile-${index + 1}.png`,
      });
      createdFirebaseUids.add(uid);
    })
  );

  const [firstToken, secondToken] = await Promise.all(firebaseUids.map(getIdToken));
  const firstInitial = await getMe(firstToken);
  const secondInitial = await getMe(secondToken);
  assert.equal(firstInitial.profile.reducedMotion, false);
  assert.equal(secondInitial.profile.reducedMotion, false);

  const initialRows = await db
    .select()
    .from(users)
    .where(inArray(users.firebaseUid, firebaseUids));
  assert.equal(initialRows.length, 2);
  const usersByFirebaseUid = new Map(initialRows.map((user) => [user.firebaseUid, user]));
  const firstUser = usersByFirebaseUid.get(firstFirebaseUid);
  const secondUser = usersByFirebaseUid.get(secondFirebaseUid);
  assert.ok(firstUser && secondUser);
  assert.notEqual(firstUser.id, secondUser.id);
  assert.equal(firstInitial.user.id, firstUser.id);
  assert.equal(secondInitial.user.id, secondUser.id);

  const sameEmail = `dd-298-profile-shared-${runId}@example.invalid`;
  const [sameEmailFirst, sameEmailSecond] = await Promise.all([
    provisionUserIdentity(db, {
      firebaseUid: firstFirebaseUid,
      email: sameEmail,
      displayName: "Same email first identity",
      emailVerifiedAt: new Date(),
    }),
    provisionUserIdentity(db, {
      firebaseUid: secondFirebaseUid,
      email: sameEmail,
      displayName: "Same email second identity",
      emailVerifiedAt: new Date(),
    }),
  ]);
  assert.notEqual(sameEmailFirst.id, sameEmailSecond.id);
  const sameEmailRows = await db
    .select({ firebaseUid: users.firebaseUid, id: users.id })
    .from(users)
    .where(inArray(users.firebaseUid, firebaseUids));
  assert.equal(sameEmailRows.length, 2);

  const firstRestored = await getMe(firstToken);
  const secondRestored = await getMe(secondToken);
  assert.equal(firstRestored.user.id, firstUser.id);
  assert.equal(secondRestored.user.id, secondUser.id);
  assert.equal(firstRestored.user.displayName, "DD 298 Profile 1");
  assert.equal(secondRestored.user.displayName, "DD 298 Profile 2");

  await db
    .update(users)
    .set({ displayName: "Poisoned Neon display name", email: "poisoned@example.invalid" })
    .where(eq(users.id, firstUser.id));
  const firstFirebaseDerived = await getMe(firstToken);
  assert.equal(firstFirebaseDerived.user.displayName, "DD 298 Profile 1");
  assert.equal(firstFirebaseDerived.user.email, `${firstFirebaseUid}@example.invalid`);
  assert.equal("photoURL" in firstFirebaseDerived.user, false);

  const updateResult = await patchProfile(firstToken, { reducedMotion: true });
  assert.equal(updateResult.status, 200);
  assert.deepEqual(updateResult.body, { ok: true, profile: { reducedMotion: true } });
  const firstRoundTrip = await getMe(firstToken);
  assert.equal(firstRoundTrip.profile.reducedMotion, true);
  const [storedPreference] = await db
    .select({ reducedMotion: users.reducedMotion })
    .from(users)
    .where(eq(users.id, firstUser.id));
  assert.equal(storedPreference?.reducedMotion, true);

  const targetedUpdate = await patchProfile(firstToken, {
    reducedMotion: false,
    userId: secondUser.id,
  });
  assert.equal(targetedUpdate.status, 400);
  const unknownFieldUpdate = await patchProfile(firstToken, { displayName: "Client supplied" });
  assert.equal(unknownFieldUpdate.status, 400);
  const privilegedFieldUpdate = await patchProfile(firstToken, {
    reducedMotion: false,
    email: "client@example.invalid",
  });
  assert.equal(privilegedFieldUpdate.status, 400);
  const [secondPreference] = await db
    .select({ reducedMotion: users.reducedMotion })
    .from(users)
    .where(eq(users.id, secondUser.id));
  assert.equal(secondPreference?.reducedMotion, false);

  const workspaceSlug = `workspace-${runId}`;
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: "DD 298 profile validation workspace",
      slug: workspaceSlug,
      ownerUserId: firstUser.id,
      creationRequestKey: randomUUID(),
    })
    .returning();
  createdWorkspaceIds.add(workspace.id);
  await db.insert(workspaceMemberships).values({
    workspaceId: workspace.id,
    userId: firstUser.id,
    role: "owner",
  });
  const [campaign] = await db
    .insert(campaigns)
    .values({
      workspaceId: workspace.id,
      createdByUserId: firstUser.id,
      creationRequestKey: randomUUID(),
      name: "DD 298 profile validation campaign",
      slug: `campaign-${runId}`,
      description: "",
      system: "",
      status: "active",
    })
    .returning();
  createdCampaignIds.add(campaign.id);
  await db.insert(campaignMemberships).values({
    campaignId: campaign.id,
    userId: firstUser.id,
    role: "gm",
  });
  const meWithMemberships = await getMe(firstToken);
  assert.ok(meWithMemberships.workspaces.some((candidate) => candidate.id === workspace.id));
  assert.ok(
    meWithMemberships.workspaceMemberships.some(
      (membership) => membership.workspaceId === workspace.id && membership.role === "owner"
    )
  );
  assert.ok(meWithMemberships.campaigns.some((candidate) => candidate.id === campaign.id));
  assert.ok(
    meWithMemberships.campaignMemberships.some(
      (membership) => membership.campaignId === campaign.id && membership.role === "gm"
    )
  );
  assert.equal("onboardingState" in firstRestored.user, false);
  assert.equal("lastLoginAt" in firstRestored.user, false);

  console.log(
    JSON.stringify({
      firebaseUidProvisioned: true,
      sameEmailDifferentUidStayedIsolated: true,
      firebaseDerivedFieldsRefreshed: true,
      photoUrlNotPersistedInNeon: true,
      reducedMotionRoundTripPersisted: true,
      callerSuppliedIdentityRejected: true,
      unknownAndPrivilegedFieldsRejected: true,
      canonicalMembershipStateReturnedByApiMe: true,
      retiredProfileFieldsNotRequired: true,
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

  const [residualUsers, residualWorkspaces, residualCampaigns] = await Promise.all([
    db
      .select({ firebaseUid: users.firebaseUid })
      .from(users)
      .where(inArray(users.firebaseUid, firebaseUids)),
    createdWorkspaceIds.size
      ? db.select({ id: workspaces.id }).from(workspaces).where(inArray(workspaces.id, [...createdWorkspaceIds]))
      : [],
    createdCampaignIds.size
      ? db.select({ id: campaigns.id }).from(campaigns).where(inArray(campaigns.id, [...createdCampaignIds]))
      : [],
  ]);
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
  console.log(JSON.stringify({ cleanupComplete: true }));
}
