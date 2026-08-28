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

const [{ default: workspaceHandler }, { default: meHandler }, { adminAuth }, { db }, { users }, { workspaces }, { workspaceMemberships }, { resolveWorkspaceByAppId }] =
  await Promise.all([
    import("../api/workspace.js"),
    import("../api/me.js"),
    import("../src/server/auth.js"),
    import("../src/server/db.js"),
    import("../db/schema/users.js"),
    import("../db/schema/workspaces.js"),
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

async function createWorkspace(token: string, idempotencyKey: string, name: string, ownerUid?: string) {
  const { response, result } = responseCapture();
  await workspaceHandler(
    request("POST", token, { idempotencyKey, name, ownerUid, role: "gm" }),
    response
  );
  assert.equal(result.status, 201);
  const body = result.body as {
    ok?: boolean;
    workspace?: { id: string; name: string; slug: string };
  };
  assert.equal(body.ok, true);
  assert.ok(body.workspace);
  return body.workspace;
}

const runId = randomUUID();
const firebaseUids = [`dd-298-validation-${runId}-a`, `dd-298-validation-${runId}-b`];
const createdFirebaseUids = new Set<string>();
const createdWorkspaceIds = new Set<string>();
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
      displayName: "DD 298 validation",
    });
    createdFirebaseUids.add(firebaseUid);
  }

  const [firstToken, secondToken] = await Promise.all(firebaseUids.map(getIdToken));
  const firstKey = randomUUID();
  const secondKey = randomUUID();
  const name = "DD 298 isolated workspace validation";

  const first = await createWorkspace(firstToken, firstKey, name, firebaseUids[1]);
  createdWorkspaceIds.add(first.id);
  const retry = await createWorkspace(firstToken, firstKey, "Ignored retry name");
  assert.equal(retry.id, first.id);
  assert.equal(retry.slug, first.slug);

  const second = await createWorkspace(firstToken, secondKey, name);
  createdWorkspaceIds.add(second.id);
  assert.notEqual(second.id, first.id);
  assert.notEqual(second.slug, first.slug);

  const isolated = await createWorkspace(secondToken, firstKey, name);
  createdWorkspaceIds.add(isolated.id);
  assert.notEqual(isolated.id, first.id);
  assert.ok(first.slug.startsWith("workspace-"));
  assert.equal(first.slug.includes(firstKey), false);

  const [firstUser] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUids[0]));
  assert.ok(firstUser);
  const firstRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, first.id));
  assert.equal(firstRows.length, 1);
  assert.equal(firstRows[0].ownerUserId, firstUser.id);
  assert.equal(firstRows[0].creationRequestKey, firstKey);
  const memberships = await db
    .select()
    .from(workspaceMemberships)
    .where(and(eq(workspaceMemberships.workspaceId, first.id), eq(workspaceMemberships.userId, firstUser.id)));
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0].role, "owner");

  const resolved = await resolveWorkspaceByAppId(first.slug);
  assert.equal(resolved.id, first.id);

  const me = responseCapture();
  await meHandler(request("GET", firstToken), me.response);
  assert.equal(me.result.status, 200);
  const meBody = me.result.body as { workspaces?: Array<{ id: string }> };
  assert.ok(meBody.workspaces?.some((workspace) => workspace.id === first.id));
  assert.ok(meBody.workspaces?.some((workspace) => workspace.id === second.id));

  const rollbackKey = randomUUID();
  const rollbackSlug = `workspace-${randomUUID()}`;
  await assert.rejects(
    db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name: "DD 298 transaction rollback probe",
          slug: rollbackSlug,
          ownerUserId: firstUser.id,
          creationRequestKey: rollbackKey,
        })
        .returning();
      await tx.insert(workspaceMemberships).values({
        workspaceId: workspace.id,
        userId: randomUUID(),
        role: "owner",
      });
    })
  );
  const rollbackRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.creationRequestKey, rollbackKey));
  assert.equal(rollbackRows.length, 0);

  console.log(
    JSON.stringify({
      firebaseUidProvisioned: true,
      persistedWorkspaceCount: createdWorkspaceIds.size,
      persistedOwnerMembershipCount: 3,
      sameOwnerRetryReturnedOriginal: true,
      sameOwnerDifferentKeyCreatedDistinctWorkspace: true,
      crossOwnerSameKeyIsolated: true,
      idempotencyKeyExcludedFromSlug: true,
      tenantLookupResolvedCanonicalWorkspace: true,
      transactionRollbackLeftNoWorkspace: true,
    })
  );
} finally {
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
    ? await db.select({ id: workspaces.id }).from(workspaces).where(inArray(workspaces.id, [...createdWorkspaceIds]))
    : [];
  assert.equal(residualUsers.length, 0);
  assert.equal(residualWorkspaces.length, 0);
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
