import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterEach, beforeEach, test } from "vitest";

import { runAuthEmailRateLimitHousekeeping } from "./auth-email-rate-limit-housekeeping-core.mjs";

function readLocalEnvironmentValue(name: string) {
  const expression = new RegExp(`^${name}=(.*)$`);
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(expression);
    if (match) return match[1]!.trim().replace(/^"|"$/g, "");
  }
  return "";
}

const databaseUrl = String(
  process.env.AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_TEST_DATABASE_URL ??
    readLocalEnvironmentValue("AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_TEST_DATABASE_URL")
).trim();
const integrationTest = databaseUrl ? test : test.skip;
const fixturePrefix = `fixture-${randomUUID()}-`;

type Fixture = { id: string };
let sql: ReturnType<typeof postgres>;
let fixtures: Fixture[];

beforeEach(() => {
  if (!databaseUrl) return;
  sql = postgres(databaseUrl, { max: 4, prepare: false });
  fixtures = [];
});

afterEach(async () => {
  if (!databaseUrl) return;
  const ids = fixtures.map((fixture) => fixture.id);
  if (ids.length) {
    await sql`
      DELETE FROM auth_email_rate_limit_attempts
      WHERE subject_id = ANY(${sql.array(ids, 2950)})
    `;
    await sql`
      DELETE FROM auth_email_rate_limit_subjects
      WHERE id = ANY(${sql.array(ids, 2950)})
    `;
  }
  await sql.end({ timeout: 5 });
});

async function addSubject({ expiresInMs, scope = "verification", attempts = 0 }: {
  expiresInMs: number;
  scope?: "verification" | "recovery_email" | "recovery_ip";
  attempts?: number;
}) {
  const id = randomUUID();
  fixtures.push({ id });
  await sql`
    INSERT INTO auth_email_rate_limit_subjects (id, scope, subject_key, expires_at)
    VALUES (${id}, ${scope}, ${`${fixturePrefix}${randomUUID()}`}, now() + ${expiresInMs} * interval '1 millisecond')
  `;
  for (let index = 0; index < attempts; index += 1) {
    await sql`
      INSERT INTO auth_email_rate_limit_attempts (subject_id, occurred_at, expires_at)
      VALUES (${id}, now(), now() + ${expiresInMs} * interval '1 millisecond')
    `;
  }
  return id;
}

async function existingSubjectCount(ids: string[]) {
  const [{ count }] = await sql`
    SELECT count(*)::int AS count
    FROM auth_email_rate_limit_subjects
    WHERE id = ANY(${sql.array(ids, 2950)})
  `;
  return Number(count);
}

integrationTest("expired limiter fixtures are dry-run safe, bounded, and deleted child-first", async () => {
  const expiredOne = await addSubject({ expiresInMs: -60_000, attempts: 2 });
  const expiredTwo = await addSubject({ expiresInMs: -30_000, scope: "recovery_email", attempts: 1 });
  const future = await addSubject({ expiresInMs: 86_400_000, attempts: 1 });

  const dryRun = await runAuthEmailRateLimitHousekeeping(sql, { mode: "dry-run", batchSize: 1, testSubjectKeyPrefix: fixturePrefix });
  assert.equal(dryRun.selectedSubjectCount, 1);
  assert.equal(dryRun.deletedSubjectCount, 0);
  assert.equal(dryRun.moreEligible, true);
  assert.equal(await existingSubjectCount([expiredOne, expiredTwo, future]), 3);

  const first = await runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 1, testSubjectKeyPrefix: fixturePrefix });
  assert.equal(first.deletedSubjectCount, 1);
  assert.equal(first.deletedAttemptCount, 2);
  assert.equal(first.moreEligible, true);
  assert.equal(await existingSubjectCount([expiredOne, expiredTwo, future]), 2);

  const second = await runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 2, testSubjectKeyPrefix: fixturePrefix });
  assert.equal(second.deletedSubjectCount, 1);
  assert.equal(second.deletedAttemptCount, 1);
  assert.equal(await existingSubjectCount([expiredOne, expiredTwo, future]), 1);
  const repeated = await runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 2, testSubjectKeyPrefix: fixturePrefix });
  assert.equal(repeated.deletedSubjectCount, 0);
  assert.equal(await existingSubjectCount([future]), 1);
});

integrationTest("simultaneous bounded cleanup transactions do not double-process expired fixtures", async () => {
  const ids = await Promise.all(Array.from({ length: 4 }, (_, index) =>
    addSubject({ expiresInMs: -60_000 - index, scope: index % 2 ? "recovery_ip" : "verification" })
  ));
  const results = await Promise.all([
    runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 4, testSubjectKeyPrefix: fixturePrefix }),
    runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 4, testSubjectKeyPrefix: fixturePrefix }),
  ]);
  assert.equal(results[0].deletedSubjectCount + results[1].deletedSubjectCount, 4);
  assert.equal(await existingSubjectCount(ids), 0);
});

integrationTest("an in-flight reservation lock preserves an expired subject until it renews", async () => {
  const id = await addSubject({ expiresInMs: -60_000 });
  let releaseReservation: () => void;
  const reservationCanFinish = new Promise<void>((resolve) => {
    releaseReservation = resolve;
  });
  let notifyLocked: () => void;
  const lockHeld = new Promise<void>((resolve) => {
    notifyLocked = resolve;
  });
  const reservation = sql.begin(async (tx) => {
    await tx`
      SELECT id FROM auth_email_rate_limit_subjects
      WHERE id = ${id}
      FOR UPDATE
    `;
    notifyLocked();
    await reservationCanFinish;
    await tx`
      UPDATE auth_email_rate_limit_subjects
      SET expires_at = now() + interval '48 hours'
      WHERE id = ${id}
    `;
    await tx`
      INSERT INTO auth_email_rate_limit_attempts (subject_id, occurred_at, expires_at)
      VALUES (${id}, now(), now() + interval '48 hours')
    `;
  });
  await lockHeld;
  const cleanup = await runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 1, testSubjectKeyPrefix: fixturePrefix });
  assert.equal(cleanup.selectedSubjectCount, 0);
  releaseReservation!();
  await reservation;
  assert.equal(await existingSubjectCount([id]), 1);
});
