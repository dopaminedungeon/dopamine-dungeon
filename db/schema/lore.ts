import {
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";

export const lore = pgTable(
  "lore",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    name: text("name").default("").notNull(),
    type: text("type").default("Lore").notNull(),
    visibility: text("visibility").default("gm-only").notNull(),
    summary: text("summary").default("").notNull(),
    content: text("content").default("").notNull(),
    gmNotes: text("gm_notes").default("").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignLore: unique().on(table.campaignId, table.id),
  })
);
