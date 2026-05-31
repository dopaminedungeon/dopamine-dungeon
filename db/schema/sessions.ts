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

export const sessions = pgTable(
  "sessions",
  {
    rowId: uuid("row_id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    id: text("id").notNull(),
    sessionNumber: integer("session_number").default(1).notNull(),
    name: text("name").notNull(),
    players: integer("players").default(0).notNull(),
    maxPlayers: integer("max_players").default(0).notNull(),
    duration: text("duration").default("—").notNull(),
    status: text("status").default("scheduled").notNull(),
    startTime: text("start_time").default("").notNull(),
    map: text("map").default("").notNull(),
    difficulty: text("difficulty").default("Normal").notNull(),
    progress: integer("progress").default(0).notNull(),
    visibility: text("visibility").default("public").notNull(),
    summary: text("summary").default("").notNull(),
    timeline: text("timeline").default("").notNull(),
    moments: text("moments").default("").notNull(),
    quotes: text("quotes").default("").notNull(),
    gmNotes: text("gm_notes").default("").notNull(),
    gmSecrets: text("gm_secrets").default("").notNull(),
    gmPrep: jsonb("gm_prep").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCampaignSession: unique().on(table.campaignId, table.id),
  })
);
