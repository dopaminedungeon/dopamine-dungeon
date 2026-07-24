import { relations } from "drizzle-orm/relations";
import { workspaces, invitations, campaigns, users, campaignMemberships, workspaceMemberships, sessions, characters, items, bagCurrency, bagEntries, entityLinks, lore, characterAssignments, npcs, locations } from "./schema";

export const invitationsRelations = relations(invitations, ({one}) => ({
	workspace: one(workspaces, {
		fields: [invitations.workspaceId],
		references: [workspaces.id]
	}),
	campaign: one(campaigns, {
		fields: [invitations.campaignId],
		references: [campaigns.id]
	}),
	user_invitedByUserId: one(users, {
		fields: [invitations.invitedByUserId],
		references: [users.id],
		relationName: "invitations_invitedByUserId_users_id"
	}),
	user_acceptedByUserId: one(users, {
		fields: [invitations.acceptedByUserId],
		references: [users.id],
		relationName: "invitations_acceptedByUserId_users_id"
	}),
}));

export const workspacesRelations = relations(workspaces, ({one, many}) => ({
	invitations: many(invitations),
	user: one(users, {
		fields: [workspaces.ownerUserId],
		references: [users.id]
	}),
	campaigns: many(campaigns),
	workspaceMemberships: many(workspaceMemberships),
}));

export const campaignsRelations = relations(campaigns, ({one, many}) => ({
	invitations: many(invitations),
	workspace: one(workspaces, {
		fields: [campaigns.workspaceId],
		references: [workspaces.id]
	}),
	campaignMemberships: many(campaignMemberships),
	sessions: many(sessions),
	characters: many(characters),
	items: many(items),
	bagCurrencies: many(bagCurrency),
	bagEntries: many(bagEntries),
	entityLinks: many(entityLinks),
	lores: many(lore),
	characterAssignments: many(characterAssignments),
	npcs: many(npcs),
	locations: many(locations),
}));

export const usersRelations = relations(users, ({many}) => ({
	invitations_invitedByUserId: many(invitations, {
		relationName: "invitations_invitedByUserId_users_id"
	}),
	invitations_acceptedByUserId: many(invitations, {
		relationName: "invitations_acceptedByUserId_users_id"
	}),
	workspaces: many(workspaces),
	campaignMemberships: many(campaignMemberships),
	workspaceMemberships: many(workspaceMemberships),
	characterAssignments_userId: many(characterAssignments, {
		relationName: "characterAssignments_userId_users_id"
	}),
	characterAssignments_createdByUserId: many(characterAssignments, {
		relationName: "characterAssignments_createdByUserId_users_id"
	}),
}));

export const campaignMembershipsRelations = relations(campaignMemberships, ({one}) => ({
	campaign: one(campaigns, {
		fields: [campaignMemberships.campaignId],
		references: [campaigns.id]
	}),
	user: one(users, {
		fields: [campaignMemberships.userId],
		references: [users.id]
	}),
}));

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({one}) => ({
	workspace: one(workspaces, {
		fields: [workspaceMemberships.workspaceId],
		references: [workspaces.id]
	}),
	user: one(users, {
		fields: [workspaceMemberships.userId],
		references: [users.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	campaign: one(campaigns, {
		fields: [sessions.campaignId],
		references: [campaigns.id]
	}),
}));

export const charactersRelations = relations(characters, ({one}) => ({
	campaign: one(campaigns, {
		fields: [characters.campaignId],
		references: [campaigns.id]
	}),
}));

export const itemsRelations = relations(items, ({one}) => ({
	campaign: one(campaigns, {
		fields: [items.campaignId],
		references: [campaigns.id]
	}),
}));

export const bagCurrencyRelations = relations(bagCurrency, ({one}) => ({
	campaign: one(campaigns, {
		fields: [bagCurrency.campaignId],
		references: [campaigns.id]
	}),
}));

export const bagEntriesRelations = relations(bagEntries, ({one}) => ({
	campaign: one(campaigns, {
		fields: [bagEntries.campaignId],
		references: [campaigns.id]
	}),
}));

export const entityLinksRelations = relations(entityLinks, ({one}) => ({
	campaign: one(campaigns, {
		fields: [entityLinks.campaignId],
		references: [campaigns.id]
	}),
}));

export const loreRelations = relations(lore, ({one}) => ({
	campaign: one(campaigns, {
		fields: [lore.campaignId],
		references: [campaigns.id]
	}),
}));

export const characterAssignmentsRelations = relations(characterAssignments, ({one}) => ({
	campaign: one(campaigns, {
		fields: [characterAssignments.campaignId],
		references: [campaigns.id]
	}),
	user_userId: one(users, {
		fields: [characterAssignments.userId],
		references: [users.id],
		relationName: "characterAssignments_userId_users_id"
	}),
	user_createdByUserId: one(users, {
		fields: [characterAssignments.createdByUserId],
		references: [users.id],
		relationName: "characterAssignments_createdByUserId_users_id"
	}),
}));

export const npcsRelations = relations(npcs, ({one}) => ({
	campaign: one(campaigns, {
		fields: [npcs.campaignId],
		references: [campaigns.id]
	}),
}));

export const locationsRelations = relations(locations, ({one}) => ({
	campaign: one(campaigns, {
		fields: [locations.campaignId],
		references: [campaigns.id]
	}),
}));