import { db } from "../api/_lib/db";
import { campaigns } from "../db/schema/campaigns";
import {
  campaignMemberships,
  workspaceMemberships,
} from "../db/schema/memberships";
import { workspaces } from "../db/schema/workspaces";

type DuplicateGroup<T> = {
  key: string;
  rows: T[];
};

function groupDuplicates<T>(
  rows: T[],
  getKey: (row: T) => string
): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const key = getKey(row);
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .filter(([, groupRows]) => groupRows.length > 1)
    .map(([key, groupRows]) => ({ key, rows: groupRows }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function printDuplicateGroups<T extends { id: string }>(
  title: string,
  groups: DuplicateGroup<T>[],
  formatRow: (row: T) => Record<string, unknown>
) {
  console.log(`\n${title}`);

  if (groups.length === 0) {
    console.log("  No duplicates found.");
    return;
  }

  for (const group of groups) {
    console.log(`  ${group.key} (${group.rows.length} rows)`);

    for (const row of group.rows) {
      console.log(`    - ${JSON.stringify(formatRow(row))}`);
    }
  }
}

async function main() {
  console.log("Checking duplicate tenancy/campaign rows. Read-only.");

  const [
    workspaceRows,
    campaignRows,
    workspaceMembershipRows,
    campaignMembershipRows,
  ] = await Promise.all([
    db.select().from(workspaces),
    db.select().from(campaigns),
    db.select().from(workspaceMemberships),
    db.select().from(campaignMemberships),
  ]);

  const duplicateWorkspaces = groupDuplicates(
    workspaceRows,
    (workspace) => workspace.slug
  );
  const duplicateCampaigns = groupDuplicates(
    campaignRows,
    (campaign) => campaign.slug
  );
  const duplicateWorkspaceMemberships = groupDuplicates(
    workspaceMembershipRows,
    (membership) => `${membership.workspaceId}:${membership.userId}`
  );
  const duplicateCampaignMemberships = groupDuplicates(
    campaignMembershipRows,
    (membership) => `${membership.campaignId}:${membership.userId}`
  );

  printDuplicateGroups(
    "Duplicate workspaces by slug",
    duplicateWorkspaces,
    (workspace) => ({
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      ownerUserId: workspace.ownerUserId,
      createdAt: workspace.createdAt,
    })
  );

  printDuplicateGroups(
    "Duplicate campaigns by slug",
    duplicateCampaigns,
    (campaign) => ({
      id: campaign.id,
      slug: campaign.slug,
      workspaceId: campaign.workspaceId,
      name: campaign.name,
      status: campaign.status,
      createdAt: campaign.createdAt,
    })
  );

  printDuplicateGroups(
    "Duplicate workspace memberships by workspaceId+userId",
    duplicateWorkspaceMemberships,
    (membership) => ({
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt,
    })
  );

  printDuplicateGroups(
    "Duplicate campaign memberships by campaignId+userId",
    duplicateCampaignMemberships,
    (membership) => ({
      id: membership.id,
      campaignId: membership.campaignId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt,
    })
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to check duplicates:", error);
    process.exit(1);
  });
