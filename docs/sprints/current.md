# Iteration 0 — Agent Workflow Pilot

Status: Completed
Owner: Magda
Start date: 2026-07-24

## Goal

Validate that an AI coding agent can safely implement one small,
well-defined Dopamine Dungeon issue using repository documentation,
automated checks, and human review.

## Expected outcome

At the end of this iteration:

- one bounded issue has been refined;
- Codex has audited the repository instructions;
- Codex has implemented the issue on a feature branch;
- a draft pull request has been created against `dev`;
- all available checks have been run;
- the implementation has been reviewed manually;
- lessons from the pilot have been recorded.

## Scope

### Included

- Select one low-risk pilot issue
- Refine its requirements and acceptance criteria
- Connect the repository to Codex
- Run a read-only repository audit
- Correct documentation inconsistencies found by the audit
- Implement the pilot issue
- Review the resulting pull request
- Record workflow improvements

### Excluded

- Database schema changes
- Authentication changes
- Permission model changes
- Production deployment
- Direct changes to `main`
- Automatic merging
- Multiple parallel agents
- Major refactoring
- New architectural abstractions

## Pilot issue selection criteria

The pilot issue must:

- affect a small and identifiable area;
- require no database migration;
- require no new external dependency;
- have a visible and testable result;
- preserve existing API contracts;
- be reversible with a simple revert;
- preferably affect no more than three to five implementation files.

## Success criteria

- [ ] Pilot issue selected
- [ ] Pilot issue refined using the agent-ready template
- [ ] Repository visible in Codex
- [ ] Read-only Codex audit completed
- [ ] Documentation contradictions resolved or recorded
- [ ] Feature branch created from `dev`
- [ ] Pilot issue implemented
- [ ] Required checks executed
- [ ] Draft pull request opened against `dev`
- [ ] Final diff contains no unrelated work
- [ ] Manual verification completed
- [ ] Retrospective recorded

## Definition of done

The iteration is complete when the pilot issue works in the `dev`
preview environment, its implementation has been reviewed by Magda,
and all durable lessons have been incorporated into repository
documentation or agent instructions.

## Risks

| Risk | Mitigation |
|---|---|
| Repository instructions are inaccurate | Run a read-only audit first |
| Existing checks are incomplete | Require documented manual testing |
| Agent expands the scope | Explicit out-of-scope section and diff review |
| Agent modifies sensitive architecture | Exclude auth, permissions and schema work |
| Implementation passes build but fails functionally | Test in the preview deployment |

## Retrospective

### What worked

- Codex understood the issue.
- Codex stayed within scope.
- Only one implementation file changed.
- Build and API typecheck passed.
- Existing lint failures were reported honestly.

### What failed or caused friction

- Documentation was originally untracked.
- GitHub CLI authentication was invalid.
- GitHub integration could not create the PR.
- Repository-wide lint currently fails.
- No test script exists.

### What must improve

- Keep agent documentation committed to dev.
- Fix GitHub authentication.
- Document the Firestore/Postgres transition.
- Fix or baseline existing lint errors.
- Add automated tests later.

### What the agent misunderstood

### Missing repository context

### Changes required in `AGENTS.md`

### Changes required in issue templates

### Decision

- [ ] Workflow accepted
- [x] Workflow accepted with changes
- [ ] Pilot must be repeated
- [ ] Workflow rejected