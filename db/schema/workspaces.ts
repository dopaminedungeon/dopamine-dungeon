import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    creationRequestKey: uuid("creation_request_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueOwnerCreationRequest: unique().on(
      table.ownerUserId,
      table.creationRequestKey
    ),
  })
);
