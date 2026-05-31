import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";

export const entityLinks = pgTable(
  "entity_links",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    entityAType: text("entity_a_type").notNull(),
    entityAId: text("entity_a_id").notNull(),
    entityBType: text("entity_b_type").notNull(),
    entityBId: text("entity_b_id").notNull(),
    label: text("label").notNull(),
    visibility: text("visibility").notNull(),
    createdInSession: text("created_in_session"),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignEntityLinkId: unique().on(table.campaignId, table.id),
    uniqueCampaignEntityLinkRelationship: unique().on(
      table.campaignId,
      table.entityAType,
      table.entityAId,
      table.entityBType,
      table.entityBId,
      table.label,
      table.visibility
    ),
  })
);
