import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, test, vi } from "vitest";

import { AuthenticationError } from "../apiErrors.js";

const mocks = vi.hoisted(() => {
  const state = { selectRows: [] as unknown[][], updateValues: [] as Array<Record<string, unknown>>, updateRows: [] as unknown[][] };
  function selectResult(rows: unknown[]) { return { limit: vi.fn().mockResolvedValue(rows) }; }
  return {
    db: {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => selectResult(state.selectRows.shift() ?? [])) })) })),
      update: vi.fn(() => ({ set: vi.fn((values: Record<string, unknown>) => {
        state.updateValues.push(values);
        return { where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue(state.updateRows.shift() ?? []) })) };
      }) })),
    },
    getCurrentUser: vi.fn(), resolveCampaignBySlug: vi.fn(), setCorsHeaders: vi.fn(), state,
  };
});

vi.mock("../access.js", () => ({ getCurrentUser: mocks.getCurrentUser, resolveCampaignBySlug: mocks.resolveCampaignBySlug }));
vi.mock("../db.js", () => ({ db: mocks.db }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));

import campaignSettingsHandler from "./campaign-settings.js";

const currentUser = { id: "00000000-0000-4000-8000-000000000002" };
const campaign = {
  id: "00000000-0000-4000-8000-000000000003", slug: "campaign-alpha", workspaceId: "00000000-0000-4000-8000-000000000004",
  name: "Alpha", description: "Shared description", status: "active", system: "D&D 5e", playerSummary: "Players know this.",
  gmNotes: "The villain is the mayor.", startDate: "2026-01-03", endDate: "2026-12-31", updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function request(method: string, body?: Record<string, unknown>, selectedMode: "gm" | "player" = "gm") {
  return { body, headers: { authorization: "Bearer emulator-token", "x-dd-mode": selectedMode }, method, query: { campaignId: campaign.slug } } as unknown as VercelRequest;
}
function response() {
  const result: { status?: number; body?: unknown } = {};
  const res = { end: vi.fn(() => res), json: vi.fn((body: unknown) => { result.body = body; return res; }), setHeader: vi.fn(() => res), status: vi.fn((status: number) => { result.status = status; return res; }) } as unknown as VercelResponse;
  return { res, result };
}
function allow(role: "gm" | "player" = "gm") { mocks.state.selectRows.push([{ role }], [{ role: "member" }]); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.selectRows.length = 0; mocks.state.updateValues.length = 0; mocks.state.updateRows.length = 0;
  mocks.getCurrentUser.mockResolvedValue(currentUser); mocks.resolveCampaignBySlug.mockResolvedValue(campaign);
});

test("GM reads every retained campaign setting", async () => {
  allow("gm"); const { res, result } = response();
  await campaignSettingsHandler(request("GET"), res);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, campaign: {
    id: campaign.id, campaignId: campaign.slug, workspaceId: campaign.workspaceId, name: campaign.name, description: campaign.description,
    status: campaign.status, system: campaign.system, playerSummary: campaign.playerSummary, gmNotes: campaign.gmNotes,
    startDate: campaign.startDate, endDate: campaign.endDate, updatedAt: campaign.updatedAt,
  } });
});

test("Player response contains only player-safe retained fields", async () => {
  allow("player"); const { res, result } = response();
  await campaignSettingsHandler(request("GET", undefined, "player"), res);
  assert.equal(result.status, 200);
  const settings = (result.body as { campaign: Record<string, unknown> }).campaign;
  assert.equal(settings.gmNotes, undefined);
  assert.deepEqual(Object.keys(settings).sort(), ["campaignId", "description", "endDate", "id", "name", "playerSummary", "startDate", "status", "system", "updatedAt", "workspaceId"]);
});

test("GM updates and receives a canonical retained-field read-back with server-owned updatedAt", async () => {
  const updatedCampaign = { ...campaign, name: "Alpha Reloaded", description: "Updated description", status: "paused", system: "Pathfinder 2e", playerSummary: "Updated player summary", gmNotes: "Updated private note", startDate: "2026-02-03", endDate: "2027-01-04", updatedAt: new Date("2026-02-01T00:00:00.000Z") };
  allow("gm"); const rejected = response();
  await campaignSettingsHandler(request("PATCH", { campaignId: campaign.slug, name: updatedCampaign.name, updated_at: "client-controlled", workspaceId: "other-workspace", role: "gm" }), rejected.res);
  assert.equal(rejected.result.status, 400); assert.equal(mocks.db.update.mock.calls.length, 0);

  allow("gm"); mocks.state.updateRows.push([updatedCampaign]); const saved = response();
  await campaignSettingsHandler(request("PATCH", { campaignId: campaign.slug, name: updatedCampaign.name, description: updatedCampaign.description, status: updatedCampaign.status, system: updatedCampaign.system, playerSummary: updatedCampaign.playerSummary, gmNotes: updatedCampaign.gmNotes, startDate: updatedCampaign.startDate, endDate: updatedCampaign.endDate }), saved.res);
  assert.equal(saved.result.status, 200);
  assert.equal(mocks.state.updateValues[0].updatedAt instanceof Date, true);
  assert.equal(mocks.state.updateValues[0].updated_at, undefined);
  assert.deepEqual((saved.result.body as { campaign: unknown }).campaign, {
    id: updatedCampaign.id, campaignId: updatedCampaign.slug, workspaceId: updatedCampaign.workspaceId, name: updatedCampaign.name, description: updatedCampaign.description,
    status: updatedCampaign.status, system: updatedCampaign.system, playerSummary: updatedCampaign.playerSummary, gmNotes: updatedCampaign.gmNotes,
    startDate: updatedCampaign.startDate, endDate: updatedCampaign.endDate, updatedAt: updatedCampaign.updatedAt,
  });
});

test("Player mode, non-members, and cross-workspace callers cannot mutate or read settings", async () => {
  allow("gm"); const playerMode = response();
  await campaignSettingsHandler(request("PATCH", { campaignId: campaign.slug, name: "Nope" }, "player"), playerMode.res);
  assert.equal(playerMode.result.status, 403);
  mocks.state.selectRows.push([], [{ role: "member" }]); const nonMember = response();
  await campaignSettingsHandler(request("PATCH", { campaignId: campaign.slug, name: "Nope" }), nonMember.res);
  assert.equal(nonMember.result.status, 403);
  mocks.state.selectRows.push([{ role: "gm" }], []); const crossWorkspace = response();
  await campaignSettingsHandler(request("GET"), crossWorkspace.res);
  assert.equal(crossWorkspace.result.status, 403); assert.equal(mocks.db.update.mock.calls.length, 0);
});

test("unauthenticated access is rejected", async () => {
  mocks.getCurrentUser.mockRejectedValue(new AuthenticationError("Invalid token")); const { res, result } = response();
  await campaignSettingsHandler(request("GET"), res);
  assert.equal(result.status, 401);
});

test("Campaign Settings has no active Firestore write or delete path", async () => {
  const source = await readFile(new URL("../../pages/CampaignSettings.jsx", import.meta.url), "utf8");
  assert.equal(source.includes("firebase/firestore"), false);
  assert.equal(source.includes("updateDoc("), false);
  assert.equal(source.includes("deleteDoc("), false);
  assert.equal(source.includes("writeBatch("), false);
  assert.match(source, /Delete Campaign \(temporarily unavailable\)/);
});
