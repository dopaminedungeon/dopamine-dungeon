# Dopamine Dungeon Documentation Reconciliation Rubric

You are auditing Dopamine Dungeon documentation against the current repository state.

## Goal

Identify documentation that is stale, contradictory, duplicated, misleading, or describing planned behavior as current behavior.

Do not optimize for documentation completeness.
Only flag documentation discrepancies that materially affect understanding of the product, architecture, security, development workflow, deployment, or maintenance.

## Source precedence

When sources disagree, use this precedence:

1. Current executable or configured behavior
2. Current source code, schemas, workflows, and configuration
3. Accepted ADRs
4. Canonical current-state documentation
5. Roadmap and planning documentation
6. Historical issues and pull requests

If intent is unclear, report the discrepancy instead of guessing.

## Dopamine Dungeon priorities

Pay particular attention to:

- GM/player visibility boundaries
- tenant and campaign isolation
- authentication and invitations
- persistence and database architecture
- entity relationships
- CI and testing
- release and branch strategy
- deployment and environment architecture
- secrets and external services

## Rules

- Do not recommend documentation merely because more documentation could exist.
- Prefer updating canonical documents over creating new documents.
- Prefer linking over duplication.
- Do not recommend deleting, moving, or superseding documents; recommend only
  updating an existing supported document, human verification, or
  implementation review.
- Never describe proposed behavior as current behavior.
- Do not suggest product or code changes unless a documentation discrepancy exposes an actual implementation risk.
- Do not modify application code.
- Keep findings concise.
- Report every material discrepancy found.

## Verification rules

Every finding must distinguish between:

- what the documentation explicitly claims;
- what the supplied repository evidence explicitly proves;
- what is an inference.

Do not treat the existence of a file, component, route, schema, or function as proof that a feature is active, enabled, complete, or production behavior.

Do not treat an authorization capability as equivalent to selected user mode.
For example, permission to act as GM and currently operating in GM mode are separate concepts unless the supplied evidence explicitly proves otherwise.

Selected mode may reduce a permitted user's returned data or active surface,
but it must never grant capability that the user's role does not provide. The
existence of a mode header or viewer-mode helper is not by itself an
authorization defect. Report IMPLEMENTATION_RISK only when supplied evidence
indicates that GM capability is granted without an independent role or
membership check.

Do not classify two documents as unnecessary duplication merely because they cover the same subject.
Different representations may be intentional, such as:
- authoritative table vs visual graph;
- system overview vs implementation detail;
- current-state document vs architectural rationale.

Only recommend consolidation when the documents make substantially redundant claims and the duplication creates a real maintenance or interpretation risk.

Use HIGH confidence only when the supplied evidence directly demonstrates the discrepancy.

Use MEDIUM when the evidence strongly suggests a discrepancy but intent or runtime behavior cannot be proven.

Use LOW when the finding depends materially on inference.

Never present a LOW-confidence inference as a required documentation change.

If implementation intent cannot be established from the supplied evidence, recommend human verification instead of rewriting documentation.

## Documentation drift vs implementation defects

Do not assume that repository behavior should always replace documented behavior.

For security, access control, tenant isolation, campaign isolation, GM/player visibility, authentication, persistence integrity, and other architectural invariants:

- If documentation describes an explicit required invariant and repository evidence appears to violate it, classify the finding as a possible implementation defect.
- Do not recommend weakening or changing the documentation merely to match insecure or unintended implementation behavior.
- Recommend human verification of the implementation.
- Only recommend changing documentation when the supplied evidence clearly establishes that the documented invariant itself is obsolete or intentionally superseded.

Use this classification:

Finding type: DOCUMENTATION_DRIFT | IMPLEMENTATION_RISK | UNVERIFIED

DOCUMENTATION_DRIFT:
The implementation/configuration clearly represents the intended current state and the documentation is stale.

IMPLEMENTATION_RISK:
The documentation describes an intended invariant or accepted architecture, but repository evidence appears not to satisfy it.

UNVERIFIED:
The supplied evidence is insufficient to determine whether documentation or implementation is wrong.

For IMPLEMENTATION_RISK findings:
- Do not prescribe a documentation change.
- State which invariant may be violated.
- Recommend human verification or implementation review.

Do not confuse frontend route protection with server-side authorization.
Client-side route guards protect navigation and UX.
Server-side authorization protects data and mutations.
Evaluate them separately.

## Finding eligibility

Only report a finding when there is a material discrepancy, implementation risk, or genuinely unresolved conflict.

An implementation detail that a document simply omits is not a finding unless
the document claims authority or completeness for that subject, or the
omission materially makes an existing claim misleading. Likewise, a supplied
file that does not contain a control, route, or function does not prove that
the product lacks it; do not treat "not found in this file" as evidence of
absence.

Do not report confirmations as findings.

If documentation and repository evidence agree:
- omit the item from the report;
- do not classify it as DOCUMENTATION_DRIFT;
- do not recommend "No action required."

DOCUMENTATION_DRIFT means:
- the documentation makes a materially stale, incorrect, or misleading claim;
- supplied repository evidence directly demonstrates the current intended implementation differs.

IMPLEMENTATION_RISK means:
- documentation defines an intended invariant or accepted architecture;
- supplied repository evidence indicates the implementation may violate it.

UNVERIFIED means:
- the supplied evidence cannot establish whether the documentation is correct.

For UNVERIFIED findings:
- do not recommend changing documentation;
- use "Human verification required."

Do not recommend adding documentation merely because implementation contains more detail than the documentation.
Absence of exhaustive implementation detail is not documentation drift.

Only recommend additional documentation when the missing information materially affects:
- security;
- architecture;
- deployment;
- development workflow;
- maintenance;
- understanding of current product behavior.

A document does not need to describe every implemented function, screen, endpoint, or workflow.

## Document scope and non-goals

Do not interpret a document's non-goals or out-of-scope sections as claims that the corresponding product behavior does not exist.

Examples:

- "Invitation UX details are out of scope" means this document does not specify invitation UX.
- It does not mean invitation UX is absent from the product.

- A permissions document does not need to describe implementation details of authentication.
- A user-flow document does not need to describe storage, headers, database queries, or internal state management unless those details materially affect the user flow.
- An architecture overview does not need to exhaustively document every component or helper function.

Before reporting DOCUMENTATION_DRIFT because implementation contains behavior not mentioned in a document, determine whether that document is actually responsible for documenting that behavior.

Only report missing documentation when:
1. the document explicitly claims to be authoritative for that subject; or
2. the omission materially makes the existing documentation misleading.

Do not treat omission alone as contradiction.

## Code interpretation discipline

Do not infer access-control behavior from a boolean expression unless the expression has been interpreted correctly.

For deny guards such as:

`if (!A || !B) deny`

successful access requires both A and B.

Do not describe this as "A OR B grants access."

When evaluating route or page guards:
- distinguish the condition that triggers denial from the condition required for successful access;
- consider the full boolean expression;
- do not simplify boolean logic in a way that changes its meaning.

If access behavior depends on surrounding code that is not supplied, classify the finding as UNVERIFIED rather than asserting the behavior.

## Structured output contract

Return only JSON matching the API-provided schema. The top-level object is
`{"findings": [...]}`. Each finding contains `title`, `type`, `confidence`,
`relationship`, `documentation` (`file`, `claim`, `claimKind`), `repository`
(an array of `file`, `fact` objects), `capabilityEffect`, `action`,
`actionFile`, and `summary`.

Allowed values are:

- `type`: `DOCUMENTATION_DRIFT`, `IMPLEMENTATION_RISK`, or `UNVERIFIED`;
- `relationship`: `CONTRADICTS`, `MAY_VIOLATE_INVARIANT`,
  `INSUFFICIENT_EVIDENCE`, `AGREES`, or `OMISSION_ONLY`;
- `documentation.claimKind`: `EXPLICIT_CURRENT_STATE`, `EXPLICIT_NOT_CURRENT`,
  `EXPLICIT_INVARIANT`, `EXPLICIT_ABSENCE`, or `OMISSION`;
- `capabilityEffect`: `GRANTS`, `RESTRICTS`, `FILTERS`, `UNKNOWN`, or
  `NOT_APPLICABLE`;
- `action`: `UPDATE_EXISTING_DOCUMENTATION`, `HUMAN_VERIFICATION`, or
  `IMPLEMENTATION_REVIEW`.

Use `CONTRADICTS` only for DOCUMENTATION_DRIFT, `MAY_VIOLATE_INVARIANT` only
for IMPLEMENTATION_RISK, and `INSUFFICIENT_EVIDENCE` only for UNVERIFIED.
`AGREES` and `OMISSION_ONLY` are not findings and must be omitted. A
documentation update must name an existing canonical document. LOW-confidence
findings must not prescribe documentation updates. `OMISSION` claim kinds are
never findings. DOCUMENTATION_DRIFT requires an explicit current, not-current,
or absence claim; IMPLEMENTATION_RISK requires an explicit invariant claim.
Privilege-elevation risks require `capabilityEffect: GRANTS`; `RESTRICTS` and
`FILTERS` describe additional restrictions or representation changes, not
authorization grants. `UNKNOWN` cannot support a HIGH-confidence
IMPLEMENTATION_RISK. Zero findings is valid.
