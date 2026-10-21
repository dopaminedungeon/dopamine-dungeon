import { integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns.js";
import type { QuestObjective, QuestSection, QuestVisibility } from "../../src/domain/quests/quest.types.js";

export const quests = pgTable("quests", {
  rowId: uuid("row_id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  id: text("id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  progress: integer("progress").default(0).notNull(),
  visibility: text("visibility").notNull(),
  startSessionId: text("start_session_id").default("").notNull(),
  endSessionId: text("end_session_id").default("").notNull(),
  endDate: text("end_date").default("").notNull(),
  giverId: text("giver_id").default("").notNull(),
  receiverIds: jsonb("receiver_ids").$type<string[]>().default([]).notNull(),
  shortDescription: text("short_description").default("").notNull(),
  hook: text("hook").default("").notNull(),
  journey: text("journey").default("").notNull(),
  aftermath: text("aftermath").default("").notNull(),
  sectionVisibility: jsonb("section_visibility").$type<Record<QuestSection, QuestVisibility> & Record<string, QuestVisibility>>().notNull(),
  mainObjectives: jsonb("main_objectives").$type<QuestObjective[]>().default([]).notNull(),
  secondaryObjectives: jsonb("secondary_objectives").$type<QuestObjective[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({ uniqueCampaignQuest: unique().on(table.campaignId, table.id) }));
