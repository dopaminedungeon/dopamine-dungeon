---
name: dd-architecture-guardian
description: Review, plan, or implement Dopamine Dungeon changes that may affect application architecture, persistence, authentication/authorization, workspace or campaign boundaries, environment behavior, migrations, or cross-layer data flow. Use for DD architectural decisions and implementation reviews. Do not use for unrelated projects or pure copy/content work.
---

# Dopamine Dungeon Architecture Guardian

Protect Dopamine Dungeon's current architecture from accidental drift while allowing deliberate architectural change.

## Core rule

The repository is the source of truth. This skill provides a review procedure and known invariants, but **must not override newer accepted ADRs, current code, or authoritative repository documentation**.

## Before making an architectural judgment

1. Read repository-level agent instructions (`AGENTS.md` or equivalent) if present.
2. Locate the authoritative current-state architecture documentation and relevant ADRs.
3. Inspect the implementation paths affected by the requested change.
4. Identify environment scope (Development / Preview / Production) when it matters.
5. Compare the proposed change against current boundaries and invariants.

If sources disagree, report the disagreement and prefer the newest accepted authoritative repository source. Do not silently choose stale bundled knowledge.

## Review dimensions

Evaluate only the dimensions relevant to the task:

- **Persistence ownership** — which service/database owns each data class?
- **Layer boundary** — browser/UI vs API/server vs database/external provider.
- **Tenant boundary** — workspace/campaign scoping and ownership.
- **Authorization** — who may read/write what, and where enforcement happens.
- **Authentication** — identity source vs application authorization.
- **Atomicity/idempotency** — creation/mutation behavior and retry safety.
- **Environment safety** — Development, Preview and Production differences.
- **Migration compatibility** — schema/data migrations, rollback, historical data retirement.
- **Operational dependencies** — email, storage, rate-limit state, scheduled/triggered services.
- **Documentation impact** — ADR/current-state/diagrams/permissions docs that must change.

## Decision categories

Return one of:

- `PASS` — compatible with current architecture.
- `PASS WITH CONCERNS` — compatible, but has non-blocking architectural risk or follow-up.
- `BLOCK` — conflicts with an established boundary/invariant or lacks a required migration/authorization safeguard.
- `ARCHITECTURAL DECISION REQUIRED` — a legitimate change is being proposed, but it must be made explicitly and documented rather than smuggled in as implementation detail.
- `INSUFFICIENT EVIDENCE` — repository evidence is missing or contradictory.

## Output contract

For reviews, use:

```md
## DD Architecture Review

**Verdict:** PASS | PASS WITH CONCERNS | BLOCK | ARCHITECTURAL DECISION REQUIRED | INSUFFICIENT EVIDENCE

### Evidence checked
- ...

### Compatible
- ...

### Findings
1. **[severity] [boundary]** — finding
   - Evidence: file/ADR/path
   - Impact: ...
   - Required action: ...

### Documentation / migration impact
- ...

### Recommendation
...
```

Do not manufacture findings to fill sections. Omit empty sections.

## Change behavior

When asked to implement rather than review:

1. Establish architecture first.
2. Make the smallest coherent change that preserves boundaries.
3. Do not introduce a new datastore, direct browser persistence path, permission model, service dependency, or environment assumption without explicit architectural justification.
4. Follow existing migration and testing conventions.
5. Update architecture documentation when the change materially changes system behavior.

## Safety rails

- Never infer authorization from UI visibility alone.
- Never treat client-provided workspace/campaign identifiers as sufficient authorization.
- Never bypass an established API boundary merely because direct access is easier.
- Never perform a Production migration/cutover just because Development behavior is correct.
- Never silently rewrite architecture to make an implementation convenient.

## Coordination with the Design Decision Keeper

- Evaluate whether a proposed product decision is architecturally compatible;
  do not silently approve a change merely because the product decision is clear.
- If the verdict is `ARCHITECTURAL DECISION REQUIRED`, identify the trade-off and
  the accepted-ADR path. Treat the architecture decision as pending until it is
  explicitly approved. Do not allow the Keeper to record it as approved prematurely.
- Once an architectural decision is accepted, keep the relevant ADR and
  architecture documentation authoritative. The Keeper may align product
  requirements and existing issues with that accepted decision.
- For pure UX wording, mockups, or issue-maintenance tasks without architectural
  impact, leave ownership with the Keeper; do not expand a narrow design task
  into a mandatory architecture review.

## Optional supporting references

If present alongside this skill, read `references/architecture-principles.md`
and `references/review-checklist.md` when relevant. They were not included in the
migration input: do not assume they exist or invent their contents. Repository
code, accepted ADRs, and current architecture docs remain authoritative.
