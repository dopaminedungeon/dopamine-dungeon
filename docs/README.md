# Documentation

Start here rather than treating every file in `docs/` as an equal source of
truth.

## Canonical documents

- [Current State](product/CURRENT_STATE.md): what exists and what remains
  incomplete.
- [Active Feature Surface Audit](product/FEATURE_SURFACE_AUDIT.md): current
  keep, retire, and infrastructure-only decisions from #319.
- [Roadmap](product/ROADMAP.md): product direction and dependency-aware
  priorities.
- [Current Iteration](sprints/current.md): final Iteration 2 record and the
  Iteration 3 handoff.
- [System Overview](architecture/SYSTEM_OVERVIEW.md): runtime, identity,
  authorization, persistence, and environment boundaries.
- [Architecture Decisions](architecture/adr/README.md): durable decisions and
  unresolved proposals.

## Operations

- [Testing](operations/TESTING.md): test layers, commands, data sources, and
  CI roles.
- [Repository and CI Policy](operations/REPOSITORY_POLICY.md): branches,
  required checks, workflows, and runner use.
- [Iteration Closeout Administration](operations/ITERATION_CLOSEOUT.md): create
  one duplicate-safe retrospective and documentation task per Project iteration.
- [Environment Configuration](operations/ENVIRONMENT.md): variable names and
  environment separation; never secret values.
- [Deployment](operations/DEPLOYMENT.md): Vercel and production responsibilities.
- [Rollback and Recovery](operations/ROLLBACK.md): recovery expectations.
- [Repository agent requirements](../AGENTS.md)

## Product and design references

- [Authentication specification](../specs/authentication.md)
- [System diagram index](SYSTEMSDIAGRAMS.md)
- [Permissions table](permissions-table.md)
- [Cross-linking](crosslinking.md)

Page and profile diagrams are primarily intended-state UX contracts. Check
Current State, the System Overview, ADRs, code, schema, and API behavior before
treating a diagram as implemented behavior.

The former Arcs, Quests, and Conditions mock screens are retained in some
intended-state diagrams only. Their routes and product pages are not active.

## Source-of-truth boundaries

- GitHub issues own acceptance criteria.
- The organization project board owns issue status and iteration assignment.
- `product/CURRENT_STATE.md` owns factual implementation claims.
- `product/ROADMAP.md` owns ordering and dependencies.
- ADRs own durable architectural decisions and proposals.
- `operations/` owns executable commands and manual provider configuration.
- Code, schema, and migrations override stale descriptive documents; record a
  conflict instead of silently choosing the desired interpretation.

Authentication feature ownership remains assigned to Iteration 3. Documents
describing #256 email verification are proposals or preparation notes unless
they explicitly state that the behavior is current and verified on `dev`.
