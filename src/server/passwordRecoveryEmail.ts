import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  buildPasswordRecoveryEmailHtml,
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
} from "../domain/mail/passwordRecoveryEmail.template.js";
import {
  getAuthEmailRateLimitConfig,
  getLegacyRecoveryEmailFingerprint,
  getRecoveryEmailFingerprint,
  getRecoveryIpFingerprint,
  getRetryAfterSeconds,
  getTrustedClientIp,
  logAuthEmailMetric,
  reserveAuthEmailRateLimits,
  type AuthEmailRateLimitDatabase,
  type AuthEmailRateLimitTarget,
} from "./authEmailRateLimit.js";
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
  db: AuthEmailRateLimitDatabase;
  fingerprintSecret: string;
  minimumResponseMs: number;
  environment?: Record<string, string | undefined>;
  now?: () => number;
  metric?: typeof logAuthEmailMetric;
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
  return getRecoveryEmailFingerprint(email, secret);
}

export function isNonIdentifyingPasswordRecoveryError(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && NON_IDENTIFYING_FIREBASE_CODES.has(code);
}

export function createPasswordRecoveryEmailHandler(
  dependencies: PasswordRecoveryDependencies
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    const requestStartedAt = Date.now();
    const recordMetric = dependencies.metric ?? logAuthEmailMetric;

    function metric(outcome: Parameters<typeof logAuthEmailMetric>[1]) {
      try {
        recordMetric("recovery", outcome);
      } catch {
        // Monitoring must not alter authentication behavior.
      }
    }

    async function delayedResponse(
      status: number,
      body: unknown,
      retryAfter?: number
    ) {
      const remainingDelay = Math.max(
        0,
        dependencies.minimumResponseMs - (Date.now() - requestStartedAt)
      );
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay));
      }
      if (retryAfter !== undefined) {
        res.setHeader("Retry-After", String(retryAfter));
      }
      return res.status(status).json(body);
    }

    function acceptedResponse() {
      return delayedResponse(202, PASSWORD_RECOVERY_ACCEPTED_RESPONSE);
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

    metric("request");
    let eligibleAccount = false;
    let limiterCompleted = false;

    try {
      const config = getAuthEmailRateLimitConfig(dependencies.environment);
      const logicalRequestTime = dependencies.now?.() ?? Date.now();
      const emailFingerprint = getRecoveryEmailFingerprint(
        email,
        dependencies.fingerprintSecret
      );
      const legacyEmailFingerprint = getLegacyRecoveryEmailFingerprint(
        email,
        dependencies.fingerprintSecret
      );
      const emailRef = dependencies.db
        .collection("_authPasswordRecoveryCooldowns")
        .doc(emailFingerprint);
      const legacyEmailRef = dependencies.db
        .collection("_authPasswordRecoveryCooldowns")
        .doc(legacyEmailFingerprint);
      const targets: AuthEmailRateLimitTarget[] = [
        {
          key: "email",
          ref: emailRef,
          legacyRef: legacyEmailRef,
          policy: config.recoveryEmail,
        },
      ];
      if (config.extendedLimitsEnabled) {
        const clientIp = getTrustedClientIp(req, dependencies.environment);
        const ipFingerprint = getRecoveryIpFingerprint(
          clientIp,
          dependencies.fingerprintSecret
        );
        targets.push({
          key: "ip",
          ref: dependencies.db
            .collection("_authPasswordRecoveryIpCooldowns")
            .doc(ipFingerprint),
          policy: config.recoveryIp,
        });
      }
      const reservation = await reserveAuthEmailRateLimits(
        dependencies.db,
        targets,
        logicalRequestTime
      );
      limiterCompleted = true;

      if (!reservation.allowed) {
        metric("throttled");
        if (reservation.decisions.ip?.allowed === false) {
          const retryAfter = getRetryAfterSeconds(
            reservation.decisions.ip.retryAfterMs
          );
          return delayedResponse(
            429,
            {
              ok: false,
              error: "Too many password recovery requests. Please try again later.",
            },
            retryAfter
          );
        }
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

      const mailCollection = dependencies.db.collection("mail");
      if (!mailCollection.add) throw new Error("Mail delivery is unavailable");
      await mailCollection.add({
        to: [email],
        from,
        replyTo,
        message: {
          subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
          html: buildPasswordRecoveryEmailHtml({ passwordResetLink }),
        },
      });

      metric("delivery_accepted");
      return acceptedResponse();
    } catch (error) {
      if (isNonIdentifyingPasswordRecoveryError(error)) {
        return acceptedResponse();
      }

      if (eligibleAccount) {
        metric("delivery_failure");
        console.error("[api/auth/send-password-reset-email] Delivery failed");
        return acceptedResponse();
      }

      metric(limiterCompleted ? "delivery_failure" : "limiter_failure");
      console.error("[api/auth/send-password-reset-email] Request failed");
      return delayedResponse(503, {
        ok: false,
        error: "Password recovery is temporarily unavailable. Please try again.",
      });
    }
  };
}
