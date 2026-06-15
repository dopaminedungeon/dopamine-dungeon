import {
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";

export const locations = pgTable(
  "locations",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    name: text("name").default("").notNull(),
    category: text("category").default("Other").notNull(),
    visibility: text("visibility").default("gm-only").notNull(),
    summary: text("summary").default("").notNull(),
    description: text("description").default("").notNull(),
    gmNotes: text("gm_notes").default("").notNull(),
    imageUrl: text("image_url").default("").notNull(),
    aliases: jsonb("aliases").$type<string[]>().notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignLocation: unique().on(table.campaignId, table.id),
  })
);
