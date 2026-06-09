import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";

export const bagCurrency = pgTable("bag_currency", {
  campaignId: uuid("campaign_id")
    .primaryKey()
    .references(() => campaigns.id),
  cp: integer("cp").default(0).notNull(),
  sp: integer("sp").default(0).notNull(),
  ep: integer("ep").default(0).notNull(),
  gp: integer("gp").default(0).notNull(),
  pp: integer("pp").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bagEntries = pgTable(
  "bag_entries",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    sourceType: text("source_type").notNull(),
    itemId: text("item_id"),
    name: text("name").default("").notNull(),
    category: text("category"),
    quantity: integer("quantity").default(1).notNull(),
    worthGp: doublePrecision("worth_gp").default(0).notNull(),
    notes: text("notes"),
    addedBy: text("added_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignBagEntry: unique().on(table.campaignId, table.id),
  })
);
