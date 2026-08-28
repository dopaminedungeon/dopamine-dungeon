import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { VercelRequest } from "@vercel/node";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_RECORD_TTL_MS = 48 * HOUR_MS;
const RECOVERY_EMAIL_HMAC_DOMAIN =
  "dopamine-dungeon:auth-email-rate-limit:recovery-email:v1";
const RECOVERY_IP_HMAC_DOMAIN =
  "dopamine-dungeon:auth-email-rate-limit:recovery-ip:v1";

type Environment = Record<string, string | undefined>;

export type AuthEmailRateLimitPolicy = {
  minimumIntervalMs: number;
  hourlyLimit: number;
  dailyLimit: number;
  recordTtlMs: number;
};

export type AuthEmailRateLimitConfig = {
  extendedLimitsEnabled: boolean;
  verification: AuthEmailRateLimitPolicy;
  recoveryEmail: AuthEmailRateLimitPolicy;
  recoveryIp: AuthEmailRateLimitPolicy;
};

type RateLimitSnapshot = {
  get(field: string): unknown;
};

type RateLimitTransaction = {
  get(ref: unknown): Promise<RateLimitSnapshot>;
  set(ref: unknown, data: unknown): void;
};

export type AuthEmailRateLimitDatabase = {
  collection(name: string): {
    doc(id: string): unknown;
    add?(data: unknown): Promise<unknown>;
  };
  runTransaction<T>(
    callback: (transaction: RateLimitTransaction) => Promise<T>
  ): Promise<T>;
};

export type AuthEmailRateLimitTarget = {
  key: string;
  ref: unknown;
  policy: AuthEmailRateLimitPolicy;
  legacyRef?: unknown;
};

export type AuthEmailRateLimitDecision = {
  allowed: boolean;
  retryAfterMs: number;
  activeTimestamps: number[];
};

export type AuthEmailRateLimitReservation = {
  allowed: boolean;
  decisions: Record<string, AuthEmailRateLimitDecision>;
};

function readPositiveInteger(
  environment: Environment,
  name: string,
  fallback: number
) {
  const configured = environment[name];
  if (configured === undefined || configured === "") return fallback;
  if (!/^\d+$/.test(configured) || Number(configured) <= 0) {
    throw new Error(`Invalid authentication email rate-limit setting: ${name}`);
  }
  return Number(configured);
}

function readBoolean(environment: Environment, name: string, fallback: boolean) {
  const configured = environment[name];
  if (configured === undefined || configured === "") return fallback;
  if (configured === "true") return true;
  if (configured === "false") return false;
  throw new Error(`Invalid authentication email rate-limit setting: ${name}`);
}

export function getAuthEmailRateLimitConfig(
  environment: Environment = process.env
): AuthEmailRateLimitConfig {
  const extendedLimitsEnabled = readBoolean(
    environment,
    "AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED",
    true
  );
  const recordTtlMs =
    readPositiveInteger(environment, "AUTH_EMAIL_RATE_LIMIT_TTL_HOURS", 48) *
    HOUR_MS;

  return {
    extendedLimitsEnabled,
    verification: {
      minimumIntervalMs:
        readPositiveInteger(
          environment,
          "AUTH_EMAIL_VERIFICATION_MIN_INTERVAL_SECONDS",
          60
        ) * 1000,
      hourlyLimit: extendedLimitsEnabled
        ? readPositiveInteger(
            environment,
            "AUTH_EMAIL_VERIFICATION_HOURLY_LIMIT",
            3
          )
        : Number.MAX_SAFE_INTEGER,
      dailyLimit: extendedLimitsEnabled
        ? readPositiveInteger(
            environment,
            "AUTH_EMAIL_VERIFICATION_DAILY_LIMIT",
            5
          )
        : Number.MAX_SAFE_INTEGER,
      recordTtlMs,
    },
    recoveryEmail: {
      minimumIntervalMs:
        readPositiveInteger(
          environment,
          "AUTH_EMAIL_RECOVERY_MIN_INTERVAL_SECONDS",
          60
        ) * 1000,
      hourlyLimit: extendedLimitsEnabled
        ? readPositiveInteger(
            environment,
            "AUTH_EMAIL_RECOVERY_HOURLY_LIMIT",
            3
          )
        : Number.MAX_SAFE_INTEGER,
      dailyLimit: extendedLimitsEnabled
        ? readPositiveInteger(
            environment,
            "AUTH_EMAIL_RECOVERY_DAILY_LIMIT",
            5
          )
        : Number.MAX_SAFE_INTEGER,
      recordTtlMs,
    },
    recoveryIp: {
      minimumIntervalMs: 0,
      hourlyLimit: extendedLimitsEnabled
        ? readPositiveInteger(
            environment,
            "AUTH_EMAIL_RECOVERY_IP_HOURLY_LIMIT",
            20
          )
        : Number.MAX_SAFE_INTEGER,
      dailyLimit: extendedLimitsEnabled
        ? readPositiveInteger(
            environment,
            "AUTH_EMAIL_RECOVERY_IP_DAILY_LIMIT",
            50
          )
        : Number.MAX_SAFE_INTEGER,
      recordTtlMs,
    },
  };
}

function getHmacFingerprint(value: string, secret: string, domain: string) {
  if (!secret.trim()) {
    throw new Error("Authentication email fingerprint secret is not configured");
  }

  return createHmac("sha256", secret)
    .update(domain)
    .update("\0")
    .update(value)
    .digest("hex");
}

export function getRecoveryEmailFingerprint(email: string, secret: string) {
  return getHmacFingerprint(email, secret, RECOVERY_EMAIL_HMAC_DOMAIN);
}

export function getRecoveryIpFingerprint(ipAddress: string, secret: string) {
  return getHmacFingerprint(ipAddress, secret, RECOVERY_IP_HMAC_DOMAIN);
}

export function getLegacyRecoveryEmailFingerprint(email: string, secret: string) {
  if (!secret.trim()) {
    throw new Error("Authentication email fingerprint secret is not configured");
  }
  return createHmac("sha256", secret).update(email).digest("hex");
}

export function canonicalizeIpAddress(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Trusted client IP is unavailable");
  }

  const candidate = value.trim();
  if (!candidate || candidate.includes(",")) {
    throw new Error("Trusted client IP is invalid");
  }

  const version = isIP(candidate);
  if (version === 4) return candidate;
  if (version === 6) {
    return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
  }

  throw new Error("Trusted client IP is invalid");
}

function readSingleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? undefined : value;
}

export function getTrustedClientIp(
  req: VercelRequest,
  environment: Environment = process.env
) {
  const isHostedVercel =
    environment.VERCEL_ENV === "preview" ||
    environment.VERCEL_ENV === "production";

  if (isHostedVercel) {
    return canonicalizeIpAddress(
      readSingleHeader(req.headers["x-vercel-forwarded-for"])
    );
  }

  return canonicalizeIpAddress(req.socket?.remoteAddress);
}

function timestampToMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis(): number }).toMillis();
  }
  throw new Error("Authentication email rate-limit record is malformed");
}

function readStoredTimestamps(snapshot: RateLimitSnapshot) {
  const attemptsValue = snapshot.get("attempts");
  const attempts = attemptsValue === undefined ? [] : attemptsValue;
  if (!Array.isArray(attempts)) {
    throw new Error("Authentication email rate-limit record is malformed");
  }

  const timestamps = attempts.map(timestampToMillis);
  const lastSentAt = snapshot.get("lastSentAt");
  if (attemptsValue === undefined && lastSentAt !== undefined) {
    timestamps.push(timestampToMillis(lastSentAt));
  }
  return {
    hasRollingRecord: attemptsValue !== undefined,
    timestamps: timestamps.sort((left, right) => left - right),
  };
}

export function evaluateAuthEmailRateLimit(
  timestamps: number[],
  policy: AuthEmailRateLimitPolicy,
  nowMs: number
): AuthEmailRateLimitDecision {
  const activeTimestamps = timestamps
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > nowMs - DAY_MS)
    .sort((left, right) => left - right);
  const hourlyTimestamps = activeTimestamps.filter(
    (timestamp) => timestamp > nowMs - HOUR_MS
  );
  const waits: number[] = [];
  const latestTimestamp = activeTimestamps[activeTimestamps.length - 1];

  if (latestTimestamp !== undefined && policy.minimumIntervalMs > 0) {
    waits.push(latestTimestamp + policy.minimumIntervalMs - nowMs);
  }
  if (hourlyTimestamps.length >= policy.hourlyLimit) {
    waits.push(
      hourlyTimestamps[hourlyTimestamps.length - policy.hourlyLimit] +
        HOUR_MS -
        nowMs
    );
  }
  if (activeTimestamps.length >= policy.dailyLimit) {
    waits.push(
      activeTimestamps[activeTimestamps.length - policy.dailyLimit] + DAY_MS - nowMs
    );
  }

  const retryAfterMs = Math.max(0, ...waits);
  return {
    allowed: retryAfterMs === 0,
    retryAfterMs,
    activeTimestamps,
  };
}

export async function reserveAuthEmailRateLimits(
  db: AuthEmailRateLimitDatabase,
  targets: AuthEmailRateLimitTarget[],
  nowMs: number
): Promise<AuthEmailRateLimitReservation> {
  if (targets.length === 0 || new Set(targets.map((target) => target.key)).size !== targets.length) {
    throw new Error("Authentication email rate-limit targets are invalid");
  }

  return db.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(
      targets.map(async (target) => ({
        target,
        current: await transaction.get(target.ref),
        legacy: target.legacyRef
          ? await transaction.get(target.legacyRef)
          : undefined,
      }))
    );
    const decisions: Record<string, AuthEmailRateLimitDecision> = {};

    for (const { target, current, legacy } of snapshots) {
      const currentRecord = readStoredTimestamps(current);
      const timestamps = currentRecord.hasRollingRecord
        ? currentRecord.timestamps
        : [
            ...currentRecord.timestamps,
            ...(legacy ? readStoredTimestamps(legacy).timestamps : []),
          ];
      decisions[target.key] = evaluateAuthEmailRateLimit(
        timestamps,
        target.policy,
        nowMs
      );
    }

    const allowed = Object.values(decisions).every((decision) => decision.allowed);
    // Multi-key requests reserve every target or none of them.
    if (!allowed) return { allowed: false, decisions };

    for (const target of targets) {
      transaction.set(target.ref, {
        attempts: [
          ...decisions[target.key].activeTimestamps.map(
            (timestamp) => new Date(timestamp)
          ),
          new Date(nowMs),
        ],
        lastSentAt: new Date(nowMs),
        expiresAt: new Date(nowMs + target.policy.recordTtlMs),
      });
    }

    return { allowed: true, decisions };
  });
}

export function getRetryAfterSeconds(retryAfterMs: number) {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

export function logAuthEmailMetric(
  flow: "verification" | "recovery",
  outcome: "request" | "delivery_accepted" | "throttled" | "delivery_failure" | "limiter_failure"
) {
  console.info("[auth-email-metric]", { flow, outcome });
}

export const AUTH_EMAIL_RATE_LIMIT_DEFAULT_RECORD_TTL_MS = DEFAULT_RECORD_TTL_MS;
