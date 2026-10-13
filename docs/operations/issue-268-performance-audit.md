# Issue #268 — local performance and loading-state audit

## Method and limits

On 2026-10-12, the guarded Playwright runner served the Vite test build on localhost with the Firebase Auth emulator (`demo-dopamine-dungeon`). `e2e/performance-268.spec.ts` intercepted worldbuilding API responses with fixed synthetic fixtures: 120 Player-visible and 60 GM-only NPCs, and the same number of Locations. `/api/me` had 180 ms delay, list requests 220 ms for NPCs and 620 ms for Locations, the NPC record 80 ms, and related profile requests 620 ms. Each flow was measured three times per selected mode in one signed-in session, with a reload before each protected-home sample. Durations are wall-clock route action to visible result; request counts come from browser requests. The profile's response envelope is the last intercepted API response. These are controlled local comparisons, **not** database or production latency measurements.

| Flow (median of 3) | GM before | GM after | Player before | Player after | Requests per run |
| --- | ---: | ---: | ---: | ---: | ---: |
| Protected home visible after reload | 605 ms | 544 ms | 557 ms | 529 ms | 1 |
| NPC list row visible | 541 ms | 532 ms | 847 ms | 463 ms | 2 |
| NPC profile heading visible | 939 ms | 95 ms | 944 ms | 74 ms | 12 profile requests |
| NPC profile last API response | 729 ms | 736 ms | 725 ms | 724 ms | same requests |
| Location list row visible | 839 ms | 874 ms | 843 ms | 836 ms | 2 |

The fixed delays make the NPC profile the clearest orientation gap: the core record responds after 80 ms but the previous `Promise.all` withheld the entire page until five related data sources returned. The split load now shows the authorized NPC overview while linked details load independently. Its network response time and request volume did **not** improve. The other median differences are run-to-run noise, not claimed speedups. The 2/12 requests in this Vite development test are React StrictMode's repeated effects; they do not establish a production duplicate-request defect, so no global cache or request coalescing was added.

## Findings and scoped changes

- NPC profile: load the core NPC separately from sessions, items, lore, Locations, and links. Show a contextual linked-details loading card, and keep linked sections out of view until complete. Core and related failures have separate retry paths; a failed related request no longer masquerades as empty relationships.
- NPC and Location lists: scope displayed results to workspace, campaign, and selected GM/Player mode; refetch on mode change. While loading, show a campaign-context message. On failure, show a retry action instead of an empty-result message. Genuine empty results retain their existing copy.
- Link cache: prevent an older asynchronous link load from overwriting the newer selected context after a switch. This changes only in-memory response ordering, not persistence or API contracts.
- The existing app gate still resolves authorization before protected routes. Player-mode data comes from the selected-mode API request, with UI projection as defense in depth. The Playwright test covers mode switching but intercepts worldbuilding APIs, so it does not independently validate live database authorization.

## Remaining work (drafts, not new issues)

- **Existing #270 — calm loading states:** inventory the other profile/list routes and app-entry states. Add a consistent, delayed-or-subtle loading treatment where local waits are visible, and test desktop/mobile plus GM/Player transitions. Avoid flashing a loader for fast transitions. This audit only changed NPC profile and NPC/Location lists.
- **Potential profile data-loading follow-up:** Map, Item, and Lore profiles also fetch several campaign-wide lists per profile view. First measure with realistic authorized fixture sizes and database-backed Development requests (counts, payload sizes, timings); then consider server-filtered related-entity queries or scoped client requests only if measurements justify an API change. Acceptance: fewer relevant bytes/requests or lower profile interaction latency in repeated GM/Player runs, no cross-campaign/workspace reuse, no Player-hidden endpoint leakage, and refresh/edit parity. No new issue was created.

## Verification and rollback

`pnpm test` passed (215 passed, 3 skipped). `pnpm quality` passed lint, unit/API/boundary suites, API and E2E type checks, and production build. The guarded `pnpm test:e2e --grep @audit268` measurement passed; the focused loading/error/retry/empty/refresh/mode-switch test passed. `git diff --check` passed. The tests use intercepted API data and the Firebase Auth emulator; a real Neon round trip and production performance were not measured. No migration or dependency is needed. Reverting the code changes restores prior loading behavior; this audit document and test can be removed independently.
