import { sql } from "drizzle-orm";

import {
  evaluateAuthEmailRateLimit,
  validateAuthEmailRateLimitTargets,
  type AuthEmailRateLimitReservation,
  type AuthEmailRateLimitScope,
  type AuthEmailRateLimitStore,
  type AuthEmailRateLimitTarget,
} from "./authEmailRateLimit.js";
import { db } from "./db.js";

type SubjectRow = {
  id: string;
  scope: AuthEmailRateLimitScope;
  subject_key: string;
};

type AttemptRow = {
  subject_id: string;
  occurred_at: Date | string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function sortedSubjects(targets: AuthEmailRateLimitTarget[]) {
  const subjects = new Map<
    string,
    { scope: AuthEmailRateLimitScope; subjectKey: string }
  >();
  for (const target of targets) {
    subjects.set(`${target.scope}\0${target.subjectKey}`, {
      scope: target.scope,
      subjectKey: target.subjectKey,
    });
    if (target.legacySubjectKey) {
      subjects.set(`${target.scope}\0${target.legacySubjectKey}`, {
        scope: target.scope,
        subjectKey: target.legacySubjectKey,
      });
    }
  }
  return Array.from(subjects.values()).sort((left, right) =>
    left.scope === right.scope
      ? left.subjectKey.localeCompare(right.subjectKey)
      : left.scope.localeCompare(right.scope)
  );
}

function asRows<T>(result: unknown) {
  if (!Array.isArray(result)) {
    throw new Error("Authentication email rate-limit query returned an invalid result");
  }
  return result as T[];
}

function timestampToMillis(value: Date | string) {
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("Authentication email rate-limit record is malformed");
  }
  return milliseconds;
}

/**
 * The parent rows are locked in deterministic scope/key order. That makes a
 * multi-target recovery reservation atomic without cross-store coordination.
 */
export const neonAuthEmailRateLimitStore: AuthEmailRateLimitStore = {
  async reserve(targets, nowMs): Promise<AuthEmailRateLimitReservation> {
    validateAuthEmailRateLimitTargets(targets);
    const subjects = sortedSubjects(targets);
    // Raw Drizzle SQL placeholders require serialized timestamps with the
    // postgres-js driver; PostgreSQL still owns timestamp typing and storage.
    const now = new Date(nowMs).toISOString();
    const activeAfter = new Date(nowMs - DAY_MS).toISOString();
    const expiresAt = new Date(
      nowMs + Math.max(...targets.map((target) => target.policy.recordTtlMs))
    ).toISOString();

    return db.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO auth_email_rate_limit_subjects
          (scope, subject_key, expires_at, created_at, updated_at)
        VALUES ${sql.join(
          subjects.map(
            (subject) =>
              sql`(${subject.scope}, ${subject.subjectKey}, ${expiresAt}, ${now}, ${now})`
          ),
          sql`, `
        )}
        ON CONFLICT (scope, subject_key) DO NOTHING
      `);

      const lockedSubjects = asRows<SubjectRow>(
        await tx.execute(sql`
          SELECT id, scope, subject_key
          FROM auth_email_rate_limit_subjects
          WHERE (scope, subject_key) IN (${sql.join(
            subjects.map(
              (subject) => sql`(${subject.scope}, ${subject.subjectKey})`
            ),
            sql`, `
          )})
          ORDER BY scope, subject_key
          FOR UPDATE
        `)
      );
      if (lockedSubjects.length !== subjects.length) {
        throw new Error("Authentication email rate-limit subjects could not be locked");
      }

      const subjectByKey = new Map(
        lockedSubjects.map((subject) => [
          `${subject.scope}\0${subject.subject_key}`,
          subject,
        ])
      );
      const subjectIds = lockedSubjects.map((subject) => subject.id);

      // Never use cleanup for authorization; it only bounds touched records.
      await tx.execute(sql`
        DELETE FROM auth_email_rate_limit_attempts
        WHERE subject_id IN (${sql.join(subjectIds, sql`, `)})
          AND occurred_at <= ${activeAfter}
      `);
      const attempts = asRows<AttemptRow>(
        await tx.execute(sql`
          SELECT subject_id, occurred_at
          FROM auth_email_rate_limit_attempts
          WHERE subject_id IN (${sql.join(subjectIds, sql`, `)})
            AND occurred_at > ${activeAfter}
          ORDER BY occurred_at
        `)
      );
      const timestampsBySubjectId = new Map<string, number[]>();
      for (const attempt of attempts) {
        const timestamps = timestampsBySubjectId.get(attempt.subject_id) ?? [];
        timestamps.push(timestampToMillis(attempt.occurred_at));
        timestampsBySubjectId.set(attempt.subject_id, timestamps);
      }

      const decisions: AuthEmailRateLimitReservation["decisions"] = {};
      for (const target of targets) {
        const current = subjectByKey.get(`${target.scope}\0${target.subjectKey}`);
        if (!current) throw new Error("Authentication email rate-limit subject is missing");
        const currentTimestamps = timestampsBySubjectId.get(current.id) ?? [];
        const legacy = target.legacySubjectKey
          ? subjectByKey.get(`${target.scope}\0${target.legacySubjectKey}`)
          : undefined;
        const timestamps = currentTimestamps.length
          ? currentTimestamps
          : legacy
            ? timestampsBySubjectId.get(legacy.id) ?? []
            : [];
        decisions[target.key] = evaluateAuthEmailRateLimit(
          timestamps,
          target.policy,
          nowMs
        );
      }

      const allowed = Object.values(decisions).every((decision) => decision.allowed);
      // Multi-key recovery requests create every reservation or none.
      if (!allowed) return { allowed: false, decisions };

      await tx.execute(sql`
        UPDATE auth_email_rate_limit_subjects
        SET expires_at = ${expiresAt}, updated_at = ${now}
        WHERE id IN (${sql.join(subjectIds, sql`, `)})
      `);
      await tx.execute(sql`
        UPDATE auth_email_rate_limit_attempts
        SET expires_at = ${expiresAt}
        WHERE subject_id IN (${sql.join(subjectIds, sql`, `)})
      `);
      await tx.execute(sql`
        INSERT INTO auth_email_rate_limit_attempts
          (subject_id, occurred_at, expires_at)
        VALUES ${sql.join(
          targets.map((target) => {
            const subject = subjectByKey.get(`${target.scope}\0${target.subjectKey}`);
            if (!subject) throw new Error("Authentication email rate-limit subject is missing");
            return sql`(${subject.id}, ${now}, ${expiresAt})`;
          }),
          sql`, `
        )}
      `);

      return { allowed: true, decisions };
    });
  },
};
