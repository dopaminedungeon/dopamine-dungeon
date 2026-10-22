import {
  bigint,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";
import { users } from "./users.js";

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
    worthGp: doublePrecision("worth_gp"),
    notes: text("notes"),
    addedBy: text("added_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignBagEntry: unique().on(table.campaignId, table.id),
  })
);

export const bagTransactions = pgTable(
  "bag_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    requestId: uuid("request_id").notNull(),
    actorUserId: uuid("actor_user_id").notNull().references(() => users.id),
    type: text("type").notNull(),
    amountCp: bigint("amount_cp", { mode: "number" }).notNull(),
    balanceAfterCp: bigint("balance_after_cp", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignRequest: unique().on(table.campaignId, table.requestId),
  })
);
