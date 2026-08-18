import { test as base, expect } from "@playwright/test";

import { clearAuthEmulator } from "./auth-emulator";
import { sendVerificationEmail } from "./auth-emulator";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const campaignId = "00000000-0000-4000-8000-000000000002";

const defaultApiMeResponse = {
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

type ApiMeResponse = typeof defaultApiMeResponse;

export const test = base.extend<{
  apiMeResponse: ApiMeResponse;
  apiMeStatus: number;
  consoleGuard: void;
  expectedConsoleErrors: string[];
  acceptedInvitations: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    workspaceRole: string;
    campaignRole: string;
    status: string;
    acceptedAt: string;
  }>;
}>({
  apiMeResponse: [defaultApiMeResponse, { option: true }],
  apiMeStatus: [200, { option: true }],
  expectedConsoleErrors: [[], { option: true }],
  acceptedInvitations: [[], { option: true }],
  consoleGuard: [
    async ({ page, expectedConsoleErrors }, use) => {
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

      for (const expectedError of expectedConsoleErrors) {
        expect(
          errors.some((error) => error.includes(expectedError)),
          `expected browser console error containing: ${expectedError}`
        ).toBe(true);
      }

      const unexpectedErrors = errors.filter(
        (error) =>
          !expectedConsoleErrors.some((expectedError) =>
            error.includes(expectedError)
          )
      );
      expect(unexpectedErrors, "unexpected browser console and page errors").toEqual([]);
    },
    { auto: true },
  ],
});

test.beforeEach(async ({ acceptedInvitations, apiMeResponse, apiMeStatus, page, request }) => {
  await clearAuthEmulator(request);

  await page.route("http://127.0.0.1:4173/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const authorization = route.request().headers().authorization;
    const selectedMode = route.request().headers()["x-dd-mode"];

    expect(authorization).toMatch(/^Bearer /);
    expect(selectedMode).toMatch(/^(gm|player)$/);

    if (requestUrl.pathname === "/api/me") {
      await route.fulfill({
        status: apiMeStatus,
        json:
          apiMeStatus === 200
            ? apiMeResponse
            : { ok: false, error: "Internal server error" },
      });
      return;
    }

    if (requestUrl.pathname === "/api/auth/send-verification-email") {
      await sendVerificationEmail(request, authorization!.slice("Bearer ".length));
      await route.fulfill({ status: 202, json: { ok: true } });
      return;
    }

    if (requestUrl.pathname === "/api/invitations/accept-pending") {
      await route.fulfill({ json: { ok: true, acceptedInvitations } });
      return;
    }

    await route.abort("blockedbyclient");
  });
});

test.afterEach(async ({ request }) => {
  await clearAuthEmulator(request);
});

export { expect };
