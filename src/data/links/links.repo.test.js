import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("../api/apiClient", () => ({ apiFetch: api.apiFetch }));

import { addLink, getAllLinks, loadLinks, saveLinkDraft } from "./links.repo";

const campaignId = "campaign-alpha";
const genericLink = {
  id: "persisted-generic",
  entityA: { type: "Arc", id: "arc-1" },
  entityB: { type: "Quest", id: "quest-1" },
  label: "advances",
  visibility: "GM",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const managedLink = {
  id: "quest-hero:quest-1:Session:session-1:started",
  entityA: { type: "Quest", id: "quest-1" },
  entityB: { type: "Session", id: "session-1" },
  label: "started",
  visibility: "GM",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const genericQuestSessionLink = {
  id: "persisted-generic-quest-session",
  entityA: { type: "Quest", id: "quest-1" },
  entityB: { type: "Session", id: "session-1" },
  label: "related",
  visibility: "GM",
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  api.apiFetch.mockReset();
});

describe("relationship draft reconciliation", () => {
  it("reuses an unchanged persisted link even when the draft has a new ID and reversed endpoints", async () => {
    api.apiFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") return { link: genericLink };
      return { links: [genericLink] };
    });
    await loadLinks(campaignId);
    await addLink({ ...genericLink, id: "new-draft-id", entityA: genericLink.entityB, entityB: genericLink.entityA }, campaignId);
    const write = api.apiFetch.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(JSON.parse(write[1].body).link.id).toBe(genericLink.id);
    expect(getAllLinks()).toEqual([genericLink]);
  });

  it.each([
    ["Arc", "arc-1", { ...genericLink, id: "arc-endpoint-draft", entityA: genericLink.entityB, entityB: genericLink.entityA }],
    ["Quest", "quest-1", { ...genericLink, id: "quest-endpoint-draft" }],
  ])("reconciles the same relationship from the %s endpoint without inserting a second row", async (type, id, desired) => {
    api.apiFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") return { link: genericLink };
      return { links: [genericLink] };
    });
    await saveLinkDraft(campaignId, type, id, [desired], [], () => false);
    expect(api.apiFetch.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(0);
    expect(api.apiFetch.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(0);
  });

  it("allows retry after the server persisted a link but the first response failed", async () => {
    let persisted = false;
    let failOnce = true;
    api.apiFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") {
        persisted = true;
        if (failOnce) { failOnce = false; throw new Error("response lost"); }
        return { link: genericLink };
      }
      return { links: persisted ? [genericLink] : [] };
    });
    const desired = { ...genericLink, id: "retry-draft" };
    await expect(saveLinkDraft(campaignId, "Arc", "arc-1", [desired], [])).rejects.toThrow("response lost");
    await expect(saveLinkDraft(campaignId, "Arc", "arc-1", [desired], [])).resolves.toEqual([genericLink]);
    expect(api.apiFetch.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1);
  });

  it("removes only the generic Quest link and retains a distinct managed primary link", async () => {
    const deleted = [];
    api.apiFetch.mockImplementation(async (url, options) => {
      if (options?.method === "DELETE") { deleted.push(new URL(url, "https://local").searchParams.get("linkId") || ""); return {}; }
      return { links: [genericQuestSessionLink, managedLink] };
    });
    await saveLinkDraft(campaignId, "Quest", "quest-1", [managedLink], [genericQuestSessionLink, managedLink], (link) => link.label === "started");
    expect(deleted).toEqual([genericQuestSessionLink.id]);
    expect(api.apiFetch.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
  });

  it("changes a generic Quest link on the same endpoint pair without changing the managed primary", async () => {
    const changed = { ...genericQuestSessionLink, label: "advanced" };
    api.apiFetch.mockImplementation(async (_url, options) => {
      if (options?.method === "PUT") return { link: changed };
      return { links: [genericQuestSessionLink, managedLink] };
    });
    await saveLinkDraft(campaignId, "Quest", "quest-1", [changed, managedLink], [genericQuestSessionLink, managedLink], (link) => link.label === "started");
    const writes = api.apiFetch.mock.calls.filter(([, options]) => options?.method === "PUT");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1].body).link).toMatchObject({ id: genericQuestSessionLink.id, label: "advanced" });
    expect(JSON.parse(writes[0][1].body).link.id).not.toBe(managedLink.id);
  });
});
