import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const values = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      return match ? [[match[1].trim(), match[2].trim().replace(/^"|"$/g, "")]] : [];
    })
);
if (!values.DATABASE_URL || !values.VITE_FIREBASE_API_KEY_DEV) throw new Error("Required .env.local values are missing");
delete process.env.DATABASE_URL;
delete process.env.NEON_DATABASE_URL;
for (const [key, value] of Object.entries(values)) {
  if (key === "DATABASE_URL" || key.startsWith("FIREBASE_") || key.startsWith("VITE_FIREBASE_")) process.env[key] = value;
}

const [
  { default: invitationHandler }, { default: acceptHandler }, { default: assignmentHandler },
  { adminAuth, adminDb }, { db }, { users }, { workspaces }, { campaigns },
  { workspaceMemberships, campaignMemberships }, { invitations, invitationCharacterAssignments },
  { characterAssignments }, { characters },
] = await Promise.all([
  import("../api/invitations/index.js"), import("../api/invitations/accept-pending.js"),
  import("../src/server/api-handlers/character-assignments.js"), import("../src/server/auth.js"),
  import("../src/server/db.js"), import("../db/schema/users.js"), import("../db/schema/workspaces.js"),
  import("../db/schema/campaigns.js"), import("../db/schema/memberships.js"),
  import("../db/schema/invitations.js"), import("../db/schema/characterAssignments.js"),
  import("../db/schema/characters.js"),
]);

function capture() {
  const result: { status?: number; body?: any } = {};
  const response = { end: () => response, setHeader: () => response, status: (status: number) => { result.status = status; return response; }, json: (body: any) => { result.body = body; return response; } } as unknown as VercelResponse;
  return { result, response };
}
function req(method: string, token?: string, body?: Record<string, unknown>, mode?: "gm" | "player") {
  return { method, body, query: body?.campaignId ? {} : {}, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(mode ? { "x-dd-mode": mode } : {}) } } as unknown as VercelRequest;
}
async function token(uid: string) {
  const customToken = await adminAuth.createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(values.VITE_FIREBASE_API_KEY_DEV)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const body = await response.json() as { idToken?: string };
  if (!response.ok || !body.idToken) throw new Error("Firebase token exchange failed");
  return body.idToken;
}

const run = randomUUID();
const uids = ["gm", "player", "recipient", "existing-gm", "existing-player", "legacy", "expired", "revoked"].map((name) => `dd-298-invite-${run}-${name}`);
const createdUsers = new Set<string>();
const mailRecipients = new Set<string>();
let workspaceId = "";
let campaignId = "";
let otherCampaignId = "";
try {
  const [target] = await db.execute(sql`select current_database() as database_name, current_setting('neon.project_id', true) as project_id, current_setting('neon.branch_id', true) as branch_id`);
  assert.deepEqual(target, { database_name: "neondb", project_id: "icy-cloud-05910629", branch_id: "br-odd-sound-alamav7v" });
  for (const uid of uids) { await adminAuth.createUser({ uid, email: `${uid}@example.invalid`, emailVerified: true }); createdUsers.add(uid); }
  const tokens = new Map(await Promise.all(uids.map(async (uid) => [uid, await token(uid)] as const)));
  // Provision users through the Firebase-authenticated identity boundary.
  const { default: meHandler } = await import("../api/me.js");
  for (const uid of uids) { const c = capture(); await meHandler(req("GET", tokens.get(uid)), c.response); assert.equal(c.result.status, 200); }
  const rows = await db.select().from(users).where(inArray(users.firebaseUid, uids));
  const user = new Map(rows.map((row) => [row.firebaseUid, row]));
  const gm = user.get(uids[0])!; const player = user.get(uids[1])!;
  const [workspace] = await db.insert(workspaces).values({ name: "DD 298 invitation validation", slug: `dd-298-${run}`, ownerUserId: gm.id, creationRequestKey: randomUUID() }).returning(); workspaceId = workspace.id;
  const [campaign, otherCampaign] = await db.insert(campaigns).values([
    { workspaceId, createdByUserId: gm.id, creationRequestKey: randomUUID(), name: "DD 298 invitation campaign", slug: `dd-298-${run}-a`, description: "", system: "", status: "active" },
    { workspaceId, createdByUserId: gm.id, creationRequestKey: randomUUID(), name: "DD 298 other campaign", slug: `dd-298-${run}-b`, description: "", system: "", status: "active" },
  ]).returning(); campaignId = campaign.id; otherCampaignId = otherCampaign.id;
  await db.insert(workspaceMemberships).values(uids.slice(0, 6).map((uid) => ({ workspaceId, userId: user.get(uid)!.id, role: uid === uids[0] ? "owner" : "member" })));
  await db.insert(campaignMemberships).values([{ campaignId, userId: gm.id, role: "gm" }, { campaignId, userId: player.id, role: "player" }]);
  const [characterA, characterB, legacyCharacterA, legacyCharacterB, foreignCharacter] = await db.insert(characters).values([
    { campaignId, id: `character-a-${run}`, name: "A", data: {} }, { campaignId, id: `character-b-${run}`, name: "B", data: {} },
    { campaignId, id: `legacy-a-${run}`, name: "Legacy A", data: {} }, { campaignId, id: `legacy-b-${run}`, name: "Legacy B", data: {} },
    { campaignId: otherCampaignId, id: `character-foreign-${run}`, name: "Foreign", data: {} },
  ]).returning();
  async function create(email: string, role: "player" | "gm", ids: string[]) { const c = capture(); await invitationHandler(req("POST", tokens.get(uids[0]), { email, tenantId: workspace.slug, campaignId: campaign.slug, campaignRole: role, characterIds: ids }, "gm"), c.response); if (c.result.status === 201) mailRecipients.add(email); return c.result; }
  const recipientEmail = `${uids[2]}@example.invalid`;
  const created = await create(recipientEmail, "player", [characterA.id, characterA.id, characterB.id]); assert.equal(created.status, 201);
  const [createdInvite] = await db.select().from(invitations).where(eq(invitations.normalizedEmail, recipientEmail));
  assert.equal(createdInvite.characterId, null); assert.ok(createdInvite.expiresAt); assert.ok(Math.abs(createdInvite.expiresAt!.getTime() - (Date.now() + 7 * 86400000)) < 10_000);
  const links = await db.select().from(invitationCharacterAssignments).where(eq(invitationCharacterAssignments.invitationId, createdInvite.id)); assert.equal(links.length, 2);
  const foreign = await create(`${run}-foreign@example.invalid`, "player", [foreignCharacter.id]); assert.equal(foreign.status, 400);
  const playerCreate = capture(); await invitationHandler(req("POST", tokens.get(uids[1]), { email: `${run}-denied@example.invalid`, tenantId: workspace.slug, campaignId: campaign.slug }, "player"), playerCreate.response); assert.equal(playerCreate.result.status, 401);
  async function accept(uid: string) { const c = capture(); await acceptHandler(req("POST", tokens.get(uid), {}), c.response); return c.result; }
  assert.equal((await accept(uids[2])).status, 200); assert.equal((await accept(uids[2])).body.acceptedInvitations.length, 0);
  assert.equal((await db.select().from(characterAssignments).where(eq(characterAssignments.userId, user.get(uids[2])!.id))).length, 2);
  // Existing roles are never altered by invitation acceptance.
  for (const [uid, existingRole, inviteRole] of [[uids[3], "gm", "player"], [uids[4], "player", "gm"]] as const) {
    await db.insert(campaignMemberships).values({ campaignId, userId: user.get(uid)!.id, role: existingRole });
    assert.equal((await create(`${uid}@example.invalid`, inviteRole, [])).status, 201); await accept(uid);
    const [membership] = await db.select().from(campaignMemberships).where(and(eq(campaignMemberships.campaignId, campaignId), eq(campaignMemberships.userId, user.get(uid)!.id))); assert.equal(membership.role, existingRole);
  }
  const [legacyInvite] = await db.insert(invitations).values({ email: `${uids[5]}@example.invalid`, normalizedEmail: `${uids[5]}@example.invalid`, workspaceId, campaignId, workspaceRole: "member", campaignRole: "player", characterId: `${legacyCharacterA.id},${legacyCharacterB.id}`, status: "pending", invitedByUserId: gm.id }).returning();
  await accept(uids[5]); assert.equal((await db.select().from(characterAssignments).where(eq(characterAssignments.userId, user.get(uids[5])!.id))).length, 2); assert.equal(legacyInvite.characterId.includes(","), true);
  for (const [uid, status] of [[uids[6], "expired"], [uids[7], "revoked"]] as const) {
    await db.insert(invitations).values({ email: `${uid}@example.invalid`, normalizedEmail: `${uid}@example.invalid`, workspaceId, campaignId, workspaceRole: "member", campaignRole: "player", status, expiresAt: new Date(Date.now() - 1_000), invitedByUserId: gm.id });
    await accept(uid); const memberships = await db.select().from(campaignMemberships).where(and(eq(campaignMemberships.campaignId, campaignId), eq(campaignMemberships.userId, user.get(uid)!.id))); assert.equal(memberships.length, 0);
  }
  const assignmentWrite = capture(); await assignmentHandler({ ...req("POST", tokens.get(uids[0]), { campaignId: campaign.slug, userId: player.id, characterId: characterA.id }, "player"), query: { campaignId: campaign.slug } } as VercelRequest, assignmentWrite.response); assert.equal(assignmentWrite.result.status, 401);
  console.log("Invitation persistence validator passed (all temporary records will be removed).");
} finally {
  if (campaignId) { await db.delete(invitationCharacterAssignments).where(inArray(invitationCharacterAssignments.invitationId, (await db.select({ id: invitations.id }).from(invitations).where(eq(invitations.campaignId, campaignId))).map((row) => row.id))); await db.delete(characterAssignments).where(eq(characterAssignments.campaignId, campaignId)); await db.delete(invitations).where(eq(invitations.campaignId, campaignId)); await db.delete(campaignMemberships).where(eq(campaignMemberships.campaignId, campaignId)); await db.delete(characters).where(eq(characters.campaignId, campaignId)); await db.delete(campaigns).where(eq(campaigns.id, campaignId)); }
  if (otherCampaignId) { await db.delete(characters).where(eq(characters.campaignId, otherCampaignId)); await db.delete(campaigns).where(eq(campaigns.id, otherCampaignId)); }
  if (workspaceId) { await db.delete(workspaceMemberships).where(eq(workspaceMemberships.workspaceId, workspaceId)); await db.delete(workspaces).where(eq(workspaces.id, workspaceId)); }
  const rows = createdUsers.size ? await db.select().from(users).where(inArray(users.firebaseUid, [...createdUsers])) : [];
  if (rows.length) await db.delete(users).where(inArray(users.id, rows.map((row) => row.id)));
  for (const email of mailRecipients) {
    const mailRows = await adminDb.collection("mail").where("to", "array-contains", email).get();
    await Promise.all(mailRows.docs.map((doc) => doc.ref.delete()));
  }
  await Promise.all([...createdUsers].map(async (uid) => { try { await adminAuth.deleteUser(uid); } catch {} }));
  console.log("Invitation persistence validator cleanup completed.");
}
