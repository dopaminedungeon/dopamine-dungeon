import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import {
  DEFAULT_AUTH_EMAIL_FROM,
  DEFAULT_AUTH_EMAIL_FROM_NAME,
  DEFAULT_AUTH_EMAIL_REPLY_TO,
  DEFAULT_AUTH_EMAIL_REPLY_TO_NAME,
  getAuthEmailDelivery,
} from "./authEmail.js";
import {
  buildAppPasswordResetLink,
  createPasswordRecoveryEmailHandler,
  getPasswordRecoveryCooldownMs,
  getPasswordRecoveryFingerprint,
  PASSWORD_RECOVERY_ACCEPTED_RESPONSE,
} from "./passwordRecoveryEmail.js";
import {
  getRecoveryEmailFingerprint,
  getRecoveryIpFingerprint,
} from "./authEmailRateLimit.js";
import {
  buildPasswordRecoveryEmailHtml,
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
} from "../domain/mail/passwordRecoveryEmail.template.js";

type StoredDocument = Record<string, unknown>;
const fingerprintSecret = "unit-test-password-recovery-fingerprint-secret";

function createHandler(
  auth: ReturnType<typeof authDouble>,
  db: ReturnType<typeof createDatabaseDouble>["db"],
  overrides: Partial<Parameters<typeof createPasswordRecoveryEmailHandler>[0]> = {}
) {
  return createPasswordRecoveryEmailHandler({
    auth,
    db,
    fingerprintSecret,
    minimumResponseMs: 0,
    environment: {},
    metric: vi.fn(),
    ...overrides,
  });
}

function createDatabaseDouble() {
  const documents = new Map<string, StoredDocument>();
  const mail: unknown[] = [];
  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return { id, name };
        },
        async add(data: unknown) {
          if (name !== "mail") throw new Error("Unexpected collection write");
          mail.push(data);
          return { id: `mail-${mail.length}` };
        },
      };
    },
    async runTransaction<T>(callback: (transaction: {
      get(ref: unknown): Promise<{ get(field: string): unknown }>;
      set(ref: unknown, data: unknown): void;
      delete(ref: unknown): void;
    }) => Promise<T>) {
      return callback({
        async get(ref: unknown) {
          const key = JSON.stringify(ref);
          const document = documents.get(key) || {};
          return {
            get(field: string) {
              const value = document[field];
              return value instanceof Date
                ? { toMillis: () => value.getTime() }
                : value;
            },
          };
        },
        set(ref: unknown, data: unknown) {
          documents.set(JSON.stringify(ref), data as StoredDocument);
        },
        delete(ref: unknown) {
          documents.delete(JSON.stringify(ref));
        },
      });
    },
  };

  return { db, documents, mail };
}

function request(email: string) {
  return {
    body: { email },
    headers: { host: "preview.example.test" },
    method: "POST",
    socket: { remoteAddress: "203.0.113.10" },
  } as unknown as VercelRequest;
}

function response() {
  const result: { status?: number; body?: unknown } = {};
  const headers = new Map<string, unknown>();
  const res = {
    end: vi.fn(() => res),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    setHeader: vi.fn((name: string, value: unknown) => {
      headers.set(name, value);
      return res;
    }),
    status: vi.fn((status: number) => {
      result.status = status;
      return res;
    }),
  } as unknown as VercelResponse;
  return { res, result, headers };
}

function authDouble(overrides: Record<string, unknown> = {}) {
  return {
    getUserByEmail: vi.fn().mockResolvedValue({
      disabled: false,
      emailVerified: true,
      providerData: [{ providerId: "password" }],
    }),
    generatePasswordResetLink: vi.fn().mockResolvedValue(
      "https://demo.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=reset-123&apiKey=raw-project-key&continueUrl=https%3A%2F%2Funneeded.example&lang=en"
    ),
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

test("authentication email delivery uses one explicit sender and ignores invitation defaults", () => {
  assert.deepEqual(getAuthEmailDelivery({
    INVITE_EMAIL_FROM: "invite@example.test",
    INVITE_EMAIL_FROM_NAME: "Invitations",
  }), {
    from: `${DEFAULT_AUTH_EMAIL_FROM_NAME} <${DEFAULT_AUTH_EMAIL_FROM}>`,
    replyTo: `${DEFAULT_AUTH_EMAIL_REPLY_TO_NAME} <${DEFAULT_AUTH_EMAIL_REPLY_TO}>`,
  });

  assert.deepEqual(getAuthEmailDelivery({
    AUTH_EMAIL_FROM: "auth@example.test",
    AUTH_EMAIL_FROM_NAME: "DD Auth",
    AUTH_EMAIL_REPLY_TO: "help@example.test",
    AUTH_EMAIL_REPLY_TO_NAME: "DD Help",
  }), {
    from: "DD Auth <auth@example.test>",
    replyTo: "DD Help <help@example.test>",
  });
});

test("password reset links retain only the Firebase code and safe language", () => {
  const link = buildAppPasswordResetLink({
    firebaseLink:
      "https://demo.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=reset-123&apiKey=raw-project-key&continueUrl=https%3A%2F%2Funneeded.example&lang=en",
    applicationOrigin: "https://preview.example.test",
  });
  const url = new URL(link);

  assert.equal(url.origin, "https://preview.example.test");
  assert.equal(url.pathname, "/auth/reset-password");
  assert.equal(url.searchParams.get("mode"), "resetPassword");
  assert.equal(url.searchParams.get("oobCode"), "reset-123");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.has("apiKey"), false);
  assert.equal(url.searchParams.has("continueUrl"), false);
});

test("branded recovery email has one action, a fallback URL, and no protected data", () => {
  const link =
    "https://preview.example.test/auth/reset-password?mode=resetPassword&oobCode=reset-123";
  const html = buildPasswordRecoveryEmailHtml({ passwordResetLink: link });

  assert.equal(PASSWORD_RECOVERY_EMAIL_SUBJECT, "Reset your Dopamine Dungeon password");
  assert.match(html, /Dopamine Dungeon/);
  assert.match(html, />Reset password</);
  assert.equal(html.match(/href=/g)?.length, 2);
  assert.match(html, /If the button does not work/);
  assert.match(html, /did not request a password reset/);
  assert.match(html, /reset-123/);
  assert.doesNotMatch(
    html,
    /workspace|campaign|invitation|membership|GM-only|Dungeon Master/i
  );
});

test("verified password users queue branded mail with the shared authentication sender", async () => {
  const { db, mail } = createDatabaseDouble();
  const auth = authDouble();
  const handler = createHandler(auth, db);
  const { res, result } = response();

  await handler(request("USER@example.test"), res);

  assert.equal(result.status, 202);
  assert.deepEqual(result.body, PASSWORD_RECOVERY_ACCEPTED_RESPONSE);
  assert.equal(auth.generatePasswordResetLink.mock.calls[0][0], "user@example.test");
  assert.equal(mail.length, 1);
  assert.deepEqual(mail[0], {
    to: ["user@example.test"],
    from: "Dopamine Dungeon <no-reply@dopamine-dungeon.com>",
    replyTo: "Dopamine Dungeon <dopamine.dungeon.info@gmail.com>",
    message: {
      subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
      html: buildPasswordRecoveryEmailHtml({
        passwordResetLink:
          "https://preview.example.test/auth/reset-password?mode=resetPassword&oobCode=reset-123&lang=en",
      }),
    },
  });
});

test("missing, disabled, provider-only, and unverified accounts receive identical responses", async () => {
  const cases = [
    authDouble({
      getUserByEmail: vi.fn().mockRejectedValue({ code: "auth/user-not-found" }),
    }),
    authDouble({
      getUserByEmail: vi.fn().mockResolvedValue({
        disabled: true,
        emailVerified: true,
        providerData: [{ providerId: "password" }],
      }),
    }),
    authDouble({
      getUserByEmail: vi.fn().mockResolvedValue({
        disabled: false,
        emailVerified: true,
        providerData: [{ providerId: "google.com" }],
      }),
    }),
    authDouble({
      getUserByEmail: vi.fn().mockResolvedValue({
        disabled: false,
        emailVerified: false,
        providerData: [{ providerId: "password" }],
      }),
    }),
  ];

  for (const auth of cases) {
    const { db, mail } = createDatabaseDouble();
    const handler = createHandler(auth, db);
    const { res, result } = response();
    await handler(request("candidate@example.test"), res);

    assert.equal(result.status, 202);
    assert.deepEqual(result.body, PASSWORD_RECOVERY_ACCEPTED_RESPONSE);
    assert.equal(auth.generatePasswordResetLink.mock.calls.length, 0);
    assert.equal(mail.length, 0);
  }
});

test("an unverified Firebase identity is neither mutated nor issued a reset action", async () => {
  const user = {
    disabled: false,
    emailVerified: false,
    providerData: [{ providerId: "password" }],
  };
  const auth = authDouble({ getUserByEmail: vi.fn().mockResolvedValue(user) });
  const { db, mail } = createDatabaseDouble();
  const handler = createHandler(auth, db);
  const { res } = response();

  await handler(request("unverified@example.test"), res);

  assert.equal(user.emailVerified, false);
  assert.equal(auth.generatePasswordResetLink.mock.calls.length, 0);
  assert.equal(mail.length, 0);
});

test("cooldown throttles repeated work without changing the accepted response", async () => {
  const { db, mail } = createDatabaseDouble();
  const auth = authDouble();
  const handler = createHandler(auth, db);
  const first = response();
  const second = response();

  await handler(request("user@example.test"), first.res);
  await handler(request("user@example.test"), second.res);

  assert.deepEqual(first.result, { status: 202, body: { ok: true } });
  assert.deepEqual(second.result, { status: 202, body: { ok: true } });
  assert.equal(auth.getUserByEmail.mock.calls.length, 1);
  assert.equal(mail.length, 1);
  assert.equal(getPasswordRecoveryCooldownMs(1_000, 61_000), 0);
  const fingerprint = getPasswordRecoveryFingerprint(
    "user@example.test",
    fingerprintSecret
  );
  assert.equal(fingerprint.length, 64);
  assert.notEqual(
    fingerprint,
    getPasswordRecoveryFingerprint("user@example.test", "different-secret")
  );
});

test("system-wide failures are retryable and do not log account details", async () => {
  const { db } = createDatabaseDouble();
  const auth = authDouble({
    getUserByEmail: vi.fn().mockRejectedValue(new Error("transport unavailable")),
  });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const handler = createHandler(auth, db);
  const { res, result } = response();

  await handler(request("private@example.test"), res);

  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Password recovery is temporarily unavailable. Please try again.",
  });
  assert.deepEqual(consoleError.mock.calls, [
    ["[api/auth/send-password-reset-email] Request failed"],
  ]);
});

test("a missing fingerprint secret fails safely before account lookup", async () => {
  const { db } = createDatabaseDouble();
  const auth = authDouble();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const handler = createPasswordRecoveryEmailHandler({
    auth,
    db,
    fingerprintSecret: "",
    minimumResponseMs: 0,
    environment: {},
    metric: vi.fn(),
  });
  const { res, result } = response();

  await handler(request("private@example.test"), res);

  assert.equal(result.status, 503);
  assert.equal(auth.getUserByEmail.mock.calls.length, 0);
  assert.deepEqual(consoleError.mock.calls, [
    ["[api/auth/send-password-reset-email] Request failed"],
  ]);
});

test("eligible-account delivery failures remain indistinguishable", async () => {
  const { db, mail } = createDatabaseDouble();
  const auth = authDouble({
    generatePasswordResetLink: vi.fn().mockRejectedValue(
      new Error("link service unavailable for private@example.test")
    ),
  });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const handler = createHandler(auth, db);
  const { res, result } = response();

  await handler(request("private@example.test"), res);

  assert.equal(result.status, 202);
  assert.deepEqual(result.body, PASSWORD_RECOVERY_ACCEPTED_RESPONSE);
  assert.equal(mail.length, 0);
  assert.deepEqual(consoleError.mock.calls, [
    ["[api/auth/send-password-reset-email] Delivery failed"],
  ]);
});

test("email throttling preserves the generic response and does not consume the IP limiter", async () => {
  vi.useFakeTimers();
  try {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  const email = "throttled@example.test";
  const sourceIp = "203.0.113.10";
  const { db, documents, mail } = createDatabaseDouble();
  const emailRef = {
    id: getRecoveryEmailFingerprint(email, fingerprintSecret),
    name: "_authPasswordRecoveryCooldowns",
  };
  const ipRef = {
    id: getRecoveryIpFingerprint(sourceIp, fingerprintSecret),
    name: "_authPasswordRecoveryIpCooldowns",
  };
  documents.set(JSON.stringify(emailRef), {
    attempts: [new Date(now - 30 * 60_000)],
  });
  const auth = authDouble();
  const metric = vi.fn();
  const handler = createHandler(auth, db, {
    now: () => now,
    metric,
    minimumResponseMs: 500,
    environment: { AUTH_EMAIL_RECOVERY_HOURLY_LIMIT: "1" },
  });
  const { res, result } = response();

  const pendingResponse = handler(request(email), res);
  await vi.advanceTimersByTimeAsync(499);
  assert.equal(result.status, undefined);
  await vi.advanceTimersByTimeAsync(1);
  await pendingResponse;

  assert.deepEqual(result, { status: 202, body: { ok: true } });
  assert.equal(documents.has(JSON.stringify(ipRef)), false);
  assert.equal(auth.getUserByEmail.mock.calls.length, 0);
  assert.equal(mail.length, 0);
  assert.deepEqual(metric.mock.calls, [
    ["recovery", "request"],
    ["recovery", "throttled"],
  ]);
  } finally {
    vi.useRealTimers();
  }
});

test("IP throttling returns a generic 429 and does not consume the email limiter", async () => {
  vi.useFakeTimers();
  try {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  const email = "candidate@example.test";
  const sourceIp = "203.0.113.10";
  const { db, documents, mail } = createDatabaseDouble();
  const emailRef = {
    id: getRecoveryEmailFingerprint(email, fingerprintSecret),
    name: "_authPasswordRecoveryCooldowns",
  };
  const ipRef = {
    id: getRecoveryIpFingerprint(sourceIp, fingerprintSecret),
    name: "_authPasswordRecoveryIpCooldowns",
  };
  documents.set(JSON.stringify(ipRef), {
    attempts: [new Date(now - 30 * 60_000)],
  });
  const auth = authDouble();
  const handler = createHandler(auth, db, {
    now: () => now,
    minimumResponseMs: 500,
    environment: { AUTH_EMAIL_RECOVERY_IP_HOURLY_LIMIT: "1" },
  });
  const { res, result, headers } = response();

  const pendingResponse = handler(request(email), res);
  await vi.advanceTimersByTimeAsync(499);
  assert.equal(result.status, undefined);
  await vi.advanceTimersByTimeAsync(1);
  await pendingResponse;

  assert.deepEqual(result, {
    status: 429,
    body: {
      ok: false,
      error: "Too many password recovery requests. Please try again later.",
    },
  });
  assert.equal(headers.get("Retry-After"), "1800");
  assert.equal(documents.has(JSON.stringify(emailRef)), false);
  assert.equal(auth.getUserByEmail.mock.calls.length, 0);
  assert.equal(mail.length, 0);
  } finally {
    vi.useRealTimers();
  }
});

test("limiter storage failures retain the minimum response duration and sanitized output", async () => {
  vi.useFakeTimers();
  try {
    const storageError = new Error(
      "private@example.test x-vercel-forwarded-for=203.0.113.10"
    );
    const db = {
      collection(name: string) {
        return { doc: (id: string) => ({ name, id }) };
      },
      runTransaction: vi.fn().mockRejectedValue(storageError),
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const metric = vi.fn();
    const handler = createPasswordRecoveryEmailHandler({
      auth: authDouble(),
      db,
      fingerprintSecret,
      minimumResponseMs: 500,
      environment: {},
      metric,
    });
    const { res, result } = response();
    const pendingResponse = handler(request("private@example.test"), res);

    await vi.advanceTimersByTimeAsync(499);
    assert.equal(result.status, undefined);
    await vi.advanceTimersByTimeAsync(1);
    await pendingResponse;

    assert.deepEqual(result, {
      status: 503,
      body: {
        ok: false,
        error: "Password recovery is temporarily unavailable. Please try again.",
      },
    });
    assert.deepEqual(consoleError.mock.calls, [
      ["[api/auth/send-password-reset-email] Request failed"],
    ]);
    assert.deepEqual(metric.mock.calls, [
      ["recovery", "request"],
      ["recovery", "limiter_failure"],
    ]);
  } finally {
    vi.useRealTimers();
  }
});
