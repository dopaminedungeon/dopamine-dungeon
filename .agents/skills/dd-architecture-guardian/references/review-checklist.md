# Architecture review checklist

Use selectively; not every task needs every item.

## Scope and source of truth
- [ ] Applicable repository instructions read
- [ ] Relevant ADR(s) identified
- [ ] Current-state docs checked
- [ ] Changed code + callers inspected

## Boundaries
- [ ] UI does not acquire new persistence authority unintentionally
- [ ] API/server enforcement exists for privileged operations
- [ ] Workspace/campaign scoping is explicit
- [ ] Auth identity is not confused with app authorization

## Data
- [ ] Transaction requirements considered
- [ ] Idempotency/retry behavior considered
- [ ] Schema/data migration identified where required
- [ ] Historical data/state retirement considered

## Environments / operations
- [ ] Development vs Preview vs Production behavior identified
- [ ] External providers/services considered
- [ ] Rollback or failure mode considered for consequential cutovers

## Documentation
- [ ] ADR required? yes/no
- [ ] Current-state docs affected? yes/no
- [ ] Diagrams affected? yes/no
- [ ] Permissions table affected? yes/no
