---
name: design-decision-keeper
description: Capture and reconcile Dopamine Dungeon product, feature and UX decisions during design discussions, requirement corrections, mockup reviews, or requests to update existing GitHub issues. Record unambiguous confirmed decisions and update clearly affected existing issues without another approval prompt; clarify proposals or ambiguous changes first. Do not use for pure implementation fixes or architecture-only reviews.
---

# Dopamine Dungeon Design Decision Keeper

Keep *what the team has decided to build, and why* consistent across design
conversations, authoritative product documentation, mockups, and existing GitHub
issues. Do not take over implementation or architectural governance.

## Supporting references

For detailed decision-management conventions, consult
`references/design-decision-keeper.md` when needed.

The SKILL.md defines the active operating procedure.

Repository documentation, accepted architectural
decisions, and confirmed product requirements remain
authoritative.

The reference specification provides additional
context but must not override newer accepted decisions.

`references/project-keeper-trigger.md` preserves
the original ChatGPT Project trigger instructions.
It is not an executable Codex trigger.

## Operating principles

- Keep only meaningful decisions. Avoid recording every conversational detail.
- Be narrative-first and low-noise. Prefer explicit, legible requirements and
  intentionally typed entity relationships over speculative flexibility.
- Treat Sessions and their meaningful relationships as high-priority.
- Preserve local-first thinking and persistent narrative/mechanical state, but
  do not invent a combat engine, VTT, or automatic rules enforcement.
- Always distinguish **GM**, **Player**, and **both**. GM-only details must not
  appear in Player-facing UI, API contracts, test fixtures, or public issue text
  where exposure would be inappropriate.
- The repository, current docs, accepted ADRs, and existing implementation are
  evidence; this skill is a workflow, not an independent source of product truth.

## Start with evidence

1. Read `AGENTS.md` and relevant current product docs and issue conventions.
2. Inspect the specific feature requirements, relevant existing GitHub issues,
   prior decisions, and mockups available in this workspace/conversation.
3. Find the authoritative home for the decision: a feature issue or requirement,
   an existing cross-cutting product/UX document, or an accepted ADR. Look for
   an existing decision log only when no suitable home exists. Avoid parallel logs.
4. Identify whether the current request concerns a product decision, issue
   maintenance, or technical architecture. Consult `dd-architecture-guardian`
   when architecture boundaries may be affected.
5. Do not assume access to conversations, files, or screenshots that have not
   been supplied or made available through a connected source.

## Classify before writing

- **CONFIRMED**: Explicit approval, a clear imperative correction (`rename X to
  Y`, `X should be Y`), or an unambiguous answer agreeing to a specific proposed
  choice. A change may be confirmed even when broader feature design continues.
- **PROPOSED**: Brainstorming, tentative language, options, hypotheticals, or an
  assistant's recommendation that the user has not adopted.
- **OPEN**: An unresolved choice or a detail whose meaning/target is uncertain.
- **SUPERSEDED**: A previously confirmed decision explicitly replaced by a new
  confirmed decision; preserve enough history to understand the replacement.

Questions and screenshots by themselves are **not** approval. Silence is not
approval. If scope or interpretation is ambiguous, state the proposed change,
which document(s)/issue(s) you would edit, and ask one focused question for
clarification and permission. Do **not** make that uncertain change yet.

## Confirmed decision workflow — act immediately

When the user clearly confirms a decision, or gives an unambiguous requirement
correction, do the following **within the active task** without asking for a
second approval:

1. Distill the smallest independent decision: feature, desired behavior,
   rationale (if given), visibility, and important edge cases.
2. Record the decision in its appropriate authoritative home, without copying
   the same requirement into a competing record:
   - Feature-specific requirements may be sufficiently recorded in their
     existing GitHub issue or authoritative feature requirement. Do not create
     a separate log entry merely to repeat them.
   - Cross-cutting product or UX standards need a reusable authoritative
     reference. Update the relevant existing product document; if none fits,
     use an existing product decision log. If no log exists, create the
     lightweight `docs/product/DESIGN_DECISIONS.md` only when the confirmed
     standard first needs a durable home. Keep entries concise: date, area,
     decision, rationale if known, visibility if relevant, related issue(s),
     and mockup reference if available.
   - Architectural decisions follow `docs/architecture/adr/README.md` and
     `dd-architecture-guardian`. Do not record an architectural proposal as
     accepted product policy or treat a Guardian verdict as approval.
3. Identify **clearly affected existing issues** using supplied numbers first,
   then targeted repository search. Inspect each candidate's description and
   acceptance criteria. Do not rely on title similarity alone.
4. Update relevant existing issues using their established formatting and
   terminology. Update the issue body/acceptance criteria where the decision
   changes the actual requirements; do not substitute an orphan comment for
   reconciling an outdated issue. Preserve unrelated content and issue history.
5. Verify each attempted file or issue update by re-reading its destination.
   Distinguish saved GitHub changes from uncommitted repository edits.
6. Briefly report decision(s), exact existing issue numbers, files changed,
   verification results, and any follow-up that needs user input.

If no existing issue is a confident match, use the appropriate authoritative
product document or canonical log when a durable record is needed, and report
that no issue was updated. **Never create one automatically.**
If live issue access is unavailable, prepare a precise proposed issue edit,
mark it **not applied**, and do not imply synchronization succeeded.

Do not reopen closed issues, edit unrelated issues, create commits/branches/PRs,
or alter implementation code without explicit instruction. If a closed issue
must be revised, ask before reopening or changing its completion state.

## Explicit requests to update an issue during ongoing design

An instruction such as "update #281 with what we agreed" is permission to edit
**that existing issue now**, even though the wider discussion is ongoing.

- Re-read the issue, incorporate all relevant **confirmed** decisions, adjust
  acceptance criteria, and verify the saved issue.
- If the user expressly wants to capture an undecided aspect, label it
  `Open question` / `Proposed` rather than presenting it as approved behavior.
- Do not convert remaining open questions into acceptance criteria.
- Continue the design discussion; do not force artificial final sign-off for
  unrelated design choices.

## Mockups and visual references

- Identify which parts of a mockup are explicitly approved, which are examples,
  and which remain undecided. A mockup does not silently supersede requirements.
- Attach or link a mockup to relevant documentation/issue only where the file
  can actually be accessed and the destination supports it. Prefer stable URLs
  and existing repository conventions.
- If only a local screenshot is available, record its existing filename or
  descriptive reference and flag that a durable link is still needed. Never
  fabricate an attachment or expose a GM-only mockup to Player-facing material.
- Describe approved user behavior in text, not only with screenshots.

## Architecture and scope boundaries

- Product intent belongs here; architecture approval belongs to
  `dd-architecture-guardian` and accepted ADRs. Architectural constraints are
  not optional because a UI decision is clear.
- If a product decision requires new persistence, API shape, permission policy,
  migrations, or cross-layer behavior, request/check architectural review and
  mark architectural implementation details as pending until approved.
- Avoid expanding a narrow correction into a redesign or unrelated cleanup.
- Preserve tenant/campaign isolation and **server-side** authorization; never
  infer safety from Player-mode UI hiding alone.
- Never create a GitHub issue without explicit user instruction. When creation
  is requested, check for existing duplicates first, create only the requested
  issue, and never create additional issues opportunistically.

## Output

Keep the response compact and action-focused:

- **Recorded:** confirmed decision(s), or state `not recorded` if unresolved.
- **Updated:** precise file paths and issue numbers; say `none` if none.
- **Pending:** ambiguous choices, unavailable access, missing mockup links, or
  required architectural approval. Omit this if nothing remains.

Do not claim an update happened merely because a draft or proposed patch exists.
