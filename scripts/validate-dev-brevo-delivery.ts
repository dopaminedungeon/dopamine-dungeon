import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const recipient = "dopamine.dungeon.info+dd298-validation@gmail.com";
const recoveryOnly = process.env.DD_BREVO_VALIDATION_PHASE === "recovery";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).flatMap((line) => { const m = line.match(/^([^#=]+)=(.*)$/); return m ? [[m[1].trim(), m[2].trim().replace(/^"|"$/g, "")]] : []; }));
for (const key of ["DATABASE_URL", "BREVO_API_KEY", "VITE_FIREBASE_API_KEY_DEV", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "PASSWORD_RECOVERY_FINGERPRINT_SECRET"]) if (!env[key]) throw new Error(`Missing development ${key}`);
for (const [key, value] of Object.entries(env)) if (key === "DATABASE_URL" || key === "BREVO_API_KEY" || key.startsWith("FIREBASE_") || key.startsWith("VITE_FIREBASE_") || key === "PASSWORD_RECOVERY_FINGERPRINT_SECRET") process.env[key] = value;
const [{ default: invite }, { default: verify }, { default: recovery }, { adminAuth, adminDb }, { db }, { users }, { workspaces }, { campaigns }, { workspaceMemberships, campaignMemberships }, { invitations }] = await Promise.all([import("../api/invitations/index.js"), import("../api/auth/send-verification-email.js"), import("../api/auth/send-password-reset-email.js"), import("../src/server/auth.js"), import("../src/server/db.js"), import("../db/schema/users.js"), import("../db/schema/workspaces.js"), import("../db/schema/campaigns.js"), import("../db/schema/memberships.js"), import("../db/schema/invitations.js")]);
function cap() { const result: { status?: number; body?: any } = {}; const response = { end: () => response, setHeader: () => response, status: (s: number) => { result.status = s; return response; }, json: (b: any) => { result.body = b; return response; } } as unknown as VercelResponse; return { result, response }; }
function request(method: string, token?: string, body?: Record<string, unknown>, mode?: "gm" | "player") { return { method, body, query: {}, socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost:3000", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(mode ? { "x-dd-mode": mode } : {}) } } as unknown as VercelRequest; }
async function token(uid: string) { const custom = await adminAuth.createCustomToken(uid); const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(env.VITE_FIREBASE_API_KEY_DEV!)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }) }); const body = await response.json() as { idToken?: string }; if (!body.idToken) throw new Error("Development Firebase token exchange failed"); return body.idToken; }
const run = randomUUID(); const gmUid = `dd-298-brevo-gm-${run}`; const authUid = `dd-298-brevo-auth-${run}`; let workspaceId = ""; let campaignId = "";
try {
  const [target] = await db.execute(sql`select current_database() as database_name,current_setting('neon.project_id',true) as project_id,current_setting('neon.branch_id',true) as branch_id`); assert.deepEqual(target, { database_name: "neondb", project_id: "icy-cloud-05910629", branch_id: "br-odd-sound-alamav7v" });
  await adminAuth.createUser({ uid: gmUid, email: `${gmUid}@example.invalid`, emailVerified: true }); await adminAuth.createUser({ uid: authUid, email: recipient, emailVerified: false, password: `Dd!${randomUUID()}` });
  const gmToken = await token(gmUid); const authToken = await token(authUid);
  const { default: me } = await import("../api/me.js"); { const c = cap(); await me(request("GET", gmToken), c.response); assert.equal(c.result.status, 200); }
  const rows = await db.select().from(users).where(inArray(users.firebaseUid, [gmUid, authUid])); const gm = rows.find((row) => row.firebaseUid === gmUid)!;
  const [workspace] = await db.insert(workspaces).values({ name: "DD 298 Brevo validation", slug: `dd-298-brevo-${run}`, ownerUserId: gm.id, creationRequestKey: randomUUID() }).returning(); workspaceId = workspace.id;
  const [campaign] = await db.insert(campaigns).values({ workspaceId, createdByUserId: gm.id, creationRequestKey: randomUUID(), name: "DD 298 Brevo", slug: `dd-298-brevo-${run}`, description: "", system: "", status: "active" }).returning(); campaignId = campaign.id;
  await db.insert(workspaceMemberships).values({ workspaceId, userId: gm.id, role: "owner" }); await db.insert(campaignMemberships).values({ campaignId, userId: gm.id, role: "gm" });
  if (!recoveryOnly) {
    const invitation = cap(); await invite(request("POST", gmToken, { email: recipient, tenantId: workspace.slug, campaignId: campaign.slug }, "gm"), invitation.response); assert.equal(invitation.result.status, 201);
    const verification = cap(); await verify(request("POST", authToken, { invited: false }), verification.response); assert.equal(verification.result.status, 202);
  }
  await adminAuth.updateUser(authUid, { emailVerified: true }); const recoveryCapture = cap(); await recovery(request("POST", undefined, { email: recipient }), recoveryCapture.response); assert.equal(recoveryCapture.result.status, 202);
  const mailDocs = await adminDb.collection("mail").where("to", "array-contains", recipient).get(); assert.equal(mailDocs.docs.length, 0);
  if (!recoveryOnly) { const [storedInvite] = await db.select().from(invitations).where(eq(invitations.normalizedEmail, recipient)); assert.equal(storedInvite.status, "pending"); }
  console.log(recoveryOnly ? "Brevo recovery delivery validation passed." : "Brevo development delivery validation passed; three approved messages were sent.");
} finally {
  if (campaignId) { await db.delete(invitations).where(eq(invitations.campaignId, campaignId)); await db.delete(campaignMemberships).where(eq(campaignMemberships.campaignId, campaignId)); await db.delete(campaigns).where(eq(campaigns.id, campaignId)); }
  if (workspaceId) { await db.delete(workspaceMemberships).where(eq(workspaceMemberships.workspaceId, workspaceId)); await db.delete(workspaces).where(eq(workspaces.id, workspaceId)); }
  const rows = await db.select().from(users).where(inArray(users.firebaseUid, [gmUid, authUid])); if (rows.length) await db.delete(users).where(inArray(users.id, rows.map((row) => row.id)));
  for (const uid of [gmUid, authUid]) { try { await adminAuth.deleteUser(uid); } catch {} }
  console.log("Brevo validation Firebase and Neon cleanup completed; delivered mail cannot be recalled.");
}
