# Active Feature Surface Audit

Last updated: 2026-08-24
Issue: [#319](https://github.com/dopaminedungeon/dopamine-dungeon/issues/319)

## Purpose

This audit records which product surfaces are active, which were retired, and
which domain concepts remain only as infrastructure or future work. It is not a
roadmap and does not authorize future feature implementation.

## Audit summary

| Feature | Visibility | Data source | Current and narrative value | Cognitive or safety risk | Cross-linking | Decision |
|---|---|---|---|---|---|---|
| Dashboard | GM and Player | Persisted campaign/workspace context plus static guidance | Useful campaign identity and navigation; not an activity feed | Repeated metadata and non-authoritative status copy | None | Keep; simplify only through separate work |
| Sessions | GM and Player-safe views | Neon through protected API | Core narrative timeline | Spoiler projection and campaign scope must remain server-enforced | Active profile links | Keep |
| NPCs | GM and Player-safe views | Neon through protected API | Core narrative actors | Large profile; GM notes and hidden entities are sensitive | Active profile links | Keep; placeholder cards retired |
| PCs | GM and assigned Player views | Neon/API with transitional invitation paths | Core party and character sheets | Assignment and visibility boundaries are sensitive | PC link type retained; profile link UI is future work | Keep |
| Bag of Holding | GM and Player | Neon through protected API | Shared party inventory | Loose entries, item links, and currency must remain consistent | Active Bag to Item links | Keep unchanged |
| Items | GM and Player-safe views | Neon through protected API | Narrative and mechanical objects | Hidden item fields must not reach Player responses | Active profile and Bag links | Keep |
| Lore | GM and Player-safe views | Neon through protected API | Core narrative context | GM-only lore and notes are sensitive | Active profile links | Keep |
| Locations | GM and Player-safe views | Neon through protected API | Narrative anchors, not VTT maps | Images are currently stored with records; revisit separately | Active profile links | Keep |
| Campaign settings | GM | Hybrid Neon/API and transitional Firestore paths | Membership, invitations, assignments, and base metadata are active | Campaign lifecycle and extended metadata do not yet have one canonical store | No campaign-level link surface | Keep real behavior; fake panels retired |
| Character import | GM | Local PDF parsing followed by Neon persistence | High-value character onboarding | Parsed data requires review; avoid diagnostic disclosure | No automatic links | Keep unchanged |
| Entity links | GM authoring and Player-safe reads; Bag exception | Neon through protected API | Core narrative infrastructure | Per-link visibility, tenant scope, and campaign scope are security boundaries | The infrastructure itself | Keep and protect |
| Arcs | Not visible | Retired mock data | No current product value | Zombie UI implied persistence that did not exist | Typed endpoints and labels retained | Retire mock UI; future work only |
| Quests | Not visible | Retired mock data | No current product value | No schema or API existed | Typed endpoints and labels retained | Retire mock UI; future work only |
| Conditions | Not visible | Retired mock data | No current product value | Risk of premature rules-engine or VTT scope | Typed endpoints and labels retained | Retire mock UI; future work only |
| Search and notifications | Not visible | Retired placeholders | No current value | Looked interactive without behavior | None | Retire until separately implemented |

## Retired in #319

- The disabled Arcs, Quests, and Conditions list/profile pages, feature flags,
  route branches, navigation entries, and mock data.
- The non-functional top-bar search and static notification/unread controls.
- NPC Friendship Index and Quest placeholder cards.
- Campaign Settings visibility-default and cross-link placeholder panels.
- The developer-facing loading-gate note.
- Unused local developer/debug and template references identified by the audit.

Retiring these screens does not retire the `Arc`, `Quest`, or `Condition` entity
types or their allowed labels. Those types remain in the typed entity-link
contract so active persisted links and future migration paths are not narrowed.

## Explicit preservation boundary

The audit did not redesign or remove Dashboard, Sessions, NPCs, PCs, Bag of
Holding, Items, Lore, Locations, Campaign Settings behavior, character import,
authentication, invitations, emulator fixtures, API contracts, schemas, or
active entity-link behavior. `SessionEntityLinkManager.jsx` remains retained
pending a separate decision about near-term session cross-linking.

## Follow-up decisions

- Dashboard activity and “what matters now” signals need a separate product
  decision backed by authoritative data.
- Campaign creation, deletion, and extended settings metadata should follow the
  Firestore-to-Neon ownership plan rather than being changed in this cleanup.
- Location image storage and upload limits need a focused persistence decision.
- PC profile cross-link presentation remains future work; the typed link
  infrastructure is already preserved.

## DD Quality Gate feedback

The normal `DD Quality Gate` check and GitHub Actions job summary remain. On
pull requests, the workflow also maintains one marked `DD Quality Gate` comment
containing separate Blocking and Advisory sections plus a run link. A rerun
updates that comment instead of creating another. Comment publication is
non-blocking and does not add a test layer.
