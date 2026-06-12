import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";
import { users } from "./users.js";

export const characterAssignments = pgTable(
  "character_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    characterId: text("character_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignCharacter: unique().on(table.campaignId, table.characterId),
    uniqueCampaignUserCharacter: unique().on(
      table.campaignId,
      table.userId,
      table.characterId
    ),
  })
);
