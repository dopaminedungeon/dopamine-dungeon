import {
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";

export const arcs = pgTable(
  "arcs",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    id: text("id").notNull(),
    type: text("type").default("main_story").notNull(),
    name: text("name").default("").notNull(),
    summary: text("summary").default("").notNull(),
    progress: integer("progress").default(0).notNull(),
    plotHook: text("plot_hook").default("").notNull(),
    grimPortentsFrontiers: text("grim_portents_frontiers").default("").notNull(),
    arcStructure: text("arc_structure").default("").notNull(),
    climaxConditions: text("climax_conditions").default("").notNull(),
    resolutionFallout: text("resolution_fallout").default("").notNull(),
    status: text("status").default("active").notNull(),
    visibility: text("visibility").default("gm-only").notNull(),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignArc: unique().on(table.campaignId, table.id),
  })
);

export const milestones = pgTable(
  "milestones",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id").notNull(),
    id: text("id").notNull(),
    // Optional for standalone Milestones; existing parent associations remain intact.
    arcId: text("arc_id"),
    title: text("title").default("").notNull(),
    description: text("description").default("").notNull(),
    progress: integer("progress").default(0).notNull(),
    conditionsForLevelUp: text("conditions_for_level_up").default("").notNull(),
    intendedLevelProgression: text("intended_level_progression").default("").notNull(),
    status: text("status").default("active").notNull(),
    visibility: text("visibility").default("gm-only").notNull(),
    position: integer("position").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignMilestone: unique().on(table.campaignId, table.id),
    milestoneArcCampaignFk: foreignKey({
      columns: [table.campaignId, table.arcId],
      foreignColumns: [arcs.campaignId, arcs.id],
    }).onDelete("cascade"),
  })
);
