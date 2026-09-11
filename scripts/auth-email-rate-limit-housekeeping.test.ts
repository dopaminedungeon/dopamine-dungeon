import assert from "node:assert/strict";
import { test } from "vitest";

import {
  AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_DEFAULT_BATCH_SIZE,
  AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_MAX_BATCH_SIZE,
  parseAuthEmailRateLimitHousekeepingArguments,
  runAuthEmailRateLimitHousekeeping,
} from "./auth-email-rate-limit-housekeeping-core.mjs";
import {
  formatAuthEmailRateLimitHousekeepingCliError,
  runAuthEmailRateLimitHousekeepingCli,
} from "./auth-email-rate-limit-housekeeping.mjs";

function createSql(responses, { failAt } = {}) {
  const calls = [];
  let rolledBack = false;
  const tx = (strings, ...values) => {
    calls.push({ query: strings.join("?"), values });
    if (calls.length === failAt) throw new Error("database failure");
    return Promise.resolve(responses.shift() ?? []);
  };
  tx.array = (value) => value;
  return {
    calls,
    get rolledBack() {
      return rolledBack;
    },
    begin: async (callback) => {
      try {
        return await callback(tx);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
    end: async () => {},
  };
}

test("housekeeping defaults to a bounded dry run and validates explicit inputs", () => {
  assert.deepEqual(parseAuthEmailRateLimitHousekeepingArguments([]), {
    mode: "dry-run",
    batchSize: AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_DEFAULT_BATCH_SIZE,
  });
  assert.deepEqual(parseAuthEmailRateLimitHousekeepingArguments(["--apply", "--batch-size=7"]), {
    mode: "apply",
    batchSize: 7,
  });
  assert.throws(() => parseAuthEmailRateLimitHousekeepingArguments(["--batch-size", "0"]));
  assert.throws(() => parseAuthEmailRateLimitHousekeepingArguments([
    "--batch-size",
    String(AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_MAX_BATCH_SIZE + 1),
  ]));
  assert.throws(() => parseAuthEmailRateLimitHousekeepingArguments(["--dry-run", "--apply"]));
  assert.throws(() => parseAuthEmailRateLimitHousekeepingArguments(["--unknown"]));
});

test("dry run locks a deterministic bounded candidate set but performs no deletes", async () => {
  const sql = createSql([
    [{ count: "3" }],
    [{ id: "one", scope: "verification" }, { id: "two", scope: "recovery_email" }],
  ]);
  const result = await runAuthEmailRateLimitHousekeeping(sql, { mode: "dry-run", batchSize: 2 });
  assert.deepEqual(result, {
    mode: "dry-run",
    eligibleSubjectCount: 3,
    selectedSubjectCount: 2,
    selectedByScope: { verification: 1, recovery_email: 1 },
    moreEligible: true,
    deletedSubjectCount: 0,
    deletedAttemptCount: 0,
    deletedSubjectsByScope: {},
    deletedAttemptsByScope: {},
  });
  assert.match(sql.calls[0].query, /expires_at < transaction_timestamp\(\)/);
  assert.doesNotMatch(sql.calls[0].query, /expires_at <=/);
  assert.match(sql.calls[1].query, /ORDER BY expires_at ASC, id ASC/);
  assert.match(sql.calls[1].query, /FOR UPDATE SKIP LOCKED/);
  assert.equal(sql.calls.some((call) => call.query.includes("DELETE FROM")), false);
});

test("apply deletes attempts before only the locked parent subjects and returns aggregates", async () => {
  const sql = createSql([
    [{ count: 3 }],
    [{ id: "one", scope: "verification" }, { id: "two", scope: "recovery_email" }],
    [{ subject_id: "one" }, { subject_id: "one" }, { subject_id: "two" }],
    [{ id: "one", scope: "verification" }, { id: "two", scope: "recovery_email" }],
  ]);
  const result = await runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 2 });
  assert.equal(result.deletedSubjectCount, 2);
  assert.equal(result.deletedAttemptCount, 3);
  assert.deepEqual(result.deletedSubjectsByScope, { verification: 1, recovery_email: 1 });
  assert.deepEqual(result.deletedAttemptsByScope, { verification: 2, recovery_email: 1 });
  assert.match(sql.calls[2].query, /DELETE FROM auth_email_rate_limit_attempts/);
  assert.match(sql.calls[3].query, /DELETE FROM auth_email_rate_limit_subjects/);
  assert.equal(sql.calls[2].values[0].length, 2);
});

test("a maintenance failure rejects the transaction and does not return a success result", async () => {
  const sql = createSql([
    [{ count: 1 }],
    [{ id: "one", scope: "verification" }],
    [{ subject_id: "one" }],
  ], { failAt: 4 });
  await assert.rejects(
    runAuthEmailRateLimitHousekeeping(sql, { mode: "apply", batchSize: 1 }),
    /database failure/
  );
  assert.equal(sql.rolledBack, true);
});

test("CLI emits aggregate-only output, closes its connection, and fails closed without configuration", async () => {
  const output = [];
  let closed = false;
  const sql = createSql([[{ count: 1 }], [{ id: "opaque-subject-key", scope: "verification" }]]);
  sql.end = async () => {
    closed = true;
  };
  await runAuthEmailRateLimitHousekeepingCli({
    environment: { DATABASE_URL: "postgres://opaque" },
    createSql: () => sql,
    write: (line) => output.push(line),
  });
  assert.equal(closed, true);
  assert.equal(output.length, 1);
  assert.equal(output[0].includes("opaque-subject-key"), false);
  await assert.rejects(
    runAuthEmailRateLimitHousekeepingCli({ environment: {}, createSql: () => sql }),
    /DATABASE_URL is required/
  );
  assert.equal(
    formatAuthEmailRateLimitHousekeepingCliError(
      new Error("DATABASE_URL is required in the approved operator environment")
    ),
    "Authentication email limiter housekeeping failed: DATABASE_URL is required in the approved operator environment"
  );
  assert.equal(
    formatAuthEmailRateLimitHousekeepingCliError(new Error("driver failure with connection details")),
    "Authentication email limiter housekeeping failed."
  );
});
