# Iteration Closeout Administration

Last updated: 2026-09-05
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
3. Enter the exact Project iteration title (or its descriptive suffix), major
   dependency issues, and intended outcome.
4. Run the workflow.
5. Review the workflow summary. When Project automation is configured, confirm
   that it reports Project 1, Type: Task, Priority: Low, Effort: Low,
   Application version: n/a, and the selected Iteration.
6. If Project automation was skipped, complete the summary's manual metadata
   checklist.
7. Start closeout only after the listed dependencies are complete.

The workflow uses the standard repository `GITHUB_TOKEN` with `issues: write`
to search all open and closed issues and create the issue when needed. It does
not checkout code and does not change application or deployment state. Native
Type is set during fresh issue creation where the repository token supports
it. Optional Project-ready metadata completion uses `DD_PROJECTS_TOKEN` as
documented below.

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
   it has Project write access. Complete or verify the remaining metadata
   manually:
   - Project: `dopamine dungeon development` (Project 1);
   - Type: `Task`;
   - Priority: `Low`;
   - Effort: `Low`;
   - Application version: `n/a`;
   - Iteration: the iteration being summarized.

The required duplicate-check boxes make the manual limitation explicit. Do not
create a second task because the first task is closed; a completed closeout is
still the closeout for that iteration.

## Documentation reconciliation start signal

Configure the organization Project workflow once so that when an Iteration
Closeout item changes Status to **In Progress**, it adds the exact repository
issue label `iteration-closeout-in-progress`. That supported `issues:labeled`
event starts the read-only documentation reconciliation; the repository
workflow additionally verifies the label, the `[Task]: Iteration` title
prefix, and the existing `<!-- dd-iteration-closeout:N -->` body marker.

`workflow_dispatch` remains available for manual debugging. Removing and
re-adding the start label may trigger another run because historical run state
is intentionally not persisted.

The reconciliation is read-only: it reads the configured canonical documents
and pass-scoped repository evidence, calls Mistral, and does not edit issues,
labels, Project status, documentation, code, or commits. Before any model call,
the script validates that every declared inventory path is supplied to at
least one pass, every pass input is declared, pass paths are unique, and all
referenced files exist. A mismatch fails with the affected paths; there is no
top-level fallback that silently changes prompt scope.

The run is partitioned into small, explicit passes. Current declared coverage
is:

| Pass | Canonical documents | Repository evidence | Subject |
| --- | ---: | ---: | --- |
| `security-auth` | 3 | 15 | Authentication, verification, recovery, and invitation flows |
| `security-access` | 5 | 6 | Workspace/campaign authorization, selected mode, and access boundaries |
| `architecture-persistence` | 10 | 13 | Runtime architecture, persistence, migration transition, and entity links |
| `operations-ci` | 6 | 7 | Deployment, environment, CI, testing, and rollback |
| `iteration-handoff` | 6 | 2 | Product/iteration closeout and its automation |

The top-level inventory has 29 canonical documents and 43 evidence files; all
are assigned to at least one pass. `docs/product/CURRENT_STATE.md` is
intentionally supplied to both security passes because it makes claims in
both subjects. The prior configuration sent only 7/29 declared canonical
documents and 17/41 declared evidence files to a pass; two additional auth
evidence inputs were configured only inside the auth pass and absent from the
declared inventory. The three new thematic passes supply the 22 omitted
canonical files and 22 of the 24 omitted evidence files in bounded prompts.
The two remaining omitted evidence files (mail templates) are assigned to
`security-auth`; the two existing auth evidence files are now declared in the
inventory. This increases prompt inputs
because the prior successful run did not inspect the declared closeout scope;
the files are divided by subject rather than combined into one broad prompt.

There are no exclusions within the declared inventory. This remains a scoped
reconciliation, not a whole-repository audit: files outside the manifest are
excluded, including unlisted code or documents, generated/ignored artifacts,
private reports, secrets, and live provider/deployment state. They are not
safe or authoritative prompt inputs for this workflow. The existing
evidence-based rubric still governs what may be reported; no finding is
inferred merely because an input omits a claim or implementation detail.

The GitHub Actions **Step Summary** lists the exact executed pass names and,
for each pass, its scope plus canonical and evidence paths inspected. It then
shows one findings section per pass and counts retained documentation drift,
implementation risks, human-verification findings, and passes with no
findings. The summary explicitly says it is not a whole-repository audit.
Dropped-finding diagnostics remain in job logs and are not included in the
clean summary. Continue the manual checklist below; the automated report is
evidence for its listed inputs and subject scopes only.

## Duplicate prevention

The workflow derives a stable marker from the numeric iteration:

```text
<!-- dd-iteration-closeout:N -->
```

Before creating an issue it searches all open and closed repository issues. It
reuses an issue when either the stable marker or the canonical title already
exists. The title check also recognizes Iteration 2 issue #317, which predates
the marker. A rerun continues from the reused issue and repairs missing or stale
metadata rather than exiting or creating another issue.

Use only the numeric Project iteration number in the number input. The name may
change without changing the duplicate key.

## Optional Project-ready automation

GitHub's standard repository `GITHUB_TOKEN` cannot access the organization
Project. To enable Project-ready completion, create a fine-grained personal
access token named `DD_PROJECTS_TOKEN` in the repository's Actions secrets.
Limit it to the `dopaminedungeon` organization and the
`dopamine-dungeon` repository with these permissions:

- repository **Issues: read and write**;
- organization **Projects: read and write**;
- organization **Issue Fields: read**;
- organization **Issue Types: read**.

The token owner must also have access to Project 1, and organization policy may
require approval of the fine-grained token. If personal-token rotation becomes
burdensome, a future GitHub App integration can generate a short-lived
installation token per run using equivalent permissions; that would require App
credentials and a deliberate workflow update rather than storing an installation
token in `DD_PROJECTS_TOKEN`.

When the token is available, the workflow discovers rather than hard-codes:

- enabled native issue type `Task`;
- native `Priority` and `Effort` fields and their `Low` options;
- Project 1 titled `dopamine dungeon development`;
- Project fields `Application version` and `Iteration`;
- the current or completed Project iteration matching the supplied number and
  exact title or descriptive suffix.

Application version uses the Project convention `n/a`. The workflow queries
existing Project items for the issue, including archived items, reuses the
Project 1 item when present, and adds an item only when none exists. It reapplies
Type, Priority, Effort, Application version, and Iteration on every run, so a
rerun can repair a partial earlier run safely.

If `DD_PROJECTS_TOKEN` is absent, issue creation or reuse still succeeds. The
workflow emits an Actions warning and writes this manual checklist to the job
summary:

- add the issue to Project 1, `dopamine dungeon development`;
- set Type to `Task`;
- set Priority to `Low`;
- set Effort to `Low`;
- set Application version to `n/a`;
- set Iteration to the iteration being summarized.

If the token is configured but invalid, under-permissioned, or cannot uniquely
resolve the requested iteration, metadata completion fails visibly and lists
the discovered iteration titles when applicable. The repository issue remains
intact. Correct the token or inputs and rerun the workflow; duplicate detection
will reuse that issue and repair its metadata.

## Existing iteration coverage

Historical coverage from #325, with Iteration 3 refreshed from Project 1 on
2026-09-05:

| Project iteration | Closeout task | Handling |
| --- | --- | --- |
| Iteration 1 - backlog refinement | None | Completed before the closeout process existed; the historical gap is documented rather than creating a low-value retroactive task. |
| Iteration 2 - refinement + adding of functionalities | [#317](https://github.com/dopaminedungeon/dopamine-dungeon/issues/317) | Completed reference closeout. |
| Iteration 3 | [#328](https://github.com/dopaminedungeon/dopamine-dungeon/issues/328) | In progress; all 14 listed dependencies are Done/closed. [Retrospective and handoff](../sprints/iteration-3-retrospective-notes.md). |
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
