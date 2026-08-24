# Repository and CI Policy

Last updated: 2026-08-24
Owner: Magda

This is the lightweight repository policy for Dopamine Dungeon. It complements
the test-layer detail in [`TESTING.md`](./TESTING.md) and the deployment
responsibilities in [`DEPLOYMENT.md`](./DEPLOYMENT.md). It does not introduce a
full GitFlow process.

## Retired standalone Relationships module

The standalone Relationships route, navigation entry, mock data, and profile
UI are retired. Active relationship-like behavior uses the typed entity-link
system, including session/entity links and its workspace, campaign, and
GM/Player visibility boundaries. Future PC-NPC and NPC-NPC relationship work
belongs to the Friendship Index and cross-linking roadmap, not a new standalone
Relationships page.

## Branch purposes and normal flow

```text
feature/* or fix/* -> dev -> main
                       \-> optional release/vX.Y -> main
```

- `feature/*` and `fix/*` branches start from `dev` and may receive direct
  commits while work is in progress.
- `dev` is the integration and preview branch. Normal pull requests target
  `dev`; direct pushes to `dev` are not part of the normal workflow.
- `release/vX.Y` is optional. Create one from a tested `dev` only when release
  stabilization needs a short-lived branch. It is not a permanent lane.
- `main` is the production source for Vercel. Only reviewed release-ready pull
  requests promote changes from `dev`, a release branch, or an approved hotfix.
- Delete feature, fix, release, and hotfix branches after their pull requests
  merge. There is no automatic stale-branch bot; the solo maintainer reviews
  old branches during release preparation.

Routine feature and fix pull requests use squash merge. A release or hotfix
promotion may use a merge commit when retaining the release boundary is useful.
Rebase is not required for normal work.

## Release and hotfix flow

1. Validate the intended release scope on `dev`.
2. Create `release/vX.Y` from `dev` only when stabilization is needed.
3. Apply release-only fixes to the release branch through pull requests.
4. Promote the release branch to `main` after the required checks and review.
5. Open a follow-up pull request from the release branch or an equivalent fix
   branch back to `dev` for every release-only fix.
6. For an urgent production fix, branch from `main`, open a hotfix pull request
   to `main`, then immediately backport the same fix to `dev` through a second
   pull request.

Do not add parallel develop, support, or long-lived release branches.

## CI and branch gates

The single understandable required check is `DD Quality Gate`. Its blocking
steps match the local `pnpm quality` command:

- `pnpm lint`;
- `pnpm test:unit`;
- `pnpm test:api`;
- `pnpm test:boundary`;
- `pnpm typecheck:api`;
- `pnpm typecheck:e2e`;
- `pnpm build`.

The Playwright PR smoke suite runs in the same workflow as an advisory step
until repeated self-hosted runner runs establish a stable signal. The full
`pnpm test:e2e` suite remains release/manual. The #315 test strategy owns the
meaning and boundaries of these commands; #316 only makes them coherent with
repository policy.

Target branch settings are:

| Branch | Pull request | Required check | Deployment/review | Direct updates |
|---|---|---|---|---|
| `dev` | Required | `DD Quality Gate` | Preview deployment and one approval | Blocked except approved administrative bypass |
| `release/*` | Required | `DD Quality Gate` | Preview deployment and one approval | Blocked except approved administrative bypass |
| `main` | Required | `DD Quality Gate` | Preview deployment and one approval before production promotion | Blocked except approved administrative bypass |

Deletion and non-fast-forward updates should remain blocked on protected
branches. `DD AI Review` is advisory and must not be required: it uses the
self-hosted runner's local Ollama service and updates one marked review comment
instead of posting a new comment on every run.

At the time of this audit, GitHub has an active `protect dev` ruleset with one
approval, a required `Preview` deployment, deletion/non-fast-forward rules, and
no required status-check rule. No active protection was reported for `main` or
`release/*`. These repository settings are an explicit manual handoff in this
branch: configure the target settings above in GitHub Rulesets, then verify the
resulting ruleset. Do not make lint, the smoke suite, AI review, or the full E2E
suite separate required checks.

## Workflow inventory

| Workflow | Classification | Trigger and purpose | Runner and access |
|---|---|---|---|
| `PR Checks` | Required and healthy after #316 cleanup | Pushes to `dev`, `main`, and `release/*`; pull requests targeting those branches; runs the DD Quality Gate and advisory smoke | Self-hosted `macOS`, `X64`; `contents: read`; no secrets |
| `DD AI Review` | Experimental/manual advisory | Opened, synchronized, or reopened pull requests targeting `main`, `dev`, or `release/*`; produces one concise review comment | Self-hosted `macOS`, `X64`; `contents: read`, `pull-requests: write`; `GITHUB_TOKEN` and local Ollama model |
| `Sync Application Version to Sub-Issue` | Obsolete and removed | Placeholder project automation with literal project and field IDs | Removed because it could not perform useful work safely |

The repository has no GitHub Actions deployment workflow. Vercel remains the
deployment system, with `main` as the production source and feature/`dev`
branches eligible for preview validation.

## Build signal

The original build emitted a warning because the initial JavaScript chunk was
1.585 MB minified. Inspection traced a major portion to `pdfjs-dist`, which was
statically imported through the PCs page. The PDF import service is now loaded
only when a user selects a PDF. The inspected production build is:

| Output | Minified | Gzip | Load behavior |
|---|---:|---:|---|
| Initial application chunk | 1.094 MB | 294 KB | Initial shell |
| Character import chunk | 491 KB | 150 KB | Loaded only for PDF import |
| PDF worker | 1.298 MB | not reported by Vite | Loaded only by PDF parsing |

The intentional warning ceiling is `1300` kB in `vite.config.js`. This is an
inspection-based ceiling for the current shell plus the on-demand PDF worker,
not a blanket warning suppression or a claim that raw minified size is the
network budget. Revisit route-level splitting if the initial chunk approaches
the ceiling or its gzip size grows materially. Manual Rollup chunking is not
currently necessary.

## Lint baseline decision

`pnpm lint` now passes cleanly. The findings were classified as follows:

- real defects fixed: undefined debug-panel link functions, conditional hooks,
  unused import/parser locals, and unused page locals;
- inappropriate rules configured narrowly: context providers disable
  `react-hooks/set-state-in-effect` because they intentionally synchronize
  auth/storage state in effects, and disable
  `react-refresh/only-export-components` because provider modules intentionally
  export their public hooks;
- legitimate local exception: `CampaignContext` retains a documented
  `membershipVersion` dependency so membership changes retrigger loading.

No lint command uses `|| true`, `continue-on-error`, or a global ignore to hide
the result. A lint failure makes `DD Quality Gate` fail normally.

## Self-hosted runner and failure diagnosis

The self-hosted `macOS`, `X64` runner is used because the repository's emulator
smoke tests require Java and the AI review requires a local Ollama model. The
blocking gate itself should remain deterministic and must not depend on
production Firebase, Neon, Vercel, or campaign data.

When a check fails:

1. Open the `DD Quality Gate` job summary and identify the named failing step.
2. Run the matching local command from `TESTING.md` on the feature branch.
3. For a build warning, compare the generated chunk sizes with the documented
   1300 kB ceiling before changing Vite configuration.
4. For smoke or AI-review failures, record the runner prerequisite or service
   failure; do not promote those checks to required status.
5. Fix the cause or document the remaining environmental risk before merging.

Production deployment remains Vercel from `main`. Agents may inspect or prepare
deployment and policy changes, but must not deploy production, apply production
migrations, expose secrets, or merge pull requests.
