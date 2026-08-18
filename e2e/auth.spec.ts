import { randomUUID } from "node:crypto";
import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { verifyAuthHeader } from "../src/server/auth";
import { test, expect } from "./auth.fixture";
import {
  createVerifiedUser,
  getVerificationCode,
  sendVerificationEmail,
  signUpWithPassword,
  signInWithPassword,
  verifyEmailThroughEmulator,
} from "./auth-emulator";

const password = "DungeonTest42!";
const invitedWorkspaceId = "00000000-0000-4000-8000-000000000011";
const invitedCampaignId = "00000000-0000-4000-8000-000000000012";

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

async function openEmailSignIn(page: Page) {
  await page.goto("/home");
  await page.getByRole("button", { name: "Continue with email" }).click();
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
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "E2E Campaign" })).toBeVisible({
    timeout: 10_000,
  });
});

test.describe("post-verification routing", () => {
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

      await page.goto("/");
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
  const states = ["expired", "failure", "refresh-failed", "already-verified"];

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
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  await expect(page.getByText("E2E Campaign", { exact: true })).toHaveCount(0);
});
