import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, test, vi } from "vitest";

import { campaigns } from "../../db/schema/campaigns.js";
import { campaignMemberships } from "../../db/schema/memberships.js";
import { workspaces } from "../../db/schema/workspaces.js";

const mocks = vi.hoisted(() => {
  const state = {
    rows: [] as unknown[][],
    whereClauses: [] as unknown[],
  };

  function queryResult(rows: unknown[]) {
    return Object.assign(Promise.resolve(rows), {
      limit: vi.fn().mockResolvedValue(rows),
    });
  }

  return {
    state,
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((whereClause: unknown) => {
            state.whereClauses.push(whereClause);
            return queryResult(state.rows.shift() ?? []);
          }),
        })),
      })),
    },
  };
});

vi.mock("./db.js", () => ({ db: mocks.db }));
vi.mock("./auth.js", () => ({ verifyAuthHeader: vi.fn() }));
vi.mock("./userIdentity.js", () => ({ provisionUserIdentity: vi.fn() }));

import {
  requireCampaignGm,
  requireCampaignMember,
  resolveCampaignByAppId,
  resolveWorkspaceByAppId,
} from "./access.js";

const sqlDatabase = drizzle.mock();
const workspaceId = "00000000-0000-4000-8000-000000000001";
const campaignId = "00000000-0000-4000-8000-000000000315";
const userId = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.rows.length = 0;
  mocks.state.whereClauses.length = 0;
});

test("DD access boundary: workspace lookup uses the requested tenant slug", async () => {
  const workspace = {
    id: workspaceId,
    slug: "workspace-alpha",
    name: "Workspace Alpha",
  };
  mocks.state.rows.push([workspace]);

  const result = await resolveWorkspaceByAppId(workspace.slug);

  assert.equal(result.id, workspaceId);
  const query = sqlDatabase
    .select()
    .from(workspaces)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(query.params, [workspace.slug]);
});

test("DD access boundary: campaign lookup cannot cross the selected workspace", async () => {
  mocks.state.rows.push([
    {
      id: campaignId,
      workspaceId,
      slug: "campaign-alpha",
      name: "Campaign Alpha",
    },
  ]);

  await assert.rejects(
    resolveCampaignByAppId({
      campaignId: "campaign-from-another-workspace",
      workspaceId,
    }),
    /Campaign not found/
  );

  const query = sqlDatabase
    .select()
    .from(campaigns)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(query.params, [workspaceId]);
});

test("DD access boundary: campaign membership requires both campaign and user", async () => {
  mocks.state.rows.push([]);

  await assert.rejects(
    requireCampaignMember({ campaignId, userId }),
    /Campaign membership required/
  );

  const query = sqlDatabase
    .select()
    .from(campaignMemberships)
    .where(mocks.state.whereClauses[0] as never)
    .toSQL();
  assert.deepEqual(query.params, [campaignId, userId]);
});

test("DD access boundary: a Player campaign role cannot use GM authorization", async () => {
  mocks.state.rows.push([{ campaignId, userId, role: "player" }]);

  await assert.rejects(
    requireCampaignGm({ campaignId, userId }),
    /Campaign GM permission required/
  );
});
