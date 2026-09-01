import { test as base, expect } from "@playwright/test";

import {
  clearAuthEmulator,
  getAuthEmulatorAccount,
  lookupAuthEmulatorAccount,
  requestPasswordResetThroughEmulator,
  sendVerificationEmail,
} from "./auth-emulator";

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
type ApiMeResponseController = { current: ApiMeResponse | null };

async function wait(delayMs: number) {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export const test = base.extend<{
  apiMeResponse: ApiMeResponse;
  apiMeResponseAfterAcceptPending: ApiMeResponse | null;
  apiMeResponseAfterCampaignCreate: ApiMeResponse | null;
  apiMeResponseAfterWorkspaceCreate: ApiMeResponse | null;
  apiMeResponseController: ApiMeResponseController;
  apiMeResponses: ApiMeResponse[] | null;
  apiMeStatus: number;
  apiMeDelayMs: number;
  apiMeDelaySequence: number[] | null;
  consoleGuard: void;
  expectedConsoleErrors: string[];
  apiCallLog: {
    apiMe: string[];
    acceptPending: string[];
    identityContinuity: string[];
    verificationEmail: string[];
    campaignCreate: Array<Record<string, unknown>>;
    workspaceCreate: Array<Record<string, unknown>>;
  };
  identityContinuityStatus: number;
  identityContinuityUserId: string;
  identityContinuityUserIds: string[] | null;
  workspaceCreateDelayMs: number;
  workspaceCreateStatuses: number[] | null;
  acceptedInvitations: Array<{
    id: string;
    tenantId: string;
    campaignId: string;
    workspaceRole: string;
    campaignRole: string;
    status: string;
    acceptedAt: string;
  }>;
  acceptPendingDelayMs: number;
  acceptPendingStatus: number;
}>({
  apiMeResponse: [defaultApiMeResponse, { option: true }],
  apiMeResponseAfterAcceptPending: [null, { option: true }],
  apiMeResponseAfterCampaignCreate: [null, { option: true }],
  apiMeResponseAfterWorkspaceCreate: [null, { option: true }],
  apiMeResponseController: async ({}, use) => {
    await use({ current: null });
  },
  apiMeResponses: [null, { option: true }],
  apiMeStatus: [200, { option: true }],
  apiMeDelayMs: [0, { option: true }],
  apiMeDelaySequence: [null, { option: true }],
  expectedConsoleErrors: [[], { option: true }],
  acceptedInvitations: [[], { option: true }],
  acceptPendingDelayMs: [0, { option: true }],
  acceptPendingStatus: [200, { option: true }],
  identityContinuityStatus: [200, { option: true }],
  identityContinuityUserId: ["e2e-user", { option: true }],
  identityContinuityUserIds: [null, { option: true }],
  workspaceCreateDelayMs: [0, { option: true }],
  workspaceCreateStatuses: [null, { option: true }],
  apiCallLog: async ({}, use) => {
    await use({
      apiMe: [],
      acceptPending: [],
      identityContinuity: [],
      verificationEmail: [],
      campaignCreate: [],
      workspaceCreate: [],
    });
  },
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

test.beforeEach(async ({
  acceptedInvitations,
  acceptPendingDelayMs,
  acceptPendingStatus,
  apiCallLog,
  apiMeDelayMs,
  apiMeDelaySequence,
  apiMeResponse,
  apiMeResponseAfterAcceptPending,
  apiMeResponseAfterCampaignCreate,
  apiMeResponseAfterWorkspaceCreate,
  apiMeResponseController,
  apiMeResponses,
  apiMeStatus,
  identityContinuityStatus,
  identityContinuityUserId,
  identityContinuityUserIds,
  page,
  request,
  workspaceCreateDelayMs,
  workspaceCreateStatuses,
}) => {
  await clearAuthEmulator(request);
  let apiMeCallCount = 0;
  let identityContinuityCallCount = 0;
  let acceptPendingCompleted = false;
  let campaignCreated = false;
  let workspaceCreated = false;
  let workspaceCreateAttempt = 0;

  await page.route("http://127.0.0.1:4173/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.pathname === "/api/auth/send-password-reset-email") {
      const email = String(route.request().postDataJSON()?.email || "").toLowerCase();
      const account = await getAuthEmulatorAccount(request, email);
      const hasPasswordProvider = account?.providerUserInfo?.some(
        (provider: { providerId?: string }) => provider.providerId === "password"
      );
      if (account?.emailVerified && !account?.disabled && hasPasswordProvider) {
        await requestPasswordResetThroughEmulator(request, email);
      }
      await route.fulfill({ status: 202, json: { ok: true } });
      return;
    }

    const authorization = route.request().headers().authorization;
    expect(authorization).toMatch(/^Bearer /);

    if (requestUrl.pathname === "/api/auth/identity-continuity") {
      expect(route.request().headers()["x-dd-mode"]).toBeUndefined();
      const account = await lookupAuthEmulatorAccount(
        request,
        authorization!.slice("Bearer ".length)
      );
      expect(account.emailVerified).toBe(true);
      apiCallLog.identityContinuity.push(requestUrl.pathname);
      const continuityUserId =
        identityContinuityUserIds?.[
          Math.min(
            identityContinuityCallCount,
            identityContinuityUserIds.length - 1
          )
        ] || identityContinuityUserId;
      identityContinuityCallCount += 1;
      await route.fulfill({
        status: identityContinuityStatus,
        json:
          identityContinuityStatus === 200
            ? { ok: true, neonUserId: continuityUserId }
            : { ok: false, error: "Account setup unavailable" },
      });
      return;
    }

    const selectedMode = route.request().headers()["x-dd-mode"];
    expect(selectedMode).toMatch(/^(gm|player)$/);

    if (requestUrl.pathname === "/api/me") {
      const callIndex = apiMeCallCount;
      apiMeCallCount += 1;
      apiCallLog.apiMe.push(requestUrl.pathname);
      const delayMs = apiMeDelaySequence?.[callIndex] ?? apiMeDelayMs;
      await wait(delayMs);
      const response =
        apiMeResponseController.current ||
        (workspaceCreated && apiMeResponseAfterWorkspaceCreate) ||
        (campaignCreated && apiMeResponseAfterCampaignCreate) ||
        (acceptPendingCompleted && apiMeResponseAfterAcceptPending) ||
        apiMeResponses?.[Math.min(callIndex, apiMeResponses.length - 1)] ||
        apiMeResponse;
      await route.fulfill({
        status: apiMeStatus,
        json:
          apiMeStatus === 200
            ? response
            : { ok: false, error: "Internal server error" },
      });
      return;
    }

    if (requestUrl.pathname === "/api/auth/send-verification-email") {
      apiCallLog.verificationEmail.push(requestUrl.pathname);
      await sendVerificationEmail(request, authorization!.slice("Bearer ".length));
      await route.fulfill({ status: 202, json: { ok: true } });
      return;
    }

    if (
      requestUrl.pathname === "/api/workspace" &&
      route.request().method() === "POST" &&
      !requestUrl.searchParams.has("resource") &&
      !requestUrl.searchParams.has("type")
    ) {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      apiCallLog.workspaceCreate.push(requestBody);
      const status =
        workspaceCreateStatuses?.[
          Math.min(workspaceCreateAttempt, workspaceCreateStatuses.length - 1)
        ] ?? 201;
      workspaceCreateAttempt += 1;
      await wait(workspaceCreateDelayMs);

      if (status !== 201) {
        await route.fulfill({
          status,
          json: { ok: false, error: "Workspace creation failed" },
        });
        return;
      }

      workspaceCreated = true;
      await route.fulfill({
        status: 201,
        json: {
          ok: true,
          workspace: {
            id: "00000000-0000-4000-8000-000000000018",
            name: String(requestBody.name || "Created Workspace"),
            slug: "created-workspace",
          },
        },
      });
      return;
    }

    if (
      requestUrl.pathname === "/api/campaign-content" &&
      route.request().method() === "POST" &&
      !requestUrl.searchParams.has("resource") &&
      !requestUrl.searchParams.has("type")
    ) {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      apiCallLog.campaignCreate.push(requestBody);
      campaignCreated = true;
      await route.fulfill({
        status: 201,
        json: {
          ok: true,
          campaign: {
            id: "00000000-0000-4000-8000-000000000027",
            name: String(requestBody.name || "Created Campaign"),
            slug: "created-campaign",
          },
        },
      });
      return;
    }

    if (requestUrl.pathname === "/api/invitations/accept-pending") {
      apiCallLog.acceptPending.push(requestUrl.pathname);
      await wait(acceptPendingDelayMs);
      const invitationsForRequest = acceptPendingCompleted
        ? []
        : acceptedInvitations;
      if (acceptPendingStatus === 200) {
        acceptPendingCompleted = true;
      }
      await route.fulfill({
        status: acceptPendingStatus,
        json:
          acceptPendingStatus === 200
            ? { ok: true, acceptedInvitations: invitationsForRequest }
            : { ok: false, error: "Invitation acceptance unavailable" },
      });
      return;
    }

    await route.abort("blockedbyclient");
  });
});

test.afterEach(async ({ request }) => {
  await clearAuthEmulator(request);
});

export { expect };
