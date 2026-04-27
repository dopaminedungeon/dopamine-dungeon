import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";

import { verifyAuthHeader } from "./_lib/auth";
import { db } from "./_lib/db";
import { users } from "../db/schema/users";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const decodedToken = await verifyAuthHeader(req.headers.authorization);

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email ?? null;

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    let user = existingUser[0];

    if (!user) {
      const insertedUsers = await db
        .insert(users)
        .values({
          firebaseUid,
          email,
        })
        .returning();

      user = insertedUsers[0];
    }

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unauthorized",
    });
  }
}