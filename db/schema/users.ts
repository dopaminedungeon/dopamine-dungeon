import { boolean, pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email"),
  displayName: text("display_name"),
  reducedMotion: boolean("reduced_motion").default(false).notNull(),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
