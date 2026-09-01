import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";

const environment = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      return match
        ? [[match[1].trim(), match[2].trim().replace(/^"|"$/g, "")]]
        : [];
    })
);
for (const key of [
  "DATABASE_URL",
  "VITE_FIREBASE_API_KEY_DEV",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "PASSWORD_RECOVERY_FINGERPRINT_SECRET",
]) {
  if (!environment[key]) throw new Error(`Missing development ${key}`);
}
for (const [key, value] of Object.entries(environment)) {
  if (
    key === "DATABASE_URL" ||
    key === "PASSWORD_RECOVERY_FINGERPRINT_SECRET" ||
    key.startsWith("FIREBASE_") ||
    key.startsWith("VITE_FIREBASE_")
  ) {
    process.env[key] = value;
  }
}

const [
  { adminAuth, verifyFirebaseToken },
  { db },
  { neonAuthEmailRateLimitStore },
  {
    getAuthEmailRateLimitConfig,
    getLegacyRecoveryEmailFingerprint,
    getRecoveryEmailFingerprint,
    getRecoveryIpFingerprint,
  },
  { createVerificationEmailHandler },
  { createPasswordRecoveryEmailHandler, PASSWORD_RECOVERY_MIN_RESPONSE_MS },
] = await Promise.all([
  import("../src/server/auth.js"),
  import("../src/server/db.js"),
  import("../src/server/neonAuthEmailRateLimit.js"),
  import("../src/server/authEmailRateLimit.js"),
  import("../src/server/verificationEmail.js"),
  import("../src/server/passwordRecoveryEmail.js"),
]);

const run = randomUUID();
const now = Date.UTC(2026, 7, 31, 12, 0, 0);
const secret = environment.PASSWORD_RECOVERY_FINGERPRINT_SECRET!;
const createdUids = [`dd-298-limit-a-${run}`, `dd-298-limit-b-${run}`];
const temporarySubjectKeys = new Set<string>(createdUids);
let sentMessages = 0;

function request(params: {
  authorization?: string;
  body?: Record<string, unknown>;
  remoteAddress?: string;
}) {
  return {
    method: "POST",
    body: params.body ?? {},
    headers: {
      host: "localhost:3000",
      ...(params.authorization ? { authorization: params.authorization } : {}),
    },
    socket: { remoteAddress: params.remoteAddress ?? "127.0.0.1" },
  } as unknown as VercelRequest;
}

function response() {
  const result: { status?: number; body?: unknown; headers: Map<string, unknown> } = {
    headers: new Map(),
  };
  const res = {
    end: () => res,
    setHeader(name: string, value: unknown) {
      result.headers.set(name, value);
      return res;
    },
    status(status: number) {
      result.status = status;
      return res;
    },
    json(body: unknown) {
      result.body = body;
      return res;
    },
  } as unknown as VercelResponse;
  return { result, res };
}

async function idToken(uid: string) {
  const customToken = await adminAuth.createCustomToken(uid);
  const result = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(environment.VITE_FIREBASE_API_KEY_DEV!)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const body = (await result.json()) as { idToken?: string };
  if (!body.idToken) throw new Error("Development Firebase token exchange failed");
  return body.idToken;
}

function recoveryTarget(key: string, subjectKey: string, policy: ReturnType<typeof getAuthEmailRateLimitConfig>["recoveryEmail"]) {
  temporarySubjectKeys.add(subjectKey);
  return { key, scope: "recovery_email" as const, subjectKey, policy };
}

function ipTarget(key: string, subjectKey: string, policy: ReturnType<typeof getAuthEmailRateLimitConfig>["recoveryIp"]) {
  temporarySubjectKeys.add(subjectKey);
  return { key, scope: "recovery_ip" as const, subjectKey, policy };
}

async function countAttempts(subjectKey: string) {
  const [row] = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM auth_email_rate_limit_attempts attempts
    JOIN auth_email_rate_limit_subjects subjects ON subjects.id = attempts.subject_id
    WHERE subjects.subject_key = ${subjectKey}
  `);
  return Number(row?.count ?? 0);
}

try {
  const [target] = await db.execute(sql`
    SELECT current_database() AS database_name,
      current_setting('neon.project_id', true) AS project_id,
      current_setting('neon.branch_id', true) AS branch_id
  `);
  assert.deepEqual(target, {
    database_name: "neondb",
    project_id: "icy-cloud-05910629",
    branch_id: "br-odd-sound-alamav7v",
  });

  for (const [index, uid] of createdUids.entries()) {
    await adminAuth.createUser({
      uid,
      email: `dd298-limit-${index}-${run}@example.invalid`,
      emailVerified: false,
      password: `Dd!${randomUUID()}`,
    });
  }
  const [firstToken, secondToken] = await Promise.all(createdUids.map(idToken));
  const config = getAuthEmailRateLimitConfig({});
  const probeUid = `dd-298-limit-probe-${run}`;
  temporarySubjectKeys.add(probeUid);
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      { key: "verification", scope: "verification", subjectKey: probeUid, policy: config.verification },
    ], now)).allowed,
    true
  );
  await db.execute(sql`
    DELETE FROM auth_email_rate_limit_attempts attempts
    USING auth_email_rate_limit_subjects subjects
    WHERE attempts.subject_id = subjects.id AND subjects.subject_key = ${probeUid}
  `);
  await db.execute(sql`
    DELETE FROM auth_email_rate_limit_subjects WHERE subject_key = ${probeUid}
  `);

  const verification = createVerificationEmailHandler({
    verifyToken: verifyFirebaseToken,
    auth: adminAuth,
    limiter: neonAuthEmailRateLimitStore,
    now: () => now,
    environment: {},
    metric: () => {},
    sendMail: async () => {
      sentMessages += 1;
    },
  });
  let capture = response();
  await verification(request({ authorization: `Bearer ${firstToken}` }), capture.res);
  assert.equal(capture.result.status, 202);
  const [storedAttempt] = await db.execute(sql`
    SELECT attempts.occurred_at
    FROM auth_email_rate_limit_attempts attempts
    JOIN auth_email_rate_limit_subjects subjects ON subjects.id = attempts.subject_id
    WHERE subjects.subject_key = ${createdUids[0]!}
  `);
  assert.equal(new Date(String(storedAttempt?.occurred_at)).getTime(), now);
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      { key: "verification", scope: "verification", subjectKey: createdUids[0]!, policy: config.verification },
    ], now + 10_000)).allowed,
    false
  );
  capture = response();
  const verificationSoon = createVerificationEmailHandler({
    verifyToken: verifyFirebaseToken,
    auth: adminAuth,
    limiter: neonAuthEmailRateLimitStore,
    now: () => now + 10_000,
    environment: {},
    metric: () => {},
    sendMail: async () => {
      sentMessages += 1;
    },
  });
  await verificationSoon(request({ authorization: `Bearer ${firstToken}` }), capture.res);
  assert.equal(capture.result.status, 429);
  assert.equal(capture.result.headers.get("Retry-After"), "50");
  capture = response();
  await verification(request({ authorization: `Bearer ${secondToken}` }), capture.res);
  assert.equal(capture.result.status, 202);
  assert.equal(await countAttempts(createdUids[0]!), 1);
  assert.equal(await countAttempts(createdUids[1]!), 1);

  const hourlyUid = `dd-298-limit-hour-${run}`;
  const dailyUid = `dd-298-limit-day-${run}`;
  temporarySubjectKeys.add(hourlyUid);
  temporarySubjectKeys.add(dailyUid);
  for (const offset of [50, 40, 30]) {
    await neonAuthEmailRateLimitStore.reserve([
      { key: "verification", scope: "verification", subjectKey: hourlyUid, policy: config.verification },
    ], now - offset * 60_000);
  }
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      { key: "verification", scope: "verification", subjectKey: hourlyUid, policy: config.verification },
    ], now)).allowed,
    false
  );
  for (const offset of [23, 22, 4, 3, 2]) {
    await neonAuthEmailRateLimitStore.reserve([
      { key: "verification", scope: "verification", subjectKey: dailyUid, policy: config.verification },
    ], now - offset * 60 * 60_000);
  }
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      { key: "verification", scope: "verification", subjectKey: dailyUid, policy: config.verification },
    ], now)).allowed,
    false
  );

  const normalizedEmail = `dd298-limit-email-${run}@example.invalid`.toLowerCase();
  const distinctEmail = `dd298-limit-other-${run}@example.invalid`.toLowerCase();
  const emailKey = getRecoveryEmailFingerprint(normalizedEmail, secret);
  const distinctEmailKey = getRecoveryEmailFingerprint(distinctEmail, secret);
  const ipKey = getRecoveryIpFingerprint("127.0.0.1", secret);
  const otherIpKey = getRecoveryIpFingerprint("127.0.0.2", secret);
  temporarySubjectKeys.add(distinctEmailKey);
  temporarySubjectKeys.add(otherIpKey);
  assert.notEqual(emailKey, distinctEmailKey);
  assert.notEqual(ipKey, otherIpKey);
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", emailKey, config.recoveryEmail),
    ], now)).allowed,
    true
  );
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", emailKey, config.recoveryEmail),
    ], now + 10_000)).allowed,
    false
  );
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", distinctEmailKey, config.recoveryEmail),
    ], now)).allowed,
    true
  );
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      ipTarget("ip", ipKey, config.recoveryIp),
    ], now)).allowed,
    true
  );

  const atomicEmailKey = getRecoveryEmailFingerprint(`dd298-atomic-${run}@example.invalid`, secret);
  const atomicIpKey = getRecoveryIpFingerprint("127.0.0.3", secret);
  temporarySubjectKeys.add(atomicEmailKey);
  temporarySubjectKeys.add(atomicIpKey);
  for (const offset of [50, 40, 30]) {
    await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", atomicEmailKey, config.recoveryEmail),
    ], now - offset * 60_000);
  }
  const ipAttemptsBefore = await countAttempts(atomicIpKey);
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", atomicEmailKey, config.recoveryEmail),
      ipTarget("ip", atomicIpKey, config.recoveryIp),
    ], now)).allowed,
    false
  );
  assert.equal(await countAttempts(atomicIpKey), ipAttemptsBefore);

  const concurrentUid = `dd-298-limit-concurrent-${run}`;
  temporarySubjectKeys.add(concurrentUid);
  const concurrent = await Promise.all(
    Array.from({ length: 6 }, () =>
      neonAuthEmailRateLimitStore.reserve([
        {
          key: "verification",
          scope: "verification" as const,
          subjectKey: concurrentUid,
          policy: { ...config.verification, minimumIntervalMs: 0 },
        },
      ], now)
    )
  );
  assert.equal(concurrent.filter((result) => result.allowed).length, 3);
  assert.equal(await countAttempts(concurrentUid), 3);

  const recoveryEmail = `dd298-handler-${run}@example.invalid`;
  temporarySubjectKeys.add(getRecoveryEmailFingerprint(recoveryEmail, secret));
  temporarySubjectKeys.add(getLegacyRecoveryEmailFingerprint(recoveryEmail, secret));
  const recoveryUid = `dd-298-limit-recovery-${run}`;
  createdUids.push(recoveryUid);
  await adminAuth.createUser({
    uid: recoveryUid,
    email: recoveryEmail,
    emailVerified: true,
    password: `Dd!${randomUUID()}`,
  });
  const recovery = createPasswordRecoveryEmailHandler({
    auth: adminAuth,
    limiter: neonAuthEmailRateLimitStore,
    fingerprintSecret: secret,
    minimumResponseMs: PASSWORD_RECOVERY_MIN_RESPONSE_MS,
    environment: {},
    now: () => now,
    metric: () => {},
    sendMail: async () => {
      sentMessages += 1;
    },
  });
  capture = response();
  const recoveryStarted = Date.now();
  await recovery(request({ body: { email: recoveryEmail } }), capture.res);
  assert.equal(capture.result.status, 202);
  assert.ok(Date.now() - recoveryStarted >= PASSWORD_RECOVERY_MIN_RESPONSE_MS);

  const nonexistentEmail = `dd298-nonexistent-${run}@example.invalid`;
  temporarySubjectKeys.add(getRecoveryEmailFingerprint(nonexistentEmail, secret));
  temporarySubjectKeys.add(getLegacyRecoveryEmailFingerprint(nonexistentEmail, secret));
  capture = response();
  const nonexistentStarted = Date.now();
  await recovery(request({ body: { email: nonexistentEmail } }), capture.res);
  assert.deepEqual(capture.result.body, { ok: true });
  assert.equal(capture.result.status, 202);
  assert.ok(Date.now() - nonexistentStarted >= PASSWORD_RECOVERY_MIN_RESPONSE_MS);

  const recoveryHourlyKey = getRecoveryEmailFingerprint(`dd298-recovery-hour-${run}@example.invalid`, secret);
  const recoveryDailyKey = getRecoveryEmailFingerprint(`dd298-recovery-day-${run}@example.invalid`, secret);
  temporarySubjectKeys.add(recoveryHourlyKey);
  temporarySubjectKeys.add(recoveryDailyKey);
  for (const offset of [50, 40, 30]) {
    await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", recoveryHourlyKey, config.recoveryEmail),
    ], now - offset * 60_000);
  }
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", recoveryHourlyKey, config.recoveryEmail),
    ], now)).allowed,
    false
  );
  for (const offset of [23, 22, 4, 3, 2]) {
    await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", recoveryDailyKey, config.recoveryEmail),
    ], now - offset * 60 * 60_000);
  }
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", recoveryDailyKey, config.recoveryEmail),
    ], now)).allowed,
    false
  );

  const emailThrottle = `dd298-email-throttle-${run}@example.invalid`;
  const emailThrottleKey = getRecoveryEmailFingerprint(emailThrottle, secret);
  temporarySubjectKeys.add(emailThrottleKey);
  temporarySubjectKeys.add(getLegacyRecoveryEmailFingerprint(emailThrottle, secret));
  for (const offset of [50, 40, 30]) {
    await neonAuthEmailRateLimitStore.reserve([
      recoveryTarget("email", emailThrottleKey, config.recoveryEmail),
    ], now - offset * 60_000);
  }
  capture = response();
  await recovery(request({ body: { email: emailThrottle } }), capture.res);
  assert.deepEqual(capture.result.body, { ok: true });
  assert.equal(capture.result.status, 202);

  const ipThrottle = "127.0.0.4";
  const ipThrottleKey = getRecoveryIpFingerprint(ipThrottle, secret);
  const ipThrottleEmail = `dd298-ip-throttle-${run}@example.invalid`;
  temporarySubjectKeys.add(getRecoveryEmailFingerprint(ipThrottleEmail, secret));
  temporarySubjectKeys.add(getLegacyRecoveryEmailFingerprint(ipThrottleEmail, secret));
  temporarySubjectKeys.add(ipThrottleKey);
  for (let index = 20; index > 0; index -= 1) {
    await neonAuthEmailRateLimitStore.reserve([
      ipTarget("ip", ipThrottleKey, config.recoveryIp),
    ], now - (index + 1) * 60_000);
  }
  capture = response();
  await recovery(request({ body: { email: ipThrottleEmail }, remoteAddress: ipThrottle }), capture.res);
  assert.equal(capture.result.status, 429);

  const ipDailyKey = getRecoveryIpFingerprint("127.0.0.5", secret);
  temporarySubjectKeys.add(ipDailyKey);
  for (let index = 50; index > 0; index -= 1) {
    await neonAuthEmailRateLimitStore.reserve([
      ipTarget("ip", ipDailyKey, config.recoveryIp),
    ], now - index * 20 * 60_000);
  }
  assert.equal(
    (await neonAuthEmailRateLimitStore.reserve([
      ipTarget("ip", ipDailyKey, config.recoveryIp),
    ], now)).allowed,
    false
  );

  const disabled = getAuthEmailRateLimitConfig({
    AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED: "false",
  });
  const disabledKey = getRecoveryEmailFingerprint(`dd298-disabled-${run}@example.invalid`, secret);
  temporarySubjectKeys.add(disabledKey);
  for (let index = 0; index < 6; index += 1) {
    assert.equal(
      (await neonAuthEmailRateLimitStore.reserve([
        recoveryTarget("email", disabledKey, disabled.recoveryEmail),
      ], now + index * 60_000)).allowed,
      true
    );
  }

  const verificationFailure = createVerificationEmailHandler({
    verifyToken: verifyFirebaseToken,
    auth: adminAuth,
    limiter: { reserve: async () => { throw new Error("storage failure"); } },
    environment: {},
    metric: () => {},
  });
  capture = response();
  await verificationFailure(request({ authorization: `Bearer ${secondToken}` }), capture.res);
  assert.deepEqual(capture.result.body, { ok: false, error: "Internal server error" });
  assert.equal(capture.result.status, 500);
  const recoveryFailure = createPasswordRecoveryEmailHandler({
    auth: adminAuth,
    limiter: { reserve: async () => { throw new Error("storage failure"); } },
    fingerprintSecret: secret,
    minimumResponseMs: PASSWORD_RECOVERY_MIN_RESPONSE_MS,
    environment: {},
    metric: () => {},
  });
  capture = response();
  const failureStarted = Date.now();
  await recoveryFailure(request({ body: { email: `dd298-failure-${run}@example.invalid` } }), capture.res);
  assert.deepEqual(capture.result.body, {
    ok: false,
    error: "Password recovery is temporarily unavailable. Please try again.",
  });
  assert.equal(capture.result.status, 503);
  assert.ok(Date.now() - failureStarted >= PASSWORD_RECOVERY_MIN_RESPONSE_MS);

  const stored = await db.execute(sql`
    SELECT subject_key
    FROM auth_email_rate_limit_subjects
    WHERE subject_key IN (${normalizedEmail}, ${"127.0.0.1"})
  `);
  assert.equal(stored.length, 0);
  assert.equal(sentMessages, 3);
  process.stderr.write("Development auth-email limiter persistence validation passed.\n");
} finally {
  if (temporarySubjectKeys.size) {
    await db.execute(sql`
      DELETE FROM auth_email_rate_limit_attempts attempts
      USING auth_email_rate_limit_subjects subjects
      WHERE attempts.subject_id = subjects.id
        AND subjects.subject_key IN (${sql.join(Array.from(temporarySubjectKeys), sql`, `)})
    `);
    await db.execute(sql`
      DELETE FROM auth_email_rate_limit_subjects
      WHERE subject_key IN (${sql.join(Array.from(temporarySubjectKeys), sql`, `)})
    `);
  }
  for (const uid of createdUids) {
    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // Cleanup is idempotent for a partially created fixture.
    }
  }
  for (const uid of createdUids) {
    await assert.rejects(
      () => adminAuth.getUser(uid),
      (error: unknown) => (error as { code?: string })?.code === "auth/user-not-found"
    );
  }
  const [subjectCount] = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM auth_email_rate_limit_subjects
    WHERE subject_key IN (${sql.join(Array.from(temporarySubjectKeys), sql`, `)})
  `);
  const [attemptCount] = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM auth_email_rate_limit_attempts attempts
    JOIN auth_email_rate_limit_subjects subjects ON subjects.id = attempts.subject_id
    WHERE subjects.subject_key IN (${sql.join(Array.from(temporarySubjectKeys), sql`, `)})
  `);
  assert.equal(Number(subjectCount?.count ?? 0), 0);
  assert.equal(Number(attemptCount?.count ?? 0), 0);
  process.stderr.write("Development auth-email limiter validation cleanup completed.\n");
}

process.exit(0);
