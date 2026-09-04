/**
 * #256 v0.6 Google-only verification migration.
 *
 * This is an operator-only program. It is intentionally not imported by an
 * API route and has no browser invocation path. `--apply` is disabled unless
 * an operator supplies a frozen, external manifest and explicit guards.
 */
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, isNull } from "drizzle-orm";

import { users } from "../db/schema/users.js";
import { adminAuth } from "../src/server/auth.js";
import { db } from "../src/server/db.js";
import {
  applyGoogleOnlyVerificationEntry,
  buildGoogleOnlyVerificationManifest,
  GOOGLE_ONLY_VERIFICATION_MANIFEST_VERSION,
  summarizeGoogleOnlyVerificationResults,
  type GoogleOnlyVerificationManifest,
  type GoogleOnlyVerificationRepository,
  type GoogleOnlyVerificationTarget,
} from "../src/server/googleOnlyVerificationMigration.js";

const APPLY_CONFIRMATION = "APPLY_GOOGLE_ONLY_VERIFICATION_V06";
const PRODUCTION_CONFIRMATION = "MIGRATE_PRODUCTION_GOOGLE_ONLY_VERIFICATION_V06";
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

type Arguments = {
  mode: "dry-run" | "apply";
  target: GoogleOnlyVerificationTarget["target"];
  firebaseProjectId: string;
  neonHost: string;
  neonDatabase: string;
  manifest?: string;
  manifestOut?: string;
  confirmApply?: string;
  confirmProduction?: string;
};

function requiredValue(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  if (index === -1 || !argv[index + 1] || argv[index + 1].startsWith("--")) {
    throw new Error(`${flag} is required`);
  }
  return argv[index + 1];
}

function optionalValue(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index + 1];
}

function parseArguments(argv: string[]): Arguments {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) throw new Error("Specify exactly one of --dry-run or --apply");

  const target = requiredValue(argv, "--target");
  if (!["development", "preview", "production"].includes(target)) {
    throw new Error("--target must be development, preview, or production");
  }

  const mode: Arguments["mode"] = dryRun ? "dry-run" : "apply";
  const arguments_: Arguments = {
    mode,
    target: target as Arguments["target"],
    firebaseProjectId: requiredValue(argv, "--firebase-project"),
    neonHost: requiredValue(argv, "--neon-host"),
    neonDatabase: requiredValue(argv, "--neon-database"),
    manifest: optionalValue(argv, "--manifest"),
    manifestOut: optionalValue(argv, "--manifest-out"),
    confirmApply: optionalValue(argv, "--confirm-apply"),
    confirmProduction: optionalValue(argv, "--confirm-production"),
  };

  if (arguments_.mode === "dry-run" && arguments_.manifest) {
    throw new Error("--manifest is only valid with --apply");
  }
  if (arguments_.mode === "apply") {
    if (!arguments_.manifest) throw new Error("--apply requires --manifest");
    if (arguments_.manifestOut) throw new Error("--manifest-out is only valid with --dry-run");
    if (arguments_.confirmApply !== APPLY_CONFIRMATION) {
      throw new Error(`--apply requires --confirm-apply ${APPLY_CONFIRMATION}`);
    }
    if (
      arguments_.target === "production" &&
      arguments_.confirmProduction !== PRODUCTION_CONFIRMATION
    ) {
      throw new Error(`Production apply requires --confirm-production ${PRODUCTION_CONFIRMATION}`);
    }
  }
  return arguments_;
}

function databaseMetadata(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function assertTarget(params: Arguments): GoogleOnlyVerificationTarget {
  const runtimeProjectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!runtimeProjectId || !databaseUrl) {
    throw new Error("Runtime FIREBASE_PROJECT_ID and DATABASE_URL are required for target proof");
  }
  const neon = databaseMetadata(databaseUrl);
  if (
    runtimeProjectId !== params.firebaseProjectId ||
    neon.host !== params.neonHost ||
    neon.database !== params.neonDatabase
  ) {
    throw new Error("Requested target does not match runtime Firebase/Neon metadata");
  }
  return {
    target: params.target,
    firebaseProjectId: runtimeProjectId,
    neonHost: neon.host,
    neonDatabase: neon.database,
  };
}

function assertExternalManifestPath(path: string) {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(process.cwd(), path);
  const pathFromRepository = relative(repositoryRoot, absolute);
  if (!pathFromRepository.startsWith("..") && !isAbsolute(pathFromRepository)) {
    throw new Error("Manifest paths must be outside the repository and must not be committed");
  }
  return absolute;
}

function sameTarget(left: GoogleOnlyVerificationTarget, right: GoogleOnlyVerificationTarget) {
  return (
    left.target === right.target &&
    left.firebaseProjectId === right.firebaseProjectId &&
    left.neonHost === right.neonHost &&
    left.neonDatabase === right.neonDatabase
  );
}

function parseManifest(contents: string): GoogleOnlyVerificationManifest {
  const manifest = JSON.parse(contents) as GoogleOnlyVerificationManifest;
  if (
    manifest?.version !== GOOGLE_ONLY_VERIFICATION_MANIFEST_VERSION ||
    !manifest.target ||
    !Array.isArray(manifest.candidates)
  ) {
    throw new Error("Manifest is malformed or uses an unsupported version");
  }
  const seenUids = new Set<string>();
  for (const entry of manifest.candidates) {
    if (
      !entry ||
      typeof entry.firebaseUid !== "string" ||
      !entry.firebaseUid ||
      typeof entry.neonUserId !== "string" ||
      !entry.neonUserId ||
      typeof entry.emailFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.emailFingerprint) ||
      typeof entry.firebaseEmailVerified !== "boolean" ||
      (entry.neonEmailVerifiedAt !== null && typeof entry.neonEmailVerifiedAt !== "string") ||
      seenUids.has(entry.firebaseUid)
    ) {
      throw new Error("Manifest contains malformed or duplicate candidate entries");
    }
    seenUids.add(entry.firebaseUid);
  }
  return manifest;
}

const repository: GoogleOnlyVerificationRepository = {
  async findByFirebaseUid(firebaseUid) {
    return db
      .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(2);
  },
  async setEmailVerifiedAtIfNull(firebaseUid, at) {
    return db
      .update(users)
      .set({ emailVerifiedAt: at })
      .where(and(eq(users.firebaseUid, firebaseUid), isNull(users.emailVerifiedAt)))
      .returning({ id: users.id, emailVerifiedAt: users.emailVerifiedAt });
  },
};

const arguments_ = parseArguments(process.argv.slice(2));
const target = assertTarget(arguments_);

console.log(JSON.stringify({
  tool: "google-only-verification-migration",
  mode: arguments_.mode,
  target,
  externalManifest: arguments_.mode === "apply" || Boolean(arguments_.manifestOut),
  browserReachable: false,
}, null, 2));

if (arguments_.mode === "dry-run") {
  const { manifest, results } = await buildGoogleOnlyVerificationManifest({
    firebaseAdmin: adminAuth,
    repository,
    target,
  });

  if (arguments_.manifestOut) {
    const manifestPath = assertExternalManifestPath(arguments_.manifestOut);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  }

  console.log(JSON.stringify({
    mode: "dry-run",
    target,
    summary: summarizeGoogleOnlyVerificationResults(results),
    results,
    manifestWritten: Boolean(arguments_.manifestOut),
  }, null, 2));
} else {
  const manifestPath = assertExternalManifestPath(arguments_.manifest!);
  const manifest = parseManifest(await readFile(manifestPath, "utf8"));
  if (!sameTarget(manifest.target, target)) {
    throw new Error("Manifest target does not match the proven runtime target");
  }

  const results = [];
  for (const entry of manifest.candidates) {
    results.push(await applyGoogleOnlyVerificationEntry({
      entry,
      firebaseAdmin: adminAuth,
      repository,
    }));
  }

  console.log(JSON.stringify({
    mode: "apply",
    target,
    summary: summarizeGoogleOnlyVerificationResults(results),
    results,
  }, null, 2));
}
