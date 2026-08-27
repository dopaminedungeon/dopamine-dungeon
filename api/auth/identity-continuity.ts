import type { VercelRequest, VercelResponse } from "@vercel/node";

import { setCorsHeaders } from "../../src/server/cors.js";
import { verifyAuthHeader } from "../../src/server/auth.js";
import { db } from "../../src/server/db.js";
import { findExactIdentityContinuity } from "../../src/server/identityContinuity.js";

const unavailableResponse = {
  ok: false,
  error: "Account setup unavailable",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyAuthHeader(req.headers.authorization);
    if (decodedToken.email_verified !== true) {
      return res.status(409).json(unavailableResponse);
    }
    const continuity = await findExactIdentityContinuity(db, decodedToken.uid);

    if (!continuity) return res.status(409).json(unavailableResponse);
    return res.status(200).json({ ok: true, ...continuity });
  } catch {
    return res.status(409).json(unavailableResponse);
  }
}
