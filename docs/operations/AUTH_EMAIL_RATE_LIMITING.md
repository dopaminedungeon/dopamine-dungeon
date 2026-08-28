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

Recovery email and IP records are read and evaluated in one Firestore
transaction. The reservation is all-or-none: if either target rejects the
request, neither record receives a new timestamp. Rejected volume remains
measurable through sanitized metrics without consuming an unrelated limiter.

## Privacy And Trust

Limiter documents contain only HMAC document IDs where required, request
timestamps, `lastSentAt`, and `expiresAt`. They never contain raw email or IP
addresses, action links, action codes, passwords, Firebase errors, provider
details, or DD account data.

Recovery email and source IP use separate HMAC domains with the same required,
environment-specific `PASSWORD_RECOVERY_FINGERPRINT_SECRET`. Hosted Preview and
Production functions accept only one canonical IPv4 or IPv6 value from
`x-vercel-forwarded-for`. They reject missing, malformed, array, and proxy-chain
values and do not fall back to `x-forwarded-for` or `x-real-ip`. Local and test
runtimes use the direct socket address only when `VERCEL_ENV` is neither
`preview` nor `production`.

The Firestore Trigger Email `mail` collection is the existing delivery queue
and is outside limiter persistence. Do not add recipient or action-link values
to rate records, monitoring, or logs.

## Firestore TTL

Application logic drops timestamps at rolling-window boundaries immediately.
Physical deletion is asynchronous and must not be used to decide whether a
request is allowed.

Enable a TTL policy on `lastSentAt` with an expiration offset matching
`AUTH_EMAIL_RATE_LIMIT_TTL_HOURS`, initially `48h`, for each environment and
collection group:

```sh
gcloud firestore fields ttls update lastSentAt --collection-group=_authVerificationCooldowns --enable-ttl --expiration-offset=48h --project=<firebase-project-id>
gcloud firestore fields ttls update lastSentAt --collection-group=_authPasswordRecoveryCooldowns --enable-ttl --expiration-offset=48h --project=<firebase-project-id>
gcloud firestore fields ttls update lastSentAt --collection-group=_authPasswordRecoveryIpCooldowns --enable-ttl --expiration-offset=48h --project=<firebase-project-id>
```

Using `lastSentAt` also ages out cooldown documents created before #332. Verify
each policy is Active in the target non-production project before Preview QA,
then repeat the reviewed setup separately for production during an authorized
release. Never infer TTL activation from repository code or deployment status.

## Monitoring

Vercel logs receive only `[auth-email-metric]` events with `flow` and `outcome`:

- flows: `verification`, `recovery`;
- outcomes: `request`, `delivery_accepted`, `throttled`, `delivery_failure`,
  `limiter_failure`.

Configure an alert for 50 recovery `request` events in one hour. Alert payloads
must contain only the aggregate count, flow, outcome, environment, and time
window. Do not include limiter keys, Firebase UIDs, emails, IPs, request bodies,
or error objects.

`delivery_accepted` means the Trigger Email queue accepted the document. It does
not prove Brevo/SMTP delivery. Monitor Firebase action-link quota, Trigger Email
extension failures, Brevo/SMTP accepted and rejected delivery, and sender
reputation in their respective consoles without exporting message secrets.

Review thresholds after representative usage exists. Compare request,
throttled, queue-accepted, and delivery-failure aggregates before changing a
value. Apply the same reviewed values independently to Preview and Production;
do not lower controls to resolve an unrelated delivery outage.

## Secret Rotation

Rotate `PASSWORD_RECOVERY_FINGERPRINT_SECRET` independently per environment.
Rotation changes both email and IP document IDs, so active limiter continuity
starts again under the new secret while old non-reversible records age out via
TTL. Schedule rotation during a monitored low-traffic window and retain the
same policy thresholds. Never print the old or new secret or attempt to migrate
limiter records by recovering their source values.

## Rollback

Set `AUTH_EMAIL_EXTENDED_RATE_LIMITS_ENABLED=false` to disable hourly, daily,
and source-IP policies while retaining the 60-second verification and recovery
email cooldowns. Do not delete limiter records; let TTL remove them. Rollback
must not mutate Firebase or DD users, credentials, memberships, campaigns,
workspaces, or invitation behavior.
