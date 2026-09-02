import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, gt, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";

import {
  getCurrentUser,
  normalizeEmail,
  requireCampaignMember,
  requireWorkspaceOwner,
  resolveCampaignByAppId,
  resolveWorkspaceByAppId,
} from "../../src/server/access.js";
import { AuthenticationError } from "../../src/server/apiErrors.js";
import { canViewAsGm } from "../../src/server/viewer-mode.js";
import { setCorsHeaders } from "../../src/server/cors.js";
import { db } from "../../src/server/db.js";
import {
  invitationCharacterAssignments,
  invitations,
} from "../../db/schema/invitations.js";
import { characterAssignments } from "../../db/schema/characterAssignments.js";
import { characters } from "../../db/schema/characters.js";
import { buildInviteEmailHtml } from "../../src/domain/mail/inviteEmail.template.js";
import {
  getInvitationCharacterIds,
  getInvitationCharacterIdsByInvitationId,
} from "../../src/server/invitation-characters.js";
import { sendTransactionalEmail } from "../../src/server/transactionalMail.js";
import {
  getInvitationResendAvailableAt,
  INVITATION_RESEND_COOLDOWN_MS,
} from "../../src/server/invitationLifecycle.js";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

class InvitationRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "InvitationRequestError";
  }
}

type InvitationScope = {
  workspace: { id: string; slug: string; name: string };
  campaign: { id: string; slug: string; name: string };
  userId: string;
};

function getFrontendOrigin(req: VercelRequest) {
  const requestOrigin = req.headers.origin;
  const headerOrigin = Array.isArray(requestOrigin)
    ? requestOrigin[0]
    : requestOrigin;

  return (
    headerOrigin ||
    process.env.VITE_APP_ORIGIN ||
    process.env.APP_ORIGIN ||
    "http://localhost:5173"
  );
}

function formatMailbox(name: string, email: string) {
  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim();
  return trimmedName ? `${trimmedName} <${trimmedEmail}>` : trimmedEmail;
}

const inviteEmailFrom = formatMailbox(
  process.env.INVITE_EMAIL_FROM_NAME || "Dopamine Dungeon Invites",
  process.env.INVITE_EMAIL_FROM || "invite@dopamine-dungeon.com"
);
const inviteEmailReplyTo = formatMailbox(
  process.env.INVITE_EMAIL_REPLY_TO_NAME || "Dopamine Dungeon",
  process.env.INVITE_EMAIL_REPLY_TO || "dopamine.dungeon.info@gmail.com"
);

const creationFields = new Set([
  "email",
  "tenantId",
  "campaignId",
  "campaignRole",
  "characterIds",
]);
const lifecycleFields = new Set(["tenantId", "campaignId", "invitationId"]);

function hasOnlyFields(body: unknown, fields: Set<string>) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return Object.keys(body).every((key) => fields.has(key));
}

function requestValue(req: VercelRequest, key: string) {
  const queryValue = req.query[key];
  if (typeof queryValue === "string") return queryValue.trim();
  if (req.body && typeof req.body === "object") {
    const bodyValue = (req.body as Record<string, unknown>)[key];
    if (typeof bodyValue === "string") return bodyValue.trim();
  }
  return "";
}

async function requireInvitationManager(
  req: VercelRequest,
  tenantId: string,
  campaignId: string
): Promise<InvitationScope> {
  let currentUser;
  try {
    currentUser = await getCurrentUser(req);
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new InvitationRequestError(401, "Authentication is required.");
  }

  let workspace;
  try {
    workspace = await resolveWorkspaceByAppId(tenantId);
  } catch {
    throw new InvitationRequestError(404, "Workspace not found.");
  }

  let campaign;
  try {
    campaign = await resolveCampaignByAppId({ campaignId, workspaceId: workspace.id });
  } catch {
    throw new InvitationRequestError(404, "Campaign not found.");
  }

  try {
    await requireWorkspaceOwner({ workspaceId: workspace.id, userId: currentUser.id });
    const campaignMembership = await requireCampaignMember({
      campaignId: campaign.id,
      userId: currentUser.id,
    });
    if (!canViewAsGm(req, campaignMembership.role)) {
      throw new InvitationRequestError(403, "Campaign GM mode required.");
    }
  } catch (error) {
    if (error instanceof InvitationRequestError) throw error;
    throw new InvitationRequestError(
      403,
      "Workspace owner and campaign GM permission required."
    );
  }

  return { workspace, campaign, userId: currentUser.id };
}

type InvitationStatusExecutor = {
  update: (table: typeof invitations) => any;
};

async function expirePendingInvitations(
  executor: InvitationStatusExecutor,
  scope: InvitationScope,
  now: Date,
  normalizedEmail?: string
) {
  const conditions = [
    eq(invitations.workspaceId, scope.workspace.id),
    eq(invitations.campaignId, scope.campaign.id),
    eq(invitations.status, "pending"),
    isNotNull(invitations.expiresAt),
    lte(invitations.expiresAt, now),
  ];
  if (normalizedEmail) conditions.push(eq(invitations.normalizedEmail, normalizedEmail));
  await executor.update(invitations).set({ status: "expired" }).where(and(...conditions));
}

function toInvitationResponse(
  invitation: typeof invitations.$inferSelect,
  characterIds: string[]
) {
  return {
    id: invitation.id,
    email: invitation.email,
    normalizedEmail: invitation.normalizedEmail,
    workspaceRole: invitation.workspaceRole,
    campaignRole: invitation.campaignRole,
    status: invitation.status,
    characterIds,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    lastSentAt: invitation.lastSentAt,
    resendAvailableAt: getInvitationResendAvailableAt(invitation.lastSentAt),
  };
}

async function sendInvitationDelivery(params: {
  req: VercelRequest;
  scope: InvitationScope;
  invitation: typeof invitations.$inferSelect;
  characterIds: string[];
}) {
  const matchingCharacters = params.characterIds.length
    ? await db
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.campaignId, params.scope.campaign.id),
            inArray(characters.id, params.characterIds)
          )
        )
    : [];
  const assignedCharacterNames = matchingCharacters
    .map((character) => String(character.name || "").trim())
    .filter(Boolean);

  await sendTransactionalEmail({
    to: params.invitation.email,
    from: inviteEmailFrom,
    replyTo: inviteEmailReplyTo,
    subject: "✨You’ve been summoned to a campaign✨",
    html: buildInviteEmailHtml({
      campaignName: params.scope.campaign.name,
      workspaceName: params.scope.workspace.name,
      inviteEmail: params.invitation.email,
      inviteLink: `${getFrontendOrigin(params.req)}/welcome?invited=true`,
      inviterName: "Dungeon Master",
      campaignRole: params.invitation.campaignRole,
      assignedCharacterNames,
    }),
  });
}

async function createInvitation(req: VercelRequest, res: VercelResponse) {
  if (!hasOnlyFields(req.body, creationFields)) {
    throw new InvitationRequestError(400, "Unsupported invitation fields.");
  }

  const email = String(req.body?.email || "").trim();
  const tenantId = String(req.body?.tenantId || "").trim();
  const campaignId = String(req.body?.campaignId || "").trim();
  const campaignRole = req.body?.campaignRole === "gm" ? "gm" : "player";
  const characterIds: string[] = Array.isArray(req.body?.characterIds)
    ? Array.from(
        new Set<string>(
          (req.body.characterIds as unknown[])
            .map((id) => String(id).trim())
            .filter(Boolean)
        )
      )
    : [];
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new InvitationRequestError(400, "Invite email is required.");

  const scope = await requireInvitationManager(req, tenantId, campaignId);
  const now = new Date();
  await expirePendingInvitations(db, scope, now, normalizedEmail);

  const existingPendingInvitations = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.normalizedEmail, normalizedEmail),
        eq(invitations.workspaceId, scope.workspace.id),
        eq(invitations.campaignId, scope.campaign.id),
        eq(invitations.campaignRole, campaignRole),
        eq(invitations.status, "pending")
      )
    )
    .limit(1);
  if (existingPendingInvitations[0]) {
    throw new InvitationRequestError(
      409,
      "There is already a pending invite for this player and role in this campaign."
    );
  }

  let matchingCharacters: Array<typeof characters.$inferSelect> = [];
  if (characterIds.length > 0) {
    const [fetchedCharacters, existingAssignments, pendingInvitations] = await Promise.all([
      db
        .select()
        .from(characters)
        .where(
          and(
            eq(characters.campaignId, scope.campaign.id),
            inArray(characters.id, characterIds)
          )
        ),
      db
        .select()
        .from(characterAssignments)
        .where(
          and(
            eq(characterAssignments.campaignId, scope.campaign.id),
            inArray(characterAssignments.characterId, characterIds)
          )
        ),
      db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.campaignId, scope.campaign.id),
            eq(invitations.status, "pending"),
            or(isNull(invitations.expiresAt), gt(invitations.expiresAt, now))
          )
        ),
    ]);
    matchingCharacters = fetchedCharacters;
    if (matchingCharacters.length !== characterIds.length) {
      throw new InvitationRequestError(400, "One or more selected characters do not exist.");
    }

    const pendingCharacterIdsByInvitationId =
      await getInvitationCharacterIdsByInvitationId(db, pendingInvitations);
    const pendingAssignedIds = new Set(
      Array.from(pendingCharacterIdsByInvitationId.values()).flat()
    );
    const blockedCharacterId =
      existingAssignments[0]?.characterId ||
      characterIds.find((characterId) => pendingAssignedIds.has(characterId));
    if (blockedCharacterId) {
      throw new InvitationRequestError(
        409,
        "One or more selected characters are already assigned."
      );
    }
  }

  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
  let invitation: typeof invitations.$inferSelect;
  try {
    invitation = await db.transaction(async (tx) => {
      await expirePendingInvitations(tx, scope, now, normalizedEmail);
      const insertedInvitations = await tx
        .insert(invitations)
        .values({
          email,
          normalizedEmail,
          workspaceId: scope.workspace.id,
          campaignId: scope.campaign.id,
          workspaceRole: "member",
          campaignRole,
          characterId: null,
          status: "pending",
          expiresAt,
          invitedByUserId: scope.userId,
          lastSentAt: now,
        })
        .returning();
      const insertedInvitation = insertedInvitations[0];
      if (!insertedInvitation) throw new Error("Invitation could not be created");
      if (characterIds.length) {
        await tx.insert(invitationCharacterAssignments).values(
          characterIds.map((characterId) => ({
            invitationId: insertedInvitation.id,
            characterId,
          }))
        );
      }
      return insertedInvitation;
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw new InvitationRequestError(
        409,
        "There is already a pending invite for this player and role in this campaign."
      );
    }
    throw error;
  }

  try {
    await sendInvitationDelivery({ req, scope, invitation, characterIds });
  } catch {
    throw new InvitationRequestError(
      502,
      "The invitation was created, but delivery could not be completed. Try resend shortly."
    );
  }

  return res.status(201).json({
    ok: true,
    invitation: {
      ...toInvitationResponse(invitation, characterIds),
      tenantId: scope.workspace.slug,
      campaignId: scope.campaign.slug,
    },
  });
}

async function listInvitations(req: VercelRequest, res: VercelResponse) {
  const scope = await requireInvitationManager(
    req,
    requestValue(req, "tenantId"),
    requestValue(req, "campaignId")
  );
  const now = new Date();
  await expirePendingInvitations(db, scope, now);
  const rows = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.workspaceId, scope.workspace.id),
        eq(invitations.campaignId, scope.campaign.id)
      )
    );
  const characterIdsByInvitationId = await getInvitationCharacterIdsByInvitationId(db, rows);
  const pendingFirst = [...rows].sort((left, right) => {
    const statusOrder = (invitation: typeof invitations.$inferSelect) =>
      invitation.status === "pending" ? 0 : 1;
    return (
      statusOrder(left) - statusOrder(right) ||
      right.createdAt.getTime() - left.createdAt.getTime()
    );
  });

  return res.status(200).json({
    ok: true,
    invitations: pendingFirst.map((invitation) =>
      toInvitationResponse(
        invitation,
        characterIdsByInvitationId.get(invitation.id) ?? []
      )
    ),
  });
}

async function resendInvitation(req: VercelRequest, res: VercelResponse) {
  if (!hasOnlyFields(req.body, lifecycleFields)) {
    throw new InvitationRequestError(400, "Unsupported invitation fields.");
  }
  const scope = await requireInvitationManager(
    req,
    requestValue(req, "tenantId"),
    requestValue(req, "campaignId")
  );
  const invitationId = requestValue(req, "invitationId");
  if (!invitationId) throw new InvitationRequestError(400, "invitationId is required.");

  const now = new Date();
  await expirePendingInvitations(db, scope, now);
  const retryCutoff = new Date(now.getTime() - INVITATION_RESEND_COOLDOWN_MS);
  const reservedRows = await db
    .update(invitations)
    .set({ lastSentAt: now })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.workspaceId, scope.workspace.id),
        eq(invitations.campaignId, scope.campaign.id),
        eq(invitations.status, "pending"),
        or(isNull(invitations.expiresAt), gt(invitations.expiresAt, now)),
        or(isNull(invitations.lastSentAt), lte(invitations.lastSentAt, retryCutoff))
      )
    )
    .returning();
  const invitation = reservedRows[0];

  if (!invitation) {
    const scopedRows = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.workspaceId, scope.workspace.id),
          eq(invitations.campaignId, scope.campaign.id)
        )
      )
      .limit(1);
    const scopedInvitation = scopedRows[0];
    if (!scopedInvitation) throw new InvitationRequestError(404, "Invitation not found.");
    if (scopedInvitation.status !== "pending") {
      throw new InvitationRequestError(409, "Only pending invitations can be resent.");
    }
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        ((scopedInvitation.lastSentAt?.getTime() ?? now.getTime()) +
          INVITATION_RESEND_COOLDOWN_MS -
          now.getTime()) /
          1000
      )
    );
    throw new InvitationRequestError(
      429,
      "This invitation was sent recently. Try again shortly.",
      retryAfterSeconds
    );
  }

  const characterIds = await getInvitationCharacterIds(db, invitation);
  try {
    await sendInvitationDelivery({ req, scope, invitation, characterIds });
  } catch {
    throw new InvitationRequestError(
      502,
      "The invitation could not be delivered. Try again after the cooldown."
    );
  }
  return res.status(200).json({
    ok: true,
    invitation: toInvitationResponse(invitation, characterIds),
  });
}

async function revokeInvitation(req: VercelRequest, res: VercelResponse) {
  if (!hasOnlyFields(req.body, lifecycleFields)) {
    throw new InvitationRequestError(400, "Unsupported invitation fields.");
  }
  const scope = await requireInvitationManager(
    req,
    requestValue(req, "tenantId"),
    requestValue(req, "campaignId")
  );
  const invitationId = requestValue(req, "invitationId");
  if (!invitationId) throw new InvitationRequestError(400, "invitationId is required.");

  const now = new Date();
  await expirePendingInvitations(db, scope, now);
  const revokedRows = await db
    .update(invitations)
    .set({ status: "revoked", revokedAt: now })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.workspaceId, scope.workspace.id),
        eq(invitations.campaignId, scope.campaign.id),
        eq(invitations.status, "pending"),
        or(isNull(invitations.expiresAt), gt(invitations.expiresAt, now))
      )
    )
    .returning();
  const invitation = revokedRows[0];
  if (!invitation) {
    const scopedRows = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.workspaceId, scope.workspace.id),
          eq(invitations.campaignId, scope.campaign.id)
        )
      )
      .limit(1);
    if (!scopedRows[0]) throw new InvitationRequestError(404, "Invitation not found.");
    throw new InvitationRequestError(409, "Only pending invitations can be revoked.");
  }

  const characterIds = await getInvitationCharacterIds(db, invitation);
  return res.status(200).json({
    ok: true,
    invitation: toInvitationResponse(invitation, characterIds),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") return await listInvitations(req, res);
    if (req.method === "POST") return await createInvitation(req, res);
    if (req.method === "PATCH") return await resendInvitation(req, res);
    if (req.method === "DELETE") return await revokeInvitation(req, res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    if (error instanceof InvitationRequestError) {
      if (error.retryAfterSeconds) res.setHeader("Retry-After", String(error.retryAfterSeconds));
      return res.status(error.status).json({
        ok: false,
        error: error.message,
        ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
      });
    }
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ ok: false, error: error.message });
    }
    console.error("[api/invitations] Request failed", error);
    return res.status(500).json({ ok: false, error: "Invitation request could not be completed." });
  }
}
