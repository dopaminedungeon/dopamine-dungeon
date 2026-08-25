import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildAppVerificationLink,
  getApplicationOrigin,
  getVerificationEmailCooldownMs,
} from "./verificationEmail.ts";
import {
  buildVerificationEmailHtml,
  VERIFICATION_EMAIL_SUBJECT,
} from "../domain/mail/verificationEmail.template.ts";
import { getAuthEmailDelivery } from "./authEmail.ts";

test("verification links keep Firebase codes on the app-owned result page", () => {
  const link = buildAppVerificationLink({
    firebaseLink: "https://demo.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=code-123&apiKey=raw-project-key",
    applicationOrigin: "https://preview.example.test",
    invited: true,
  });
  const url = new URL(link);

  assert.equal(url.origin, "https://preview.example.test");
  assert.equal(url.pathname, "/auth/verify-email");
  assert.equal(url.searchParams.get("oobCode"), "code-123");
  assert.equal(url.searchParams.get("invited"), "true");
  assert.equal(url.searchParams.has("apiKey"), false);
});

test("verification email cooldown is deterministic", () => {
  assert.equal(getVerificationEmailCooldownMs(1_000, 30_000), 31_000);
  assert.equal(getVerificationEmailCooldownMs(1_000, 61_000), 0);
});

test("request origin is derived from the API host rather than a caller origin", () => {
  const request = {
    headers: {
      host: "localhost:3000",
      origin: "https://attacker.example",
    },
  };

  assert.equal(getApplicationOrigin(request), "http://localhost:3000");
});

test("branded verification email is transactional and contains no protected data", () => {
  const html = buildVerificationEmailHtml({
    verificationLink: "https://preview.example.test/auth/verify-email?oobCode=code-123&mode=verifyEmail",
  });

  assert.equal(VERIFICATION_EMAIL_SUBJECT, "Verify your email for Dopamine Dungeon");
  assert.match(html, /Dopamine Dungeon/);
  assert.match(html, /Verify email address/);
  assert.match(html, /If the button does not work/);
  assert.match(html, /max-width:600px/);
  assert.doesNotMatch(html, /workspace|campaign|invitation|GM-only|project number/i);
});

test("verification email uses the shared authentication sender", () => {
  assert.deepEqual(getAuthEmailDelivery({}), {
    from: "Dopamine Dungeon <no-reply@dopamine-dungeon.com>",
    replyTo: "Dopamine Dungeon <dopamine.dungeon.info@gmail.com>",
  });
});
