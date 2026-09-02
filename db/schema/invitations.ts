import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";
import { campaigns } from "./campaigns.js";

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  workspaceRole: text("workspace_role").default("member").notNull(),
  campaignRole: text("campaign_role").default("player").notNull(),
  characterId: text("character_id"),
  status: text("status").default("pending").notNull(),
  // Existing rows may not have an expiry. The application treats those legacy
  // rows as migration input; newly created invitations always set this value.
  expiresAt: timestamp("expires_at"),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  // Reservation time for direct invitation delivery. This is intentionally
  // separate from auth-email rate limiting because invitation lifecycle and
  // delivery semantics are scoped to a campaign invitation.
  lastSentAt: timestamp("last_sent_at"),
}, (table) => ({
  // Expiry transitions pending rows to `expired` before creation/retry. The
  // partial unique index then makes concurrent active-invitation creation safe.
  uniqueActiveInvitationScopeRole: uniqueIndex("invitations_active_scope_email_role_unique")
    .on(
      table.workspaceId,
      table.campaignId,
      table.normalizedEmail,
      table.campaignRole
    )
    .where(sql`${table.status} = 'pending'`),
}));

export const invitationCharacterAssignments = pgTable(
  "invitation_character_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => invitations.id),
    characterId: text("character_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueInvitationCharacter: unique().on(table.invitationId, table.characterId),
  })
);
