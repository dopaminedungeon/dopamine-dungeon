import { inArray } from "drizzle-orm";

import { db } from "../api/_lib/db";
import { campaigns } from "../db/schema/campaigns";
import { campaignMemberships } from "../db/schema/memberships";

type CampaignRow = typeof campaigns.$inferSelect;
type CampaignMembershipRow = typeof campaignMemberships.$inferSelect;

type CleanupGroup = {
  slug: string;
  keep: CampaignRow;
  deleteCampaigns: CampaignRow[];
  deleteMemberships: CampaignMembershipRow[];
};

const shouldApply = process.argv.includes("--apply");

function sortCampaignsForKeep(rows: CampaignRow[]): CampaignRow[] {
  return [...rows].sort((a, b) => {
    const createdA = a.createdAt?.getTime?.() ?? 0;
    const createdB = b.createdAt?.getTime?.() ?? 0;

    if (createdA !== createdB) {
      return createdA - createdB;
    }

    return a.id.localeCompare(b.id);
  });
}

function groupDuplicateCampaigns(
  campaignRows: CampaignRow[],
  membershipRows: CampaignMembershipRow[]
): CleanupGroup[] {
  const campaignsBySlug = new Map<string, CampaignRow[]>();

  for (const campaign of campaignRows) {
    const existing = campaignsBySlug.get(campaign.slug) ?? [];
    existing.push(campaign);
    campaignsBySlug.set(campaign.slug, existing);
  }

  return [...campaignsBySlug.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([slug, rows]) => {
      const sortedRows = sortCampaignsForKeep(rows);
      const keep = sortedRows[0];
      const deleteCampaigns = sortedRows.slice(1);
      const deleteCampaignIds = new Set(deleteCampaigns.map((row) => row.id));

      return {
        slug,
        keep,
        deleteCampaigns,
        deleteMemberships: membershipRows.filter((membership) =>
          deleteCampaignIds.has(membership.campaignId)
        ),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function printGroup(group: CleanupGroup) {
  console.log(`\nDuplicate slug: ${group.slug}`);
  console.log(`  Kept campaign id: ${group.keep.id}`);
  console.log(
    `  Deleted campaign ids: ${
      group.deleteCampaigns.map((campaign) => campaign.id).join(", ") || "(none)"
    }`
  );
  console.log(
    `  Deleted membership ids: ${
      group.deleteMemberships.map((membership) => membership.id).join(", ") ||
      "(none)"
    }`
  );
}

async function main() {
  console.log(
    shouldApply
      ? "Applying duplicate campaign cleanup."
      : "Dry run only. Re-run with --apply to delete duplicate campaigns."
  );

  const [campaignRows, membershipRows] = await Promise.all([
    db.select().from(campaigns),
    db.select().from(campaignMemberships),
  ]);

  const cleanupGroups = groupDuplicateCampaigns(campaignRows, membershipRows);

  if (cleanupGroups.length === 0) {
    console.log("\nNo duplicate campaign slugs found.");
    return;
  }

  for (const group of cleanupGroups) {
    printGroup(group);
  }

  const deleteCampaignIds = cleanupGroups.flatMap((group) =>
    group.deleteCampaigns.map((campaign) => campaign.id)
  );
  const deleteMembershipIds = cleanupGroups.flatMap((group) =>
    group.deleteMemberships.map((membership) => membership.id)
  );

  console.log(
    `\nSummary: ${deleteCampaignIds.length} campaign rows and ${deleteMembershipIds.length} campaign membership rows ${
      shouldApply ? "selected for deletion." : "would be deleted."
    }`
  );

  if (!shouldApply) {
    return;
  }

  await db.transaction(async (tx) => {
    if (deleteMembershipIds.length > 0) {
      await tx
        .delete(campaignMemberships)
        .where(inArray(campaignMemberships.id, deleteMembershipIds));
    }

    if (deleteCampaignIds.length > 0) {
      await tx.delete(campaigns).where(inArray(campaigns.id, deleteCampaignIds));
    }
  });

  console.log("\nCleanup applied.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to cleanup duplicate campaigns:", error);
    process.exit(1);
  });
