import { removeTenantMember } from "../data/tenantMembers/tenantMembers.repo";
import {
  getCampaignMembershipsForUserInTenant,
  removeCampaignMember,
} from "../data/campaignMembers/campaignMembers.repo";
import {
  getAssignmentsForUserInCampaign,
  removeCharacterAssignment,
} from "../data/characterAssignments/characterAssignments.repo";

export async function removeWorkspaceMemberCascade(params: {
  tenantMemberId: string;
  tenantId: string;
  userId: string;
}): Promise<void> {
  const { tenantMemberId, tenantId, userId } = params;

  // 1. Remove tenant membership
  await removeTenantMember(tenantMemberId);

  // 2. Get all campaign memberships
  const campaignMemberships =
    await getCampaignMembershipsForUserInTenant(tenantId, userId);

  // 3. Cascade per campaign
  await Promise.all(
    campaignMemberships.map(async (membership) => {
      const campaignId = membership.campaignId;

      // remove assignments
      const assignments = await getAssignmentsForUserInCampaign(
        campaignId,
        userId
      );

      await Promise.all(
        assignments.map((a) => removeCharacterAssignment(a.id))
      );

      // remove campaign membership
      await removeCampaignMember(membership.id);
    })
  );
}