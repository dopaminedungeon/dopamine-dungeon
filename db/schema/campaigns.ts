import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { users } from "./users.js";

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  creationRequestKey: uuid("creation_request_key"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  system: text("system").default("").notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueWorkspaceCreatorCreationRequest: unique().on(
    table.workspaceId,
    table.createdByUserId,
    table.creationRequestKey
  ),
}));
