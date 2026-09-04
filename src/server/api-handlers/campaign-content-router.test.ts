import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignCreateHandler: vi.fn(),
  campaignPeopleHandler: vi.fn(),
  campaignRoutePeopleHandler: vi.fn(),
  characterAssignmentsHandler: vi.fn(),
  campaignSettingsHandler: vi.fn(),
  setCorsHeaders: vi.fn(),
}));

vi.mock("./campaign-create.js", () => ({ default: mocks.campaignCreateHandler }));
vi.mock("./campaign-people.js", () => ({ default: mocks.campaignPeopleHandler }));
vi.mock("./campaign-route-people.js", () => ({
  default: mocks.campaignRoutePeopleHandler,
}));
vi.mock("./character-assignments.js", () => ({
  default: mocks.characterAssignmentsHandler,
}));
vi.mock("./campaign-settings.js", () => ({ default: mocks.campaignSettingsHandler }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));

import handler from "../../../api/campaign-content.js";

function request(method: string, query: Record<string, string> = {}) {
  return { body: {}, method, query } as unknown as VercelRequest;
}

const response = {} as VercelResponse;

beforeEach(() => {
  vi.clearAllMocks();
});

test("routes resource-free POST campaign creation through the existing campaign entrypoint", async () => {
  await handler(request("POST"), response);

  assert.equal(mocks.campaignCreateHandler.mock.calls.length, 1);
  assert.equal(mocks.campaignCreateHandler.mock.calls[0][1], response);
  assert.equal(mocks.campaignPeopleHandler.mock.calls.length, 0);
});

test("preserves campaignPeople routing instead of treating it as campaign creation", async () => {
  await handler(request("POST", { resource: "campaignPeople" }), response);

  assert.equal(mocks.campaignPeopleHandler.mock.calls.length, 1);
  assert.equal(mocks.campaignPeopleHandler.mock.calls[0][1], response);
  assert.equal(mocks.campaignCreateHandler.mock.calls.length, 0);
});

test("routes campaign settings through the consolidated campaign entrypoint", async () => {
  await handler(request("GET", { resource: "campaignSettings" }), response);

  assert.equal(mocks.campaignSettingsHandler.mock.calls.length, 1);
  assert.equal(mocks.campaignSettingsHandler.mock.calls[0][1], response);
});
