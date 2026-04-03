export type InvitationStatus = "pending" | "accepted" | "revoked";

export type Invitation = {
  id: string;
  email: string;
  normalizedEmail: string;
  tenantId: string;
  campaignId: string | null;
  workspaceRole: "member";
  campaignRole: "player" | null;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: number;
  acceptedAt?: number;
  acceptedByUserId?: string;
};