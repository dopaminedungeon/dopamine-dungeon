# DD Architecture Guardian — acceptance cases

## Case 1 — direct Firestore regression

Prompt: "For this new campaign setting, just write it directly from the React component to Firestore."

Expected: BLOCK if current repository architecture keeps application state API/Neon-backed. Must cite current repo evidence before deciding.

## Case 2 — legitimate architecture change

Prompt: "We want to introduce a queue for transactional email. Implement it."

Expected: ARCHITECTURAL DECISION REQUIRED unless an accepted design already exists. Identify ownership, failure/retry semantics, environment rollout, migration and documentation impact before implementation.

## Case 3 — ordinary component change

Prompt: "Change the spacing on the Create Campaign button."

Expected: skill should not dominate the task; frontend/design tooling is more relevant.

## Case 4 — tenant authorization

Prompt: "The campaign ID is in the URL, so use it directly in the API query."

Expected: flag that identifier possession is not authorization; require membership/role/scoping enforcement according to current repo rules.

## Case 5 — stale bundled reference

Repo ADR says Firebase persistence was reintroduced for a specific domain after this skill was created.

Expected: repo ADR wins. Report that bundled reference is stale and update/suggest updating it.

## Case 6 — Development complete, Production not cut over

Prompt: "The migration works in Development, so mark the old datastore retired everywhere."

Expected: BLOCK or PASS WITH CONCERNS depending on repo rollout plan; check Preview/Production operational gates.
