# Retired suites (P7 migrates them)

These seven suites test the old blue-paper garden page (`#scene`, the journey
stops, the sheets, the reading page and its exploration controls), which the
sketchbook-to-house redesign replaced. They are kept here, unchanged except for
their relative import paths, so that `npm test` (glob `tests/*.test.mjs`) runs
only the suites that test the current page and CI reports real regressions.
None of them is deleted: ACCEPTANCE.md §5 says what each one keeps, adapts and
replaces, and P7 does that migration, then moves the adapted cases back into
`tests/` and deletes this folder.

`journey.test.mjs` and `localization.test.mjs` cannot even be imported: they
read the deleted `src/content.ts` (`stops`, `stageProgress`, `projects`,
`beats`). The other five import cleanly but drive the old DOM.

`interaction.test.mjs` was not on the final review's list of six, but all
five of its cases wait for the old `#scene` element and time out against the
current page (15 s each), so it is retired with the others.

| File | ACCEPTANCE §5 row | Retain or adapt (P7) | Replace (obsolete) | Current coverage meanwhile |
| --- | --- | --- | --- | --- |
| `portfolio.test.mjs` (38 cases) | `portfolio.test.mjs` | Semantic, no-JS, blocked-module and print exposure; deep links; 200%/400% reflow; WebGL unavailable and context loss/restoration; local voice fallback | Essential details in sheets, wheel chaining from nested notes, first-gesture autoplay ("sound on by default"), idle fade, duplicate stage/navigation UI, night stills, phone exploration controls (time, weather, season, pinch zoom) | `navigation.test.mjs`, `scene-lifecycle.test.mjs` (deep links, context loss, stills, F21 sound consent) |
| `presentation.test.mjs` (6 cases) | `presentation.test.mjs` | `?view` compatibility, viewport and resize behaviour, the no-live-renderer stills mode | Exclusive garden-vs-reader DOM trees, automatic phone overlay mode | `scene-lifecycle.test.mjs` (stills on and off, layout handoff), `narrative-model.test.mjs` (view parsing) |
| `journey.test.mjs` (2 cases) | `journey.test.mjs` | Chapter and phase sequence; real still availability and the ≤100 KB per-still budget (ACCEPTANCE §4) | Old fixed stop count, stage-to-content coupling, the day/night still pairs (night stills are removed) | `narrative-model.test.mjs` (chapter order and phases) |
| `lifecycle.test.mjs` (3 cases) | `lifecycle.test.mjs` | Hidden, paused and offscreen sleep and wake; disposal | Holds only at the opening or when paused: extend to the guided built-house reading holds | `scene-lifecycle.test.mjs` (reading holds, hidden tab, pause) |
| `localization.test.mjs` (6 cases) | `localization.test.mjs` | Locale precedence, placeholders, in-place switching, RTL, local narration | Sheet-specific assertions; expand to the current chapter and case vocabulary | `translations.test.mjs` (every rendered label translated) |
| `interaction.test.mjs` (5 cases) | `interaction.test.mjs` | Keyboard and pointer responses, interrupted navigation, focus restoration; exploration entry/exit and equivalent controls in release 2 | Planting/chime, postcard and fennec visits (removed features); essential-evidence hotspot and Inside-Whisperbook sheet expectations, replaced by direct chapter and case navigation | `navigation.test.mjs` (interrupted visits, focus, case return) |
| `quality.test.mjs` (2 cases) | `quality.test.mjs` | Quality persistence and state-preserving rebuilds | Any assumption that resizing restarts the narrative | `narrative-model.test.mjs` (quality choice only; the release-1 page has no quality control) |

`tests/performance.mjs` still imports cleanly and is left in place for P7
(ACCEPTANCE §5 asks for its scenarios to be migrated, not guessed);
`tests/run-performance-budgets.mjs` selects only `scene-lifecycle.test.mjs`
cases and does not reference any file here.
