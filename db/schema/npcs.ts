import {
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";

export const npcs = pgTable(
  "npcs",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    name: text("name").default("").notNull(),
    title: text("title").default("").notNull(),
    type: text("type").default("NPC").notNull(),
    status: text("status").default("active").notNull(),
    visibility: text("visibility").default("public").notNull(),
    summary: text("summary").default("").notNull(),
    description: text("description").default("").notNull(),
    gmNotes: text("gm_notes").default("").notNull(),
    imageUrl: text("image_url").default("").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignNpc: unique().on(table.campaignId, table.id),
  })
);
