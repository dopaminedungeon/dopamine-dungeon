# Issue #389 responsive width audit

## Shared patterns

| Pattern | Use |
| --- | --- |
| `.app-page-standard` | Dashboard and similarly structured overview content; centered, full available width up to 72rem. |
| `.app-page-wide` | Entity lists/details and settings with forms, metadata, or tables; centered, full available width up to 80rem. |
| `.app-reading-width` | Narrative paragraphs, lists, and quotations; readable prose line length inside a wider page. |

Page roots use `min-w-0`; cards and fields reflow inside them. Tables that need a minimum column width keep their local `overflow-x-auto` wrapper. Dialogs, auth cards, and short onboarding forms keep intentional compact widths.

## Screen inventory

| Screen / route | Before | After / disposition |
| --- | --- | --- |
| Home `/home`, GM and Player | Overview had no page cap. | `.app-page-standard`; grids retain their existing breakpoints. |
| Sessions `/sessions` | List used the full shell width. | `.app-page-wide`; search and filters remain responsive. |
| Session profile `/sessions/:id` | Had a local `max-w-7xl`. | Uses `.app-page-wide`; loading/error cards remain compact. |
| PCs `/pcs` and Bag of Holding `/pcs/bag` | Full-width roots with different outer padding. | Both use `.app-page-wide`; dense inventory controls and subtables retain internal scroll/reflow. |
| PC profile `/pcs/:pcId` | Full-width root; several dense grids. | Uses `.app-page-wide`; dense sections keep their existing responsive grids. |
| NPCs `/npcs` | Full width with fixed `p-8` mobile padding. | Uses `.app-page-wide` with responsive root padding; cards reflow 1/2/3 columns. |
| NPC profile `/npcs/:id` | Full-width profile and paired detail columns. | Uses `.app-page-wide`; existing GM/Player conditional sections are unchanged. |
| Locations `/maps` and `/maps/:id` | Full-width list and detail roots. | Both use `.app-page-wide`; map viewer remains a wide, bounded modal with contained image. |
| Lore `/lore` and `/lore/:id` | Full-width library and detail roots. | Both use `.app-page-wide`; narrative Markdown uses `.app-reading-width`. |
| Items `/items` | Full-width list; item profile already had a local `max-w-7xl`. | List and profile use `.app-page-wide`; narrative copy uses `.app-reading-width`. |
| Profile Settings `/settings/profile` | `max-w-5xl` plus an `xl` split constrained the cards. | #342 was merged to `dev` during this audit and its exact tested files were brought into this older branch. It uses `.app-page-wide`, keeps the cards stacked until `2xl`, and reflows fields and role details at explicit breakpoints. |
| Workspace Settings tab | Inherited Profile Settings' narrow parent; member table has a 760px minimum. | Inherits `.app-page-wide`; table retains a local horizontal scroller. |
| Campaign Settings `/campaigns/settings` (GM) | Full-width root; people table has an 880px minimum. | Uses `.app-page-wide`; table remains horizontally scrollable within its own wrapper. |
| Welcome `/welcome` | Centered compact card. | Manual rendered check at actual 200% browser zoom passed; remains intentionally compact for a single choice/action. |
| Workspace / campaign bootstrap and picker | Forms/cards use 480–520px limits. | Manual rendered onboarding check at actual 200% browser zoom passed; compact centered form pattern remains appropriate. |
| Invitation accept/onboarding entry | Invitation form uses `max-w-2xl`; shared auth/recovery cards use 480px. | Manual rendered invitation check at actual 200% browser zoom passed; remains a focused form/card pattern. |
| Quests, Arcs, Conditions, Relationships | No active route; these screens are retired. | Not applicable. Existing route handling resolves these paths to Not Found; no width change. |

## Evidence and limits

The guarded Playwright sweep uses synthetic names and intercepted API responses. It visits routed lists/details in GM and Player modes at 375, 640, 768, 1280, and 1920 CSS pixels, checks each shared container and document overflow, exercises Profile and Workspace Settings, and visits Campaign Settings in GM mode. A synthetic GM-only NPC is present in GM mode and absent in Player mode.

| CSS viewport | Before: common page root | After: standard | After: wide |
| ---: | ---: | ---: | ---: |
| 375 | 343px | 343px | 343px |
| 640 | 592px | 592px | 592px |
| 768 | 432px | 432px | 432px |
| 1280 | 944px | 944px | 944px |
| 1920 | 1584px | 1152px | 1280px |

Values are rendered root/container widths with the app shell sidebar and padding included in the viewport geometry. At 375–1280px the available app content area was narrower than either maximum, so the new patterns fill that space. Profile Settings uses a nested padded area and measures 311px at 375px, 544px at 640px, 384px at 768px, 880px at 1280px, and 1280px at 1920px. The 1920px baseline Profile Settings wrapper was capped at 1024px (`max-w-5xl`), with its `xl` split making the cards narrower still.

The sweep does not use a real campaign or database. Retired routes are identified from the route table and source but were not rendered in the sweep. The 640px check represents the effective CSS width of a 1280px viewport at 200% zoom; it is not an actual browser chrome zoom. The browser zoom shortcut was not honored by the headless test browser. Actual 200% browser zoom and the rendered welcome, onboarding, and invitation flows were subsequently checked manually and passed.
