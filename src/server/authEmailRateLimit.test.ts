import assert from "node:assert/strict";
import { test } from "vitest";
import type { VercelRequest } from "@vercel/node";

import {
  AUTH_EMAIL_RATE_LIMIT_DEFAULT_RECORD_TTL_MS,
  canonicalizeIpAddress,
  evaluateAuthEmailRateLimit,
  getAuthEmailRateLimitConfig,
  getLegacyRecoveryEmailFingerprint,
  getRecoveryEmailFingerprint,
  getRecoveryIpFingerprint,
  getTrustedClientIp,
  reserveAuthEmailRateLimits,
  type AuthEmailRateLimitDatabase,
  type AuthEmailRateLimitPolicy,
} from "./authEmailRateLimit.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const SECRET = "unit-test-rate-limit-fingerprint-secret";
const POLICY: AuthEmailRateLimitPolicy = {
  minimumIntervalMs: 60_000,
  hourlyLimit: 3,
  dailyLimit: 5,
  recordTtlMs: AUTH_EMAIL_RATE_LIMIT_DEFAULT_RECORD_TTL_MS,
};

type StoredDocument = Record<string, unknown>;
type Ref = { collection: string; id: string };

function createAtomicDatabase(initial: Array<[Ref, StoredDocument]> = []) {
  const documents = new Map(
    initial.map(([ref, document]) => [JSON.stringify(ref), document])
  );
  let transactionQueue = Promise.resolve();
  const db: AuthEmailRateLimitDatabase = {
    collection(collection: string) {
      return {
        doc(id: string) {
          return { collection, id };
        },
      };
    },
    runTransaction<T>(callback: Parameters<AuthEmailRateLimitDatabase["runTransaction"]>[0]) {
      const transaction = transactionQueue.then(async () => {
        const pendingWrites = new Map<string, StoredDocument>();
        const result = await callback({
          async get(ref: unknown) {
            const document = documents.get(JSON.stringify(ref)) || {};
            return {
              get(field: string) {
                const value = document[field];
                if (value instanceof Date) {
                  return { toMillis: () => value.getTime() };
                }
                if (Array.isArray(value)) {
                  return value.map((entry) =>
                    entry instanceof Date
                      ? { toMillis: () => entry.getTime() }
                      : entry
                  );
                }
                return value;
              },
            };
          },
          set(ref: unknown, data: unknown) {
            pendingWrites.set(
              JSON.stringify(ref),
              data as StoredDocument
            );
          },
        });
        for (const [key, document] of pendingWrites) documents.set(key, document);
        return result;
      });
      transactionQueue = transaction.then(() => undefined, () => undefined);
      return transaction as Promise<T>;
    },
  };

  return { db, documents };
}

test("rate-limit defaults and overrides are centralized and validated", () => {
  const defaults = getAuthEmailRateLimitConfig({});
  assert.equal(defaults.extendedLimitsEnabled, true);
  assert.deepEqual(defaults.verification, POLICY);
  assert.deepEqual(defaults.recoveryEmail, POLICY);
  assert.deepEqual(defaults.recoveryIp, {
    minimumIntervalMs: 0,
    hourlyLimit: 20,
    dailyLimit: 50,
    recordTtlMs: AUTH_EMAIL_RATE_LIMIT_DEFAULT_RECORD_TTL_MS,
  });

  const configured = getAuthEmailRateLimitConfig({
    AUTH_EMAIL_VERIFICATION_MIN_INTERVAL_SECONDS: "90",
    AUTH_EMAIL_VERIFICATION_HOURLY_LIMIT: "4",
    AUTH_EMAIL_VERIFICATION_DAILY_LIMIT: "7",
    AUTH_EMAIL_RECOVERY_MIN_INTERVAL_SECONDS: "75",
    AUTH_EMAIL_RECOVERY_HOURLY_LIMIT: "6",
    AUTH_EMAIL_RECOVERY_DAILY_LIMIT: "9",
    AUTH_EMAIL_RECOVERY_IP_HOURLY_LIMIT: "25",
    AUTH_EMAIL_RECOVERY_IP_DAILY_LIMIT: "60",
    AUTH_EMAIL_RATE_LIMIT_TTL_HOURS: "72",
  });
  assert.equal(configured.verification.minimumIntervalMs, 90_000);
  assert.equal(configured.verification.hourlyLimit, 4);
  assert.equal(configured.verification.dailyLimit, 7);
  assert.equal(configured.recoveryEmail.minimumIntervalMs, 75_000);
  assert.equal(configured.recoveryEmail.hourlyLimit, 6);
  assert.equal(configured.recoveryEmail.dailyLimit, 9);
  assert.equal(configured.recoveryIp.hourlyLimit, 25);
  assert.equal(configured.recoveryIp.dailyLimit, 60);
  assert.equal(configured.recoveryIp.recordTtlMs, 72 * HOUR_MS);

  const rollbackConfig = getAuthEmailRateLimitConfig({
    AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED: "false",
  });
  assert.equal(rollbackConfig.extendedLimitsEnabled, false);
  assert.equal(rollbackConfig.verification.minimumIntervalMs, 60_000);
  assert.equal(rollbackConfig.recoveryEmail.minimumIntervalMs, 60_000);
  assert.equal(rollbackConfig.verification.hourlyLimit, Number.MAX_SAFE_INTEGER);
  assert.equal(rollbackConfig.recoveryIp.dailyLimit, Number.MAX_SAFE_INTEGER);

  assert.throws(
    () =>
      getAuthEmailRateLimitConfig({
        AUTH_EMAIL_RECOVERY_HOURLY_LIMIT: "0",
      }),
    /AUTH_EMAIL_RECOVERY_HOURLY_LIMIT/
  );
  assert.throws(
    () =>
      getAuthEmailRateLimitConfig({
        AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED: "yes",
      }),
    /AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED/
  );
});

test("email and IP fingerprints are domain separated", () => {
  const value = "same-value@example.test";
  const emailFingerprint = getRecoveryEmailFingerprint(value, SECRET);
  const ipFingerprint = getRecoveryIpFingerprint(value, SECRET);

  assert.equal(emailFingerprint.length, 64);
  assert.equal(ipFingerprint.length, 64);
  assert.notEqual(emailFingerprint, ipFingerprint);
  assert.notEqual(
    emailFingerprint,
    getLegacyRecoveryEmailFingerprint(value, SECRET)
  );
  assert.notEqual(
    emailFingerprint,
    getRecoveryEmailFingerprint(value, `${SECRET}-rotated`)
  );
});

test("trusted client IP parsing canonicalizes IPv4 and IPv6 without trusting proxy chains", () => {
  assert.equal(canonicalizeIpAddress("203.0.113.8"), "203.0.113.8");
  assert.equal(
    canonicalizeIpAddress("2001:0db8:0:0:0:0:0:1"),
    "2001:db8::1"
  );
  assert.throws(() => canonicalizeIpAddress("203.0.113.8, 10.0.0.1"));
  assert.throws(() => canonicalizeIpAddress("not-an-ip"));

  const hostedRequest = {
    headers: {
      "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:2",
      "x-forwarded-for": "198.51.100.99",
      "x-real-ip": "198.51.100.100",
    },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as VercelRequest;
  assert.equal(
    getTrustedClientIp(hostedRequest, { VERCEL_ENV: "preview" }),
    "2001:db8::2"
  );

  const localRequest = {
    headers: {
      "x-vercel-forwarded-for": "198.51.100.20",
      "x-forwarded-for": "198.51.100.21",
    },
    socket: { remoteAddress: "::1" },
  } as unknown as VercelRequest;
  assert.equal(getTrustedClientIp(localRequest, {}), "::1");

  const spoofedHostedRequest = {
    headers: { "x-forwarded-for": "198.51.100.99" },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as VercelRequest;
  assert.throws(() =>
    getTrustedClientIp(spoofedHostedRequest, { VERCEL_ENV: "production" })
  );

  const arrayValuedHostedRequest = {
    headers: { "x-vercel-forwarded-for": ["203.0.113.8"] },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as VercelRequest;
  assert.throws(() =>
    getTrustedClientIp(arrayValuedHostedRequest, { VERCEL_ENV: "preview" })
  );
});

test("rolling limits allow below threshold and reject exactly at or above threshold", () => {
  const below = evaluateAuthEmailRateLimit(
    [NOW - 3 * HOUR_MS, NOW - 2 * HOUR_MS, NOW - 10 * 60_000, NOW - 5 * 60_000],
    POLICY,
    NOW
  );
  assert.equal(below.allowed, true);

  const hourlyThreshold = evaluateAuthEmailRateLimit(
    [NOW - 50 * 60_000, NOW - 40 * 60_000, NOW - 30 * 60_000],
    POLICY,
    NOW
  );
  assert.equal(hourlyThreshold.allowed, false);
  assert.equal(hourlyThreshold.retryAfterMs, 10 * 60_000);

  const hourlyAbove = evaluateAuthEmailRateLimit(
    [NOW - 55 * 60_000, NOW - 50 * 60_000, NOW - 40 * 60_000, NOW - 30 * 60_000],
    POLICY,
    NOW
  );
  assert.equal(hourlyAbove.allowed, false);
  assert.equal(hourlyAbove.retryAfterMs, 10 * 60_000);

  const dailyThreshold = evaluateAuthEmailRateLimit(
    [NOW - 23 * HOUR_MS, NOW - 22 * HOUR_MS, NOW - 4 * HOUR_MS, NOW - 3 * HOUR_MS, NOW - 2 * HOUR_MS],
    POLICY,
    NOW
  );
  assert.equal(dailyThreshold.allowed, false);
  assert.equal(dailyThreshold.retryAfterMs, HOUR_MS);

  const dailyAbove = evaluateAuthEmailRateLimit(
    [
      NOW - 23 * HOUR_MS,
      NOW - 22 * HOUR_MS,
      NOW - 21 * HOUR_MS,
      NOW - 4 * HOUR_MS,
      NOW - 3 * HOUR_MS,
      NOW - 2 * HOUR_MS,
    ],
    POLICY,
    NOW
  );
  assert.equal(dailyAbove.allowed, false);
});

test("IP limits enforce below, at, and above the 20-hour and 50-day thresholds", () => {
  const ipPolicy = {
    minimumIntervalMs: 0,
    hourlyLimit: 20,
    dailyLimit: 50,
    recordTtlMs: AUTH_EMAIL_RATE_LIMIT_DEFAULT_RECORD_TTL_MS,
  };
  const recent = (count: number) =>
    Array.from({ length: count }, (_, index) => NOW - (index + 1) * 60_000);
  const daily = (count: number) =>
    Array.from(
      { length: count },
      (_, index) => NOW - 2 * HOUR_MS - index * 20 * 60_000
    );

  assert.equal(evaluateAuthEmailRateLimit(recent(19), ipPolicy, NOW).allowed, true);
  assert.equal(evaluateAuthEmailRateLimit(recent(20), ipPolicy, NOW).allowed, false);
  assert.equal(evaluateAuthEmailRateLimit(recent(21), ipPolicy, NOW).allowed, false);
  assert.equal(evaluateAuthEmailRateLimit(daily(49), ipPolicy, NOW).allowed, true);
  assert.equal(evaluateAuthEmailRateLimit(daily(50), ipPolicy, NOW).allowed, false);
  assert.equal(evaluateAuthEmailRateLimit(daily(51), ipPolicy, NOW).allowed, false);
});

test("minimum interval and simultaneous windows return the wait until all limits permit", () => {
  const minimumInterval = evaluateAuthEmailRateLimit(
    [NOW - 15_000],
    POLICY,
    NOW
  );
  assert.equal(minimumInterval.retryAfterMs, 45_000);

  const simultaneous = evaluateAuthEmailRateLimit(
    [NOW - 23 * HOUR_MS, NOW - 50 * 60_000, NOW - 40 * 60_000, NOW - 30 * 60_000, NOW - 15_000],
    POLICY,
    NOW
  );
  assert.equal(simultaneous.allowed, false);
  assert.equal(simultaneous.retryAfterMs, HOUR_MS);
});

test("rolling windows recover at exact boundaries and discard stale records", () => {
  const recovered = evaluateAuthEmailRateLimit(
    [NOW - DAY_MS - 1, NOW - DAY_MS, NOW - HOUR_MS, NOW - HOUR_MS - 1],
    POLICY,
    NOW
  );
  assert.equal(recovered.allowed, true);
  assert.deepEqual(recovered.activeTimestamps, [NOW - HOUR_MS - 1, NOW - HOUR_MS]);
});

test("combined email and IP reservation is all-or-none when either limiter rejects", async () => {
  const emailRef = { collection: "email", id: "email-fingerprint" };
  const ipRef = { collection: "ip", id: "ip-fingerprint" };
  const { db, documents } = createAtomicDatabase([
    [
      emailRef,
      {
        attempts: [
          new Date(NOW - 50 * 60_000),
          new Date(NOW - 40 * 60_000),
          new Date(NOW - 30 * 60_000),
        ],
      },
    ],
    [ipRef, { attempts: [new Date(NOW - 2 * HOUR_MS)] }],
  ]);
  const ipBefore = documents.get(JSON.stringify(ipRef));

  const reservation = await reserveAuthEmailRateLimits(
    db,
    [
      { key: "email", ref: emailRef, policy: POLICY },
      {
        key: "ip",
        ref: ipRef,
        policy: { ...POLICY, minimumIntervalMs: 0, hourlyLimit: 20, dailyLimit: 50 },
      },
    ],
    NOW
  );

  assert.equal(reservation.allowed, false);
  assert.equal(reservation.decisions.email.allowed, false);
  assert.equal(reservation.decisions.ip.allowed, true);
  assert.equal(documents.get(JSON.stringify(ipRef)), ipBefore);
});

test("atomic concurrent reservations cannot exceed a threshold", async () => {
  const { db, documents } = createAtomicDatabase();
  const ref = db.collection("limits").doc("shared-key");
  const concurrentPolicy = { ...POLICY, minimumIntervalMs: 0 };

  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      reserveAuthEmailRateLimits(
        db,
        [{ key: "shared", ref, policy: concurrentPolicy }],
        NOW
      )
    )
  );

  assert.equal(results.filter((result) => result.allowed).length, 3);
  assert.equal(results.filter((result) => !result.allowed).length, 3);
  const stored = documents.get(JSON.stringify(ref));
  assert.equal((stored?.attempts as Date[]).length, 3);
});

test("legacy cooldowns are honored and successful writes receive expiry metadata", async () => {
  const { db, documents } = createAtomicDatabase();
  const ref = db.collection("new").doc("domain-separated-key");
  const legacyRef = db.collection("legacy").doc("old-key");
  documents.set(JSON.stringify(legacyRef), {
    lastSentAt: new Date(NOW - 30_000),
  });

  const blocked = await reserveAuthEmailRateLimits(
    db,
    [{ key: "email", ref, legacyRef, policy: POLICY }],
    NOW
  );
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.decisions.email.retryAfterMs, 30_000);

  const allowedAt = NOW + 60_000;
  const allowed = await reserveAuthEmailRateLimits(
    db,
    [{ key: "email", ref, legacyRef, policy: POLICY }],
    allowedAt
  );
  assert.equal(allowed.allowed, true);
  const stored = documents.get(JSON.stringify(ref));
  assert.equal(
    (stored?.expiresAt as Date).getTime(),
    allowedAt + AUTH_EMAIL_RATE_LIMIT_DEFAULT_RECORD_TTL_MS
  );
});

test("malformed persisted limiter data fails closed", async () => {
  const ref = { collection: "limits", id: "malformed" };
  const { db } = createAtomicDatabase([[ref, { attempts: "not-an-array" }]]);

  await assert.rejects(
    reserveAuthEmailRateLimits(
      db,
      [{ key: "malformed", ref, policy: POLICY }],
      NOW
    ),
    /malformed/
  );
});
