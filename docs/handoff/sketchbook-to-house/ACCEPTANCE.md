# Acceptance, validation and release

Use this alongside the implementation plan. These are completion criteria, not a claim that the future implementation has already passed them. Documentation-only work did not run the site's build/tests or establish a new runtime baseline.

## Release applicability

Use this table for both the slice and the release candidates. Record each check as passed, failed or deferred to release 2, with evidence in PROGRESS.md. Deferred is not passed. G2 covers the release-1 slice through the **existing Android** `/work/whispbook/` case; the complete release-1 gate still requires all eight chapters and all retained cases.

| Checks or surface | Release 1 | Release 2 |
| --- | --- | --- |
| V1–V11; F1–F7, F9, F11–F22; A1–A12 | Required for shipped homepage, retained cases, CVs and available controls; no new-case or exploration requirement is implied | Retain coverage and extend to new cases/exploration where relevant |
| F8a, F10: retained routes, dependencies and case return | Required for MCQ Scan, Wattch and legacy Android cases, EN/FR copies, and `/live/` redirects | Must still pass; extend F10 to the new case routes |
| F8b: four main case destinations | Deferred; no links to unbuilt new routes | Required: three new cases plus expanded MCQ Scan, with specified locale pairing |
| F23–F24: exploration entry/exit and input | Deferred; release 1 has no Explore action or exploration input handlers. **Superseded 3 November 2026:** the user restored exploration in the current product, so F23–F24 and F28–F30 are required now | Required |
| F25a: planting, postcard, fennec visits | Until 3 November 2026: required absent (no planting, postcard or fennec visits/controls). **Reversed 3 November 2026:** restored by the user; required present under F25a's conditions and F31–F32 | Required, as restored |
| F25b: retained exploration features | Deferred; their UI is absent in release 1. **Superseded 3 November 2026:** the garden panel and exploration ship now, so F25b and F33–F34 are required | Required |
| F26–F27: weather permission and impact methodology | Required for any retained services/instrumentation; no exploration UI is required. If dormant, verify no unsolicited permission request or misleading claim | Required for the exposed exploration features as well |
| Performance, build-output checks and release gate | Required for all release-1 scenarios, including verified CVs and repaired retained-case assets | Repeat for changed behavior and the expanded journey; retain release-1 guarantees |
| F35–F38: case evidence, demos, share cards, on-request loading | Required from 3 November 2026 (restored by the user) | Must still pass |

**3 November 2026 reversal.** In the 78-item decision table of 3 November 2026 the user restored, from `main`, the explicit "Explore the garden" state, its place labels, planting with the fennec's visit, "Save a postcard", the quality rebuild, the optional rendering detail, and the six case screenshots with Inside Whisperbook and Listen. They ship in focused modules loaded on request, not in the old `main.ts`. The rows above keep their earlier wording so the history stays visible; the rewritten F25a and the new F28–F38 below are the current criteria. Decision 75 asks that the documentation follow the chosen behaviour.

Only named release-2 features are deferred. No-JS content, URL identity, sound opt-in, motion preferences, translation policy, CV verification and retained-case asset completeness are release-1 requirements. Apply overlay-specific accessibility checks only where an overlay ships; record an absent optional surface explicitly rather than claiming it was exercised.

## 1. Visual and narrative acceptance

A technically passing conventional portfolio does not satisfy this redesign. Capture and review these states using the **actual scene**, not the generated art:

- [ ] V1 Opening is visibly a sketchbook/drawing, with identity and promise readable immediately.
- [ ] V2 The same architectural silhouette is recognizable through Sketch, Blueprint, Build and Bloom.
- [ ] V3 Depth/material changes are visible and intentional; this is not a crossfade between unrelated static images in the enhanced experience.
- [ ] V4 The reading pavilion, observatory, heart garden and other existing identity-bearing forms survive the redesign.
- [ ] V5 Scene framing supports the active project. Named content and evidence can be read without knowing the building metaphor.
- [ ] V6 The camera and construction hold still during reading; there is no automatic idle content fade or Bloom orbit in guided mode.
- [ ] V7 Contact has the completed house and a visible next action. A visitor can contact Chakib without exploring it.
- [ ] V8 Mobile retains the transformation and deliberate framing; it is neither text-only by default nor a shrunken desktop canvas with a long overlay. The slot may stick to the viewport top only while a transition runs.
- [ ] V9 Real text is legible in all intended lighting states, including night if retained. The sky does not become a noisy background behind body copy.
- [ ] V10 Product proof is separately identifiable from decorative architecture and synthetic illustrations.
- [ ] V11 Role line, promise and the CV link are visible before any scroll on desktop and at 390×844.

Evidence to retain: opening, work index, each project reading hold, About, Contact, evidence page, reduced-motion and unavailable-WebGL screenshots; short wide/portrait recordings showing approach → settle → hold → next chapter and direct navigation to Contact. Record actual rendering quality/device settings.

The supplied review boards are references for hierarchy and intent. They are not exact production geometry, font, camera or timing requirements. Resolve visual deviations intentionally and explain material ones.

## 2. Functional acceptance

### Content and navigation

- [ ] F1 One semantic `<main>` contains all essential homepage copy; one h1, logical headings, no duplicate accessible reading trees.
- [ ] F2 Name, Work, About, Contact and CV are discoverable on both sizes; existing language selection remains usable.
- [ ] F3 Work displays BP Log, Whisperbook, energy tools and separately labeled MCQ Scan without opening a sheet.
- [ ] F4 All canonical and legacy fragments in the plan work on initial load, refresh, direct hash change and Back/Forward.
- [ ] F5 Explicit navigation pushes history and focuses the destination; passive scroll replaces location without moving keyboard focus.
- [ ] F6 Interrupting navigation cancels its pending animation/focus. Arriving at Contact never triggers a delayed return to a previous chapter.
- [ ] F7 `#workshop` still identifies experiments, not MCQ Scan; `#wattch` still finds the energy/Wattch context.
- [ ] F8a Both releases: `/work/mcq-scan/`, `/work/wattch/`, `/work/whispbook/` and their `/fr/work/` copies remain usable with correct EN/FR `hreflang` pairing. `/work/whispbook/` and its French copy still describe Android, while the web-studio notebook entry links to its distinct repository. `/live/` and `/fr/live/` still land on readable content. All retained-case local dependencies resolve in a clean build/preview; verify images decode, not merely that their requests return HTTP 200. Each of the six missing images has a recorded recovery or text-first resolution.
- [ ] F8b Release 2: `/work/bp-log/`, `/work/whisperbook/`, `/work/energy-tools/` and the expanded `/work/mcq-scan/` exist in production output with EN/FR `hreflang` pairing (or a recorded English-only decision for new pages). Legacy Android and Wattch cases link to their new corresponding stories without changing project identity.
- [ ] F9 Source/release links are valid; modifier-click/new-tab behavior is preserved. No design-deck placeholder links reach production.
- [ ] F10 Back from evidence and explicit Return both find the original project and useful reading position, preserving locale/view where available; failure/absence of session storage has a safe chapter-anchor fallback. Test retained local cases in release 1 and new cases in release 2. Returning from `/work/whispbook/` finds `#whisperbook`, not the web-studio notebook; a return from a guided visit does not unexpectedly force stills mode.
- [ ] F11 From release 1, CV links point to verified short CVs and preserve EN/FR URLs. Download labeling matches the actual file language. HTML/PDF claims agree with the content contract, including the narrowed Qarnot contribution; the unsupported 300× claim is not retained by default. Every rendered PDF page has been visually inspected, with asset checksums and validation recorded in PROGRESS.md.
- [ ] F12 Email opens a composer; no automatic message or fake “sent” state is produced.

### Rendering and lifecycle

- [ ] F13 The complete semantic page works with JavaScript disabled, the entry module blocked, or scene import rejected.
- [ ] F14 The renderer enhances reserved geometry without changing text layout; posters do not collapse or expand when WebGL becomes ready.
- [ ] F15 Exactly one live house renderer is used. Changing chapters does not repeatedly build/dispose the entire garden or create many WebGL contexts.
- [ ] F16 Direct deep links initialize the correct pose/poster; no visible Sketch flash before the requested chapter.
- [ ] F17 Hidden tab, offscreen host, stills mode and guided reading holds stop recurring scene/sky draws after settling.
- [ ] F18 Returning from hidden state restarts the clock without a large movement jump. Rapid scroll applies the latest state rather than replaying a queue.
- [ ] F19 Context loss shows the correct still, retains content/navigation and restores the latest scene safely when possible.
- [ ] F20 Resize, mobile URL-bar changes, orientation, font completion and locale changes preserve the selected content and usable scroll/focus.
- [ ] F21 Audio cannot start through Work/Contact/CV clicks, ordinary keyboard input or scrolling. Only the explicit sound control enables it.
- [ ] F22 Pause and system-reduced motion are independent from sound consent and navigation pose selection; settings do not silently overwrite one another.

### Exploration and preserved features

- [ ] F23 Release 2 (required now, 3 November 2026): exploration is explicitly entered and exited; exit restores reading position and focus.
- [ ] F24 Release 2 (required now, 3 November 2026): orbit/pinch/drag handlers capture input only in that mode. Ordinary reading retains native scrolling and browser zoom in both releases.
- [ ] F25a Both releases: planting, the postcard and the fennec visits are present, as restored by the user on 3 November 2026 (until then this item required them removed, by the earlier decision). Planting is a deliberate choice in the garden panel (Plant one, Plant by clicking; at most 24 trees, kept across rebuilt gardens); the postcard is made only on request and sends nothing; a fennec visits only after deliberate planting while motion is allowed. Every control works or is disabled with a reason, and every string is translated.
- [ ] F25b Release 2 (required now, 3 November 2026): quality, sky with time/weather/season, the carbon tally, rotate and zoom are retained in exploration. ~~Release 1 may retain dormant reusable code, but exposes no exploration controls.~~ Superseded: the garden panel and exploration are part of the current product.
- [ ] F26 Missing weather/location permission does not block the page. Exact location remains an explicit request.
- [ ] F27 Impact data retains measured-versus-estimated distinctions, unknown transfer sizes and unavailable GPU timers. It is not called a hardware Wattch measurement.

### Restored on 3 November 2026

The user's decision table of 3 November 2026 brought these back from `main`, in focused modules. All are unchecked until exercised against a production preview.

- [ ] F28 "Explore the garden" (garden panel) is the only way in. Entering keeps the reading position, shows the toolbar and the place labels, turns ambient life on and moves focus to "Back to reading". Back to reading and Escape restore the reading position, focus (the Explore button) and the chapter's pose, and the reading hold returns to 0 recurring frames. A layout change or a lost renderer also exits safely. Stacked layouts explore in a full-screen dialog; the rest of the page is inert and does not scroll until exit.
- [ ] F29 Gestures act only on the stage and only while exploring: drag turns, wheel or trackpad pinch zooms about the pointer, two fingers zoom and pan. Outside the mode, wheel, touch and browser zoom behave natively. Each gesture has an equivalent control (Turn left/right, Zoom in/out, Reset view; arrow keys in the toolbar). Under pause or reduced motion each change is drawn at once.
- [ ] F30 Place labels exist only while exploring, are keyboard-reachable buttons, and name the current chapters: BP Log, Whisperbook, pyRAPL, pyJoules & Wattch, MCQ Scan, The path so far. Pointer or focus highlights the place; activating one leaves exploration and performs an explicit visit (history entry, heading focus) to its chapter.
- [ ] F31 "Save a postcard" downloads a PNG of the scene as arranged (sky, trees, turn, weather, season) with a caption and the portfolio's address. Its module is fetched on the first request; no network request carries the image; the control is disabled while only stills are shown.
- [ ] F32 Fennec visit: after deliberate planting, with motion allowed, the nearest fennec on that level completes one visit (notice, approach by a valid route, settle, return); a held garden keeps drawing until the visit ends, then sleeps again. Pause or reduced motion brings none. Fennecs are drawn only by day, in dry weather and in the full build, so at the default 22:00 night a visit is visible only after the visitor moves the hour into daylight; record the user's decision on fennecs at night.
- [ ] F33 A Light/Full choice that changes the geometry tier rebuilds the garden in place, preserving chapter, trees, atmosphere, camera (turn, zoom, pan) and the carbon tally; the old garden stays on screen until the new one has drawn; a failed build falls back to stills. A choice that does not change the tier only changes how it is drawn.
- [ ] F34 "Show rendering detail" in the tally panel is optional: fetched on the first press, sampling (CPU/GPU ms sparkline, triangles, draw calls) only while open and the tab is visible, stopping when closed; labelled as this page's estimated rendering cost, not a Wattch hardware measurement.
- [ ] F35 Case screenshots: the four Whisperbook and two Wattch images ship in `public/assets/projects/` in a clean build, in EN and FR, with their original captions and Wattch's synthetic/protocol labels, width and height attributes, the hero eager and the rest lazy below the fold, and a plain file link that works without JavaScript. With JavaScript the enlargement dialog offers Actual size / Fit image / Close, closes on Escape and returns focus to the opening link. `scripts/verify-case-dependencies.mjs` decodes every image.
- [ ] F36 Whisperbook case demos: "Inside Whisperbook" steps through four steps (Step inside, Next, Back, Close, a polite count) and is one list with reduced motion or without JavaScript. "Listen" uses only voices on the device, in the page's language, never a network voice; it starts only on request, has Stop, stops when the page is left or hidden, says so when no voice exists, and is labelled as not the Android narration engine.
- [ ] F37 Share cards: six self-hosted 1200×630 PNGs at `public/assets/social/<slug>-<lang>.png` for the three cases in EN and FR, referenced by each page's `og:image` and `twitter:image`, built by `npm run share-cards` and validated by `npm run share-cards -- --check`.
- [ ] F38 On-request loading: exploration, postcard and rendering-detail code is not fetched until asked for; reduced motion, data saver and `?view=read|stills` load no renderer until asked; sound starts only from its control; no third-party request is made by default (Open-Meteo only from Live or exact location). Record entry and scene chunk sizes as measurements, not promises (3 November 2026: entry 101.44 kB JS / 27.22 kB CSS minified, against 92.37 / 24.34 before; scene chunk 605.14 kB).

## 3. Accessibility and localization

- [ ] A1 Test keyboard-only navigation, focus visibility, focus order, skip link and Escape/close behavior for optional overlays.
- [ ] A2 Sticky elements do not cover the focused control or destination heading. Use measured header offsets and appropriate scroll margins.
- [ ] A3 All essential text and actions remain available at 200% text and 400% zoom/320 CSS px reflow; no forced horizontal page scrolling.
- [ ] A4 Aim for generous 44 px touch controls where practical. This is a design comfort target, not a claim that every smaller control violates WCAG AA.
- [ ] A5 Verify text contrast against each actual scene/background combination; choose a stable text surface where contrast would otherwise vary.
- [ ] A6 Reduced motion is honored from initial load, with stable phase presentation and no camera travel. A user pause control is discoverable.
- [ ] A7 The non-interactive guided canvas is decorative to assistive navigation; meaningful chapter content is HTML. If exploration controls make the scene interactive, provide named equivalent controls and instructions without duplicating the whole content tree.
- [ ] A8 EN/FR/AR strings and accessible names are covered. Arabic shapes correctly, direction is right-to-left where appropriate, and technical names/code remain readable.
- [ ] A9 Locale precedence and blocked-storage behavior remain: URL, saved preference, supported browser language, English fallback. Switching keeps current chapter and mounted controls.
- [ ] A10 Live announcements are reserved for useful status/failure; do not announce every animation frame or every small scroll movement.
- [ ] A11 Print exposes the complete content and source links without fixed controls or huge blank scene regions.
- [ ] A12 Manually check at least VoiceOver/Safari or an available equivalent screen-reader/browser pairing; name what was actually covered.

Use the official [WCAG 2.2 recommendation](https://www.w3.org/TR/WCAG22/) to scope conformance, including keyboard/reflow/contrast and relevant interaction criteria. Specifically check [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum). Supporting reduced interaction motion is a design requirement here; do not incorrectly describe every motion preference as an AA-specific criterion. Automated tests alone do not establish conformance.

## 4. Performance measurement and budgets

### Baseline provenance

The prior November review ran three cold HTTP-cache runs per mode in Chrome 156 on Apple M5. Mobile used desktop-browser emulation at 390×844, DPR 3, 4× CPU slowdown, 1.6 Mbit/s download and 150 ms latency; weather was blocked. Startup was observed for seven seconds and followed by a short settled sample. These were lab observations, not physical-phone or field data.

| Prior mode | Median observed LCP | Startup CLS | Reported startup transfer | First WebGL draw |
| --- | ---: | ---: | ---: | ---: |
| Desktop default | 0.16 s | 0.014 | 948 KB | 0.77 s |
| Desktop reading | 0.19 s | 0.000 | 441 KB | No scene |
| Mobile default, throttled | 1.99 s | 0.882 | 621 KB | 4.00 s |
| Mobile reading, throttled | 2.05 s | 0.027 | 441 KB | No scene |

Source records: [prior-performance.json](references/prior-performance.json). KB is decimal. These figures are context, not a guaranteed measurement of the checkout when implementation starts. Refresh them in P0. The default LCP often described loading text/still, not scene readiness; measure those separately.

### Required protocol

1. Production build and verified preview server; capture source SHA, Node/browser version, OS, hardware, viewport, DPR, renderer backend and quality tier.
2. Use at least five repeated comparable cold runs per scenario for the candidate and baseline. Report individual runs and median; distinguish browser-cache reset from a genuinely cold network connection. Avoid a field-percentile claim from five lab runs.
3. Collect LCP with its element, CLS session-window calculation, main-thread long tasks, reported transferred/decoded bytes, scene request/first draw/correct-pose readiness and fonts/images requested before first useful content.
4. Observe startup for a fixed documented window, then a complete scripted journey. Add ten-second settled reading windows and hidden/offscreen/paused checks. Account for lazy resources loaded later rather than calling startup transfer “total site weight.”
5. Measure a controlled run with weather blocked and a realistic run with its normal failure/latency behavior. Neither path may block identity or navigation.
6. Include fresh loads at Intro, Whisperbook and Contact; explicit Work → project → case → back; rapid reverse/forward scroll; locale change; resize; stills and reduced-motion variants. Use the retained `/work/whispbook/` Android case in release 1. Extend the case journey to `/work/whisperbook/` and exploration in release 2; do not count nonexistent route requests as successful scenarios.
7. On representative physical mobile hardware, record transition/frame pacing, touch response, visible stalls, reading stability and a several-minute session. Record temperature/battery only if actually measured; do not infer it from the carbon estimate.
8. Run hardware-dependent tests on hardware acceleration where required. Label SwiftShader/software results; do not relax budgets to hide environmental differences.

The existing `tests/performance.mjs` is useful for render/scheduling instrumentation but its old scenario names/selectors and simulated hidden state must be updated. A separate actual hidden-tab check is still needed. Reuse the original review method for CLS/LCP where helpful; do not assume the current npm performance script already measures the full new startup contract.

### Targets

Core Web Vitals field goals, when sufficient field data exists: LCP <=2.5 s, CLS <=0.1 and INP <=200 ms at the 75th percentile, segmented by device. These are the published good-experience thresholds, not a claim about this portfolio. See [Web Vitals](https://web.dev/articles/vitals) and [Search Console's threshold table](https://support.google.com/webmasters/answer/9205520?hl=en-EN).

Project-specific initial engineering targets below are proposed budgets for P0/P1 calibration, **not external standards or already achieved results**. If a target must change, record the measured reason and user-visible consequence before final acceptance; do not silently redefine success.

| Metric | Initial target | Interpretation |
| --- | --- | --- |
| Startup CLS in controlled mobile runs | <=0.05; no enhancement-caused major shift | Stricter project target than the field good threshold. |
| LCP on controlled mobile profile | Median <=2.5 s; record the candidate element | Does not establish canvas readiness. |
| Identity / core navigation | Visible before scene completion and usable while loading/failing | Hard functional requirement, not a fake “loading finished” timer. |
| Correct first live pose | Aim for <=4 s on the same controlled mobile baseline profile | A provisional no-regression scene-readiness budget; never gate reading on it. |
| Core first-view transfer before optional scene work | Aim <=350 KB reported bytes | Document exactly what is included; phase images/fonts must not be double counted. |
| Seven-second default mobile startup transfer | Aim <=650 KB under the baseline profile | Prevent a large regression while improving stability; full-journey transfer reported separately. |
| Phase still | <=100 KB each; current + at most one anticipated image eagerly fetched | New eight-chapter/day-night set may exceed old six-image totals; do not preload the whole set. |
| Guided reading hold, hidden/offscreen scene | 0 recurring house/sky frames after settling | Compare actual draw counters, not only requestAnimationFrame probes. One-off invalidations are allowed. |
| Motion quality | Aim 60 fps on reference desktop, stable 30 fps on selected light mobile tier | Report p95 frame intervals/dropped frames and actual device; averages alone are insufficient. |
| Explicit navigation response | Heading/focus/URL promptly established, optional short settle only | No old three-second flight. Measure interaction response separately from animation duration. |

Do not buy performance by removing the central 3D experience from capable mobile devices. First remove avoidable work, prioritize loading, control rendering while reading, and tune the existing quality tiers. Keep a faithful still narrative for unavailable rendering or user preference.

## 5. Test migration map

Some existing tests assert the old design. Update them to the new contract with a reason; do not delete failures merely to obtain a green suite.

| Suite | Retain/adapt | Replace obsolete expectations |
| --- | --- | --- |
| `portfolio.test.mjs` | Semantic/no-JS/blocked-module/print, deep links, reflow, context failure, local voice fallback | Essential details in sheets, wheel chaining from nested notes, first-gesture autoplay, idle fade, duplicate stage/navigation UI |
| `presentation.test.mjs` | View compatibility, viewport/resize behavior, no-live-renderer stills mode | Old exclusive garden-vs-reader DOM trees and automatic phone overlay mode |
| `journey.test.mjs` | Chapter/phase sequence, real still availability and byte budgets | Old fixed stop count and stage-to-content coupling |
| `interaction.test.mjs` | Keyboard/pointer responses, interrupted navigation, focus restoration; exploration entry/exit and equivalent controls (now required, 3 November 2026) | Until 3 November 2026 its planting/chime, postcard and fennec-visit cases were obsolete because those features were removed. **Reversed 3 November 2026:** the features are restored and their cases were written fresh for the current page in `exploration.test.mjs`, `postcard.test.mjs`, `fennec-visit.test.mjs` and `garden-panel.test.mjs` rather than ported from this file. The chime is not restored. Essential-evidence hotspot and Inside-sheet expectations stay replaced: places now link to chapters, and Inside Whisperbook lives on the case page (`case-evidence.test.mjs`) |
| `lifecycle.test.mjs` | Hidden/paused/offscreen wake/sleep and disposal | Extend holds to guided built-house reading, not just the opening/paused state |
| `localization.test.mjs` | Locale precedence, placeholders, switching, RTL, local narration | Sheet-specific assertions; expand current chapter/case vocabulary |
| `quality.test.mjs` | Quality persistence and state-preserving rebuilds (written fresh in `quality-rebuild.test.mjs`, 3 November 2026) | Any assumption that resizing restarts the narrative |
| `sound.test.mjs` | Mix bounds, daytime/seasonal behavior and suspension | UI consent belongs in browser tests; assert explicit opt-in rather than default-on |
| `transfer.test.mjs` | Unknown/cached/resource distinctions and estimate semantics | Keep estimates distinct from actual hardware measurement |
| `browser-fixture.test.mjs` | Failed setup resource cleanup | No redesign-specific replacement needed |

Add focused tests for chapter/alias resolution, navigation cancellation/history, renderer host handoff, separate motion/audio state, case-return restoration and build-output case routing. Test observable behavior; avoid brittle assertions of exact internal module layouts or generated class names.

Apply the release table to test selection: release-1 validation must exercise retained-case return and asset completeness without requiring new case routes (exploration became required on 3 November 2026). In release 2 add those scenarios and retain regression coverage. ~~Remove obsolete planting/postcard/fennec test cases and update any named hardware-budget selection that includes them.~~ Superseded 3 November 2026: those features are restored, and their cases are new files in `tests/` (above); the instruction to drop them from the named hardware-budget selection no longer applies. Keep independent sound, lifecycle and performance coverage. The seven old suites stay in `tests/retired/`, whose README remains the migration ledger.

The current `npm test` set (3 November 2026): `browser-fixture`, `case-evidence`, `exploration`, `fennec-visit`, `garden-panel`, `narrative-model`, `navigation`, `postcard`, `quality-rebuild`, `render-meter`, `scene-lifecycle`, `sound`, `transfer`, `translations` and `ux-regressions` (`tests/*.test.mjs`, run serially against `TEST_URL`). `tests/performance.mjs`, `tests/run-performance-budgets.mjs` and `tests/visuals.mjs` (the exploration and reading-hold performance harness and a visual capture aid) are being migrated to the current page.

## 6. Execution commands

Verify port ownership first; do not kill an unrelated service. Use the repository's lockfile and package scripts. Typical sequence once implementation is ready:

```sh
npm ci
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
npm run preview -- --port 5199 --strictPort
```

With that production preview running, from another terminal:

```sh
TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/narrative npm test
TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/narrative RUNS=5 npm run test:performance
TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/narrative npm run test:performance:budgets
```

The performance scenarios must first be migrated as described above. Do not paste new, unsupported scenario names into the existing harness and assume they ran. The hardware-budget command selects named tests; update that selection if names change so it cannot silently run zero relevant checks.

Stills scripts currently expect the development scene hook/server. Inspect their current port/environment controls before running `npm run stills` / `npm run still:loading`; update them for the new adapter and frame poses. Record the renderer, hour/season and quality used to generate stills.

Use Chromium automation for repeatable checks and actual Safari/iOS/Android browser sessions for important platform paths. Browser emulation is not physical-device coverage. Run tests appropriate to changed behavior; repeat broad suites when new changes/failures justify it.

## 7. Release gate and final report

- [ ] Release 1: all eight chapters complete on both sizes with the transformation, retained cases repaired and linked to the correct projects, source/release links working, verified EN/FR CVs, ~~no Explore action~~ exploration and the restored features meeting F28–F38 (3 November 2026 reversal), within the twenty-day cap or with recorded descopes. Release 2: four main cases and exploration complete. Neither ships a vertical slice as if complete. Release-specific check results and deferred items are explicit.
- [ ] Latest visual review captures are from the production build and actual scene.
- [ ] P1 motion results and final transition checks are available.
- [ ] Required functional/localization/accessibility checks pass; missing physical-device/screen-reader coverage is explicitly stated.
- [ ] Performance results identify protocol, source SHA and limitations; no field-INP or energy claim is fabricated from lab timing.
- [ ] No private client assets, dossier files, generated review boards or local absolute paths leak into `dist/`.
- [ ] Current short CVs visually inspected and corrected against the content contract before release 1; existing public routes remain reachable. All referenced case assets ship in clean build output or have a documented text-first repair; no dependency on undeclared files surviving an old deployment.
- [ ] README, metadata, `/llms.txt`, `/llm.txt`, evidence and validation docs match the final experience and corrected authorship.
- [ ] Diff contains only authorized work; branch names and commit subjects/bodies follow the active chat/repository instructions, not an inferred convention from mixed git history.
- [ ] `public/sitemap.xml` lists every public route in the build; `public/sw.js` still ships unchanged at `/sw.js`; `og:image` and `og:description` describe the new site.
- [ ] ~~Release 1 has no Explore the finished house action anywhere, rather than a disabled or broken one.~~ Reversed 3 November 2026: "Explore the garden" ships in the garden panel and must meet F28–F30, never as a disabled or broken control.
- [ ] Every new French and Arabic string is listed in PROGRESS.md by release and review status, including post-G2 additions. French is reviewed before publication. Only Arabic may ship visibly marked as a draft under the recorded descoping order; an English-only new-case exception is separately recorded with correct links and `hreflang`.
- [ ] Publication is gated on functional validation; pushing main is recognized as deployment-triggering.
- [ ] If publication is authorized, Pages workflow and `version.txt` confirm the intended source SHA, followed by live browser checks. Otherwise report “release candidate prepared; not deployed.”

Final report should state: what changed; why it represents the agreed narrative; what was tested and on which devices; performance comparison with exact scope; remaining limitations; commit/PR state; actual deployment state; and rollback reference if released.
