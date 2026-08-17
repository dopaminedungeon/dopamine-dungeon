import { test as base, expect } from "@playwright/test";

import { clearAuthEmulator } from "./auth-emulator";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const campaignId = "00000000-0000-4000-8000-000000000002";

const apiMeResponse = {
  ok: true,
  user: { id: "e2e-user" },
  workspaces: [
    { id: workspaceId, slug: "e2e-workspace", name: "E2E Workspace" },
  ],
  workspaceMemberships: [
    { workspaceId, userId: "e2e-user", role: "owner" },
  ],
  campaigns: [
    {
      id: campaignId,
      workspaceId,
      slug: "e2e-campaign",
      name: "E2E Campaign",
      description: "Authentication emulator test campaign",
    },
  ],
  campaignMemberships: [
    { campaignId, userId: "e2e-user", role: "gm" },
  ],
};

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;

        const isExpectedCredentialRejection =
          message.location().url.startsWith("http://127.0.0.1:9099/") &&
          message.text().includes("400 (Bad Request)");

        if (!isExpectedCredentialRejection) errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await use();

      expect(errors, "browser console and page errors").toEqual([]);
    },
    { auto: true },
  ],
});

test.beforeEach(async ({ page, request }) => {
  await clearAuthEmulator(request);

  await page.route("http://127.0.0.1:4173/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const authorization = route.request().headers().authorization;

    expect(authorization).toMatch(/^Bearer /);

    if (requestUrl.pathname === "/api/me") {
      await route.fulfill({ json: apiMeResponse });
      return;
    }

    if (requestUrl.pathname === "/api/invitations/accept-pending") {
      await route.fulfill({ json: { ok: true, acceptedInvitations: [] } });
      return;
    }

    await route.abort("blockedbyclient");
  });
});

test.afterEach(async ({ request }) => {
  await clearAuthEmulator(request);
});

export { expect };
