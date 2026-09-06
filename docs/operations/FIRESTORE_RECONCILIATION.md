# Firestore Inventory And Reconciliation

This runbook supports the remaining operational and historical-data work in
[#298](https://github.com/dopaminedungeon/dopamine-dungeon/issues/298). It is
an inventory and reconciliation reporter, **not** a data migration tool.

## Safety contract

`scripts/firestore-reconciliation.ts` has no apply mode. It opens Firestore
only through read/list operations and opens Neon only for `SELECT` queries when
`reconcile` is requested. It does not create, update, delete, batch, or
transaction-write documents or database rows.

The command requires all of the following, so it cannot select a project from
an implicit default:

- `--target development|preview|production`;
- a matching target confirmation flag;
- `--firebase-project`, which must equal `FIREBASE_PROJECT_ID` from the selected
  source;
- exactly one configuration source: `--env-file <path>` or
  `--env-source process`;
- server credentials and (for `reconcile`) `DATABASE_URL` from that same
  selected source.

Production additionally requires the literal
`--confirm-production READ_PRODUCTION_FIRESTORE`. That flag is deliberately
not authority to run the command: explicit operator approval and a reviewed
Production run window remain required.

The tool prints only safe preflight metadata before connecting: target, project
ID, source (`file` or `process`), optional env-file basename, requested modes,
and (for reconciliation) Neon hostname and database name. It never prints
credential values. Process mode allowlists only the required variables in
memory and never writes them to disk or serializes `process.env`.

Preview may use Vercel's injected process environment. The tool never falls
back to `.env.local` or inherited credentials, and it rejects both or neither
source selections.

## Temporary Production audit path (retired)

The one-time #298 Production baseline was captured through a temporary,
GET-only `productionReadOnlyAudit` resource in the existing
`api/worldbuilding` function. It required a verified Firebase ID token with
the temporary `productionAudit` claim and validated the Production Firebase
project and Neon target before performing Firestore reads and PostgreSQL
`SELECT` queries.

The sanitized evidence was captured and the temporary claim was removed. The
route, implementation module, and dedicated tests have now been removed from
the release source. Future audits must use a newly reviewed, explicitly
approved mechanism; this resource is no longer available.

## Vercel Preview process mode

Use process mode when Vercel injects Preview variables so encrypted values never
need to be pulled into a plaintext file:

```sh
vercel env run -e preview -- pnpm exec tsx scripts/firestore-reconciliation.ts \
  --target preview \
  --confirm-preview preview \
  --mode inventory,reconcile,limiter-export \
  --env-source process \
  --firebase-project <PREVIEW_FIREBASE_PROJECT_ID>
```

The process source is explicit and exclusive. Preflight validates the supplied
project against `FIREBASE_PROJECT_ID` and reports only safe Neon URL metadata.

## Modes and output

`--mode` accepts a comma-separated combination of:

- `inventory` — known and discovered top-level collections plus campaign
  subcollections, structural counts, field types, timestamp/reference markers,
  and collection-level disposition;
- `reconcile` — compares Firestore identifiers with read-only Neon snapshots;
- `limiter-export` — emits the active 24-hour limiter horizon for the later,
  separately approved Production import.

Each execution writes private operational evidence under:

```text
reports/firestore-reconciliation/<target>/<UTC timestamp>/
```

That directory is Git-ignored. It contains:

- `inventory.json` — counts, fields/types, and collection disposition;
- `reconciliation.json` — every evaluated record with one primary disposition
  and independent secondary findings, plus non-overlapping aggregate totals;
- `unresolved.json` — only records whose primary disposition is
  `NEEDS_RECONCILIATION` or `UNRESOLVED`, not harmless legacy/archive notices;
- `limiter-export.json` — only when requested;
- `manifest.json` — target/project, timestamps, counts, hashes, mode, and
  sanitization declaration;
- `summary.md` — concise human-readable results.

The ordinary reports use opaque SHA-256 document references rather than raw
document IDs. They do not include document values, mail bodies, action links,
invitation tokens, plaintext email/IP values, GM narrative, or recovery
fingerprints. `limiter-export.json` is the one deliberate exception: it keeps
opaque Firebase UID/HMAC subject keys and timestamps because a future approved
Production importer needs those values. It still never contains plaintext email
or IP values and must remain access-controlled and uncommitted.

## Controlled Development command

Do not run this until the operator authorizes a read-only Development Firebase
and Neon read. From the repository root, the expected command is:

```sh
pnpm exec tsx scripts/firestore-reconciliation.ts \
  --target development \
  --confirm-development development \
  --mode inventory,reconcile,limiter-export \
  --env-file .env.local \
  --firebase-project dopamine-dungeon-c8c77
```

The explicit project value is a guard, not a credential. Stop if preflight
metadata does not identify the intended Development project. Preview and
Production require their own explicitly supplied environment file and approval;
the tool never falls back to `.env.local` or inherited credentials.

## What is covered

Known top-level paths are `users`, `tenants`, `tenantMembers`, `campaigns`,
`campaignMembers`, `invitations`, `characterAssignments`, `mail`, and the three
former auth-email limiter collections. For every campaign found, the tool lists
its actual subcollections and covers known `characters`, `sessions`, `items`,
`meta/bag`, `npcs`, `locations`, and `lore` paths. Other top-level or campaign
subcollections are reported as unresolved rather than ignored.

The reconciliation uses Firebase UID only for user identity. Email is never a
join key. Deterministic entity IDs are required; invitation mapping uses an
exact Firestore document ID or explicit non-email `id` field, and refuses an
email-only or ambiguous match. It reports missing Neon counterparts,
role/scope mismatch, orphaned records, legacy CSV invitation character IDs,
workspace-only invitations, legacy-only fields, retired campaign fields, and
unexpected paths. It never fixes them. A canonical record may therefore carry
secondary retirement or archive findings without being downgraded from
`CANONICAL_IN_NEON`.

## Production limiter export

The limiter export is deterministic: it sorts `scope`, opaque `subjectKey`,
timestamp, and source collection before calculating a SHA-256 checksum. It
reads only valid timestamps in the final 24 hours from:

- `_authVerificationCooldowns` → `verification`;
- `_authPasswordRecoveryCooldowns` → `recovery_email`;
- `_authPasswordRecoveryIpCooldowns` → `recovery_ip`.

Malformed source documents are listed by opaque reference and make the later
Production import/reconciliation gate fail closed. This tool does not import
anything. A future importer must be retry-safe, reconcile exact subject and
attempt timestamp counts, and run only during the approved fail-closed
Production cutover window.

## Configuration archive checklist

The repository can identify only local emulator metadata in `firebase.json`,
`.firebaserc`, and documented variable names. It has no committed effective
Firestore rules, indexes, TTL policies, or Trigger Email extension settings.
For each environment, archive the following through approved Firebase Console
or CLI read-only access before any rules or extension change:

1. effective Firestore security rules and deployment/version metadata;
2. composite and field index definitions;
3. TTL policies;
4. Trigger Email extension instance, event collection/filter, parameter names,
   service account, and secret references (never secret values);
5. Firebase project identifiers and region metadata;
6. collection counts, the sanitized report manifest, and representative shape
   evidence.

Store those exports in the approved access-controlled operational archive, not
in this repository if they include sensitive configuration or identifiers.

## Existing migration scripts

The existing scripts remain historical input and are not invoked by this tool:

- `migrate-firebase.ts` reads users, tenants, memberships, and campaigns but
  writes immediately and lacks the required unified reconciliation report;
- `migrate-characters.ts`, `migrate-sessions.ts`, `migrate-items.ts`, and
  `migrate-bag.ts` have useful per-domain dry-run/apply normalization, but need
  target pinning, exception manifests, and end-to-end reconciliation before a
  Production apply.

Do not use any existing `--apply` script for a cutover until that separate
hardening and review work is complete.
