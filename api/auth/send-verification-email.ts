import type { VercelRequest, VercelResponse } from "@vercel/node";

import { setCorsHeaders } from "../../src/server/cors.js";
import { adminAuth, adminDb, verifyFirebaseToken } from "../../src/server/auth.js";
import {
  buildVerificationEmailHtml,
  VERIFICATION_EMAIL_SUBJECT,
} from "../../src/domain/mail/verificationEmail.template.js";
import {
  buildAppVerificationLink,
  getApplicationOrigin,
  getVerificationEmailCooldownMs,
} from "../../src/server/verificationEmail.js";
import {
  getApiErrorMessage,
  getApiErrorStatus,
} from "../../src/server/apiErrors.js";

function mailbox(name: string, email: string) {
  return `${name.trim()} <${email.trim()}>`;
}

const from = mailbox(
  process.env.VERIFICATION_EMAIL_FROM_NAME ||
    process.env.INVITE_EMAIL_FROM_NAME ||
    "Dopamine Dungeon",
  process.env.VERIFICATION_EMAIL_FROM ||
    process.env.INVITE_EMAIL_FROM ||
    "invite@dopamine-dungeon.com"
);
const replyTo = mailbox(
  process.env.VERIFICATION_EMAIL_REPLY_TO_NAME ||
    process.env.INVITE_EMAIL_REPLY_TO_NAME ||
    "Dopamine Dungeon",
  process.env.VERIFICATION_EMAIL_REPLY_TO ||
    process.env.INVITE_EMAIL_REPLY_TO ||
    "dopamine.dungeon.info@gmail.com"
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const decodedToken = await verifyFirebaseToken(req.headers.authorization);
    const email = decodedToken.email;

    if (!email) {
      return res.status(400).json({ ok: false, error: "Verification email unavailable" });
    }

    if (decodedToken.email_verified === true) {
      return res.status(409).json({ ok: false, error: "Email is already verified" });
    }

    const cooldownRef = adminDb
      .collection("_authVerificationCooldowns")
      .doc(decodedToken.uid);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(cooldownRef);
      const lastSentAt = snapshot.get("lastSentAt")?.toMillis?.() ?? 0;

      if (getVerificationEmailCooldownMs(lastSentAt) > 0) {
        const rateLimitError = new Error("Verification email cooldown active") as Error & {
          code: string;
        };
        rateLimitError.code = "auth/too-many-requests";
        throw rateLimitError;
      }

      transaction.set(cooldownRef, { lastSentAt: new Date() });
    });

    const applicationOrigin = getApplicationOrigin(req);
    const firebaseLink = await adminAuth.generateEmailVerificationLink(email);
    const verificationLink = buildAppVerificationLink({
      firebaseLink,
      applicationOrigin,
      invited: req.body?.invited === true,
    });

    await adminDb.collection("mail").add({
      to: [email],
      from,
      replyTo,
      message: {
        subject: VERIFICATION_EMAIL_SUBJECT,
        html: buildVerificationEmailHtml({ verificationLink }),
      },
    });

    return res.status(202).json({ ok: true });
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/too-many-requests") {
      return res.status(429).json({
        ok: false,
        error: "Please wait before requesting another verification email.",
      });
    }
    const status = getApiErrorStatus(error);
    if (status === 500) {
      console.error("[api/auth/send-verification-email] Request failed", error);
    }
    return res.status(status).json({ ok: false, error: getApiErrorMessage(error) });
  }
}
