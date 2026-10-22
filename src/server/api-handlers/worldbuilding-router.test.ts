import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bag: vi.fn(),
  arcs: vi.fn(),
  milestones: vi.fn(),
  characters: vi.fn(),
  entityLinks: vi.fn(),
  items: vi.fn(),
  lore: vi.fn(),
  locations: vi.fn(),
  npcs: vi.fn(),
  sessions: vi.fn(),
  quests: vi.fn(),
  setCorsHeaders: vi.fn(),
}));

vi.mock("./bag.js", () => ({ default: mocks.bag }));
vi.mock("./arcs.js", () => ({ default: mocks.arcs }));
vi.mock("./milestones.js", () => ({ default: mocks.milestones }));
vi.mock("./characters.js", () => ({ default: mocks.characters }));
vi.mock("./entity-links.js", () => ({ default: mocks.entityLinks }));
vi.mock("./items.js", () => ({ default: mocks.items }));
vi.mock("./lore.js", () => ({ default: mocks.lore }));
vi.mock("./locations.js", () => ({ default: mocks.locations }));
vi.mock("./npcs.js", () => ({ default: mocks.npcs }));
vi.mock("./sessions.js", () => ({ default: mocks.sessions }));
vi.mock("./quests.js", () => ({ default: mocks.quests }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));

import handler from "../../../api/worldbuilding.js";

function request(method: string, resource: string) {
  return { body: {}, method, query: { resource } } as unknown as VercelRequest;
}

function response() {
  const res = {
    end: vi.fn(),
    json: vi.fn(),
    status: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as VercelResponse & typeof res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

test.each([
  ["bag", mocks.bag],
  ["arcs", mocks.arcs],
  ["milestones", mocks.milestones],
  ["characters", mocks.characters],
  ["entityLinks", mocks.entityLinks],
  ["items", mocks.items],
  ["lore", mocks.lore],
  ["locations", mocks.locations],
  ["npcs", mocks.npcs],
  ["sessions", mocks.sessions],
  ["quests", mocks.quests],
])("continues routing the %s worldbuilding resource to its handler", async (resource, routedHandler) => {
  const req = request("GET", resource);
  const res = response();

  await handler(req, res);

  assert.equal(routedHandler.mock.calls.length, 1);
  assert.equal(routedHandler.mock.calls[0][0], req);
  assert.equal(routedHandler.mock.calls[0][1], res);
});

test.each(["productionReadOnlyAudit", "unknownResource"])(
  "rejects the retired or unknown %s resource without dispatching a handler",
  async (resource) => {
    const res = response();

    await handler(request("GET", resource), res);

    assert.equal(res.status.mock.calls[0][0], 404);
    assert.deepEqual(res.json.mock.calls[0][0], {
      ok: false,
      error: "Worldbuilding resource not found",
    });
    for (const handlerMock of Object.values(mocks)) {
      if (handlerMock !== mocks.setCorsHeaders) assert.equal(handlerMock.mock.calls.length, 0);
    }
  }
);
