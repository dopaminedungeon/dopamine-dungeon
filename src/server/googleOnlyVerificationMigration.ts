import { createHash } from "node:crypto";

export const GOOGLE_ONLY_VERIFICATION_MANIFEST_VERSION = 1;

export type GoogleOnlyVerificationTarget = {
  target: "development" | "preview" | "production";
  firebaseProjectId: string;
  neonHost: string;
  neonDatabase: string;
};

export type FirebaseProvider = { providerId?: string | null };

export type FirebaseMigrationUser = {
  uid?: string | null;
  email?: string | null;
  disabled?: boolean;
  emailVerified?: boolean;
  providerData?: FirebaseProvider[];
};

export type NeonMigrationIdentity = {
  id: string;
  emailVerifiedAt: Date | null;
};

export type FirebaseMigrationAdmin = {
  listUsers: (maxResults?: number, pageToken?: string) => Promise<{
    users: FirebaseMigrationUser[];
    pageToken?: string;
  }>;
  getUser: (uid: string) => Promise<FirebaseMigrationUser>;
  updateUser: (uid: string, properties: { emailVerified: true }) => Promise<unknown>;
};

export type GoogleOnlyVerificationRepository = {
  findByFirebaseUid: (firebaseUid: string) => Promise<NeonMigrationIdentity[]>;
  setEmailVerifiedAtIfNull: (
    firebaseUid: string,
    at: Date
  ) => Promise<NeonMigrationIdentity[]>;
};

export type GoogleOnlyVerificationManifestEntry = {
  firebaseUid: string;
  neonUserId: string;
  emailFingerprint: string;
  firebaseEmailVerified: boolean;
  neonEmailVerifiedAt: string | null;
};

export type GoogleOnlyVerificationManifest = {
  version: typeof GOOGLE_ONLY_VERIFICATION_MANIFEST_VERSION;
  generatedAt: string;
  target: GoogleOnlyVerificationTarget;
  candidates: GoogleOnlyVerificationManifestEntry[];
};

export type MigrationSkipReason =
  | "disabled"
  | "missing-uid"
  | "missing-email"
  | "provider-conflict"
  | "missing-neon-identity"
  | "duplicate-neon-identity"
  | "state-changed";

export type MigrationResult =
  | {
      firebaseUid: string;
      status: "eligible";
      neonUserId: string;
      firebaseEmailVerified: boolean;
      neonEmailVerifiedAt: string | null;
      manifestEntry: GoogleOnlyVerificationManifestEntry;
    }
  | { firebaseUid: string | null; status: "skipped"; reason: MigrationSkipReason }
  | {
      firebaseUid: string;
      status: "completed" | "partial";
      firebaseUpdated: boolean;
      neonUpdated: boolean;
      neonUserId: string;
      reason?: "neon-write-failed";
    }
  | { firebaseUid: string; status: "failed"; reason: "firebase-update-failed" | "firebase-reread-failed" };

function normalizedEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

function hasExactGoogleOnlyProviderSet(user: FirebaseMigrationUser) {
  const providers = user.providerData ?? [];
  return providers.length === 1 && providers[0]?.providerId === "google.com";
}

function emailFingerprint(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

function toManifestEntry(
  firebaseUser: FirebaseMigrationUser,
  neonIdentity: NeonMigrationIdentity
): GoogleOnlyVerificationManifestEntry {
  const email = normalizedEmail(firebaseUser.email);
  return {
    firebaseUid: String(firebaseUser.uid),
    neonUserId: neonIdentity.id,
    emailFingerprint: emailFingerprint(email),
    firebaseEmailVerified: firebaseUser.emailVerified === true,
    neonEmailVerifiedAt: neonIdentity.emailVerifiedAt?.toISOString() ?? null,
  };
}

async function inspectUser(
  firebaseUser: FirebaseMigrationUser,
  repository: GoogleOnlyVerificationRepository
): Promise<MigrationResult> {
  const firebaseUid = String(firebaseUser.uid || "").trim() || null;
  if (!firebaseUid) return { firebaseUid: null, status: "skipped", reason: "missing-uid" };
  if (firebaseUser.disabled === true) {
    return { firebaseUid, status: "skipped", reason: "disabled" };
  }
  if (!normalizedEmail(firebaseUser.email)) {
    return { firebaseUid, status: "skipped", reason: "missing-email" };
  }
  if (!hasExactGoogleOnlyProviderSet(firebaseUser)) {
    return { firebaseUid, status: "skipped", reason: "provider-conflict" };
  }

  const identities = await repository.findByFirebaseUid(firebaseUid);
  if (identities.length === 0) {
    return { firebaseUid, status: "skipped", reason: "missing-neon-identity" };
  }
  if (identities.length !== 1 || !identities[0]?.id) {
    return { firebaseUid, status: "skipped", reason: "duplicate-neon-identity" };
  }

  const identity = identities[0];
  return {
    firebaseUid,
    status: "eligible",
    neonUserId: identity.id,
    firebaseEmailVerified: firebaseUser.emailVerified === true,
    neonEmailVerifiedAt: identity.emailVerifiedAt?.toISOString() ?? null,
    manifestEntry: toManifestEntry(firebaseUser, identity),
  };
}

export async function buildGoogleOnlyVerificationManifest(params: {
  firebaseAdmin: FirebaseMigrationAdmin;
  repository: GoogleOnlyVerificationRepository;
  target: GoogleOnlyVerificationTarget;
  now?: Date;
}) {
  const results: MigrationResult[] = [];
  let pageToken: string | undefined;
  do {
    const page = await params.firebaseAdmin.listUsers(undefined, pageToken);
    for (const firebaseUser of page.users) {
      results.push(await inspectUser(firebaseUser, params.repository));
    }
    pageToken = page.pageToken;
  } while (pageToken);

  const candidates = results
    .filter((result): result is Extract<MigrationResult, { status: "eligible" }> => result.status === "eligible")
    .map((result) => result.manifestEntry)
    .sort((left, right) => left.firebaseUid.localeCompare(right.firebaseUid));

  return {
    manifest: {
      version: GOOGLE_ONLY_VERIFICATION_MANIFEST_VERSION,
      generatedAt: (params.now ?? new Date()).toISOString(),
      target: params.target,
      candidates,
    } satisfies GoogleOnlyVerificationManifest,
    results,
  };
}

function matchesManifestEntry(
  entry: GoogleOnlyVerificationManifestEntry,
  current: Extract<MigrationResult, { status: "eligible" }>
) {
  // A successful earlier attempt may have advanced false -> true in Firebase
  // and/or NULL -> timestamp in Neon before a later retry. Those are the only
  // accepted state advances; every identity or precondition regression fails
  // closed instead of treating the frozen manifest as blind authority.
  const firebaseStateIsCompatible =
    current.firebaseEmailVerified === true || entry.firebaseEmailVerified === false;
  const neonStateIsCompatible =
    entry.neonEmailVerifiedAt === null ||
    current.neonEmailVerifiedAt === entry.neonEmailVerifiedAt;
  return (
    entry.firebaseUid === current.firebaseUid &&
    entry.neonUserId === current.neonUserId &&
    entry.emailFingerprint === current.manifestEntry.emailFingerprint &&
    firebaseStateIsCompatible &&
    neonStateIsCompatible
  );
}

/**
 * Applies exactly one frozen manifest entry. It deliberately does not scan
 * Firebase, select a Neon identity by email, or write anything other than the
 * Firebase verification flag and a null-only UID-keyed Neon timestamp.
 */
export async function applyGoogleOnlyVerificationEntry(params: {
  entry: GoogleOnlyVerificationManifestEntry;
  firebaseAdmin: FirebaseMigrationAdmin;
  repository: GoogleOnlyVerificationRepository;
  now?: Date;
}): Promise<MigrationResult> {
  let firebaseUser: FirebaseMigrationUser;
  try {
    firebaseUser = await params.firebaseAdmin.getUser(params.entry.firebaseUid);
  } catch {
    return { firebaseUid: params.entry.firebaseUid, status: "failed", reason: "firebase-reread-failed" };
  }

  const inspected = await inspectUser(firebaseUser, params.repository);
  if (inspected.status !== "eligible" || !matchesManifestEntry(params.entry, inspected)) {
    return { firebaseUid: params.entry.firebaseUid, status: "skipped", reason: "state-changed" };
  }

  let firebaseUpdated = false;
  if (!firebaseUser.emailVerified) {
    try {
      await params.firebaseAdmin.updateUser(params.entry.firebaseUid, { emailVerified: true });
      firebaseUpdated = true;
    } catch {
      return { firebaseUid: params.entry.firebaseUid, status: "failed", reason: "firebase-update-failed" };
    }
  }

  try {
    firebaseUser = await params.firebaseAdmin.getUser(params.entry.firebaseUid);
  } catch {
    return { firebaseUid: params.entry.firebaseUid, status: "failed", reason: "firebase-reread-failed" };
  }
  const postFirebase = await inspectUser(firebaseUser, params.repository);
  if (
    postFirebase.status !== "eligible" ||
    postFirebase.neonUserId !== params.entry.neonUserId ||
    postFirebase.manifestEntry.emailFingerprint !== params.entry.emailFingerprint ||
    firebaseUser.emailVerified !== true
  ) {
    return { firebaseUid: params.entry.firebaseUid, status: "skipped", reason: "state-changed" };
  }

  let neonUpdated = false;
  if (!postFirebase.neonEmailVerifiedAt) {
    try {
      const rows = await params.repository.setEmailVerifiedAtIfNull(
        params.entry.firebaseUid,
        params.now ?? new Date()
      );
      if (rows.length > 1 || (rows.length === 1 && (rows[0]?.id !== params.entry.neonUserId || !rows[0].emailVerifiedAt))) {
        return {
          firebaseUid: params.entry.firebaseUid,
          status: "partial",
          firebaseUpdated,
          neonUpdated: false,
          neonUserId: params.entry.neonUserId,
          reason: "neon-write-failed",
        };
      }
      // An empty null-guarded update can be a harmless concurrent completion.
      // The final exact-UID read below distinguishes that from an actual loss.
      neonUpdated = rows.length === 1;
    } catch {
      return {
        firebaseUid: params.entry.firebaseUid,
        status: "partial",
        firebaseUpdated,
        neonUpdated: false,
        neonUserId: params.entry.neonUserId,
        reason: "neon-write-failed",
      };
    }
  }

  const finalRows = await params.repository.findByFirebaseUid(params.entry.firebaseUid);
  if (
    finalRows.length !== 1 ||
    finalRows[0]?.id !== params.entry.neonUserId ||
    !finalRows[0]?.emailVerifiedAt
  ) {
    return {
      firebaseUid: params.entry.firebaseUid,
      status: "partial",
      firebaseUpdated,
      neonUpdated,
      neonUserId: params.entry.neonUserId,
      reason: "neon-write-failed",
    };
  }

  return {
    firebaseUid: params.entry.firebaseUid,
    status: "completed",
    firebaseUpdated,
    neonUpdated,
    neonUserId: params.entry.neonUserId,
  };
}

export function summarizeGoogleOnlyVerificationResults(results: MigrationResult[]) {
  const summary = {
    eligible: 0,
    completed: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
    firebaseUpdated: 0,
    neonUpdated: 0,
  };
  for (const result of results) {
    if (result.status === "eligible") summary.eligible += 1;
    if (result.status === "completed") summary.completed += 1;
    if (result.status === "partial") summary.partial += 1;
    if (result.status === "failed") summary.failed += 1;
    if (result.status === "skipped") summary.skipped += 1;
    if ("firebaseUpdated" in result && result.firebaseUpdated) summary.firebaseUpdated += 1;
    if ("neonUpdated" in result && result.neonUpdated) summary.neonUpdated += 1;
  }
  return summary;
}
