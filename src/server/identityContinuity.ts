import { and, eq, isNotNull } from "drizzle-orm";

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

/**
 * Finds only a UID-keyed Neon identity that has already observed a verified
 * Firebase email. The timestamp remains historical reconciliation evidence;
 * this helper never writes or derives identity from an email address.
 */
export async function findVerifiedIdentityContinuity(
  database: IdentityDatabase,
  firebaseUid: string
) {
  const normalizedUid = String(firebaseUid || "").trim();
  if (!normalizedUid) return null;

  const rows = await database
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.firebaseUid, normalizedUid),
        isNotNull(users.emailVerifiedAt)
      )
    )
    .limit(2);

  if (rows.length !== 1 || !rows[0]?.id) return null;
  return { neonUserId: rows[0].id };
}
