import { createHmac, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  buildPasswordRecoveryEmailHtml,
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
} from "../domain/mail/passwordRecoveryEmail.template.js";
import { getAuthEmailDelivery } from "./authEmail.js";
import { setCorsHeaders } from "./cors.js";
import { getApplicationOrigin } from "./verificationEmail.js";

export const PASSWORD_RECOVERY_COOLDOWN_MS = 60_000;
export const PASSWORD_RECOVERY_MIN_RESPONSE_MS = 500;
export const PASSWORD_RECOVERY_ACCEPTED_RESPONSE = { ok: true } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NON_IDENTIFYING_FIREBASE_CODES = new Set([
  "auth/email-not-found",
  "auth/invalid-email",
  "auth/user-disabled",
  "auth/user-not-found",
]);

type FirebaseUser = {
  disabled?: boolean;
  emailVerified?: boolean;
  providerData?: Array<{ providerId?: string }>;
};

type PasswordRecoveryDependencies = {
  auth: {
    getUserByEmail(email: string): Promise<FirebaseUser>;
    generatePasswordResetLink(email: string): Promise<string>;
  };
  db: {
    collection(name: string): {
      doc(id: string): unknown;
      add(data: unknown): Promise<unknown>;
    };
    runTransaction<T>(callback: (transaction: {
      get(ref: unknown): Promise<{ get(field: string): unknown }>;
      set(ref: unknown, data: unknown): void;
      delete(ref: unknown): void;
    }) => Promise<T>): Promise<T>;
  };
  fingerprintSecret: string;
  minimumResponseMs: number;
};

function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

export function buildAppPasswordResetLink(params: {
  firebaseLink: string;
  applicationOrigin: string;
}) {
  const firebaseUrl = new URL(params.firebaseLink);
  const oobCode = firebaseUrl.searchParams.get("oobCode");

  if (!oobCode) throw new Error("Firebase password reset link omitted its action code");

  const appUrl = new URL("/auth/reset-password", params.applicationOrigin);
  appUrl.searchParams.set("mode", "resetPassword");
  appUrl.searchParams.set("oobCode", oobCode);
  const languageCode = firebaseUrl.searchParams.get("lang");
  if (languageCode) appUrl.searchParams.set("lang", languageCode);
  return appUrl.toString();
}

export function getPasswordRecoveryCooldownMs(
  lastSentAtMs: number,
  nowMs = Date.now()
) {
  return Math.max(0, lastSentAtMs + PASSWORD_RECOVERY_COOLDOWN_MS - nowMs);
}

export function getPasswordRecoveryFingerprint(email: string, secret: string) {
  if (!secret.trim()) {
    throw new Error("Password recovery fingerprint secret is not configured");
  }
  return createHmac("sha256", secret).update(email).digest("hex");
}

export function isNonIdentifyingPasswordRecoveryError(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && NON_IDENTIFYING_FIREBASE_CODES.has(code);
}

async function reserveCooldown(
  db: PasswordRecoveryDependencies["db"],
  email: string,
  fingerprintSecret: string
) {
  const ref = db
    .collection("_authPasswordRecoveryCooldowns")
    .doc(getPasswordRecoveryFingerprint(email, fingerprintSecret));
  const requestId = randomUUID();
  const reserved = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const storedValue = snapshot.get("lastSentAt") as
      | { toMillis?: () => number }
      | undefined;
    const lastSentAt = storedValue?.toMillis?.() ?? 0;

    if (getPasswordRecoveryCooldownMs(lastSentAt) > 0) return false;

    transaction.set(ref, { lastSentAt: new Date(), requestId });
    return true;
  });

  return { ref, requestId, reserved };
}

async function releaseFailedCooldown(
  db: PasswordRecoveryDependencies["db"],
  ref: unknown,
  requestId: string
) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.get("requestId") === requestId) transaction.delete(ref);
  });
}

export function createPasswordRecoveryEmailHandler(
  dependencies: PasswordRecoveryDependencies
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    const requestStartedAt = Date.now();
    async function acceptedResponse() {
      const remainingDelay = Math.max(
        0,
        dependencies.minimumResponseMs - (Date.now() - requestStartedAt)
      );
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }
      return res.status(202).json(PASSWORD_RECOVERY_ACCEPTED_RESPONSE);
    }

    setCorsHeaders(res, "POST, OPTIONS");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const email = normalizeEmail(req.body?.email);
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ ok: false, error: "Enter a valid email address." });
    }

    let cooldown:
      | { ref: unknown; requestId: string; reserved: boolean }
      | undefined;
    let eligibleAccount = false;

    try {
      cooldown = await reserveCooldown(
        dependencies.db,
        email,
        dependencies.fingerprintSecret
      );
      if (!cooldown.reserved) {
        return acceptedResponse();
      }

      const user = await dependencies.auth.getUserByEmail(email);
      const hasPasswordProvider = user.providerData?.some(
        (provider) => provider.providerId === "password"
      );

      if (user.disabled || !user.emailVerified || !hasPasswordProvider) {
        return acceptedResponse();
      }
      eligibleAccount = true;

      const firebaseLink = await dependencies.auth.generatePasswordResetLink(email);
      const passwordResetLink = buildAppPasswordResetLink({
        firebaseLink,
        applicationOrigin: getApplicationOrigin(req),
      });
      const { from, replyTo } = getAuthEmailDelivery();

      await dependencies.db.collection("mail").add({
        to: [email],
        from,
        replyTo,
        message: {
          subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
          html: buildPasswordRecoveryEmailHtml({ passwordResetLink }),
        },
      });

      return acceptedResponse();
    } catch (error) {
      if (isNonIdentifyingPasswordRecoveryError(error)) {
        return acceptedResponse();
      }

      if (eligibleAccount) {
        console.error("[api/auth/send-password-reset-email] Delivery failed");
        return acceptedResponse();
      }

      if (cooldown?.reserved) {
        try {
          await releaseFailedCooldown(
            dependencies.db,
            cooldown.ref,
            cooldown.requestId
          );
        } catch {
          // Preserve the original system-wide failure response.
        }
      }

      console.error("[api/auth/send-password-reset-email] Request failed");
      return res.status(503).json({
        ok: false,
        error: "Password recovery is temporarily unavailable. Please try again.",
      });
    }
  };
}
