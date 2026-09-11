export const AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_DEFAULT_BATCH_SIZE = 100;
export const AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_MAX_BATCH_SIZE = 500;

const MODES = new Set(["dry-run", "apply"]);

function countRows(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Authentication email limiter housekeeping returned an invalid count");
  }
  return count;
}

function countScopes(rows) {
  const counts = {};
  for (const row of rows) {
    if (typeof row.scope !== "string") {
      throw new Error("Authentication email limiter housekeeping returned an invalid scope");
    }
    counts[row.scope] = (counts[row.scope] ?? 0) + 1;
  }
  return counts;
}

export function validateAuthEmailRateLimitHousekeepingBatchSize(batchSize) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error("--batch-size must be a positive integer");
  }
  if (batchSize > AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_MAX_BATCH_SIZE) {
    throw new Error(
      `--batch-size must not exceed ${AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_MAX_BATCH_SIZE}`
    );
  }
  return batchSize;
}

export function parseAuthEmailRateLimitHousekeepingArguments(argv) {
  let mode = "dry-run";
  let batchSize = AUTH_EMAIL_RATE_LIMIT_HOUSEKEEPING_DEFAULT_BATCH_SIZE;
  let modeWasSpecified = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      if (modeWasSpecified) throw new Error("Specify only one of --dry-run or --apply");
      mode = "apply";
      modeWasSpecified = true;
      continue;
    }
    if (argument === "--dry-run") {
      if (modeWasSpecified) throw new Error("Specify only one of --dry-run or --apply");
      mode = "dry-run";
      modeWasSpecified = true;
      continue;
    }
    if (argument === "--batch-size") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--batch-size requires a value");
      batchSize = Number(value);
      index += 1;
      continue;
    }
    if (argument.startsWith("--batch-size=")) {
      batchSize = Number(argument.slice("--batch-size=".length));
      continue;
    }
    throw new Error(`Unsupported argument: ${argument}`);
  }

  return { mode, batchSize: validateAuthEmailRateLimitHousekeepingBatchSize(batchSize) };
}

/**
 * Performs one bounded maintenance transaction. It deliberately does not read
 * or modify request-time authorization decisions: expiry is only a retention
 * boundary for rows selected by this operator-only path.
 */
export async function runAuthEmailRateLimitHousekeeping(sql, { mode, batchSize, testSubjectKeyPrefix }) {
  if (!MODES.has(mode)) throw new Error("Authentication email limiter housekeeping mode is invalid");
  validateAuthEmailRateLimitHousekeepingBatchSize(batchSize);
  if (
    testSubjectKeyPrefix !== undefined &&
    (!/^[a-z0-9-]+$/.test(testSubjectKeyPrefix) || !testSubjectKeyPrefix.startsWith("fixture-"))
  ) {
    throw new Error("Authentication email limiter housekeeping test selector is invalid");
  }

  return sql.begin(async (tx) => {
    // transaction_timestamp() is PostgreSQL's fixed time for this transaction.
    // The strict comparison preserves rows at the exact retention boundary.
    const [{ count: eligibleCount }] = testSubjectKeyPrefix === undefined
      ? await tx`
          SELECT count(*)::bigint AS count
          FROM auth_email_rate_limit_subjects
          WHERE expires_at < transaction_timestamp()
        `
      : await tx`
          SELECT count(*)::bigint AS count
          FROM auth_email_rate_limit_subjects
          WHERE expires_at < transaction_timestamp()
            AND subject_key LIKE ${`${testSubjectKeyPrefix}%`}
        `;
    const eligibleSubjectCount = countRows(eligibleCount);
    const candidates = testSubjectKeyPrefix === undefined
      ? await tx`
          SELECT id, scope
          FROM auth_email_rate_limit_subjects
          WHERE expires_at < transaction_timestamp()
          ORDER BY expires_at ASC, id ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `
      : await tx`
          SELECT id, scope
          FROM auth_email_rate_limit_subjects
          WHERE expires_at < transaction_timestamp()
            AND subject_key LIKE ${`${testSubjectKeyPrefix}%`}
          ORDER BY expires_at ASC, id ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;
    const selectedSubjectCount = candidates.length;
    const selectedByScope = countScopes(candidates);
    const baseResult = {
      mode,
      eligibleSubjectCount,
      selectedSubjectCount,
      selectedByScope,
      moreEligible: eligibleSubjectCount > selectedSubjectCount,
    };

    if (mode === "dry-run" || candidates.length === 0) {
      return {
        ...baseResult,
        deletedSubjectCount: 0,
        deletedAttemptCount: 0,
        deletedSubjectsByScope: {},
        deletedAttemptsByScope: {},
      };
    }

    const subjectIds = candidates.map((candidate) => candidate.id);
    const scopeBySubjectId = new Map(candidates.map((candidate) => [candidate.id, candidate.scope]));
    // The schema deliberately has no cascading delete. Remove children while
    // their parents are still locked, then remove only those locked parents.
    const deletedAttempts = await tx`
      DELETE FROM auth_email_rate_limit_attempts
      WHERE subject_id = ANY(${tx.array(subjectIds, 2950)})
      RETURNING subject_id
    `;
    const deletedSubjects = await tx`
      DELETE FROM auth_email_rate_limit_subjects
      WHERE id = ANY(${tx.array(subjectIds, 2950)})
      RETURNING id, scope
    `;
    const deletedAttemptsByScope = {};
    for (const attempt of deletedAttempts) {
      const scope = scopeBySubjectId.get(attempt.subject_id);
      if (!scope) throw new Error("Authentication email limiter housekeeping returned an invalid attempt");
      deletedAttemptsByScope[scope] = (deletedAttemptsByScope[scope] ?? 0) + 1;
    }

    return {
      ...baseResult,
      deletedSubjectCount: deletedSubjects.length,
      deletedAttemptCount: deletedAttempts.length,
      deletedSubjectsByScope: countScopes(deletedSubjects),
      deletedAttemptsByScope,
    };
  });
}
