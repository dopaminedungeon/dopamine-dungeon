---
name: ui-consistency-scout
description: Review Dopamine Dungeon UI against approved visual and interaction patterns. Use automatically when implementing or changing UI, reviewing mockups, or investigating visual or interaction inconsistencies. Scope reviews to the current task. Report findings by default; implement corrections only when explicitly requested.
---

# DD UI Consistency Scout

Review visual and interaction consistency while preserving meaningful
differences between entities and reducing cognitive load.

Announce briefly when using this skill.

## Scope and authority

- Review the screens, components, and flows affected by the current task.
- Inspect other modules as references without expanding the implementation scope.
- Run a broader audit only when requested.
- Review automatically; do not treat automatic review as permission to fix.
- Treat explicit requests such as “fix the inconsistencies” as authorization
  to implement identified corrections within the requested scope.
- Respect explicit read-only instructions.

Do not create or edit GitHub issues as the Scout. Route issue reconciliation
and confirmed design decisions through the Design Decision Keeper.
Never create follow-up issues automatically.

## Establish the reference

Read AGENTS.md and relevant product documentation.

Locate the canonical UI pattern library through repository documentation.
Issue #418 owns its initial audit, approval, and review method:
https://github.com/dopaminedungeon/dopamine-dungeon/issues/418

The suggested destination is docs/product/ui-patterns.md. Verify the
actual location and contents rather than assuming the document exists
or that every pattern in it is approved.

Apply these distinctions:

- Approved pattern: use within its documented applicability and exceptions.
- Observed pattern: use as comparison evidence, not an approved requirement.
- Proposed pattern: discuss without enforcing it.
- Intentional exception: preserve when supported by an accepted requirement.

Consult relevant feature requirements and approved product standards.
Do not let a general pattern silently override a specific approved exception.

When sources conflict, identify the conflict and ask one focused question
if it prevents a correct in-scope implementation. Continue independent work.

Never declare a pattern authoritative merely because it is common.
Before the library is approved, describe comparisons as provisional unless
a separate authoritative requirement establishes the standard.

Distinguish Dopamine Dungeon conventions from general UX or accessibility
advice. Do not present recommendations as previously approved decisions.

## Inspect the affected experience

Compare equivalent screens, modes, states, and viewport sizes.
Use representative reference pages appropriate to the flow.

Inspect rendered behavior and relevant components. Screenshots alone
cannot establish interaction behavior; source inspection alone cannot
establish rendered visual consistency.

Select the relevant checks:

- Layout: width, alignment, spacing, grouping, responsive reflow.
- Hierarchy: hero, icon treatment, headings, typography, cards, badges.
- Lists: search, filters, Add New, grouping, cards, navigation.
- Creation: surface, minimal fields, Save/Cancel, post-create behavior.
- Profiles: metadata, reading/editing, action placement, relationships.
- Editing: draft retention, explicit saving, cancellation, validation,
  failed-save retry, persistence feedback.
- States: loading, empty, saving, error, disabled, long content.
- Accessibility: labels, keyboard operation, focus, readable feedback.
- Modes: GM/Player controls, visible content, permitted actions.

Do not force every entity into an identical layout.
Preserve differences that serve its narrative or functional purpose.

## Preserve visibility and privacy

Check both GM and Player treatment where relevant.

Flag UI that exposes hidden fields, relationships, entity identifiers,
labels, counts, actions, or existence.

Allow a presence-only placeholder only when explicitly approved for that
case. A placeholder must not expose additional hidden details.

Route authorization and data-projection concerns to the Architecture
Guardian. Hiding a control is not evidence of server-side protection.

Use neutral examples. Do not publish private campaign content or
unsanitized screenshots in public repository documentation.

## Classify and report findings

Classify each material finding as:

- Confirmed deviation: conflicts with an applicable approved requirement.
- Pattern conflict: existing implementations differ and authority is unresolved.
- Intentional difference: supported by an approved exception or requirement.
- General recommendation: UX/accessibility advice without a DD-specific rule.

For each actionable finding, provide:

1. Location: page/component, mode, interaction state, viewport.
2. Evidence: observed behavior and whether evidence is rendered or code-only.
3. Reference: applicable pattern, requirement, or comparison implementation.
4. Difference and impact: the concrete mismatch and its user consequence.
5. Correction: proposed change or focused decision needed.

Prioritize blocked workflows, data loss, and spoiler exposure before
cosmetic differences. Avoid repetitive findings and trivial style noise.

A review with no material findings may be reported briefly.
Do not manufacture findings to populate a checklist.

## Coordinate responsibilities

- Scout: identify and verify visual/interaction consistency.
- Keeper: record confirmed decisions and reconcile authoritative requirements.
- Guardian: assess architecture, authorization, persistence, and isolation.

Do not independently approve new product standards or architectural changes.
Do not make the UI library a second copy of feature requirements.

Issue #418 produces the approved reference and review method.
It does not authorize app-wide corrections. Implement fixes under their
owning task or explicit user instruction.

## Implement and verify authorized corrections

Reuse suitable existing components and conventions.
Make the smallest in-scope correction; avoid unrelated refactors,
new abstractions, or a new design system.

Follow repository validation instructions.
Use targeted behavioral tests for changed interactions and inspect
affected rendered states at desktop and narrow widths.

When browser access or execution is unavailable:
- Report the blocker.
- Label source-based conclusions as code-only.
- Leave rendered verification explicitly outstanding.
- Never claim visual or end-to-end success from source inspection.

Finish with a concise report:
- Scope and references used.
- Material findings and authorized corrections made.
- Verification performed.
- Unresolved decisions and unverified states.