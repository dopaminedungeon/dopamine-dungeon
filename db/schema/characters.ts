import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";

export const characters = pgTable(
  "characters",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    name: text("name").default("").notNull(),
    level: integer("level").default(1).notNull(),
    visibility: text("visibility").default("player").notNull(),
    isPlayerVisible: boolean("is_player_visible").default(true).notNull(),
    ownerUserId: text("owner_user_id").default("").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignCharacter: unique().on(table.campaignId, table.id),
  })
);
