import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  buildVerificationEmailHtml,
  VERIFICATION_EMAIL_SUBJECT,
} from "../domain/mail/verificationEmail.template.js";
import {
  getAuthEmailRateLimitConfig,
  getRetryAfterSeconds,
  logAuthEmailMetric,
  reserveAuthEmailRateLimits,
  type AuthEmailRateLimitDatabase,
} from "./authEmailRateLimit.js";
import { getApiErrorMessage, getApiErrorStatus } from "./apiErrors.js";
import { getAuthEmailDelivery } from "./authEmail.js";
import { setCorsHeaders } from "./cors.js";
import { sendTransactionalEmail } from "./transactionalMail.js";

const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
export const VERIFICATION_EMAIL_COOLDOWN_MS = 60_000;

export function getVerificationEmailCooldownMs(lastSentAtMs: number, nowMs = Date.now()) {
  return Math.max(0, lastSentAtMs + VERIFICATION_EMAIL_COOLDOWN_MS - nowMs);
}

export function getApplicationOrigin(req: VercelRequest) {
  const configured = process.env.APP_ORIGIN || process.env.VITE_APP_ORIGIN;
  if (configured) return new URL(configured).origin;

  const hostHeader = Array.isArray(req.headers.host)
    ? req.headers.host[0]
    : req.headers.host;
  const host = String(hostHeader || "").trim();

  if (!host) throw new Error("Application origin is not configured");

  return `${LOCAL_HOST_PATTERN.test(host) ? "http" : "https"}://${host}`;
}

export function buildAppVerificationLink(params: {
  firebaseLink: string;
  applicationOrigin: string;
  invited: boolean;
}) {
  const firebaseUrl = new URL(params.firebaseLink);
  const oobCode = firebaseUrl.searchParams.get("oobCode");

  if (!oobCode) throw new Error("Firebase verification link omitted its action code");

  const appUrl = new URL("/auth/verify-email", params.applicationOrigin);
  appUrl.searchParams.set("mode", "verifyEmail");
  appUrl.searchParams.set("oobCode", oobCode);
  if (params.invited) appUrl.searchParams.set("invited", "true");
  return appUrl.toString();
}

type VerificationEmailDependencies = {
  verifyToken(authorization?: string): Promise<{
    uid: string;
    email?: string;
    email_verified?: boolean;
  }>;
  auth: {
    generateEmailVerificationLink(email: string): Promise<string>;
  };
  db: AuthEmailRateLimitDatabase;
  environment?: Record<string, string | undefined>;
  now?: () => number;
  metric?: typeof logAuthEmailMetric;
  sendMail?: typeof sendTransactionalEmail;
};

export function createVerificationEmailHandler(
  dependencies: VerificationEmailDependencies
) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    const recordMetric = dependencies.metric ?? logAuthEmailMetric;
    let limiterCompleted = false;
    let metricStarted = false;

    function metric(outcome: Parameters<typeof logAuthEmailMetric>[1]) {
      try {
        recordMetric("verification", outcome);
      } catch {
        // Monitoring must not alter authentication behavior.
      }
    }

    setCorsHeaders(res, "POST, OPTIONS");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    try {
      const decodedToken = await dependencies.verifyToken(
        req.headers.authorization
      );
      const email = decodedToken.email;

      if (!email) {
        return res.status(400).json({
          ok: false,
          error: "Verification email unavailable",
        });
      }
      if (decodedToken.email_verified === true) {
        return res.status(409).json({
          ok: false,
          error: "Email is already verified",
        });
      }

      metricStarted = true;
      metric("request");
      const config = getAuthEmailRateLimitConfig(dependencies.environment);
      const logicalRequestTime = dependencies.now?.() ?? Date.now();
      const limiterRef = dependencies.db
        .collection("_authVerificationCooldowns")
        .doc(decodedToken.uid);
      const reservation = await reserveAuthEmailRateLimits(
        dependencies.db,
        [
          {
            key: "verification",
            ref: limiterRef,
            policy: config.verification,
          },
        ],
        logicalRequestTime
      );
      limiterCompleted = true;

      if (!reservation.allowed) {
        const retryAfter = getRetryAfterSeconds(
          reservation.decisions.verification.retryAfterMs
        );
        metric("throttled");
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
          ok: false,
          error: "Please wait before requesting another verification email.",
          retryAfterSeconds: retryAfter,
        });
      }

      const applicationOrigin = getApplicationOrigin(req);
      const firebaseLink = await dependencies.auth.generateEmailVerificationLink(
        email
      );
      const verificationLink = buildAppVerificationLink({
        firebaseLink,
        applicationOrigin,
        invited: req.body?.invited === true,
      });
      const { from, replyTo } = getAuthEmailDelivery();

      await (dependencies.sendMail ?? sendTransactionalEmail)({
        to: email,
        from,
        replyTo,
        subject: VERIFICATION_EMAIL_SUBJECT,
        html: buildVerificationEmailHtml({ verificationLink }),
      });

      metric("delivery_accepted");
      return res.status(202).json({ ok: true });
    } catch (error) {
      if (metricStarted) {
        metric(limiterCompleted ? "delivery_failure" : "limiter_failure");
      }
      const status = getApiErrorStatus(error);
      if (status === 500) {
        console.error("[api/auth/send-verification-email] Request failed");
      }
      return res.status(status).json({
        ok: false,
        error: getApiErrorMessage(error),
      });
    }
  };
}
