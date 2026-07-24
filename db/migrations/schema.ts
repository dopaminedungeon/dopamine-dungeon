import { pgTable, foreignKey, uuid, text, timestamp, unique, integer, jsonb, boolean, doublePrecision } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const invitations = pgTable("invitations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	normalizedEmail: text("normalized_email").notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	campaignId: uuid("campaign_id").notNull(),
	workspaceRole: text("workspace_role").default('member').notNull(),
	campaignRole: text("campaign_role").default('player').notNull(),
	characterId: text("character_id"),
	status: text().default('pending').notNull(),
	invitedByUserId: uuid("invited_by_user_id").notNull(),
	acceptedByUserId: uuid("accepted_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "invitations_workspace_id_workspaces_id_fk"
		}),
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "invitations_campaign_id_campaigns_id_fk"
		}),
	foreignKey({
			columns: [table.invitedByUserId],
			foreignColumns: [users.id],
			name: "invitations_invited_by_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.acceptedByUserId],
			foreignColumns: [users.id],
			name: "invitations_accepted_by_user_id_users_id_fk"
		}),
]);

export const workspaces = pgTable("workspaces", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	ownerUserId: uuid("owner_user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [users.id],
			name: "workspaces_owner_user_id_users_id_fk"
		}),
	unique("workspaces_slug_unique").on(table.slug),
]);

export const campaigns = pgTable("campaigns", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	system: text().default(').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "campaigns_workspace_id_workspaces_id_fk"
		}),
]);

export const campaignMemberships = pgTable("campaign_memberships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "campaign_memberships_campaign_id_campaigns_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "campaign_memberships_user_id_users_id_fk"
		}),
	unique("campaign_memberships_campaign_id_user_id_unique").on(table.campaignId, table.userId),
]);

export const workspaceMemberships = pgTable("workspace_memberships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workspaceId: uuid("workspace_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.workspaceId],
			foreignColumns: [workspaces.id],
			name: "workspace_memberships_workspace_id_workspaces_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "workspace_memberships_user_id_users_id_fk"
		}),
	unique("workspace_memberships_workspace_id_user_id_unique").on(table.workspaceId, table.userId),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	firebaseUid: text("firebase_uid").notNull(),
	email: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	displayName: text("display_name"),
}, (table) => [
	unique("users_firebase_uid_unique").on(table.firebaseUid),
]);

export const sessions = pgTable("sessions", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	sessionNumber: integer("session_number").default(1).notNull(),
	name: text().notNull(),
	players: integer().default(0).notNull(),
	maxPlayers: integer("max_players").default(0).notNull(),
	duration: text().default('—').notNull(),
	status: text().default('scheduled').notNull(),
	startTime: text("start_time").default(').notNull(),
	map: text().default(').notNull(),
	difficulty: text().default('Normal').notNull(),
	progress: integer().default(0).notNull(),
	visibility: text().default('public').notNull(),
	summary: text().default(').notNull(),
	timeline: text().default(').notNull(),
	moments: text().default(').notNull(),
	quotes: text().default(').notNull(),
	gmNotes: text("gm_notes").default(').notNull(),
	gmSecrets: text("gm_secrets").default(').notNull(),
	gmPrep: jsonb("gm_prep").default([]).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	attendees: jsonb().default([]).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "sessions_campaign_id_campaigns_id_fk"
		}),
	unique("sessions_campaign_id_id_unique").on(table.campaignId, table.id),
]);

export const characters = pgTable("characters", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	name: text().default(').notNull(),
	level: integer().default(1).notNull(),
	visibility: text().default('player').notNull(),
	isPlayerVisible: boolean("is_player_visible").default(true).notNull(),
	ownerUserId: text("owner_user_id").default(').notNull(),
	data: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "characters_campaign_id_campaigns_id_fk"
		}),
	unique("characters_campaign_id_id_unique").on(table.campaignId, table.id),
]);

export const items = pgTable("items", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	name: text().default(').notNull(),
	type: text().default('Other').notNull(),
	rarity: text().default('Common').notNull(),
	power: integer().default(0).notNull(),
	visibility: text().default('public').notNull(),
	data: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "items_campaign_id_campaigns_id_fk"
		}),
	unique("items_campaign_id_id_unique").on(table.campaignId, table.id),
]);

export const bagCurrency = pgTable("bag_currency", {
	campaignId: uuid("campaign_id").primaryKey().notNull(),
	cp: integer().default(0).notNull(),
	sp: integer().default(0).notNull(),
	ep: integer().default(0).notNull(),
	gp: integer().default(0).notNull(),
	pp: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "bag_currency_campaign_id_campaigns_id_fk"
		}),
]);

export const bagEntries = pgTable("bag_entries", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	sourceType: text("source_type").notNull(),
	itemId: text("item_id"),
	name: text().default(').notNull(),
	category: text(),
	quantity: integer().default(1).notNull(),
	worthGp: doublePrecision("worth_gp").default(0).notNull(),
	notes: text(),
	addedBy: text("added_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "bag_entries_campaign_id_campaigns_id_fk"
		}),
	unique("bag_entries_campaign_id_id_unique").on(table.campaignId, table.id),
]);

export const entityLinks = pgTable("entity_links", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	entityAType: text("entity_a_type").notNull(),
	entityAId: text("entity_a_id").notNull(),
	entityBType: text("entity_b_type").notNull(),
	entityBId: text("entity_b_id").notNull(),
	label: text().notNull(),
	visibility: text().notNull(),
	createdInSession: text("created_in_session"),
	note: text(),
	createdByUserId: uuid("created_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "entity_links_campaign_id_campaigns_id_fk"
		}),
	unique("entity_links_campaign_id_id_unique").on(table.campaignId, table.id),
	unique("entity_links_campaign_id_entity_a_type_entity_a_id_entity_b_typ").on(table.campaignId, table.entityAType, table.entityAId, table.entityBType, table.entityBId, table.label, table.visibility),
]);

export const lore = pgTable("lore", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	name: text().default(').notNull(),
	type: text().default('Lore').notNull(),
	visibility: text().default('gm-only').notNull(),
	summary: text().default(').notNull(),
	content: text().default(').notNull(),
	gmNotes: text("gm_notes").default(').notNull(),
	aliases: jsonb().notNull(),
	data: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "lore_campaign_id_campaigns_id_fk"
		}),
	unique("lore_campaign_id_id_unique").on(table.campaignId, table.id),
]);

export const characterAssignments = pgTable("character_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	characterId: text("character_id").notNull(),
	userId: uuid("user_id").notNull(),
	createdByUserId: uuid("created_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "character_assignments_campaign_id_campaigns_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "character_assignments_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "character_assignments_created_by_user_id_users_id_fk"
		}),
	unique("character_assignments_campaign_id_character_id_unique").on(table.campaignId, table.characterId),
	unique("character_assignments_campaign_id_user_id_character_id_unique").on(table.campaignId, table.characterId, table.userId),
]);

export const npcs = pgTable("npcs", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	name: text().default(').notNull(),
	title: text().default(').notNull(),
	type: text().default('NPC').notNull(),
	status: text().default('active').notNull(),
	visibility: text().default('public').notNull(),
	summary: text().default(').notNull(),
	description: text().default(').notNull(),
	gmNotes: text("gm_notes").default(').notNull(),
	imageUrl: text("image_url").default(').notNull(),
	data: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "npcs_campaign_id_campaigns_id_fk"
		}),
	unique("npcs_campaign_id_id_unique").on(table.campaignId, table.id),
]);

export const locations = pgTable("locations", {
	rowId: uuid("row_id").defaultRandom().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	id: text().notNull(),
	name: text().default(').notNull(),
	category: text().default('Other').notNull(),
	visibility: text().default('gm-only').notNull(),
	summary: text().default(').notNull(),
	description: text().default(').notNull(),
	gmNotes: text("gm_notes").default(').notNull(),
	imageUrl: text("image_url").default(').notNull(),
	aliases: jsonb().notNull(),
	data: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.campaignId],
			foreignColumns: [campaigns.id],
			name: "locations_campaign_id_campaigns_id_fk"
		}),
	unique("locations_campaign_id_id_unique").on(table.campaignId, table.id),
]);
