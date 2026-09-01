import { randomUUID } from "node:crypto";
import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { verifyAuthHeader } from "../src/server/auth";
import { test, expect } from "./auth.fixture";
import {
  addPasswordProvider,
  addPasswordProviderByLocalId,
  createGoogleOnlyUser,
  createVerifiedUser,
  findAuthEmulatorAccountByEmail,
  getAuthEmulatorAccount,
  getPasswordResetCode,
  getVerificationCode,
  hasPasswordResetCode,
  lookupAuthEmulatorAccount,
  requestPasswordResetThroughEmulator,
  sendVerificationEmail,
  signUpWithPassword,
  signInWithPassword,
  verifyEmailThroughEmulator,
} from "./auth-emulator";

const password = "DungeonTest42!";
const replacementPassword = "RecoveredDungeon84!";
const resetConfirmation =
  "If an account can use password authentication with that email address, we've sent instructions to reset its password.";
const invitedWorkspaceId = "00000000-0000-4000-8000-000000000011";
const invitedCampaignId = "00000000-0000-4000-8000-000000000012";
const bootstrapWorkspaceId = "00000000-0000-4000-8000-000000000013";
const readyWorkspaceId = "00000000-0000-4000-8000-000000000014";
const readyCampaignId = "00000000-0000-4000-8000-000000000015";
const inaccessibleWorkspaceId = "00000000-0000-4000-8000-000000000016";
const inaccessibleCampaignId = "00000000-0000-4000-8000-000000000017";

function generatedEmail() {
  return `auth-${randomUUID()}@example.test`;
}

function emptyApiMeResponse(userId = "e2e-user-without-membership") {
  return {
    ok: true,
    user: { id: userId },
    workspaces: [],
    workspaceMemberships: [],
    campaigns: [],
    campaignMemberships: [],
  };
}

function invitedApiMeResponse(userId = "e2e-invited-user") {
  return {
    ok: true,
    user: { id: userId },
    workspaces: [
      {
        id: invitedWorkspaceId,
        slug: "invited-workspace",
        name: "Invited Workspace",
      },
    ],
    workspaceMemberships: [
      { workspaceId: invitedWorkspaceId, userId, role: "member" },
    ],
    campaigns: [
      {
        id: invitedCampaignId,
        workspaceId: invitedWorkspaceId,
        slug: "invited-campaign",
        name: "Invited Campaign",
        description: "Invited player campaign",
      },
    ],
    campaignMemberships: [
      { campaignId: invitedCampaignId, userId, role: "player" },
    ],
  };
}

function campaignBootstrapApiMeResponse(userId = "e2e-campaign-bootstrap-user") {
  return {
    ok: true,
    user: { id: userId },
    workspaces: [
      {
        id: bootstrapWorkspaceId,
        slug: "bootstrap-workspace",
        name: "Bootstrap Workspace",
      },
    ],
    workspaceMemberships: [
      { workspaceId: bootstrapWorkspaceId, userId, role: "owner" },
    ],
    campaigns: [],
    campaignMemberships: [],
  };
}

function multiWorkspaceCampaignBootstrapApiMeResponse(
  userId = "e2e-multi-workspace-bootstrap-user"
) {
  return {
    ok: true,
    user: { id: userId },
    workspaces: [
      {
        id: bootstrapWorkspaceId,
        slug: "bootstrap-workspace",
        name: "Bootstrap Workspace",
      },
      {
        id: readyWorkspaceId,
        slug: "ready-workspace",
        name: "Ready Workspace",
      },
    ],
    workspaceMemberships: [
      { workspaceId: bootstrapWorkspaceId, userId, role: "owner" },
      { workspaceId: readyWorkspaceId, userId, role: "member" },
    ],
    campaigns: [
      {
        id: readyCampaignId,
        workspaceId: readyWorkspaceId,
        slug: "ready-campaign",
        name: "Ready Campaign",
        description: "Accessible player campaign",
      },
    ],
    campaignMemberships: [
      { campaignId: readyCampaignId, userId, role: "player" },
    ],
  };
}

function mixedVisibilityCampaignBootstrapApiMeResponse(
  userId = "e2e-bootstrap-visibility-user"
) {
  return {
    ...multiWorkspaceCampaignBootstrapApiMeResponse(userId),
    workspaces: [
      ...multiWorkspaceCampaignBootstrapApiMeResponse(userId).workspaces,
      {
        id: inaccessibleWorkspaceId,
        slug: "unauthorized-workspace",
        name: "Unauthorized Workspace",
      },
    ],
    campaigns: [
      ...multiWorkspaceCampaignBootstrapApiMeResponse(userId).campaigns,
      {
        id: inaccessibleCampaignId,
        workspaceId: readyWorkspaceId,
        slug: "gm-secret-campaign",
        name: "GM Secret Campaign",
        description: "Hidden prep",
      },
    ],
  };
}

async function openEmailSignIn(page: Page) {
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
}

async function signInVerifiedUser(page: Page, request: APIRequestContext) {
  const email = generatedEmail();
  await createVerifiedUser(request, email, password);
  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signInWithEmulatedGoogle(page: Page, email: string) {
  await page.goto("/home");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(
    () =>
      typeof (window as Window & { finishWithUser?: unknown }).finishWithUser ===
      "function"
  );
  await popup
    .locator("li.js-reuse-account", { hasText: email })
    .evaluate((account) => (account as HTMLElement).click());
  await popup.waitForEvent("close");
}

async function signInWithNewEmulatedGoogle(page: Page, email: string) {
  await page.goto("/home");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(
    () =>
      typeof (window as Window & { finishWithUser?: unknown }).finishWithUser ===
      "function"
  );
  await popup.getByRole("button", { name: "Add new account" }).click();
  await popup.locator("#email-input").fill(email);
  await popup.locator("#sign-in").click();
  await popup.waitForEvent("close");
}

async function connectGoogleProviderFromProfile(page: Page, email: string) {
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect Google" }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(
    () =>
      typeof (window as Window & { finishWithUser?: unknown }).finishWithUser ===
      "function"
  );
  await popup.getByRole("button", { name: "Add new account" }).click();
  await popup.locator("#email-input").fill(email);
  await popup.locator("#sign-in").click();
  await popup.waitForEvent("close");
}

async function deferSecondIdentityContinuityResponse(
  page: Page,
  secondResponse: { status: number; body: unknown } = {
    status: 200,
    body: { ok: true, neonUserId: "e2e-user" },
  }
) {
  let callCount = 0;
  let releaseSecond: (() => void) | null = null;
  let notifySecondRequestStarted: (() => void) | null = null;
  const secondRequestStarted = new Promise<void>((resolve) => {
    notifySecondRequestStarted = resolve;
  });
  await page.route("**/api/auth/identity-continuity", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    expect(route.request().headers()["x-dd-mode"]).toBeUndefined();
    callCount += 1;
    if (callCount === 2) {
      notifySecondRequestStarted?.();
      await new Promise<void>((release) => {
        releaseSecond = release;
      });
      await route.fulfill({
        status: secondResponse.status,
        json: secondResponse.body,
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: { ok: true, neonUserId: "e2e-user" },
    });
  });

  return {
    getCallCount: () => callCount,
    waitForSecondRequest: () => secondRequestStarted,
    resolveSecondRequest: () => releaseSecond?.(),
  };
}

async function seedPendingCredentialSetup(
  page: Page,
  firebaseUid: string,
  neonUserId = "e2e-user"
) {
  await page.goto("/home");
  await page.evaluate(
    ({ uid, expectedNeonUserId }) => {
      window.sessionStorage.setItem(
        "dd_credentialMigrationContinuity",
        JSON.stringify({ firebaseUid: uid, neonUserId: expectedNeonUserId })
      );
    },
    { uid: firebaseUid, expectedNeonUserId: neonUserId }
  );
}

async function expirePendingVerificationCooldown(page: Page) {
  await page.evaluate(() => {
    const storageKey = "dd_credentialMigrationContinuity";
    const pending = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    if (!pending) throw new Error("Pending credential setup is missing.");
    const expiredAt = Date.now() - 61_000;
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        ...pending,
        verificationEmailRequestedAt: pending.verificationEmailRequestedAt ?? expiredAt,
        verificationEmailSentAt: expiredAt,
      })
    );
  });
}

async function waitForPendingVerificationDelivery(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const pending = JSON.parse(
      window.sessionStorage.getItem("dd_credentialMigrationContinuity") || "null"
    );
    return Number.isFinite(pending?.verificationEmailSentAt);
  })).toBe(true);
}

async function observeBootstrapFormSubmissions(page: Page) {
  await page.locator("form").evaluate((form) => {
    const trackedWindow = window as Window & {
      __ddBootstrapFormSubmissions?: number;
    };
    trackedWindow.__ddBootstrapFormSubmissions = 0;
    form.addEventListener("submit", () => {
      trackedWindow.__ddBootstrapFormSubmissions =
        (trackedWindow.__ddBootstrapFormSubmissions ?? 0) + 1;
    });
  });
}

async function expectNoBootstrapFormSubmission(page: Page) {
  await expect
    .poll(() => page.evaluate(() => {
      const trackedWindow = window as Window & {
        __ddBootstrapFormSubmissions?: number;
      };
      return trackedWindow.__ddBootstrapFormSubmissions ?? 0;
    }))
    .toBe(0);
}

async function signInVerifiedInvitedUser(
  page: Page,
  request: APIRequestContext,
  email = generatedEmail()
) {
  await createVerifiedUser(request, email, password);
  await page.goto("/?invited=true");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return email;
}

async function startWorkspaceOnboardingObserver(page: Page) {
  const installObserver = () => {
    const trackedWindow = window as Window & {
      __ddWorkspaceOnboardingSeen?: boolean;
      __ddWorkspaceOnboardingObserver?: MutationObserver;
    };

    trackedWindow.__ddWorkspaceOnboardingSeen = false;
    trackedWindow.__ddWorkspaceOnboardingObserver?.disconnect();

    const check = () => {
      if (document.body?.innerText.includes("Create your workspace")) {
        trackedWindow.__ddWorkspaceOnboardingSeen = true;
      }
    };

    check();
    trackedWindow.__ddWorkspaceOnboardingObserver = new MutationObserver(check);
    trackedWindow.__ddWorkspaceOnboardingObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  };

  await page.addInitScript(() => {
    const install = () => {
      const trackedWindow = window as Window & {
        __ddWorkspaceOnboardingSeen?: boolean;
        __ddWorkspaceOnboardingObserver?: MutationObserver;
      };

      trackedWindow.__ddWorkspaceOnboardingSeen = false;
      trackedWindow.__ddWorkspaceOnboardingObserver?.disconnect();

      const check = () => {
        if (document.body?.innerText.includes("Create your workspace")) {
          trackedWindow.__ddWorkspaceOnboardingSeen = true;
        }
      };

      check();
      trackedWindow.__ddWorkspaceOnboardingObserver = new MutationObserver(check);
      trackedWindow.__ddWorkspaceOnboardingObserver.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    };

    if (document.body) {
      install();
    } else {
      document.addEventListener("DOMContentLoaded", install, { once: true });
    }
  });

  await page.evaluate(installObserver);
}

async function expectWorkspaceOnboardingWasNeverRendered(page: Page) {
  expect(
    await page.evaluate(() => {
      const trackedWindow = window as Window & {
        __ddWorkspaceOnboardingSeen?: boolean;
      };

      return trackedWindow.__ddWorkspaceOnboardingSeen === true;
    })
  ).toBe(false);
}

async function getContrastRatio(page: Page, text: string) {
  return page.getByText(text, { exact: true }).evaluate((element) => {
    function parseColor(color: string) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas color conversion is unavailable.");
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    }

    function luminance(values: number[]) {
      const channels = values.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    const foreground = parseColor(getComputedStyle(element).color);
    let backgroundElement: Element | null = element;
    let background = [0, 0, 0];

    while (backgroundElement) {
      const color = getComputedStyle(backgroundElement).backgroundColor;
      const parsedColor = parseColor(color);
      if (parsedColor[3] > 0) {
        background = parsedColor;
        break;
      }
      backgroundElement = backgroundElement.parentElement;
    }

    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  });
}

async function expectStableAuthLayout(
  page: Page,
  expectedWidth: { min: number; max: number }
) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    )
    .toBe(true);

  const card = page.getByTestId("auth-card");
  const firstBox = await card.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(firstBox!.width).toBeGreaterThanOrEqual(expectedWidth.min);
  expect(firstBox!.width).toBeLessThanOrEqual(expectedWidth.max);

  const brand = page.getByTestId("auth-brand");
  if (await brand.isVisible().catch(() => false)) {
    const brandBox = await brand.boundingBox();
    expect(brandBox).not.toBeNull();
    expect(brandBox!.width).toBeCloseTo(firstBox!.width, 0);
  }

  await page.waitForTimeout(250);
  const settledBox = await card.boundingBox();
  expect(settledBox).not.toBeNull();
  expect(Math.abs(settledBox!.width - firstBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(settledBox!.height - firstBox!.height)).toBeLessThanOrEqual(1);

  const controlHeights = await page
    .locator("button:visible, input:visible, a:visible")
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(controlHeights.every((height) => height >= 44)).toBe(true);

  const overflowingText = await page
    .locator("h1:visible, p:visible, label:visible, li:visible, button:visible, a:visible")
    .evaluateAll((elements) => elements
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim(),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })));
  expect(overflowingText).toEqual([]);

  const requirementHeights = await page
    .locator('[aria-label="Password requirements"] li:visible')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(requirementHeights.every((height) => height <= 32)).toBe(true);

  expect(
    await page.locator('[data-testid="auth-card"], [data-testid="auth-card"] *, [data-testid="auth-brand"]').evaluateAll(
      (elements) => elements.every((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= window.innerWidth + 1;
      })
    )
  ).toBe(true);

  const wideControlInsets = await page
    .locator('[data-testid="auth-card"] button:visible, [data-testid="auth-card"] input:visible')
    .evaluateAll((elements) => elements
      .filter((element) => element.getBoundingClientRect().width >= 250)
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          left: Number.parseFloat(style.paddingLeft),
          right: Number.parseFloat(style.paddingRight),
        };
      }));
  expect(wideControlInsets.every(({ left, right }) => left >= 15 && right >= 15)).toBe(true);
}

async function setRootFontSize(page: Page, rootFontSize: number) {
  await page.locator("html").evaluate((element, size) => {
    element.style.fontSize = `${size}px`;
  }, rootFontSize);
  await expect(page.locator("html")).toHaveCSS("font-size", `${rootFontSize}px`);
}

function clampedFontSize(
  rootFontSize: number,
  minimum: number,
  preferredRem: number,
  maximum: number
) {
  return Math.min(maximum, Math.max(minimum, rootFontSize * preferredRem));
}

async function expectSingleLine(locator: Locator) {
  expect(await locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const lineTops = new Set<number>();
    let node = walker.nextNode();

    while (node) {
      const parent = node.parentElement;
      if (node.textContent?.trim() && !parent?.closest('[aria-hidden="true"]')) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width > 0 && rect.height > 0) lineTops.add(Math.round(rect.top));
        }
      }
      node = walker.nextNode();
    }

    return lineTops.size;
  })).toBe(1);
}

test("keeps the 480px authentication shell stable across accessible root sizes", async ({
  page,
}, testInfo) => {
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const rootFontSize of [12, 16, 20]) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/home");
      await setRootFontSize(page, rootFontSize);

      const brand = page.getByText("Dopamine Dungeon", { exact: true });
      const registerControl = page.getByRole("button", { name: "Create an account" });

      const subtitle = page.getByText("TTRPG Manager", { exact: true });
      const chooserHeading = page.getByRole("heading", { name: "Sign in to your account" });
      const chooserCopy = page.getByText("Choose how you want to continue.", { exact: true });
      const card = page.getByTestId("auth-card");
      const background = page.getByTestId("gradient-background");
      const isDesktop = viewport.name === "desktop";

      await expect(subtitle).toBeVisible();
      await expect(background).toHaveAttribute("aria-hidden", "true");
      await expect(background).toHaveCSS("pointer-events", "none");
      await expect(background).toHaveCSS("position", "fixed");
      await expect(brand).toHaveCSS("color", "oklch(0.827 0.119 306.383)");
      await expect(brand).toHaveCSS("font-size", `${clampedFontSize(rootFontSize, 22, 1.5, 30)}px`);
      await expect(subtitle).toHaveCSS("font-size", `${clampedFontSize(rootFontSize, 16, 1.125, 22)}px`);
      await expect(chooserHeading).toHaveCSS("font-size", `${clampedFontSize(rootFontSize, 28, 1.875, 38)}px`);
      await expect(chooserCopy).toHaveCSS("font-size", `${clampedFontSize(rootFontSize, 16, 1.0625, 20)}px`);
      await expect(card).toHaveCSS("padding", isDesktop ? "36px" : "24px");
      await expect(page.locator('img[src="/logo/icon-192.png"]')).toHaveCSS("width", "64px");
      await expect(registerControl).toHaveCSS("font-size", `${clampedFontSize(rootFontSize, 16, 1.0625, 20)}px`);
      await expect(registerControl).toHaveCSS("color", "oklch(0.827 0.119 306.383)");
      expect(await getContrastRatio(page, "Dopamine Dungeon")).toBeGreaterThanOrEqual(4.5);
      expect(await getContrastRatio(page, "Create an account")).toBeGreaterThanOrEqual(4.5);
      await registerControl.hover();
      await expect(registerControl).toHaveCSS("color", "oklch(0.946 0.033 307.174)");
      await expect(registerControl).toHaveCSS("text-decoration-line", "underline");

      await registerControl.focus();
      await expect(registerControl).toHaveCSS("outline-style", "solid");
      await expect(registerControl).toHaveCSS(
        "outline-color",
        "oklch(0.827 0.119 306.383)"
      );
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      if (isDesktop) {
        const accountPrompt = await registerControl.locator("..").boundingBox();
        expect(accountPrompt).not.toBeNull();
        expect(accountPrompt!.height).toBeLessThanOrEqual(45);

        await expectSingleLine(brand);
        await expectSingleLine(subtitle);
        await expectSingleLine(chooserHeading);
        await expectSingleLine(chooserCopy);
        await expectSingleLine(page.getByRole("button", { name: "Continue with Google" }));
        await expectSingleLine(page.getByRole("button", { name: "Continue with email" }));
        await expectSingleLine(registerControl);
      }

      const expectedCardWidth = isDesktop
        ? { min: 460, max: 500 }
        : { min: 357, max: 359 };
      await expectStableAuthLayout(page, expectedCardWidth);
      if (rootFontSize === 16) {
        await testInfo.attach(`auth-${viewport.name}-sign-in`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }

      await page.getByRole("button", { name: "Continue with email" }).click();
      const emailHeading = page.getByRole("heading", { name: "Sign in with email" });
      const emailCopy = page.getByText("Use the email and password for your account.", { exact: true });
      await expect(emailHeading).toBeVisible();
      if (isDesktop) {
        await expectSingleLine(emailHeading);
        await expectSingleLine(emailCopy);
        await expectSingleLine(page.getByText("Email address", { exact: true }));
        await expectSingleLine(page.getByText("Password", { exact: true }));
        await expectSingleLine(page.getByRole("button", { name: "Sign in", exact: true }));
      }
      await expectStableAuthLayout(page, expectedCardWidth);
      if (rootFontSize === 16) {
        await testInfo.attach(`auth-${viewport.name}-email-sign-in`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }

      await page.getByRole("button", { name: "Create one" }).click();
      const registrationHeading = page.getByRole("heading", { name: "Create your account" });
      await expect(registrationHeading).toBeVisible();
      if (isDesktop) {
        await expectSingleLine(registrationHeading);
        await expectSingleLine(page.getByText("Confirm password", { exact: true }));
        await expectSingleLine(page.getByRole("button", { name: "Create account" }));
      }
      await expectStableAuthLayout(page, expectedCardWidth);
      if (rootFontSize === 16) {
        await testInfo.attach(`auth-${viewport.name}-registration`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }

      const email = generatedEmail();
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Create account" }).click();
      const verificationHeading = page.getByRole("heading", { name: "Verify your email" });
      const verificationAction = page.getByRole("button", { name: "I've verified my email" });
      await expect(verificationHeading).toBeVisible();
      await expect(verificationHeading).toHaveCSS("font-size", `${clampedFontSize(rootFontSize, 28, 1.875, 38)}px`);
      await expect(verificationAction).toHaveCSS("font-size", `${clampedFontSize(rootFontSize, 16, 1.0625, 22)}px`);
      await expect(page.getByTestId("auth-card")).toHaveCSS("padding", isDesktop ? "36px" : "24px");
      if (isDesktop) {
        await expectSingleLine(verificationHeading);
        await expectSingleLine(verificationAction);
        await expectSingleLine(page.getByRole("button", { name: /Resend available in|Resend verification email/ }));
        await expectSingleLine(page.getByRole("button", { name: "Use a different account" }));
      }
      await expectStableAuthLayout(page, expectedCardWidth);
      if (rootFontSize === 16) {
        await testInfo.attach(`auth-${viewport.name}-verification`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }

      await page.getByRole("button", { name: "Use a different account" }).click();
      await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
    }
  }
});

test("keeps the authentication background static for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/home");

  await expect(page.getByTestId("gradient-background")).toBeVisible();
  await expect
    .poll(() => page.locator('[data-testid="gradient-background"] .animate-pulse').count())
    .toBe(0);
  await expectStableAuthLayout(page, { min: 460, max: 500 });
});

test("keeps authentication views out of browser history and URL fragments", async ({
  page,
  request,
}) => {
  for (const fragment of ["sign-in", "register", "verification"]) {
    await page.goto(`/home#${fragment}`);
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  }

  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByRole("heading", { name: "Sign in with email" })).toBeVisible();
  await expect(page).toHaveURL(/\/home$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page).toHaveURL(/\/home$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

  const email = generatedEmail();
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/home?history=verification");
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();

  await page.goto("/home#register");
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  const session = await signInWithPassword(request, email, password);
  await expect(verifyAuthHeader(`Bearer ${session.idToken}`)).rejects.toThrow(
    "Email verification required"
  );
});

test("keeps password visibility toggles independent and keyboard accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");
  await page.getByRole("button", { name: "Create an account" }).click();

  const passwordInput = page.getByLabel("Password", { exact: true });
  const confirmationInput = page.getByLabel("Confirm password", { exact: true });
  const passwordToggle = page.getByRole("button", { name: "Show password", exact: true });
  const confirmationToggle = page.getByRole("button", {
    name: "Show confirm password",
    exact: true,
  });

  await expect(passwordInput).toHaveAttribute("autocomplete", "new-password");
  await expect(confirmationInput).toHaveAttribute("autocomplete", "new-password");
  await expect(passwordToggle).toHaveAttribute("type", "button");
  await expect(confirmationToggle).toHaveAttribute("type", "button");
  await expect(passwordToggle).toHaveAttribute("aria-pressed", "false");
  await expect(confirmationToggle).toHaveAttribute("aria-pressed", "false");

  await passwordInput.focus();
  await page.keyboard.press("Tab");
  await expect(passwordToggle).toBeFocused();
  await expect(passwordToggle).toHaveCSS("outline-style", "solid");
  await passwordToggle.press("Space");
  await expect(passwordInput).toHaveAttribute("type", "text");
  await expect(
    page.getByRole("button", { name: "Hide password", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(confirmationInput).toHaveAttribute("type", "password");
  await expect(confirmationToggle).toHaveAttribute("aria-pressed", "false");

  await confirmationInput.focus();
  await page.keyboard.press("Tab");
  await expect(confirmationToggle).toBeFocused();
  await expect(confirmationToggle).toHaveCSS("outline-style", "solid");
  await confirmationToggle.press("Enter");
  await expect(confirmationInput).toHaveAttribute("type", "text");
  await expect(
    page.getByRole("button", { name: "Hide confirm password", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(passwordInput).toHaveAttribute("type", "text");

  await page.getByLabel("Email address").fill(generatedEmail());
  await passwordInput.fill(password);
  await confirmationInput.fill("Different42!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expectStableAuthLayout(page, { min: 357, max: 359 });
});

test("offers non-identifying password recovery for existing and nonexistent addresses", async ({
  page,
  request,
}) => {
  const existingEmail = generatedEmail();
  const nonexistentEmail = generatedEmail();
  await createVerifiedUser(request, existingEmail, password);

  let delayedRequest = false;
  await page.route("**/api/auth/send-password-reset-email", async (route) => {
    if (!delayedRequest) {
      delayedRequest = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.fallback();
  });

  await openEmailSignIn(page);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/auth\/recover$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a valid email address.");

  await page.getByLabel("Email address").fill(existingEmail);
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(
    page.getByRole("button", { name: "Sending instructions..." })
  ).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(resetConfirmation, { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(existingEmail);
  expect(await getPasswordResetCode(request, existingEmail)).toBeTruthy();

  await page.getByRole("button", { name: "Request another reset" }).click();
  await page.getByLabel("Email address").fill(nonexistentEmail);
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(resetConfirmation, { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(nonexistentEmail);
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toHaveCount(0);
});

test.describe("password recovery service failures", () => {
  test.use({ expectedConsoleErrors: ["503 (Service Unavailable)"] });

  test("remain retryable without identifying an account", async ({ page }) => {
    await page.route("**/api/auth/send-password-reset-email", async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          ok: false,
          error: "Password recovery is temporarily unavailable. Please try again.",
        },
      });
    });

    await page.goto("/auth/recover");
    await page.getByLabel("Email address").fill(generatedEmail());
    await page.getByRole("button", { name: "Send reset instructions" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Password recovery is temporarily unavailable. Please try again."
    );
    await expect(
      page.getByRole("button", { name: "Send reset instructions" })
    ).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
  });
});

test("forces password recovery into a signed-out route without application context", async ({
  page,
  request,
}) => {
  const email = generatedEmail();
  await createVerifiedUser(request, email, password);

  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

  await page.goto("/auth/recover");
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toHaveCount(0);

  await page.getByRole("link", { name: "Return to sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
});

test("verifies a reset link, enforces shared password policy, and replaces the credential", async ({
  page,
  request,
}) => {
  const email = generatedEmail();
  const account = await createVerifiedUser(request, email, password);
  await requestPasswordResetThroughEmulator(request, email);
  const oobCode = await getPasswordResetCode(request, email);

  await page.route("http://127.0.0.1:9099/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/accounts:resetPassword")) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });

  const resetPath = `/auth/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;
  await page.goto(resetPath);
  await expect(page.getByRole("heading", { name: "Checking your reset link" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/reset-password$/);

  const newPassword = page.getByLabel("New password", { exact: true });
  const confirmation = page.getByLabel("Confirm new password", { exact: true });
  await newPassword.fill(replacementPassword);
  await confirmation.fill("DifferentDungeon84!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");

  await newPassword.fill("short");
  await confirmation.fill("short");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Your password does not meet the requirements."
  );
  await expect(page.getByText("At least 6 characters", { exact: true })).toBeVisible();

  await newPassword.fill(replacementPassword);
  await confirmation.fill(replacementPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("button", { name: "Updating password..." })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Your password has been changed successfully. You can now sign in with your new password."
  );
  await expect(page.getByText("Your reset code has been used securely.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Return to sign in" })).toBeVisible();

  await expect(signInWithPassword(request, email, password)).rejects.toThrow();
  const replacementSession = await signInWithPassword(
    request,
    email,
    replacementPassword
  );
  expect(replacementSession.localId).toBe(account.localId);

  await page.getByRole("link", { name: "Return to sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

  let expectedFirebaseRequestErrors = 0;
  let unexpectedConsoleErrors = 0;
  let uncaughtPageErrors = 0;
  page.on("console", (message) => {
    if (message.type() !== "error") return;

    const isExpectedFirebaseRequestError =
      message.location().url.includes("/accounts:resetPassword") &&
      message.text().includes("400 (Bad Request)");
    if (isExpectedFirebaseRequestError) {
      expectedFirebaseRequestErrors += 1;
    } else {
      unexpectedConsoleErrors += 1;
    }
  });
  page.on("pageerror", () => {
    uncaughtPageErrors += 1;
  });

  const consumedCodeResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/accounts:resetPassword") &&
      response.status() === 400
  );
  await page.goto(resetPath);
  const response = await consumedCodeResponse;
  const responseBody = (await response.json()) as {
    error?: { message?: string };
  };
  expect(responseBody.error?.message).toBe("INVALID_OOB_CODE");
  await expect(page.getByRole("heading", { name: "Reset link unavailable" })).toBeVisible();
  await expect(page.getByText("This password-reset link is invalid or has already been used.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Request another reset" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Password reset unavailable" })).toHaveCount(0);
  expect(expectedFirebaseRequestErrors).toBeGreaterThanOrEqual(1);
  expect(unexpectedConsoleErrors).toBe(0);
  expect(uncaughtPageErrors).toBe(0);
  await expect(page.locator("main")).not.toContainText(email);

  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(replacementPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toHaveCount(0);
});

test("does not issue reset actions or verify an unverified account", async ({
  page,
  request,
}) => {
  const email = generatedEmail();
  const account = await signUpWithPassword(request, email, password);

  await page.goto("/auth/recover");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset instructions" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(resetConfirmation, { exact: true })).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toHaveCount(0);
  expect(await hasPasswordResetCode(request, email)).toBe(false);

  const storedAccount = await lookupAuthEmulatorAccount(request, account.idToken);
  expect(storedAccount.localId).toBe(account.localId);
  expect(storedAccount.emailVerified).toBe(false);
});

test("handles malformed and expired reset links with a recovery action", async ({ page }) => {
  await page.goto("/auth/reset-password?mode=resetPassword");
  await expect(page.getByRole("heading", { name: "Reset link unavailable" })).toBeVisible();
  await page.getByRole("link", { name: "Request another reset" }).click();
  await expect(page).toHaveURL(/\/auth\/recover$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

  await page.goto("/auth/reset-password?testState=expired");
  await expect(page.getByRole("heading", { name: "Reset link expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request another reset" })).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toHaveCount(0);
});

test("@smoke registers a password user, blocks access, and completes emulator verification", async ({
  page,
  request,
}) => {
  const email = generatedEmail();

  await page.goto("/home");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);

  const unverifiedSession = await signInWithPassword(request, email, password);
  await expect(
    verifyAuthHeader(`Bearer ${unverifiedSession.idToken}`)
  ).rejects.toThrow("Email verification required");

  await verifyEmailThroughEmulator(request, email);
  await page.getByRole("button", { name: "I've verified my email" }).click();

  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

  const verifiedSession = await signInWithPassword(request, email, password);
  const decodedToken = await verifyAuthHeader(`Bearer ${verifiedSession.idToken}`);
  expect(decodedToken.email_verified).toBe(true);
});

test("requests verification email and prevents immediate resend", async ({ page, request }) => {
  const email = generatedEmail();

  await page.goto("/home");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend available in \d+s/ })).toBeDisabled();
  expect(await getVerificationCode(request, email)).toBeTruthy();
});

test("applies a valid action code and continues the same browser session", async ({
  page,
  request,
}) => {
  const email = generatedEmail();

  await page.goto("/home");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  const oobCode = await getVerificationCode(request, email);

  await page.goto(`/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}`);
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).not.toHaveURL(/\/auth\/verify-email/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your account" })
  ).toHaveCount(0);
});

test.describe("post-verification routing", () => {
  test.describe("after the Firebase verification continuation returns", () => {
    test.use({
      apiMeResponse: emptyApiMeResponse("e2e-verification-return-user"),
      apiMeResponseAfterAcceptPending: invitedApiMeResponse(
        "e2e-verification-return-user"
      ),
      acceptPendingDelayMs: 1_500,
      acceptedInvitations: [
        {
          id: "invitation-verification-return",
          tenantId: "invited-workspace",
          campaignId: "invited-campaign",
          workspaceRole: "member",
          campaignRole: "player",
          status: "accepted",
          acceptedAt: "2026-08-24T11:00:00.000Z",
        },
      ],
    });

    test("waits for acceptance and authoritative membership refresh without workspace onboarding or a corrective reload", async ({
      apiCallLog,
      page,
      request,
    }) => {
      const email = generatedEmail();

      await page.goto("/?invited=true");
      await page.getByRole("button", { name: "Create an account" }).click();
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Create account" }).click();
      const oobCode = await getVerificationCode(request, email);
      await startWorkspaceOnboardingObserver(page);

      await page.goto(
        `/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&invited=true`
      );

      await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "You have entered the dungeon" })
      ).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/welcome\?invited=true$/);
      await expect(page.getByText("Invitation accepted", { exact: true })).toBeVisible();
      await expectWorkspaceOnboardingWasNeverRendered(page);
      expect(apiCallLog.acceptPending).toHaveLength(1);
      expect(apiCallLog.apiMe.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe("with an accepted invitation", () => {
    test.use({
      apiMeResponses: [
        emptyApiMeResponse("e2e-invited-user"),
        invitedApiMeResponse("e2e-invited-user"),
      ],
      acceptedInvitations: [
        {
          id: "invitation-1",
          tenantId: "invited-workspace",
          campaignId: "invited-campaign",
          workspaceRole: "member",
          campaignRole: "player",
          status: "accepted",
          acceptedAt: "2026-08-18T08:00:00.000Z",
        },
      ],
    });

    test("preserves the invitation hint and reaches invited welcome without workspace onboarding", async ({
      apiCallLog,
      page,
      request,
    }) => {
      const email = generatedEmail();
      let verificationRequestBody: unknown;
      page.on("request", (browserRequest) => {
        if (new URL(browserRequest.url()).pathname === "/api/auth/send-verification-email") {
          verificationRequestBody = browserRequest.postDataJSON();
        }
      });

      await page.goto("/?invited=true");
      await page.getByRole("button", { name: "Create an account" }).click();
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Create account" }).click();
      const oobCode = await getVerificationCode(request, email);
      await startWorkspaceOnboardingObserver(page);

      expect(verificationRequestBody).toEqual({ invited: true });
      await page.goto(
        `/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&invited=true`
      );
      await expect(
        page.getByRole("heading", { name: "You have entered the dungeon" })
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Invitation accepted", { exact: true })).toBeVisible();
      await expectWorkspaceOnboardingWasNeverRendered(page);
      expect(apiCallLog.acceptPending).toHaveLength(1);
      expect(apiCallLog.apiMe.length).toBeGreaterThanOrEqual(2);
    });

    test("does not duplicate pending invitation acceptance under Strict Mode", async ({
      apiCallLog,
      page,
      request,
    }) => {
      await startWorkspaceOnboardingObserver(page);
      await signInVerifiedInvitedUser(page, request);

      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "You have entered the dungeon" }))
        .toBeVisible({ timeout: 10_000 });
      await expectWorkspaceOnboardingWasNeverRendered(page);
      expect(apiCallLog.acceptPending).toHaveLength(1);
    });
  });

  test.describe("when verification continuation invitation acceptance fails", () => {
    test.use({
      apiMeResponse: emptyApiMeResponse("e2e-verification-access-failure-user"),
      acceptPendingStatus: 500,
      expectedConsoleErrors: [
        "Failed to load resource",
        "[InvitationAcceptanceBridge] Failed to accept pending invitations",
      ],
    });

    test("keeps workspace onboarding blocked behind a recoverable verification result", async ({
      apiCallLog,
      page,
      request,
    }) => {
      const email = generatedEmail();

      await page.goto("/?invited=true");
      await page.getByRole("button", { name: "Create an account" }).click();
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Create account" }).click();
      const oobCode = await getVerificationCode(request, email);
      await startWorkspaceOnboardingObserver(page);

      await page.goto(
        `/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&invited=true`
      );

      await expect(
        page.getByRole("heading", { name: "Account access unavailable" })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toHaveCount(0);
      await expectWorkspaceOnboardingWasNeverRendered(page);
      expect(apiCallLog.acceptPending).toHaveLength(1);
    });
  });

  test.describe("when pending invitation acceptance is delayed", () => {
    test.use({
      apiMeResponses: [
        emptyApiMeResponse("e2e-delayed-acceptance-user"),
        invitedApiMeResponse("e2e-delayed-acceptance-user"),
      ],
      acceptPendingDelayMs: 600,
      acceptedInvitations: [
        {
          id: "invitation-delayed-acceptance",
          tenantId: "invited-workspace",
          campaignId: "invited-campaign",
          workspaceRole: "member",
          campaignRole: "player",
          status: "accepted",
          acceptedAt: "2026-08-18T08:00:00.000Z",
        },
      ],
    });

    test("keeps delayed invitation acceptance behind the loading gate", async ({
      apiCallLog,
      page,
      request,
    }) => {
      await startWorkspaceOnboardingObserver(page);
      await signInVerifiedInvitedUser(page, request);

      await expect(page.getByText("Loading access…", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "You have entered the dungeon" }))
        .toBeVisible({ timeout: 10_000 });
      await expectWorkspaceOnboardingWasNeverRendered(page);
      expect(apiCallLog.acceptPending).toHaveLength(1);
    });
  });

  test.describe("when accepted invitation tenant refresh is delayed", () => {
    test.use({
      apiMeResponses: [
        emptyApiMeResponse("e2e-delayed-refresh-user"),
        invitedApiMeResponse("e2e-delayed-refresh-user"),
      ],
      apiMeDelaySequence: [0, 5_000, 0],
      acceptedInvitations: [
        {
          id: "invitation-delayed-refresh",
          tenantId: "invited-workspace",
          campaignId: "invited-campaign",
          workspaceRole: "member",
          campaignRole: "player",
          status: "accepted",
          acceptedAt: "2026-08-18T08:00:00.000Z",
        },
      ],
    });

    test("keeps delayed membership refresh from rendering workspace onboarding", async ({
      apiCallLog,
      page,
      request,
    }) => {
      const email = generatedEmail();
      await createVerifiedUser(request, email, password);
      await startWorkspaceOnboardingObserver(page);
      await page.goto("/?invited=true");
      await page.getByRole("button", { name: "Continue with email" }).click();
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);

      const signIn = page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toHaveCount(0);
      await signIn;
      await expect(page.getByRole("heading", { name: "You have entered the dungeon" }))
        .toBeVisible({ timeout: 10_000 });
      await expectWorkspaceOnboardingWasNeverRendered(page);
      expect(apiCallLog.acceptPending).toHaveLength(1);
      expect(apiCallLog.apiMe.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe("when invitation acceptance fails", () => {
    test.use({
      apiMeResponse: emptyApiMeResponse("e2e-invitation-failure-user"),
      acceptPendingStatus: 500,
      expectedConsoleErrors: [
        "Failed to load resource",
        "[InvitationAcceptanceBridge] Failed to accept pending invitations",
      ],
    });

    test("shows a recoverable access gate without protected data", async ({
      page,
      request,
    }) => {
      await signInVerifiedInvitedUser(page, request);

      await expect(
        page.getByText("Account setup unavailable", { exact: true })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Use a different account" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Invited Workspace");
      await expect(page.locator("body")).not.toContainText("Invited Campaign");
      await expect(page.locator("body")).not.toContainText(/GM-only/i);
    });
  });

  test.describe("without an invitation", () => {
    test.use({
      apiMeResponse: {
        ok: true,
        user: { id: "e2e-uninvited-user" },
        workspaces: [],
        workspaceMemberships: [],
        campaigns: [],
        campaignMemberships: [],
      },
    });

    test("continues to independent workspace onboarding", async ({ page, request }) => {
      const email = generatedEmail();

      await page.goto("/login");
      await page.getByRole("button", { name: "Create an account" }).click();
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByLabel("Confirm password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Create account" }).click();
      const oobCode = await getVerificationCode(request, email);

      await page.goto(`/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}`);
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Invitation accepted", { exact: true })).toHaveCount(0);
    });
  });
});

test("requires sign-in after cross-browser verification and preserves invitation context", async ({
  page,
  request,
}) => {
  const email = generatedEmail();
  const account = await signUpWithPassword(request, email, password);
  await sendVerificationEmail(request, account.idToken);
  const oobCode = await getVerificationCode(request, email);

  await page.goto(
    `/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&invited=true`
  );

  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to sign in" })).toBeVisible();
  await expect(page.getByText("E2E Workspace", { exact: true })).toHaveCount(0);
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/GM mode|Player mode/)).toHaveCount(0);

  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await expect(page).toHaveURL(/\/welcome\?invited=true$/);
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
});

test("shows non-identifying invalid and already-used action states", async ({
  page,
  request,
}) => {
  await page.goto("/auth/verify-email?mode=verifyEmail&oobCode=invalid-code");
  await expect(
    page.getByRole("heading", { name: "Verification link unavailable" })
  ).toBeVisible();
  await expect(page.getByText(/invalid or has already been used/i)).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/workspace|campaign|role|GM-only/i);

  const email = generatedEmail();
  const account = await signUpWithPassword(request, email, password);
  await sendVerificationEmail(request, account.idToken);
  const oobCode = await getVerificationCode(request, email);
  await verifyEmailThroughEmulator(request, email);
  await page.goto(`/auth/verify-email?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}`);
  await expect(
    page.getByRole("heading", { name: "Verification link unavailable" })
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(email);
});

test("renders every recoverable result state responsively and accessibly", async ({
  page,
}, testInfo) => {
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];
  const states = [
    "expired",
    "failure",
    "refresh-failed",
    "access-failed",
    "already-verified",
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const state of states) {
      await page.goto(`/auth/verify-email?testState=${state}`);
      const card = page.getByTestId("verification-result-card");
      await expect(card).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);

      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(viewport.name === "desktop" ? 460 : 357);
      expect(box!.width).toBeLessThanOrEqual(viewport.name === "desktop" ? 500 : 359);

      const action = page.getByRole("button");
      await action.focus();
      await expect(action).toBeFocused();
      await expect(action).toHaveCSS("outline-style", "solid");
      await expect(page.locator("main")).not.toContainText(/workspace|campaign|role|GM-only/i);

      await testInfo.attach(`verification-${viewport.name}-${state}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
  }
});

test("signs in a verified email and password user", async ({ page, request }) => {
  const email = generatedEmail();
  await createVerifiedUser(request, email, password);

  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
});

test.describe("verified user identity provisioning", () => {
  test.describe("without invitations", () => {
    test.use({
      apiMeResponse: {
        ok: true,
        user: { id: "e2e-user-without-invitations" },
        workspaces: [],
        workspaceMemberships: [],
        campaigns: [],
        campaignMemberships: [],
      },
    });

    test("enters workspace onboarding after identity provisioning", async ({
      page,
      request,
    }) => {
      const email = generatedEmail();
      await createVerifiedUser(request, email, password);

      await openEmailSignIn(page);
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toBeVisible();
    });
  });

  test.describe("when provisioning fails", () => {
    test.use({
      apiMeStatus: 500,
      expectedConsoleErrors: [
        "Failed to load resource",
        "[TenantContext] Failed to load tenants",
      ],
    });

    test("blocks onboarding and offers a retry", async ({ page, request }) => {
      const email = generatedEmail();
      await createVerifiedUser(request, email, password);

      await openEmailSignIn(page);
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();

      await expect(
        page.getByText("Account setup unavailable", { exact: true })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toHaveCount(0);
    });
  });
});

test.describe("canonical workspace creation", () => {
  const workspaceId = "00000000-0000-4000-8000-000000000018";
  const userId = "e2e-canonical-workspace-user";

  test.use({
    apiMeResponse: emptyApiMeResponse(userId),
    apiMeResponseAfterWorkspaceCreate: {
      ok: true,
      user: { id: userId },
      workspaces: [
        {
          id: workspaceId,
          slug: "created-workspace",
          name: "Created Workspace",
        },
      ],
      workspaceMemberships: [
        { workspaceId, userId, role: "owner" },
      ],
      campaigns: [],
      campaignMemberships: [],
    },
  });

  test("creates through the API and refreshes Neon-backed tenant state", async ({
    apiCallLog,
    page,
    request,
  }) => {
    const email = generatedEmail();
    await createVerifiedUser(request, email, password);

    await openEmailSignIn(page);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
    await page
      .getByPlaceholder("e.g. Chronicles of Varionath")
      .fill("Created Workspace");
    await page.getByRole("button", { name: "Create workspace" }).click();

    await expect(
      page.getByRole("heading", { name: "Create your first campaign" })
    ).toBeVisible();
    expect(apiCallLog.workspaceCreate).toHaveLength(1);
    expect(apiCallLog.workspaceCreate[0]).toMatchObject({ name: "Created Workspace" });
    expect(apiCallLog.workspaceCreate[0]).not.toHaveProperty("ownerUid");
    expect(apiCallLog.workspaceCreate[0]).not.toHaveProperty("role");
    expect(apiCallLog.workspaceCreate[0].idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("dd_selectedTenantId")))
      .toBe("created-workspace");
  });
});

test.describe("canonical campaign creation", () => {
  const campaignId = "00000000-0000-4000-8000-000000000027";
  const userId = "e2e-canonical-campaign-user";

  test.use({
    apiMeResponse: campaignBootstrapApiMeResponse(userId),
    apiMeResponseAfterCampaignCreate: {
      ok: true,
      user: { id: userId },
      workspaces: [
        {
          id: bootstrapWorkspaceId,
          slug: "bootstrap-workspace",
          name: "Bootstrap Workspace",
        },
      ],
      workspaceMemberships: [
        { workspaceId: bootstrapWorkspaceId, userId, role: "owner" },
      ],
      campaigns: [
        {
          id: campaignId,
          workspaceId: bootstrapWorkspaceId,
          slug: "created-campaign",
          name: "Created Campaign",
          description: "",
        },
      ],
      campaignMemberships: [
        { campaignId, userId, role: "gm" },
      ],
    },
  });

  test("creates through the API and refreshes Neon-backed campaign state", async ({
    apiCallLog,
    page,
    request,
  }) => {
    const email = generatedEmail();
    await createVerifiedUser(request, email, password);

    await openEmailSignIn(page);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Create your first campaign" })
    ).toBeVisible();
    await page
      .getByPlaceholder("e.g. Chronicles of Varionath")
      .fill("Created Campaign");
    await page.getByRole("button", { name: "Create campaign" }).click();

    await expect(
      page.getByRole("heading", { name: "Create your first campaign" })
    ).toHaveCount(0);
    expect(apiCallLog.campaignCreate).toHaveLength(1);
    expect(apiCallLog.campaignCreate[0]).toMatchObject({
      workspaceId: "bootstrap-workspace",
      name: "Created Campaign",
    });
    expect(apiCallLog.campaignCreate[0]).not.toHaveProperty("ownerUid");
    expect(apiCallLog.campaignCreate[0]).not.toHaveProperty("gmUid");
    expect(apiCallLog.campaignCreate[0]).not.toHaveProperty("role");
    expect(apiCallLog.campaignCreate[0].idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("dd_selectedCampaignId")))
      .toBe("created-campaign");
  });
});

test.describe("workspace fixture routing", () => {
  test.use({ expectedConsoleErrors: ["Failed to load resource"] });

  test("does not handle workspacePeople requests as workspace creation", async ({
    apiCallLog,
    page,
  }) => {
    await page.goto("/");

    const outcome = await page.evaluate(async () => {
      try {
        await fetch("/api/workspace?resource=workspacePeople", {
          headers: {
            Authorization: "Bearer emulator-token",
            "X-DD-Mode": "player",
          },
        });
        return "fulfilled";
      } catch {
        return "blocked";
      }
    });

    expect(outcome).toBe("blocked");
    expect(apiCallLog.workspaceCreate).toHaveLength(0);
  });
});

test.describe("campaign fixture routing", () => {
  test.use({ expectedConsoleErrors: ["Failed to load resource"] });

  test("does not handle campaignPeople requests as campaign creation", async ({
    apiCallLog,
    page,
  }) => {
    await page.goto("/");

    const outcome = await page.evaluate(async () => {
      try {
        await fetch("/api/campaign-content?resource=campaignPeople", {
          headers: {
            Authorization: "Bearer emulator-token",
            "X-DD-Mode": "player",
          },
        });
        return "fulfilled";
      } catch {
        return "blocked";
      }
    });

    expect(outcome).toBe("blocked");
    expect(apiCallLog.campaignCreate).toHaveLength(0);
  });
});

test.describe("bootstrap sign out", () => {
  test.describe("without a workspace", () => {
    test.use({
      apiMeResponse: emptyApiMeResponse("e2e-workspace-bootstrap-sign-out-user"),
    });

    test("signs out from workspace bootstrap without submitting the creation form", async ({
      page,
      request,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await signInVerifiedUser(page, request);

      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toBeVisible();
      await observeBootstrapFormSubmissions(page);

      const signOut = page.getByRole("button", { name: "Sign out" });
      await expect(signOut).toBeVisible();
      await expect(signOut).toHaveAttribute("type", "button");
      expect(await signOut.evaluate((button) => button.closest("form") === null)).toBe(true);

      await signOut.focus();
      await expect(signOut).toBeFocused();
      await signOut.press("Enter");

      await expect(
        page.getByRole("heading", { name: "Sign in to your account" })
      ).toBeVisible();
      await expectNoBootstrapFormSubmission(page);
    });

    test("shows a generic retryable error when workspace-bootstrap sign out fails", async ({
      page,
      request,
    }) => {
      await signInVerifiedUser(page, request);
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toBeVisible();

      await page.evaluate(() => {
        const trackedWindow = window as Window & {
          __ddRestoreIndexedDbDelete?: () => void;
          __ddRejectedSignOutDeletes?: number;
        };
        const originalDelete = IDBObjectStore.prototype.delete;
        trackedWindow.__ddRejectedSignOutDeletes = 0;
        IDBObjectStore.prototype.delete = function rejectAuthUserDelete(key) {
          if (String(key).startsWith("firebase:authUser:")) {
            trackedWindow.__ddRejectedSignOutDeletes =
              (trackedWindow.__ddRejectedSignOutDeletes ?? 0) + 1;
            throw new DOMException("Persistence unavailable", "UnknownError");
          }
          return originalDelete.call(this, key);
        };
        trackedWindow.__ddRestoreIndexedDbDelete = () => {
          IDBObjectStore.prototype.delete = originalDelete;
        };
      });

      await page.getByRole("button", { name: "Sign out" }).click();

      await expect(page.getByRole("alert")).toHaveText(
        "Could not sign out. Please try again."
      );
      await expect(
        page.getByRole("heading", { name: "Create your workspace" })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeEnabled();
      await expect
        .poll(() => page.evaluate(() => {
          const trackedWindow = window as Window & {
            __ddRejectedSignOutDeletes?: number;
          };
          return trackedWindow.__ddRejectedSignOutDeletes ?? 0;
        }))
        .toBeGreaterThan(0);

      await page.evaluate(() => {
        const trackedWindow = window as Window & {
          __ddRestoreIndexedDbDelete?: () => void;
        };
        trackedWindow.__ddRestoreIndexedDbDelete?.();
      });
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(
        page.getByRole("heading", { name: "Sign in to your account" })
      ).toBeVisible();
    });
  });

  test.describe("with a workspace and no campaign", () => {
    test.use({
      apiMeResponse: campaignBootstrapApiMeResponse(),
    });

    test("keeps a single incomplete workspace on the campaign creation flow", async ({
      page,
      request,
    }) => {
      await signInVerifiedUser(page, request);

      await expect(
        page.getByRole("heading", { name: "Create your first campaign" })
      ).toBeVisible();
      await expect(page.getByLabel("Workspace")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    });

    test("signs out from campaign bootstrap without submitting the creation form", async ({
      page,
      request,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await signInVerifiedUser(page, request);

      await expect(
        page.getByRole("heading", { name: "Create your first campaign" })
      ).toBeVisible();
      await observeBootstrapFormSubmissions(page);

      const signOut = page.getByRole("button", { name: "Sign out" });
      await expect(signOut).toBeVisible();
      await expect(signOut).toHaveAttribute("type", "button");
      expect(await signOut.evaluate((button) => button.closest("form") === null)).toBe(true);
      await signOut.click();

      await expect(
        page.getByRole("heading", { name: "Sign in to your account" })
      ).toBeVisible();
      await expectNoBootstrapFormSubmission(page);
    });
  });

  test.describe("with multiple workspaces and one incomplete workspace", () => {
    test.use({
      apiMeResponse: multiWorkspaceCampaignBootstrapApiMeResponse(),
    });

    test("switches away from campaign bootstrap to an accessible workspace with a campaign", async ({
      page,
      request,
    }) => {
      await signInVerifiedUser(page, request);

      await expect(
        page.getByRole("heading", { name: "Create your first campaign" })
      ).toBeVisible();
      await expect(page.getByText("Current workspace: Bootstrap Workspace")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

      await page.getByLabel("Workspace").selectOption("ready-workspace");

      await expect(
        page.getByRole("heading", { name: "Create your first campaign" })
      ).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Ready Campaign" })).toBeVisible();
      await expect(page.getByText("Workspace: Ready Workspace")).toBeVisible();
    });
  });

  test.describe("with inaccessible workspace and campaign rows in membership data", () => {
    test.use({
      apiMeResponse: mixedVisibilityCampaignBootstrapApiMeResponse(),
    });

    test("does not expose unjoined workspaces or campaigns from bootstrap switching", async ({
      page,
      request,
    }) => {
      await signInVerifiedUser(page, request);

      await expect(
        page.getByRole("heading", { name: "Create your first campaign" })
      ).toBeVisible();
      await expect(page.getByLabel("Workspace")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Unauthorized Workspace");
      await expect(page.locator("body")).not.toContainText("GM Secret Campaign");

      await page.getByLabel("Workspace").selectOption("ready-workspace");

      await expect(page.getByRole("heading", { name: "Ready Campaign" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Unauthorized Workspace");
      await expect(page.locator("body")).not.toContainText("GM Secret Campaign");
    });
  });
});

test("@smoke keeps authentication independent from player and GM mode", async ({ page, request }) => {
  const email = generatedEmail();
  await createVerifiedUser(request, email, password);

  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

  await page.getByRole("button", { name: "GM", exact: true }).click();
  await expect(page.getByText("GM mode", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Player", exact: true }).click();
  await expect(page.getByText("Player mode", { exact: true }).first()).toBeVisible();
});

test("keeps retired feature and placeholder controls out of authenticated navigation", async ({
  page,
  request,
}) => {
  const email = generatedEmail();
  await createVerifiedUser(request, email, password);

  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Sessions", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Items", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "NPCs", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "PCs", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Locations", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lore", exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Campaign Settings", exact: true })
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Arcs", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Quests", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Conditions", exact: true })).toHaveCount(0);
  await expect(page.locator("header input")).toHaveCount(0);
  await expect(page.locator("header button")).toHaveCount(3);

  for (const retiredPath of [
    "/arcs",
    "/arcs/retired-arc",
    "/quests",
    "/quests/retired-quest",
    "/conditions",
    "/conditions/retired-condition",
  ]) {
    await page.goto(retiredPath);
    await expect(page.getByText("Not Found", { exact: true })).toBeVisible();
  }
});

test("shows a generic error for incorrect credentials", async ({ page }) => {
  const email = generatedEmail();

  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Incorrect42!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "We couldn't sign you in with those credentials."
  );
  await expect(page.getByRole("alert")).not.toContainText(email);
  await expect(page.getByRole("alert")).not.toContainText(/not found|does not exist/i);
});

test("@smoke signs out and keeps protected routes behind authentication", async ({ page, request }) => {
  const email = generatedEmail();
  await createVerifiedUser(request, email, password);

  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

  await page.getByRole("button").filter({ hasText: email }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByTestId("public-home")).toBeVisible();
  await expect(page.getByTestId("enter-dungeon")).toBeVisible();

  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await expect(page.getByTestId("back-to-public")).toBeVisible();
  await expect(page.getByTestId("back-to-public")).toHaveAttribute("href", "/");
  await page.getByTestId("back-to-public").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("public-home")).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
});

test("@smoke keeps the public homepage outside application bootstrap", async ({
  apiCallLog,
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
  });

  await page.goto("/");

  await expect(page.getByTestId("public-home")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
  await expect(page.getByTestId("enter-dungeon")).toBeVisible();
  await expect(page.getByTestId("enter-dungeon")).toHaveCount(1);
  await expect(page.getByTestId("enter-dungeon")).toHaveText("Enter The Dungeon");
  await expect(page.getByTestId("enter-dungeon")).toHaveAttribute("href", "/home");
  await expect(page.getByTestId("public-login")).toHaveAttribute("href", "/login");
  await expect(page.getByTestId("public-sign-up")).toHaveAttribute("href", "/get-started");
  await expect(page.getByText("Sessions", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Campaign Settings", { exact: true })).toHaveCount(0);
  expect(apiRequests).toEqual([]);
  expect(apiCallLog.apiMe).toHaveLength(0);

  await page.getByTestId("enter-dungeon").click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
});

test("public navigation reaches each coming-soon page and auth entry state", async ({ page }) => {
  await page.goto("/");

  for (const [label, path] of [
    ["About Us", "/about"],
    ["Features", "/features"],
    ["Pricing", "/pricing"],
    ["Resources", "/resources"],
    ["Socials", "/socials"],
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByText("Coming soon", { exact: true })).toBeVisible();
    await page.goto("/");
  }

  await page.getByTestId("public-login").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();

  await page.goto("/");
  await page.getByTestId("public-sign-up").click();
  await expect(page).toHaveURL(/\/get-started$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("keeps authenticated users on the public homepage until they enter the app", async ({
  apiCallLog,
  page,
  request,
}) => {
  const email = generatedEmail();
  await createVerifiedUser(request, email, password);

  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await expect(page.getByTestId("back-to-public")).toHaveCount(0);
  const apiMeCallsBeforePublicHome = apiCallLog.apiMe.length;

  await page.goto("/");

  await expect(page.getByTestId("public-home")).toBeVisible();
  await expect(page.getByTestId("enter-dungeon")).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sessions", { exact: true })).toHaveCount(0);
  expect(apiCallLog.apiMe).toHaveLength(apiMeCallsBeforePublicHome);
});

test("returns from the auth entry to the public shell with browser navigation intact", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByTestId("auth-card")).toBeVisible();
  await expect(page.getByTestId("back-to-public")).toBeVisible();

  await page.getByTestId("back-to-public").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("public-home")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("auth-card")).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("public-home")).toBeVisible();
});

test("@credential-migration keeps normal access available and optional setup locally validated", async ({
  apiCallLog,
  page,
  request,
}) => {
  const email = generatedEmail();
  await signInWithNewEmulatedGoogle(page, email);
  let linkingRequests = 0;
  page.on("request", (browserRequest) => {
    if (browserRequest.url().includes("accounts:update")) linkingRequests += 1;
  });

  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  expect(apiCallLog.apiMe.length).toBeGreaterThan(0);
  expect(apiCallLog.acceptPending.length).toBeGreaterThan(0);
  expect(apiCallLog.identityContinuity).toEqual([]);

  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Profile Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add another way to sign in" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  expect(apiCallLog.identityContinuity).toEqual(["/api/auth/identity-continuity"]);

  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Add another way to sign in" })).toBeVisible();
  await expect.poll(() => apiCallLog.identityContinuity.length).toBe(2);

  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password", { exact: true }).fill("different");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
  expect(linkingRequests).toBe(0);

  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Your password does not meet the requirements."
  );
  expect(linkingRequests).toBe(0);
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
});

test("@credential-migration resumes an already-linked setup without relinking and preserves both sign-ins", async ({
  apiCallLog,
  page,
  request,
}) => {
  const email = generatedEmail();
  const googleAccount = await createGoogleOnlyUser(request, email);
  await addPasswordProvider(
    request,
    googleAccount.idToken,
    email,
    replacementPassword
  );
  await seedPendingCredentialSetup(page, googleAccount.localId);
  let linkingRequests = 0;
  page.on("request", (browserRequest) => {
    if (browserRequest.url().includes("accounts:update")) linkingRequests += 1;
  });

  await signInWithEmulatedGoogle(page, email);
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  expect(apiCallLog.identityContinuity).toEqual([]);
  await page.goto("/settings/profile");

  await expect(page.getByText("Password sign-in is ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add another way to sign in" })).toHaveCount(0);
  await expect(page.getByText("Google", { exact: true })).toBeVisible();
  await expect(page.getByText("Email / Password", { exact: true })).toBeVisible();
  expect(apiCallLog.identityContinuity).toHaveLength(2);
  expect(linkingRequests).toBe(0);

  const passwordAccount = await signInWithPassword(request, email, replacementPassword);
  expect(passwordAccount.localId).toBe(googleAccount.localId);
  const authoritativeAccount = await lookupAuthEmulatorAccount(
    request,
    passwordAccount.idToken
  );
  expect(authoritativeAccount.localId).toBe(googleAccount.localId);
  expect(
    authoritativeAccount.providerUserInfo.map(
      (provider: { providerId: string }) => provider.providerId
    )
  ).toEqual(expect.arrayContaining(["google.com", "password"]));
});

test("@credential-migration automatically verifies email before resuming pending continuity", async ({
  apiCallLog,
  page,
  request,
}) => {
  const email = generatedEmail();
  const googleAccount = await createGoogleOnlyUser(request, email);
  await addPasswordProviderByLocalId(
    request,
    googleAccount.localId,
    email,
    replacementPassword,
    false
  );
  await seedPendingCredentialSetup(page, googleAccount.localId);
  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(replacementPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expect.poll(() => apiCallLog.verificationEmail.length).toBe(1);
  await waitForPendingVerificationDelivery(page);
  expect(apiCallLog.identityContinuity).toHaveLength(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expect.poll(() => apiCallLog.verificationEmail.length).toBe(1);
  expect(apiCallLog.identityContinuity).toHaveLength(0);

  await expirePendingVerificationCooldown(page);
  await page.reload();
  const resend = page.getByRole("button", { name: "Resend verification email" });
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(page.getByText("A new verification email has been sent.")).toBeVisible();
  await expect.poll(() => apiCallLog.verificationEmail.length).toBe(2);
  const pendingAfterResend = await page.evaluate(() =>
    JSON.parse(
      window.sessionStorage.getItem("dd_credentialMigrationContinuity") || "null"
    )
  );
  expect(pendingAfterResend).toMatchObject({
    firebaseUid: googleAccount.localId,
    neonUserId: "e2e-user",
  });
  expect(typeof pendingAfterResend.verificationEmailSentAt).toBe("number");

  await verifyEmailThroughEmulator(request, email);
  await page.getByRole("button", { name: "I've verified my email" }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await expect.poll(() => apiCallLog.identityContinuity.length).toBe(1);
  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Add another way to sign in" })).toHaveCount(0);
  await expect(page.getByText("Google", { exact: true })).toBeVisible();
  await expect(page.getByText("Email / Password", { exact: true })).toBeVisible();

  const linkedAccount = await findAuthEmulatorAccountByEmail(request, email);
  expect(linkedAccount.localId).toBe(googleAccount.localId);
  expect(
    linkedAccount.providerUserInfo.map(
      (provider: { providerId: string }) => provider.providerId
    )
  ).toEqual(expect.arrayContaining(["google.com", "password"]));
});

test.describe("pending credential verification cooldown", () => {
  test.use({
    expectedConsoleErrors: [
      "Failed to load resource: the server responded with a status of 429",
    ],
  });

  test("@credential-migration manual verification resend surfaces the server cooldown", async ({
    apiCallLog,
    page,
    request,
  }) => {
    const email = generatedEmail();
    const googleAccount = await createGoogleOnlyUser(request, email);
    await addPasswordProviderByLocalId(
      request,
      googleAccount.localId,
      email,
      replacementPassword,
      false
    );
    await seedPendingCredentialSetup(page, googleAccount.localId);
    await openEmailSignIn(page);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(replacementPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    await expect.poll(() => apiCallLog.verificationEmail.length).toBe(1);
    await waitForPendingVerificationDelivery(page);
    await expirePendingVerificationCooldown(page);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Resend verification email" })
    ).toBeEnabled();

    let manualRequests = 0;
    await page.route("**/api/auth/send-verification-email", async (route) => {
      manualRequests += 1;
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "125" },
        json: {
          error: "Too many verification requests",
          retryAfterSeconds: 125,
        },
      });
    });
    await page.getByRole("button", { name: "Resend verification email" }).click();

    await expect(
      page.getByText("Verification email limit reached. Try again in 2m 5s.")
    ).toBeVisible();
    await expect(page.getByText("A new verification email has been sent.")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Resend available in 2m [45]s/ })
    ).toBeDisabled();
    expect(manualRequests).toBe(1);
    const pendingAfterRateLimit = await page.evaluate(() =>
      JSON.parse(
        window.sessionStorage.getItem("dd_credentialMigrationContinuity") || "null"
      )
    );
    expect(pendingAfterRateLimit).toMatchObject({
      firebaseUid: googleAccount.localId,
      neonUserId: "e2e-user",
    });
  });
});

test("@credential-migration already-linked users do not receive optional cards", async ({
  apiCallLog,
  page,
  request,
}) => {
  const email = generatedEmail();
  const googleAccount = await createGoogleOnlyUser(request, email);
  await addPasswordProvider(
    request,
    googleAccount.idToken,
    email,
    replacementPassword
  );

  await signInWithEmulatedGoogle(page, email);

  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Add another way to sign in" })).toHaveCount(0);
  expect(apiCallLog.identityContinuity).toEqual([]);
  expect(apiCallLog.apiMe.length).toBeGreaterThan(0);

  await page.getByRole("button").filter({ hasText: email }).click();
  await page.getByRole("banner").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  const passwordOnlyEmail = generatedEmail();
  await createVerifiedUser(request, passwordOnlyEmail, password);
  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(passwordOnlyEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Add another way to sign in" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Connect Google sign-in" })).toBeVisible();
});

test("@google-linking password account can connect Google without changing Firebase UID or Neon continuity", async ({
  apiCallLog,
  page,
  request,
}) => {
  const email = generatedEmail();
  const passwordAccount = await createVerifiedUser(request, email, password);
  await openEmailSignIn(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Connect Google sign-in" })).toBeVisible();
  await expect(page.getByText("Email / Password", { exact: true })).toBeVisible();
  await expect(page.getByText("Google", { exact: true })).toHaveCount(0);
  expect(apiCallLog.identityContinuity).toEqual(["/api/auth/identity-continuity"]);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect Google" }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(
    () =>
      typeof (window as Window & { finishWithUser?: unknown }).finishWithUser ===
      "function"
  );
  await popup.getByRole("button", { name: "Add new account" }).click();
  await popup.locator("#email-input").fill(email);
  await popup.locator("#sign-in").click();
  await popup.waitForEvent("close");

  await expect(page.getByText("Google sign-in is connected", { exact: true })).toBeVisible();
  await expect.poll(() => apiCallLog.identityContinuity.length).toBe(2);
  await expect(page.getByText("Google", { exact: true })).toBeVisible();
  await expect(page.getByText("Email / Password", { exact: true })).toBeVisible();

  const googleLinkedAccount = await findAuthEmulatorAccountByEmail(request, email);
  expect(googleLinkedAccount.localId).toBe(passwordAccount.localId);
  expect(
    googleLinkedAccount.providerUserInfo.map(
      (provider: { providerId: string }) => provider.providerId
    )
  ).toEqual(expect.arrayContaining(["google.com", "password"]));

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await signInWithEmulatedGoogle(page, email);
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  const authoritativeAccount = await findAuthEmulatorAccountByEmail(request, email);
  expect(authoritativeAccount.localId).toBe(passwordAccount.localId);
});

test.describe("Google linking verification state", () => {
  test("@google-linking successful direct link shows neutral verification before success", async ({
    page,
    request,
  }) => {
    const email = generatedEmail();
    const passwordAccount = await createVerifiedUser(request, email, password);
    await openEmailSignIn(page);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

    const continuity = await deferSecondIdentityContinuityResponse(page);
    await page.goto("/settings/profile");
    await expect(page.getByRole("heading", { name: "Connect Google sign-in" })).toBeVisible();
    await expect.poll(() => continuity.getCallCount()).toBe(1);

    await connectGoogleProviderFromProfile(page, email);
    await continuity.waitForSecondRequest();

    await expect(
      page.getByRole("status").filter({
        hasText: "Google connected. Confirming account continuity...",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Google connection unavailable" })
    ).toHaveCount(0);
    await expect(
      page.getByText("This sign-in method was added, but we could not verify account continuity.")
    ).toHaveCount(0);

    continuity.resolveSecondRequest();
    await expect(page.getByText("Google sign-in is connected", { exact: true })).toBeVisible();
    await expect.poll(() => continuity.getCallCount()).toBe(2);

    const googleLinkedAccount = await findAuthEmulatorAccountByEmail(request, email);
    expect(googleLinkedAccount.localId).toBe(passwordAccount.localId);
  });
});

test.describe("Google linking continuity failure", () => {
  test("@google-linking real continuity failure shows recoverable warning", async ({
    page,
    request,
  }) => {
    const email = generatedEmail();
    const passwordAccount = await createVerifiedUser(request, email, password);
    await openEmailSignIn(page);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();

    const continuity = await deferSecondIdentityContinuityResponse(page, {
      status: 200,
      body: { ok: true, neonUserId: "different-neon-user" },
    });
    await page.goto("/settings/profile");
    await expect(page.getByRole("heading", { name: "Connect Google sign-in" })).toBeVisible();
    await expect.poll(() => continuity.getCallCount()).toBe(1);

    await connectGoogleProviderFromProfile(page, email);
    await continuity.waitForSecondRequest();

    await expect(
      page.getByRole("status").filter({
        hasText: "Google connected. Confirming account continuity...",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Google connection unavailable" })
    ).toHaveCount(0);

    continuity.resolveSecondRequest();

    await expect(
      page.getByRole("alert").filter({ hasText: "Google connection unavailable" })
    ).toBeVisible();
    await expect(
      page.getByText("This sign-in method was added, but we could not verify account continuity.")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Try again" })
    ).toBeEnabled();
    await expect(
      page.getByRole("status").filter({
        hasText: "Google connected. Confirming account continuity...",
      })
    ).toHaveCount(0);
    await expect.poll(() => continuity.getCallCount()).toBe(2);

    const googleLinkedAccount = await findAuthEmulatorAccountByEmail(request, email);
    expect(googleLinkedAccount.localId).toBe(passwordAccount.localId);
  });
});

test.describe("missing identity continuity", () => {
  test.use({
    identityContinuityStatus: 409,
    expectedConsoleErrors: [
      "Failed to load resource: the server responded with a status of 409",
    ],
  });

  test("@credential-migration unavailable setup remains retryable without blocking normal access", async ({
    apiCallLog,
    page,
    request,
  }) => {
    const email = generatedEmail();
    await signInWithNewEmulatedGoogle(page, email);

    await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
    expect(apiCallLog.apiMe.length).toBeGreaterThan(0);
    await page.goto("/settings/profile");
    await expect(page.getByText("Account setup unavailable", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => apiCallLog.identityContinuity.length).toBe(2);
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
  });
});

test.describe("changed post-link identity continuity", () => {
  test.use({
    identityContinuityUserIds: ["e2e-user", "different-neon-user"],
  });

  test("@credential-migration keeps continuity failure recoverable without blocking application providers", async ({
    apiCallLog,
    page,
    request,
  }) => {
    const email = generatedEmail();
    const googleAccount = await createGoogleOnlyUser(request, email);
    await addPasswordProvider(
      request,
      googleAccount.idToken,
      email,
      replacementPassword
    );
    await seedPendingCredentialSetup(page, googleAccount.localId);
    await signInWithEmulatedGoogle(page, email);
    await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
    await page.goto("/settings/profile");

    await expect(page.getByText(/could not verify account continuity/i)).toBeVisible();
    expect(apiCallLog.apiMe.length).toBeGreaterThan(0);
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible();
    await page.goto("/settings/profile");
    await expect(page.getByText("Account setup unavailable", { exact: true })).toBeVisible();
    const account = await findAuthEmulatorAccountByEmail(request, email);
    expect(
      account.providerUserInfo.map(
        (provider: { providerId: string }) => provider.providerId
      )
    ).toEqual(expect.arrayContaining(["google.com", "password"]));
  });
});
