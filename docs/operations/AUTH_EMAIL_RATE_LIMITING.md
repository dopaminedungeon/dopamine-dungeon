# Authentication Email Rate Limiting

Last updated: 2026-08-28

## Policy

Authentication email limits use rolling windows evaluated against one logical
request timestamp. Defaults are configured through the server-only variables in
`ENVIRONMENT.md`.

| Flow and key | Minimum interval | Rolling hour | Rolling 24 hours |
|---|---:|---:|---:|
| Verification, Firebase UID | 60 seconds | 3 | 5 |
| Recovery, email HMAC fingerprint | 60 seconds | 3 | 5 |
| Recovery, source-IP HMAC fingerprint | none | 20 | 50 |

Recovery email and IP subjects are locked and evaluated in one Neon/PostgreSQL
transaction. The reservation is all-or-none: if either target rejects the
request, neither receives a new attempt. Subject locks are acquired in stable
scope/key order, so concurrent requests cannot over-reserve either target.
Rejected volume remains measurable through sanitized metrics without consuming
an unrelated limiter.

## Privacy And Trust

Limiter rows contain a scope, a Firebase UID (verification only) or HMAC
subject key (recovery only), attempt timestamps, and expiry metadata. They
never contain raw recovery email or IP addresses, action links, action codes,
passwords, Firebase errors, provider details, or DD account data.

Recovery email and source IP use separate HMAC domains with the same required,
environment-specific `PASSWORD_RECOVERY_FINGERPRINT_SECRET`. Hosted Preview and
Production functions accept only one canonical IPv4 or IPv6 value from
`x-vercel-forwarded-for`. They reject missing, malformed, array, and proxy-chain
values and do not fall back to `x-forwarded-for` or `x-real-ip`. Local and test
runtimes use the direct socket address only when `VERCEL_ENV` is neither
`preview` nor `production`.

Direct Brevo delivery is outside limiter persistence. Do not add recipient or
action-link values to rate records, monitoring, or logs.

## Retention and cleanup

Application logic drops timestamps at rolling-window boundaries immediately.
Physical deletion is asynchronous and must not be used to decide whether a
request is allowed.

The limiter transaction ignores and prunes attempts outside the 24-hour rolling
authorization horizon for subjects it touches. `expires_at` is retained on both
subject and attempt rows for later physical housekeeping. A row is eligible for
physical cleanup only when its stored `expires_at` is strictly earlier than the
maintenance transaction's PostgreSQL `transaction_timestamp()`. Rows at the
exact boundary, and all future-expiring rows, are retained. This does not
shorten the 48-hour default record TTL or change a rate-limit threshold.

Maintainers run the operator-only command against an approved environment with
its `DATABASE_URL` supplied out of band. It has no HTTP route, browser control,
or application role. It defaults to a count-only dry run:

```sh
pnpm auth-email-rate-limit:housekeep -- --batch-size 100
```

Deletion requires an explicit flag and remains capped at 500 expired subjects
per transaction:

```sh
pnpm auth-email-rate-limit:housekeep -- --apply --batch-size 100
```

The command selects expired parent subjects in expiry/ID order with `FOR UPDATE
SKIP LOCKED`, deletes their attempt rows, then deletes only those locked parent
rows in one transaction. Concurrent reservations either hold the parent lock so
cleanup skips it, or safely reserve a replacement after cleanup commits. Repeat
the bounded command until `moreEligible` is false. Output contains aggregate
counts and safe limiter scopes only; never capture subject keys, Firebase UIDs,
HMACs, emails, IPs, database URLs, or raw database errors.

Repository maintainers own this task. Run a dry run at least daily and an
approved apply run at the same cadence when backlog is present. Monitor the
exit status, `eligibleSubjectCount`, `deletedSubjectCount`, and `moreEligible`;
retry a failed run only after correcting the operator environment. The operation
is idempotent: a retry processes only remaining expired rows. Automated
scheduling is intentionally disabled: this repository has no protected
environment-scoped database-secret workflow for cleanup. Before adding one,
maintainers must approve the environment, secret ownership, cadence, overlap
protection, and dry-run/apply separation.

To disable housekeeping, stop invoking `--apply` or disable a future protected
operator workflow. No application rollback is needed because authorization
never consults physical cleanup. Restoring this code stops future deletion;
already deleted expired limiter rows are intentionally not reconstructed and do
not represent active rate-limit state.

## Monitoring

Vercel logs receive only `[auth-email-metric]` events with `flow` and `outcome`:

- flows: `verification`, `recovery`;
- outcomes: `request`, `delivery_accepted`, `throttled`, `delivery_failure`,
  `limiter_failure`.

Configure an alert for 50 recovery `request` events in one hour. Alert payloads
must contain only the aggregate count, flow, outcome, environment, and time
window. Do not include limiter keys, Firebase UIDs, emails, IPs, request bodies,
or error objects.

`delivery_accepted` means the direct Brevo transport accepted the send request.
It does not prove mailbox delivery. Monitor Firebase action-link quota, Brevo
accepted/rejected delivery, and sender reputation without exporting message
secrets.

Review thresholds after representative usage exists. Compare request,
throttled, delivery-accepted, and delivery-failure aggregates before changing a
value. Apply the same reviewed values independently to Preview and Production;
do not lower controls to resolve an unrelated delivery outage.

## Secret Rotation

Rotate `PASSWORD_RECOVERY_FINGERPRINT_SECRET` independently per environment.
Rotation changes both email and IP subject keys, so active limiter continuity
starts again under the new secret while old non-reversible rows expire. Schedule
rotation during a monitored low-traffic window and retain the same policy
thresholds. Never print the old or new secret or attempt to migrate limiter
records by recovering their source values.

## Rollback

Set `AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED=false` to disable hourly, daily,
and source-IP policies while retaining the 60-second verification and recovery
email cooldowns. Do not delete limiter records. Rollback must not mutate
Firebase or DD users, credentials, memberships, campaigns, workspaces, or
invitation behavior.

## Production cutover gate

Production has real users and must not start fresh by default. Immediately
before production cutover, export the complete active 24-hour Firestore horizon,
including opaque verification UID keys, recovery-email HMAC keys (including the
legacy form where present), recovery-IP HMAC keys, and attempt timestamps.
Import only those opaque values into Neon, reconcile subject/attempt counts and
timestamps, and hold a controlled fail-closed window between the final snapshot
and Neon becoming authoritative. Retain Firestore records temporarily for
rollback/reconciliation, but do not dual-read or dual-write after cutover.

### #375 Production evidence disposition (reviewed 2026-10-12)

The Production limiter export, import, exact subject/attempt count and
timestamp reconciliation, and fail-closed authority handoff are **unverified**.
PR #365 explicitly deferred these actions and PR #372 records them as release
gates; no Production export/import manifest or sanitized result was available
in the repository or reviewed PR text. Local Development limiter exports do
not establish Production state. The private #373 audit report was not available
here. Do not infer limiter completion from schema presence, code tests, or
audit capture, and do not rerun a potentially completed export/import to create
a new record.

The requester confirms they are the sole prospective release operator; no
personal name is recorded here. They must reconcile any existing private
evidence first. The tentative maintenance target is around 2027-01-12, for
planning only; it is not approval or a scheduled window. The exact date/time
and rollback-retention period remain undecided.

If the evidence proves an import, retain its opaque internal reference,
checksum, horizon bounds, aggregate subject/attempt counts, timestamp
comparison, and fail-closed window result. Do not put Firebase UIDs, HMAC
subject keys, row-level timestamps, manifests, or export files in this
repository. If no valid prior import is evidenced, schedule only after explicit
target approval, a complete final active 24-hour snapshot, a reviewed
retry-safe importer, exact post-import reconciliation, and an approved
rollback/retention window. Record provider acceptance separately from inbox
receipt; `delivery_accepted` alone is not inbox-delivery evidence. Current
status and next steps are tracked in the [#375 gate
ledger](../architecture/FIRESTORE_TO_NEON_MIGRATION.md#375-production-evidence-ledger-reviewed-2026-10-12).
