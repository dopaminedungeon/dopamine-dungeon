import type { VercelRequest, VercelResponse } from "@vercel/node";

import { setCorsHeaders } from "../../src/server/cors.js";
import { adminAuth, verifyAuthHeader } from "../../src/server/auth.js";
import { db } from "../../src/server/db.js";
import {
  findExactIdentityContinuity,
  findVerifiedIdentityContinuity,
} from "../../src/server/identityContinuity.js";

const unavailableResponse = {
  ok: false,
  error: "Account setup unavailable",
};

const GOOGLE_PROVIDER_ID = "google.com";
const PASSWORD_PROVIDER_ID = "password";

function hasProvider(user: { providerData?: Array<{ providerId?: string }> }, providerId: string) {
  return user.providerData?.some((provider) => provider.providerId === providerId) === true;
}

async function restoreVerifiedPasswordLink(req: VercelRequest, res: VercelResponse) {
  try {
    // `verifyAuthHeader` proves the caller supplied a still-valid *pre-link*
    // Firebase token whose email_verified claim is true. No UID, email, or
    // verification assertion is accepted from the request body.
    const decodedToken = await verifyAuthHeader(req.headers.authorization);
    const tokenEmail = typeof decodedToken.email === "string" ? decodedToken.email : "";
    if (!tokenEmail) return res.status(409).json(unavailableResponse);

    const firebaseUser = await adminAuth.getUser(decodedToken.uid);
    if (
      firebaseUser.uid !== decodedToken.uid ||
      firebaseUser.email !== tokenEmail ||
      !hasProvider(firebaseUser, GOOGLE_PROVIDER_ID) ||
      !hasProvider(firebaseUser, PASSWORD_PROVIDER_ID)
    ) {
      return res.status(409).json(unavailableResponse);
    }

    // This is an exact UID lookup plus a pre-existing historical verification
    // record. It never selects, creates, merges, or updates Neon identities.
    const continuity = await findVerifiedIdentityContinuity(db, decodedToken.uid);
    if (!continuity) return res.status(409).json(unavailableResponse);

    if (!firebaseUser.emailVerified) {
      await adminAuth.updateUser(decodedToken.uid, { emailVerified: true });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(409).json(unavailableResponse);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "POST") {
    return restoreVerifiedPasswordLink(req, res);
  }
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
