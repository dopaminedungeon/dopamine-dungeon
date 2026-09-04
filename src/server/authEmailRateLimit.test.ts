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
  type AuthEmailRateLimitReservation,
  type AuthEmailRateLimitStore,
  type AuthEmailRateLimitTarget,
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

function createAtomicLimiter(): AuthEmailRateLimitStore {
  const attempts = new Map<string, number[]>();
  let queue = Promise.resolve();
  return {
    reserve(targets: AuthEmailRateLimitTarget[], nowMs: number) {
      const result = queue.then(() => {
        const decisions: AuthEmailRateLimitReservation["decisions"] = {};
        for (const target of targets) {
          const current = attempts.get(`${target.scope}\0${target.subjectKey}`) ?? [];
          const legacy = target.legacySubjectKey
            ? attempts.get(`${target.scope}\0${target.legacySubjectKey}`) ?? []
            : [];
          decisions[target.key] = evaluateAuthEmailRateLimit(
            current.length ? current : legacy,
            target.policy,
            nowMs
          );
        }
        const allowed = Object.values(decisions).every((decision) => decision.allowed);
        if (allowed) {
          for (const target of targets) {
            attempts.set(`${target.scope}\0${target.subjectKey}`, [
              ...decisions[target.key].activeTimestamps,
              nowMs,
            ]);
          }
        }
        return { allowed, decisions };
      });
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

test("rate-limit defaults and rollback semantics stay centralized", () => {
  const defaults = getAuthEmailRateLimitConfig({});
  assert.deepEqual(defaults.verification, POLICY);
  assert.deepEqual(defaults.recoveryEmail, POLICY);
  assert.deepEqual(defaults.recoveryIp, {
    minimumIntervalMs: 0,
    hourlyLimit: 20,
    dailyLimit: 50,
    recordTtlMs: AUTH_EMAIL_RATE_LIMIT_DEFAULT_RECORD_TTL_MS,
  });
  const rollback = getAuthEmailRateLimitConfig({
    AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED: "false",
  });
  assert.equal(rollback.verification.hourlyLimit, Number.MAX_SAFE_INTEGER);
  assert.equal(rollback.recoveryIp.dailyLimit, Number.MAX_SAFE_INTEGER);
});

test("recovery HMACs are domain-separated and legacy compatibility stays opaque", () => {
  const value = "same-value@example.test";
  const email = getRecoveryEmailFingerprint(value, SECRET);
  assert.equal(email.length, 64);
  assert.notEqual(email, getRecoveryIpFingerprint(value, SECRET));
  assert.notEqual(email, getLegacyRecoveryEmailFingerprint(value, SECRET));
  assert.notEqual(email, getRecoveryEmailFingerprint(value, `${SECRET}-rotated`));
});

test("trusted IP parsing preserves the server-only contract", () => {
  assert.equal(canonicalizeIpAddress("203.0.113.8"), "203.0.113.8");
  assert.equal(canonicalizeIpAddress("2001:0db8:0:0:0:0:0:1"), "2001:db8::1");
  assert.throws(() => canonicalizeIpAddress("203.0.113.8, 10.0.0.1"));
  const hosted = {
    headers: { "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:2" },
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as VercelRequest;
  assert.equal(getTrustedClientIp(hosted, { VERCEL_ENV: "preview" }), "2001:db8::2");
  const local = { headers: {}, socket: { remoteAddress: "::1" } } as unknown as VercelRequest;
  assert.equal(getTrustedClientIp(local, {}), "::1");
});

test("rolling windows use the longest wait and discard stale attempts", () => {
  const decision = evaluateAuthEmailRateLimit(
    [NOW - DAY_MS - 1, NOW - 23 * HOUR_MS, NOW - 50 * 60_000, NOW - 40 * 60_000, NOW - 30 * 60_000, NOW - 15_000],
    POLICY,
    NOW
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.retryAfterMs, HOUR_MS);
  assert.deepEqual(
    evaluateAuthEmailRateLimit([NOW - DAY_MS, NOW - HOUR_MS], POLICY, NOW).activeTimestamps,
    [NOW - HOUR_MS]
  );
});

test("combined recovery reservation is all-or-none", async () => {
  const limiter = createAtomicLimiter();
  const email: AuthEmailRateLimitTarget = {
    key: "email", scope: "recovery_email", subjectKey: "email-hmac", policy: POLICY,
  };
  const ip: AuthEmailRateLimitTarget = {
    key: "ip", scope: "recovery_ip", subjectKey: "ip-hmac",
    policy: { ...POLICY, minimumIntervalMs: 0, hourlyLimit: 20, dailyLimit: 50 },
  };
  for (let index = 0; index < 3; index += 1) {
    await limiter.reserve([email], NOW - (3 - index) * 60_000);
  }
  const rejected = await limiter.reserve([email, ip], NOW);
  assert.equal(rejected.allowed, false);
  assert.equal((await limiter.reserve([ip], NOW)).allowed, true);
});

test("concurrent reservations cannot exceed a threshold", async () => {
  const limiter = createAtomicLimiter();
  const target: AuthEmailRateLimitTarget = {
    key: "shared", scope: "verification", subjectKey: "firebase-uid",
    policy: { ...POLICY, minimumIntervalMs: 0 },
  };
  const results = await Promise.all(Array.from({ length: 6 }, () => limiter.reserve([target], NOW)));
  assert.equal(results.filter((result) => result.allowed).length, 3);
  assert.equal(results.filter((result) => !result.allowed).length, 3);
});

test("legacy recovery HMAC is considered only when current state is absent", async () => {
  const limiter = createAtomicLimiter();
  const legacy: AuthEmailRateLimitTarget = {
    key: "legacy", scope: "recovery_email", subjectKey: "legacy-hmac", policy: POLICY,
  };
  const current: AuthEmailRateLimitTarget = {
    key: "email", scope: "recovery_email", subjectKey: "current-hmac",
    legacySubjectKey: "legacy-hmac", policy: POLICY,
  };
  await limiter.reserve([legacy], NOW - 30_000);
  assert.equal((await limiter.reserve([current], NOW)).allowed, false);
  assert.equal((await limiter.reserve([current], NOW + 60_000)).allowed, true);
});
