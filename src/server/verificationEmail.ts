import type { VercelRequest } from "@vercel/node";

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
