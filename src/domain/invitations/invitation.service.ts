import { doc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  createInvitation,
  getPendingInvitationsByEmail,
  getPendingInvitationsByEmail as getPendingInvitationsByNormalizedEmail,
} from "../../data/invitations/invitations.repo";
import { getTenantById } from "../../data/tenants/tenant.repo";
import { getCampaignById } from "../../data/campaigns/campaigns.repo";
import { getCampaignMembershipForUserInCampaign } from "../../data/campaignMembers/campaignMembers.repo";
import { getAssignmentsForUserInCampaign } from "../../data/characterAssignments/characterAssignments.repo";
import { createMail } from "../../data/mail/mail.repo";
import { buildInviteEmailHtml } from "../mail/inviteEmail.template";
import type { Invitation } from "./invitation.types";
import type { TenantMember } from "../tenants/tenant.types";
import type { CampaignMember } from "../campaigns/campaign.types";
import type { CharacterAssignment } from "../characterAssignments/characterAssignment.types";

type InvitePlayerInput = {
  email: string;
  tenantId: string;
  campaignId: string | null;
  invitedBy: string;
};

type AcceptPendingInvitationsInput = {
  userId: string;
  email: string;
  displayName?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function matchesInvitationScope(
  invitation: Pick<Invitation, "tenantId" | "campaignId" | "status">,
  tenantId: string,
  campaignId: string | null
): boolean {
  return (
    invitation.status === "pending" &&
    invitation.tenantId === tenantId &&
    invitation.campaignId === campaignId
  );
}

export async function invitePlayerToCampaign({
  email,
  tenantId,
  campaignId,
  invitedBy,
}: InvitePlayerInput): Promise<Invitation> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Invite email cannot be empty.");
  }

  const existingPendingInvitations = await getPendingInvitationsByNormalizedEmail(normalizedEmail);
  const duplicatePendingInvitation = existingPendingInvitations.find((invitation) =>
    matchesInvitationScope(invitation, tenantId, campaignId)
  );

  if (duplicatePendingInvitation) {
    throw new Error("There is already a pending invite for this player in this campaign.");
  }
  const invitation = await createInvitation({
    email: email.trim(),
    tenantId,
    campaignId,
    workspaceRole: "member",
    campaignRole: campaignId ? "player" : null,
    invitedBy,
  });

  const tenant = await getTenantById(tenantId);
  const campaign = campaignId ? await getCampaignById(campaignId) : null;

  const inviteLink = `${window.location.origin}/welcome?invited=true`;

  await createMail({
    to: [invitation.email],
    message: {
      subject: "✨You’ve been summoned to a campaign✨",
      html: buildInviteEmailHtml({
        campaignName: campaign?.name ?? "a campaign",
        workspaceName: tenant?.name ?? "Dopamine Dungeon",
        inviteEmail: invitation.email,
        inviteLink,
        inviterName: "Dungeon Master",
      }),
    },
  });

  return invitation;
}

export async function acceptPendingInvitationsForUser({
  userId,
  email,
  displayName,
}: AcceptPendingInvitationsInput): Promise<Invitation[]> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("User email cannot be empty.");
  }

  const invitations = await getPendingInvitationsByEmail(normalizedEmail);

  if (invitations.length === 0) {
    return [];
  }

  const now = Date.now();
  const batch = writeBatch(db);

  const uniqueTenantIds = new Set<string>();
  const uniqueCampaignKeys = new Set<string>();
  const uniqueCharacterAssignmentKeys = new Set<string>();
  const existingCharacterIdsByCampaign = new Map<string, Set<string>>();

  for (const invitation of invitations) {
    if (!uniqueTenantIds.has(invitation.tenantId)) {
      uniqueTenantIds.add(invitation.tenantId);

      const tenantMemberId = crypto.randomUUID();
      const tenantMember: TenantMember = {
        id: tenantMemberId,
        tenantId: invitation.tenantId,
        userId,
        role: invitation.workspaceRole,
        createdAt: now,
        createdBy: invitation.invitedBy,
      };

      batch.set(doc(db, "tenantMembers", tenantMemberId), tenantMember);
    }

    if (invitation.campaignId) {
      const campaignKey = `${invitation.tenantId}:${invitation.campaignId}`;

      if (!uniqueCampaignKeys.has(campaignKey)) {
        uniqueCampaignKeys.add(campaignKey);

        const existingCampaignMembership = await getCampaignMembershipForUserInCampaign(
          invitation.tenantId,
          invitation.campaignId,
          userId
        );

        if (!existingCampaignMembership) {
          const campaignMemberId = crypto.randomUUID();
          const campaignMember: CampaignMember = {
            id: campaignMemberId,
            tenantId: invitation.tenantId,
            campaignId: invitation.campaignId,
            userId,
            role: invitation.campaignRole ?? "player",
            characterId: null,
            createdAt: now,
            createdBy: invitation.invitedBy,
          };

          batch.set(doc(db, "campaignMembers", campaignMemberId), campaignMember);
        }
      }

      if (invitation.characterIds?.length) {
        let existingCharacterIds = existingCharacterIdsByCampaign.get(invitation.campaignId);

        if (!existingCharacterIds) {
          const existingAssignments = await getAssignmentsForUserInCampaign(
            invitation.campaignId,
            userId
          );

          existingCharacterIds = new Set(
            existingAssignments.map((assignment) => assignment.characterId)
          );

          existingCharacterIdsByCampaign.set(invitation.campaignId, existingCharacterIds);
        }

        for (const characterId of new Set(invitation.characterIds.filter(Boolean))) {
          const assignmentKey = `${invitation.campaignId}:${userId}:${characterId}`;

          if (
            !existingCharacterIds.has(characterId) &&
            !uniqueCharacterAssignmentKeys.has(assignmentKey)
          ) {
            uniqueCharacterAssignmentKeys.add(assignmentKey);
            existingCharacterIds.add(characterId);

            const characterAssignmentId = crypto.randomUUID();
            const characterAssignment: CharacterAssignment = {
              id: characterAssignmentId,
              tenantId: invitation.tenantId,
              campaignId: invitation.campaignId,
              characterId,
              userId,
              createdAt: now,
              createdBy: invitation.invitedBy,
            };

            batch.set(
              doc(db, "characterAssignments", characterAssignmentId),
              characterAssignment
            );
          }
        }
      }
    }

    batch.update(doc(db, "invitations", invitation.id), {
      status: "accepted",
      acceptedAt: now,
      acceptedByUserId: userId,
    });
  }

  batch.set(
    doc(db, "users", userId),
    {
      displayName: displayName ?? "",
      email,
      normalizedEmail,
      onboardingState: "active",
      updatedAt: now,
    },
    { merge: true }
  );

  await batch.commit();

  return invitations.map((invitation) => ({
    ...invitation,
    status: "accepted",
    acceptedAt: now,
    acceptedByUserId: userId,
  }));
}