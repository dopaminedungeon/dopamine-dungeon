# Iteration Closeout Administration

Last updated: 2026-08-24
Owner: Magda

## Purpose

Create exactly one retrospective and documentation-reconciliation task for
every GitHub Project iteration. The task closes the iteration deliberately; it
does not implement product work discovered during the retrospective.

The successful reference is [#317](https://github.com/dopaminedungeon/dopamine-dungeon/issues/317),
the Iteration 2 retrospective and documentation update. Each future task keeps
the same essential shape:

1. wait for major iteration work to finish;
2. capture actionable retrospective evidence;
3. reconcile canonical documentation with the repository;
4. link or create focused deferred-work issues;
5. record the final state and next-iteration handoff;
6. never describe proposed or future behavior as current behavior.

## Recommended creation path

Use the manual [Create Iteration Closeout Task workflow](../../.github/workflows/create-iteration-closeout.yml):

1. Open **Actions → Create Iteration Closeout Task → Run workflow**.
2. Enter the numeric iteration number exactly as it appears in the Project.
3. Enter the iteration name, major dependency issues, and intended outcome.
4. Run the workflow.
5. Open the created issue, add it to organization Project 1, set its native
   Type to Task, and assign the matching Iteration and Application Version
   fields in the Project UI.
6. Start closeout only after the listed dependencies are complete.

The workflow creates repository issues only. It uses `issues: write`, does not
checkout code, does not use secrets, and does not change application or
deployment state.

GitHub exposes issue forms and dispatchable workflows from the repository's
default branch. Until these files reach that branch through the normal
`dev`-to-`main` release flow, use the documented manual title and task shape
from the branch rather than changing branch or deployment policy for this tool.

## Manual fallback

Use the [Iteration closeout issue form](../../.github/ISSUE_TEMPLATE/iteration-closeout.yml)
when Actions is unavailable:

1. Search both open and closed issues for the exact canonical title
   `[Task]: Iteration N retrospective and documentation update`.
2. If no match exists, open the issue form and complete the iteration,
   dependency, and intended-outcome fields.
3. Keep the generated retrospective, documentation, deferred-work, handoff,
   and acceptance-criteria sections.
4. The form sets native Type to Task and adds Project 1 when the person opening
   it has Project write access. Set the matching Iteration and Application
   Version fields manually.

The required duplicate-check boxes make the manual limitation explicit. Do not
create a second task because the first task is closed; a completed closeout is
still the closeout for that iteration.

## Duplicate prevention

The workflow derives a stable marker from the numeric iteration:

```text
<!-- dd-iteration-closeout:N -->
```

Before creating an issue it searches all open and closed repository issues. It
stops successfully when either the stable marker or the canonical title already
exists. The title check also recognizes Iteration 2 issue #317, which predates
the marker.

Use only the numeric Project iteration number in the number input. The name may
change without changing the duplicate key.

## Project automation boundary

The organization Project owns Iteration and Application Version assignment,
but this repository does not own the Project field configuration. GitHub's
standard repository `GITHUB_TOKEN` can create issues with `issues: write`; it
does not provide the organization Project V2 permission needed to discover and
update those field IDs.

Automating that assignment would require a separately maintained GitHub App or
PAT with organization Project permission, stored as a secret, plus GraphQL code
coupled to Project and field IDs. That is disproportionate for this solo
workflow. Workflow-created issues therefore receive their Project, native Type,
Iteration, and Application Version metadata manually after creation. Form-
created issues can receive Project 1 and native Type from the form, but still
require manual Iteration and Application Version assignment.

## Existing iteration coverage

Snapshot from organization Project 1 when #325 was implemented:

| Project iteration | Closeout task | Handling |
|---|---|---|
| Iteration 1 - backlog refinement | None | Completed before the closeout process existed; the historical gap is documented rather than creating a low-value retroactive task. |
| Iteration 2 - refinement + adding of functionalities | [#317](https://github.com/dopaminedungeon/dopamine-dungeon/issues/317) | Completed reference closeout. |
| Iteration 3 | Not yet created | Create once its major work and dependencies are stable; preparation evidence already lives in `docs/sprints/iteration-3-retrospective-notes.md`. |
| Iterations 4-9 | Not yet created | Future iterations; create one task per iteration when that iteration starts and its major dependencies are known. Do not precreate speculative backlog noise. |

This table is an implementation snapshot, not a second source of truth for the
Project schedule. The Project iteration field remains authoritative.

## Closeout completion checklist

- Confirm all dependency issues are complete before starting.
- Review merged work and final repository behavior, not only issue descriptions.
- Reconcile `CURRENT_STATE.md`, `ROADMAP.md`, relevant architecture/ADRs, and
  operations documentation rather than duplicating them.
- Update the final iteration record and prepare the next iteration's evidence.
- Link deferred work to focused issues with explicit ownership.
- Run documentation/link checks and `git diff --check` for repository changes.
- Use `pnpm quality` only when closeout changes executable workflow, script, or
  configuration behavior.

## Rollback

Revert the issue form, workflow, and this policy documentation. Existing issues
created through the process remain normal GitHub issues and should be closed or
edited deliberately rather than deleted automatically.
