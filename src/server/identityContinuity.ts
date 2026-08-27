import { eq } from "drizzle-orm";

import { users } from "../../db/schema/users.js";
import type { db } from "./db.js";

type IdentityDatabase = Pick<typeof db, "select">;

export async function findExactIdentityContinuity(
  database: IdentityDatabase,
  firebaseUid: string
) {
  const normalizedUid = String(firebaseUid || "").trim();
  if (!normalizedUid) return null;

  const rows = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, normalizedUid))
    .limit(2);

  if (rows.length !== 1 || !rows[0]?.id) return null;
  return { neonUserId: rows[0].id };
}
