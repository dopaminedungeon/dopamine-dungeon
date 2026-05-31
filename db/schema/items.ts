import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";

export const items = pgTable(
  "items",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    name: text("name").default("").notNull(),
    type: text("type").default("Other").notNull(),
    rarity: text("rarity").default("Common").notNull(),
    power: integer("power").default(0).notNull(),
    visibility: text("visibility").default("public").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignItem: unique().on(table.campaignId, table.id),
  })
);
