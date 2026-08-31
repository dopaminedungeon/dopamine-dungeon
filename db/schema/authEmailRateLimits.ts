import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/** Server-only limiter state; recovery keys are HMAC fingerprints only. */
export const authEmailRateLimitSubjects = pgTable(
  "auth_email_rate_limit_subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: text("scope").notNull(),
    subjectKey: text("subject_key").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueScopeSubjectKey: unique().on(table.scope, table.subjectKey),
    validScope: check(
      "auth_email_rate_limit_subjects_scope_check",
      sql`${table.scope} in ('verification', 'recovery_email', 'recovery_ip')`
    ),
    expiresAtIndex: index("auth_email_rate_limit_subjects_expires_at_idx").on(
      table.expiresAt
    ),
  })
);

export const authEmailRateLimitAttempts = pgTable(
  "auth_email_rate_limit_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => authEmailRateLimitSubjects.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    subjectOccurredAtIndex: index(
      "auth_email_rate_limit_attempts_subject_occurred_at_idx"
    ).on(table.subjectId, table.occurredAt),
    expiresAtIndex: index("auth_email_rate_limit_attempts_expires_at_idx").on(
      table.expiresAt
    ),
  })
);
