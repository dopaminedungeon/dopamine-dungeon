import { users } from "../../db/schema/users.js";
import { buildUserIdentityUpsert } from "./userIdentityQuery.js";

type Database = typeof import("./db.js").db;

export type UserIdentity = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

export async function provisionUserIdentity(
  database: Database,
  identity: UserIdentity
) {
  const provisionedUsers: Array<typeof users.$inferSelect> =
    await buildUserIdentityUpsert(database, users, identity);
  const user = provisionedUsers[0];

  if (!user) {
    throw new Error("User identity provisioning returned no user");
  }

  return user;
}
