# Progress record

Shared state between implementation sessions. Each session reads this first and updates it last. One section per phase; P2–P4 record slice and breadth separately. Record release, session/date, files touched, checks and capture paths when updating a phase. Status words: `not started`, `in progress`, `blocked`, `reviewed`, `done`. Never write `done` for code that has not been visually exercised. Handoff corrections below are findings and planned work, not completed application changes.

Release 1 cap: twenty working days from the first implementation session. Days used so far: 2.

## Decision gates

| Gate | When | Reviewer | Status | Entry |
| --- | --- | --- | --- | --- |
| G1 Motion study | End of P1 | User | not started | [motion-study/P1-MOTION-STUDY.md](motion-study/P1-MOTION-STUDY.md) (outcome a; recordings `.qa/p1/video/`) |
| G2 Release-1 slice review | After P2–P4 for intro → work → Whisperbook → existing Android `/work/whispbook/` → back → contact, with CV placement and repaired case assets | User | not started | — |

P5/new case routes and P6/exploration are not G2 prerequisites. Complete the release-1 candidate before starting them. An unresolved CV fact is a P2 publication blocker, not a blocker for independent layout work or G2's visual review; close CV verification before the release-1 candidate passes P7/P8. Translation review is asynchronous and bundled below; it does not add a design gate. Publication follows the authorization in the implementation chat.

## Open questions for the user

- Confirm Arabic stays a visible site language (default: yes).
- Confirm the build behind `public/assets/whisperbook.webp`, or capture a fresh one on the Nothing Phone 3 (needed for release 2 only).

That capture question is required only if the image is reused as proof; text-first cases can ship without it.

## Release-1 issues to resolve

| Finding | Owner phase | Required resolution | Status / evidence |
| --- | --- | --- | --- |
| Legacy `/work/whispbook/` and French copy are Android, not the web studio | P2/P3 | Preserve Android route identity; web studio links to its separate repository; test Android return to `#whisperbook` | P0 confirmed both pages describe Android; the homepage links to neither `/work/whispbook/` nor `/work/wattch/`. Not started |
| Both short-CV HTML sources retain the 300× PowerAPI claim excluded without clarified attribution; PDFs have not been audited by this handoff review | P0 audit → P2 correction/verification | Apply content contract, align HTML/PDFs, inspect all PDF pages and verify downloads before release 1 | P0 audit done (see CV record and `baseline/BASELINE.md` section 8): 300× and Qarnot wording fail in all four files, role line differs, no "bilingual" line, HTML and PDF text agree. Corrections not started |
| Six retained-case images absent locally | P0 inventory → P3 repair | Resolve each through verified recovery or text-first markup repair in EN/FR; verify clean output in P7/P8 | P0 inventory done: all six missing locally; all six exist on the deployed Pages repo and live site; provenance unestablished. Also 8 font files and 6 social SVGs are missing locally. Repair not started; see asset table below |
| Product and old tests retain planting, postcard and fennec visits | P4 removal → P7 validation | Remove discarded behavior/controls and obsolete expectations; update named test selections and preserve independent coverage for retained behavior | not started |

### CV verification record

| Locale | Source HTML | Published PDF | Source corrections / PDF SHA-256 / visual review |
| --- | --- | --- | --- |
| EN | `public/resume/chakib-belgaid-product-engineer-en.html` | `public/resume/chakib-belgaid-product-engineer-en.pdf` | P0 audit only, not verified (P2 corrects and inspects every page). PDF SHA-256 `7751470499821ca585c61d18db41ff0ba4e67543c7f0a9bbff4c17d53262b4a6`. Findings: 300× claim retained (HTML and PDF); Qarnot line says "deploying PowerAPI", not adapting the HWPC sensor; role line is "Full-stack Product Engineer · AI systems & developer tools"; no "bilingual" line; constrained-decoding line lacks the evaluation/enum/Pydantic wording; PDF typography flattens dashes and leaves a dangling " ·"; PDF metadata title differs. Unresolved facts: scope of "Led", 10,123 parameters vs 54 KB and "digits" vs "crops", JouleHunter authorship, Funecs figures, name form. No "custom sampler" wording. HTML and PDF text agree. |
| FR | `public/resume/chakib-belgaid-product-engineer-fr.html` | `public/resume/chakib-belgaid-product-engineer-fr.pdf` | P0 audit only, not verified. PDF SHA-256 `e016c9688cd27085df8d12066e008605c6421d43afce5b02b539f8e932a0d7f9`. Same findings as EN ("environ 300 fois"; "mise en production de PowerAPI"; "Ingénieur produit full-stack"; no "bilingue"); FR PDF metadata title is the English one. HTML and PDF text agree. |

### Retained-case asset resolutions

Paths below are under `public/assets/projects/`. Follow the [asset protocol](CONTENT_AND_EVIDENCE.md#retained-case-assets-missing-from-this-checkout). For recovered files, record provenance/checksum; for a text-first resolution, record repaired EN/FR markup and preview checks. “Missing” records checkout state, not live-site availability.

| Path | Resolution | Validation / evidence |
| --- | --- | --- |
| `whisperbook/now-playing.webp` | Missing locally. Candidate exists on Pages repo `chakib-belgaid.github.io` @ `4c0d83a` and live site (177008 bytes, SHA-256 `ec740fea1fc7baf6d9bd68ce1ccbba4a7c8f396dfe36d92ef3f2cdb1e5c2bff8`); saved only under `.qa/baseline/recovered/`, not copied to `public/`. Provenance and public-use status unestablished (byte-identical to `public/assets/whisperbook.webp` (build unconfirmed); first published to Pages 2026-08-21). P3 decision: verified add, or text-first repair in EN/FR. **Ledger conflict: see `baseline/BASELINE.md` section 7.1** (byte-identical to a root asset, contrary to the ledger's "different files" line). | P0 inventory only; `naturalWidth` is 0 in Chromium on both language pages; preview serves HTML 200 for the URL |
| `whisperbook/read-along.webp` | Missing locally. Candidate exists on Pages repo `chakib-belgaid.github.io` @ `4c0d83a` and live site (109716 bytes, SHA-256 `0b025fe3cc5c4d86187e305c200ab2f2185bd6dc83ec0402baf3d9d5593f4847`); saved only under `.qa/baseline/recovered/`, not copied to `public/`. Provenance and public-use status unestablished (Pages 2026-08-21). P3 decision: verified add, or text-first repair in EN/FR. | P0 inventory only; `naturalWidth` is 0 in Chromium on both language pages; preview serves HTML 200 for the URL |
| `whisperbook/voice-cast.webp` | Missing locally. Candidate exists on Pages repo `chakib-belgaid.github.io` @ `4c0d83a` and live site (123552 bytes, SHA-256 `02d48dced381230837d06c88405744a78aa5a60d6fff29eed63e1ccf2a2dbf14`); saved only under `.qa/baseline/recovered/`, not copied to `public/`. Provenance and public-use status unestablished (Pages 2026-08-21). P3 decision: verified add, or text-first repair in EN/FR. | P0 inventory only; `naturalWidth` is 0 in Chromium on both language pages; preview serves HTML 200 for the URL |
| `whisperbook/library.webp` | Missing locally. Candidate exists on Pages repo `chakib-belgaid.github.io` @ `4c0d83a` and live site (114764 bytes, SHA-256 `2729d3f51837340d374da3bda27c8dc9709bd842a872c8f68bd8c9821b083f84`); saved only under `.qa/baseline/recovered/`, not copied to `public/`. Provenance and public-use status unestablished (Pages 2026-08-21). P3 decision: verified add, or text-first repair in EN/FR. | P0 inventory only; `naturalWidth` is 0 in Chromium on both language pages; preview serves HTML 200 for the URL |
| `wattch/deterministic-trace.png` | Missing locally. Candidate exists on Pages repo `chakib-belgaid.github.io` @ `4c0d83a` and live site (219565 bytes, SHA-256 `ec0b3208215371f1278817e2dfcbfa7eff63c6152d0c6f2eae215a105ab4de1b`); saved only under `.qa/baseline/recovered/`, not copied to `public/`. Provenance and public-use status unestablished (self-labelled synthetic dry-run transcript; Pages 2026-08-21). P3 decision: verified add, or text-first repair in EN/FR. | P0 inventory only; `naturalWidth` is 0 in Chromium on both language pages; preview serves HTML 200 for the URL |
| `wattch/energy-tests.png` | Missing locally. Candidate exists on Pages repo `chakib-belgaid.github.io` @ `4c0d83a` and live site (95452 bytes, SHA-256 `7dfbd30b07b7f860221b18251d5fafcd3be1e0b4710d489aa25070971d1c45d9`); saved only under `.qa/baseline/recovered/`, not copied to `public/`. Provenance and public-use status unestablished (byte-identical to `public/assets/wattch.png`; self-labelled synthetic; Pages 2026-08-21). P3 decision: verified add, or text-first repair in EN/FR. **Ledger conflict: see `baseline/BASELINE.md` section 7.1** (byte-identical to a root asset, contrary to the ledger's "different files" line). | P0 inventory only; `naturalWidth` is 0 in Chromium on both language pages; preview serves HTML 200 for the URL |

## Descopes taken

None.

## Strings awaiting the user's review

List every new string, including breadth and release-2 additions after G2. French must be reviewed before publication; only Arabic review may be deferred under the recorded descoping order, with a visible draft label. Record any English-only new-case decision separately.

| Release / key | English | French draft / review status | Arabic draft / review status | Review or descope reference |
| --- | --- | --- | --- | --- |

## Acceptance evidence by release

Use the [release applicability table](ACCEPTANCE.md#release-applicability). Link a report with per-check status and evidence; do not mark deferred work as passed.

| Release | Required scope | Check results / evidence | Deferred work |
| --- | --- | --- | --- |
| 1 | Eight chapters, CVs, retained cases/assets/returns, removed-feature cleanup and applicable accessibility/localization/performance checks | not started | F8b, F23–F24 exploration checks, F25b; new cases and exploration belong to release 2 |
| 2 | New main cases and exploration plus regression checks on release-1 behavior | not started | None by default |

## Phases

### P0 — Baseline and working context

- Status: reviewed (documentation only; baseline is reproducible; failures below are assigned phases; gate review passed with fix round 1 applied)
- Session: 1 November 2026 (day 1)
- Source SHA at start: `fa4386b984ce8c20dda90ddcfd2943f1b1861ef5` on `feat/sketchbook-house-narrative`; source identical to the inspected `453d26a8a8d26ef2785dc2e6a8c4b5c1af309b58` (only handoff docs and a `.gitignore` line differ). Working tree was clean; single worktree; no `AGENTS.md`.
- Files touched: `docs/handoff/sketchbook-to-house/baseline/BASELINE.md` (new), `docs/handoff/sketchbook-to-house/PROGRESS.md`. No application source, tests, config or public assets edited; no recovered image copied into `public/`.
- Validation run (Node v26.12.0, Playwright Chromium 151.0.7922.34 headless, macOS 27.0.1, Apple M5, **SwiftShader software WebGL**, preview on port 5199, production build with `SITE_ORIGIN`): build exit 0; `npm test` 86 tests, 85 pass, 1 fail (`a deep link opens the journey at its stop`, timing-flaky: passed alone twice; obsolete in P4/P7); `test:performance:budgets` 5 tests, 2 pass, 3 fail (fennec stall 317 ms; paused/hidden lifecycle frame-count limits under software rendering; environmental, to be re-run on accelerated hardware in P7); `RUNS=5 test:performance` ran its 5 existing scenarios (25 runs, no page errors). Results and medians are in `baseline/BASELINE.md` sections 3 and 4. LCP, CLS, throttling and a true hidden-tab check are not measured by the existing harness.
- Captures (git-ignored, local): `.qa/baseline/captures/` (28 PNG + `capture-log.json`): desktop 1440x900 and phone 390x844 DPR 3 for entry, `#work`, `#contact`, `#whisperbook` deep link, reduced motion, no-JS, `?view=read`, `?view=stills`, and the six EN/FR case pages. Test-run screenshots, logs, `performance.json`, PDF renders and fetched candidates are also under `.qa/baseline/`.
- CV discrepancy audit: done for source HTML and PDF text; not a rendered-page verification. 300× claim and the Qarnot "deploying PowerAPI" wording remain in all four files; role line differs from the contract; no "bilingual" language line; constrained-decoding wording is partial; PDF typography defects; HTML and PDF text agree; no "custom sampler" wording. Unresolved facts for the user: scope of "Led", BP Log parameter count and "digits" vs "crops", JouleHunter authorship, Funecs figures, name form. The same 300× and a "100+ nodes" claim also appear in `src/content.ts`, translations, `llms.txt`, `llm.txt` and `README.md`. Corrections and rendered-PDF verification are P2 work.
- Retained-case dependency inventory: done. Six ledger images missing locally, all present on the Pages repo and live site (checksums in the asset table); two are byte-identical to the root `whisperbook.webp` and `wattch.png`. Beyond the ledger: 8 font files referenced by `public/assets/legacy-evidence.css` and 6 `social/*.svg` og:image files are also missing locally (they exist on Pages). The preview serves HTML with status 200 for missing files, so decode status is the real check. The homepage links to neither `/work/whispbook/` nor `/work/wattch/` and has no CV link; `public/sitemap.xml` lists only `/`.
- Open issues: **for the controller/P3: `CONTENT_AND_EVIDENCE.md` says the root `whisperbook.webp`/`wattch.png` are "different files" from `projects/whisperbook/now-playing.webp`/`projects/wattch/energy-tests.png`, but they are byte-identical (BASELINE section 7.1); correct the ledger or decide the substitution explicitly**; provenance and public-use status of the six images (user decision, P3); whether the user wants a "bilingual" language line on the CVs; confirmation of the unresolved CV facts above; hardware-accelerated rerun of the budget tests (P7); harness migration for LCP/CLS/throttling and the new scenarios (P7); two additional dependency groups (fonts, social SVGs) need an owner in P3.

### P1 — Actual-house motion study

- Status: in progress (implemented and visually exercised; awaiting controller review and the user's G1 review)
- Session: 1 November 2026 (day 2). Study document: [motion-study/P1-MOTION-STUDY.md](motion-study/P1-MOTION-STUDY.md)
- Files touched: `src/scene.ts` (new `setAmbient`, `snap`, `isSettled`, `onSettled`; focus aims at the target build scale; warm-paper light ink), new `src/narrative/scene-adapter.ts`, new dev-only `dev/motion-study.html` + `src/narrative/motion-study.ts`, `dev/vite.study.config.ts`, `dev/motion-study-stills.mjs`, `dev/motion-study-run.mjs`, this file and the study document. Not touched: `main.ts`, `render.ts`, `content.ts`, `index.html`, `style.css`, `vite.config.ts`, `public/`.
- Outcome (a / b / c): **(a)** global construction progress plus named focus is legible at 1440×900 and at 390×844 in a 45vh slot. No reveal manifest; estimate if wanted later: 1.5 to 2 days (per-region × per-colour batching raises draw calls).
- Portrait slot approach tried (45 percent, sticky during transition): one 45vh slot per chapter between motivation and decision; the scene moves into the active slot; the slot is sticky at top 0 only while a scroll-driven transition runs, then releases into flow with a 260 ms slide. Measured stuck 0.91 s → 2.45 s, released at settle. Direct jumps never stick.
- Measurements (SwiftShader): guided hold draws 0 frames over 10 s at Build and at Bloom in both hosts (released control: 13/s wide, 30/s phone); a navigation after a hold draws its destination in 1 frame; direct jumps 1 frame (2 to 6 ms); eased transitions settle in 1.7 to 2.9 s; `snapTo` leaves later changes eased; rapid scroll across six chapters gives one settle at the destination.
- Recordings: `.qa/p1/video/wide.webm`, `.qa/p1/video/portrait.webm` (git-ignored); stills `.qa/p1/stills/`; data `.qa/p1/measurements.json`, `.qa/p1/recordings.json`.
- Checks: `npx tsc --noEmit` and `npm run build` green; `dist/` contains no study page; legacy `/#whisperbook` smoke check at 1440 and 390 with no page errors. Full browser suite not run (owned by P7).
- Fix round 1 (review): BP Log cue retuned (about 2×, heart garden centre-low, hover-ring `mark`), because the first framing let the pavilion read as the subject; `moving()` now includes the camera aim point; holds re-measured at 0 frames.
- Open issues: the BP Log heart garden is the subject by position and ring, but the pavilion above it shares its terracotta (P4 option: lighter pavilion roof at partial build or a one-region reveal); cue marks share `Garden.hover` with any label pointing in P4; the stuck portrait slot covers the first lines of the decision until settle; vacated slots show blank paper; activation thresholds are tuned for placeholder copy; eased settles are long for scroll (camera ease); the built house reads bright on ivory (exposure); re-measure on accelerated hardware in P7.

### P2 — Content model, static semantic shell and verified CVs (release 1)

- Slice status: not started
- Breadth status: not started
- CV source/PDF verification: not started; see CV record above
- Open issues: —

### P3 — Layout, retained-case repairs and state restoration (release 1)

- Slice status: not started
- Breadth status: not started
- Legacy Android EN/FR return-path checks: not started
- Missing-asset resolutions: not started; see asset table above
- Open issues: —

### P4 — Guided scene integration and lifecycle (release 1)

- Slice status: not started
- Breadth status: not started
- Open issues: —

### P7 — Regression, localization, accessibility, performance (release 1)

- Status: not started
- Devices covered: —
- Applicable acceptance report: —
- French review / Arabic review or recorded descope: —
- Clean-build case dependency checks: —
- Open issues: —

### P8 — Release 1 candidate and publication

- Status: not started
- Release-1 candidate complete: no
- PR: —
- Deployed SHA: —
- Rollback reference: —

### P5 — Main case pages and evidence assets (release 2)

- Status: not started
- Prerequisite: release-1 P7/P8 candidate complete (publication not required)
- Representative new `/work/whisperbook/` case and return path: not started
- Remaining main cases / retained-route compatibility: not started
- Existing verified CV links: not started

### P6 — Finished-house exploration (release 2)

- Status: not started
- Prerequisite: release-1 P7/P8 candidate complete and P4 adapter available

### P7 / P8 — Release 2 closure and publication

- Status: not started
- Applicable acceptance report / release-1 regressions: —
- French review / Arabic review or recorded descope: —
- PR / deployed SHA / rollback reference: —
