import assert from "node:assert/strict";
import { test, vi } from "vitest";

import {
  buildAppVerificationLink,
  createVerificationEmailHandler,
  getApplicationOrigin,
  getVerificationEmailCooldownMs,
} from "./verificationEmail.ts";
import {
  buildVerificationEmailHtml,
  VERIFICATION_EMAIL_SUBJECT,
} from "../domain/mail/verificationEmail.template.ts";
import { getAuthEmailDelivery } from "./authEmail.ts";

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const HOUR_MS = 60 * 60 * 1000;

function createDatabaseDouble(initial = []) {
  const documents = new Map(initial.map(([ref, data]) => [JSON.stringify(ref), data]));
  const mail = [];
  return {
    documents,
    mail,
    db: {
      collection(name) {
        return {
          doc(id) {
            return { name, id };
          },
          async add(data) {
            if (name !== "mail") throw new Error("Unexpected collection write");
            mail.push(data);
          },
        };
      },
      async runTransaction(callback) {
        const writes = new Map();
        const result = await callback({
          async get(ref) {
            const document = documents.get(JSON.stringify(ref)) || {};
            return { get: (field) => document[field] };
          },
          set(ref, data) {
            writes.set(JSON.stringify(ref), data);
          },
        });
        for (const [key, data] of writes) documents.set(key, data);
        return result;
      },
    },
  };
}

function request() {
  return {
    body: { invited: false },
    headers: {
      authorization: "Bearer unit-test-token",
      host: "preview.example.test",
    },
    method: "POST",
  };
}

function response() {
  const result = { headers: {} };
  const res = {
    end: vi.fn(() => res),
    json: vi.fn((body) => {
      result.body = body;
      return res;
    }),
    setHeader: vi.fn((name, value) => {
      result.headers[name] = value;
      return res;
    }),
    status: vi.fn((status) => {
      result.status = status;
      return res;
    }),
  };
  return { res, result };
}

function createHandler(db, overrides = {}) {
  return createVerificationEmailHandler({
    verifyToken: vi.fn().mockResolvedValue({
      uid: "firebase-uid",
      email: "private@example.test",
      email_verified: false,
    }),
    auth: {
      generateEmailVerificationLink: vi.fn().mockResolvedValue(
        "https://demo.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=code-123"
      ),
    },
    db,
    environment: {},
    now: () => NOW,
    metric: vi.fn(),
    ...overrides,
  });
}

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

test("verification handler reserves by Firebase UID and queues the branded email", async () => {
  const { db, documents, mail } = createDatabaseDouble();
  const handler = createHandler(db);
  const { res, result } = response();

  await handler(request(), res);

  assert.equal(result.status, 202);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(mail.length, 1);
  const limiterKey = JSON.stringify({
    name: "_authVerificationCooldowns",
    id: "firebase-uid",
  });
  const limiterRecord = documents.get(limiterKey);
  assert.equal(limiterRecord.attempts.length, 1);
  assert.equal(limiterRecord.lastSentAt.getTime(), NOW);
  assert.equal(JSON.stringify(limiterRecord).includes("private@example.test"), false);
});

test("verification Retry-After uses the longest simultaneously limiting window", async () => {
  const limiterRef = {
    name: "_authVerificationCooldowns",
    id: "firebase-uid",
  };
  const { db, mail } = createDatabaseDouble([
    [
      limiterRef,
      {
        attempts: [
          new Date(NOW - 23 * HOUR_MS),
          new Date(NOW - 50 * 60_000),
          new Date(NOW - 40 * 60_000),
          new Date(NOW - 30 * 60_000),
          new Date(NOW - 15_000),
        ],
      },
    ],
  ]);
  const auth = {
    generateEmailVerificationLink: vi.fn(),
  };
  const handler = createHandler(db, { auth });
  const { res, result } = response();

  await handler(request(), res);

  assert.equal(result.status, 429);
  assert.equal(result.headers["Retry-After"], "3600");
  assert.deepEqual(result.body, {
    ok: false,
    error: "Please wait before requesting another verification email.",
    retryAfterSeconds: 3600,
  });
  assert.equal(auth.generateEmailVerificationLink.mock.calls.length, 0);
  assert.equal(mail.length, 0);
});

test("verification storage failures fail closed without logging error details", async () => {
  const sensitiveError = new Error("private@example.test oobCode=secret-code");
  const db = {
    collection(name) {
      return { doc: (id) => ({ name, id }) };
    },
    runTransaction: vi.fn().mockRejectedValue(sensitiveError),
  };
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const handler = createHandler(db);
  const { res, result } = response();

  await handler(request(), res);

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { ok: false, error: "Internal server error" });
  assert.deepEqual(consoleError.mock.calls, [
    ["[api/auth/send-verification-email] Request failed"],
  ]);
});
