# Implementation plan

This is a repository-grounded handoff, not an instruction to reproduce the static review HTML verbatim. Start with [README](README.md), then keep [content](CONTENT_AND_EVIDENCE.md) and [acceptance](ACCEPTANCE.md) open throughout implementation.

## 1. What exists now

Inspected 1 November 2026 at `453d26a8a8d26ef2785dc2e6a8c4b5c1af309b58`. Re-check before starting; paths and symbols below are verified starting points, not immutable line numbers.

| Area | Current implementation | Required treatment |
| --- | --- | --- |
| Toolchain | Vite 7, TypeScript 5.9, Three.js 0.180 declared in package.json; Node >=24; npm lockfile | Keep stack and locked versions. Upgrade only for a specific demonstrated need. |
| Semantic HTML | `src/render.ts` exports `renderPortfolio`; `vite.config.ts` injects HTML before enhancement | Retain build-time HTML and failure resilience; replace old content organization. |
| Story data | `src/content.ts`: `projects`, `beats`, `stageStart`, `spotBeat`, `stops`; `src/recent.ts` | Replace divergent chapter definitions with one canonical chapter model. Preserve secondary material. |
| Desktop controller | `src/main.ts` owns presentation switching, notes, ruler, audio, scene loading, history coordination, weather and widgets | Extract narrative responsibilities incrementally. Do not add a third presentation system beside the old two. |
| Phone controller | `src/phone.ts`, `src/phone.css`, `src/sheet.ts`; primary details move into sheets | Retire that primary content path. Reuse only secondary controls/exploration behavior that still fits. |
| Navigation | `src/navigation.ts`: `SectionId`, `createNavigation`, push-on-explicit / replace-on-passive | Extend and retain semantics. Replace fixed timing lock with an actual arrival/cancellation contract. |
| Scene | `src/scene.ts`: `Garden`, `createGarden`, progress, focus, frame, quality, snapshot/restore, disposal | Reuse geometry, lifecycle and instrumentation. Add a narrow narrative adapter. |
| Camera | `src/framing.ts`, scene `points` and `rooms` | Make framing respond to the actual scene host bounds, not only global window width. |
| Render scheduling | Scene/sky already sleep when hidden or paused; built scene can continue animating after settling | Add guided-reading holds with no recurring scene/sky draws once settled. Separate them from explicit pause and reduced motion. |
| Sound | `soundOn = true`, general first-gesture unlock in `main.ts` | Replace with explicit audio consent. Keep soundscape engine, mixes and suspension behavior. |
| Idle | `IDLE_AFTER = 20000`, `setIdle`, `startDrift`, CSS fading header and note | Remove from guided content/navigation. No automatic orbit while reading; optional within deliberate exploration only. |
| Localization | `src/i18n.ts`, `translations.ts`, `recent-translations.ts` | Retain EN/FR/AR, URL precedence, storage resilience, RTL and mounted-control identity. |
| Evidence | `src/evidence.ts`, existing `public/work/*` HTML | Preserve safe image-dialog behavior for secondary images. Add real full case routes and return path. |
| Stills | `scripts/capture-stills.mjs`, `capture-loading-still.mjs`, `public/assets/stills/*` | Regenerate from the real model at approved poses; update manifests and scripts for the new chapters. |
| Build/social | `index.html`, `vite.config.ts`, `public/llms.txt`, `public/llm.txt` | Update identity, selected work and previews consistently. Remove pre-layout journey geometry switching. |
| Delivery | `.github/workflows/deploy.yml` publishes on push to main; `test.yml` runs on push to main **and on pull requests**, independently of deploy | Do not push main as a review step; a pull request already runs the functional suite. Make deploy depend on that validation before release. Preserve non-destructive rsync. |
| Service worker | `public/sw.js` is a self-unregistering worker that deletes the previous site's `systems-garden-*` caches; nothing in `src/` registers it | Keep shipping it unchanged at `/sw.js` so returning visitors still retire the old worker. Do not add a caching worker for the redesign. |
| Localized static pages | `public/fr/work/{mcq-scan,wattch,whispbook}/` mirror the English cases with `hreflang` en/fr/x-default; `public/live/` and `public/fr/live/` are meta-refresh redirects to `?view=read&lang=…` | New case pages need the same `hreflang` pairing, or a recorded English-only decision with self-referencing `hreflang`. Keep both `/live/` redirects landing on readable content under the new view policy. |
| Legacy Android route | `public/work/whispbook/index.html` and its French copy both describe **Whisperbook Android**, despite the shorter slug | Preserve that identity in both releases. Link the separate Whispbook web studio to its repository; do not repurpose the Android URL. |
| Retained-case image dependencies | Android and Wattch pages reference six files under `/assets/projects/` that are absent from this checkout | Inventory in P0; resolve in release-1 P3 using the [missing-asset protocol](CONTENT_AND_EVIDENCE.md#retained-case-assets-missing-from-this-checkout). A clean preview must not depend on old files surviving in the Pages repository. |
| Short CVs | EN/FR HTML and PDF candidates exist in `public/resume/`; both HTML sources retain the 300× PowerAPI claim excluded by the content contract without clarified attribution | Audit source and PDFs in P0, correct/rebuild and visually verify in P2 before release 1. This is not deferred to P5. |
| Discovery files | `public/sitemap.xml` lists only `/`; `public/robots.txt` points to it | List every public case route (EN and FR) and keep the sitemap in step with the build output. |
| Social preview | `vite.config.ts` sets `og:image` to `/assets/garden-preview.png`, a finished-garden capture; `og:description` names only Whisperbook and Wattch | Re-capture from the new opening or an agreed pose and rewrite the description for the new selected work. Keep the file name if external links use it. |

No AGENTS.md was found in this checkout or its parent directories during this handoff. Re-check in the implementation environment.

## 2. Target architecture

### 2.1 One content document

Render all eight homepage chapters into one `<main>`, visible in ordinary document flow before JavaScript. Reuse the build-time Vite hook. The interactive canvas enhances this document; it does not replace it or select which chapter's text exists.

Suggested modules, names adjustable when the same responsibilities are clearer elsewhere:

- `src/narrative/content.ts`: chapter copy, evidence metadata, project/case identifiers and locale messages.
- `src/narrative/model.ts`: chapter IDs, canonical/legacy fragment mapping, scene cues and reading state types. Pure data/helpers; safe to import at build time.
- `src/narrative/controller.ts`: measures chapter geometry, resolves active chapter and transition progress, handles reading holds and explicit navigation intent.
- `src/narrative/scene-adapter.ts`: translates narrative cues into the retained Garden API, manages poster/live replacement and scene-host ownership.
- `src/narrative/exploration.ts`: optional finished-house interaction, entry/exit, controls and snapshot lifecycle.
- `src/narrative/style.css`: new layout and responsive rules. Remove superseded rules rather than accumulating broad overrides forever.

Keep `main.ts` as the composition root. Keep i18n, evidence dialogs, transfer accounting, weather, soundscape and renderer internals separate from chapter content. Do not import browser-only globals from the build-time content model.

### 2.2 Canonical data model

Define a chapter with: stable ID; visual phase; label; title; optional subtitle; motivation; decision/contribution; scoped evidence note; actions; scene focus; build/reveal target; desktop and portrait framing; static-poster keys. Each action carries an actual destination and type (section, case, source, download, contact). Evidence records distinguish public code, public evaluation, product capture, synthetic illustration and internal/company account.

Suggested IDs:

`intro`, `work`, `bplog`, `whisperbook`, `energy-tools`, `mcq-scan`, `about`, `contact`.

Keep the locale-independent IDs stable. Do not infer page order from the numerical ordering of scene beats. Derive the project index, next links, active navigation and compatibility maps from this model. Keep About's timeline and the secondary notebook data distinct from scene growth data.

### 2.3 Scene state contract

Track independently:

- `chapterId` and transition progress;
- build/reveal state and camera pose;
- mode: guided, exploration, or stills;
- motion preference: normal, user-paused, system-reduced;
- renderer lifecycle: not requested, loading, ready, failed, context-lost;
- sound enabled: false until explicit interaction with its control;
- current locale and current quality tier.

Avoid conflating `setProgress(p, immediate)` with a persistent reduced-motion preference: the current method also sets internal `reduced`. Wrap or adjust that behavior deliberately so a navigation snap does not silently change later motion. Likewise, freezing ambient animation must not prevent a newly navigated-to scene from drawing its destination once.

Retain `Garden.setProgress`, `focus`, `frame`, `setQuality`, `snapshot/restore`, `stats`, `dispose` where suitable. Add narrowly scoped concepts such as camera snapping and ambient-enabled state if the existing API cannot express them independently. No whole-scene rewrite is required just to change the page layout.

### 2.4 A single renderer and reserved scene hosts

Desktop: one sticky visual rail beside flowing story text, contained within the narrative region. It can become a broader composition at opening/contact. A single scene instance persists as the visitor scrolls.

Mobile: each chapter has an inline, dimensioned scene slot between short motivation and decision. Render only into the dominant visible slot. The scene may leave the viewport while the reader continues into text; do not keep a large canvas fixed across the whole reading session. One exception is allowed: the active slot may stick to the top of the viewport while a transition runs, then release into document flow once the pose has settled.

Preferred starting implementation: preserve one stable scene container/canvas and move that container between dimensioned hosts at chapter boundaries, not on every scroll event. Existing `main.ts` already reparents the stage. Use visibility hysteresis to avoid oscillation. Keep the matching poster in the host until the correct live pose has rendered successfully. Keep other hosts as lazy stills. Verify renderer sizing and ResizeObserver behavior after each mount; never create one WebGL renderer per chapter or rebuild geometry on every host change.

If profiling shows mount churn or an unavoidable flash, use one viewport-clipped canvas aligned to the active host instead. Record why that alternative is needed. Either approach must preserve DOM reading order, image dimensions, and native touch scrolling; no transparent canvas may intercept unrelated text or links.

## 3. Narrative, camera and construction mapping

Use the actual model's named points, not arbitrary screen coordinates copied from the generated board.

| Chapter | Actual starting scene mapping | Transformation intent |
| --- | --- | --- |
| Intro | Whole-world view; no focus spot | Pencil on warm paper, faint guides, no finished-house reveal on initial entry. |
| Work | Whole-world view | Blueprint lines and first foundation planes; readable project index. |
| BP Log | Existing `bplog` heart garden, not the reading pavilion | First useful built area; restrained solid detail and a project marker. |
| Whisperbook | Existing `whisperbook` reading pavilion / `rooms.whisperbook` | Book pavilion becomes dimensional; camera approaches its reading space. |
| Energy tools | Existing `wattch` observatory / `rooms.wattch` | Measurement area gains presence; a related family, not sole PowerAPI ownership. |
| MCQ Scan | Existing `workshop` region as a spatial setting | Professional delivery context. This scene association must not steal the old workshop URL. |
| About | Existing `about` point; wider terrace/tower framing | Explain career progression; preserve recognizable architecture without inventing personal meaning. |
| Contact | Whole-world view | Final foliage, light and full dimensional composition; readable contact alongside it. |

Existing scene coordinates for verification: `bplog` point `(6.75, 1.45, 2.65)` with room `(6.75, 0.65, 3.0)`; `whisperbook` room `(3.4, 1.7, -0.55)`; `wattch` room `(-3.4, 1.45, 0.45)`; `workshop` room `(6.65, 0.75, -0.2)`. These are input references, not immutable final camera positions. Account for world scale/rotation and portrait framing.

Start with current global construction progress plus named focus and hover accents. In the motion study, determine whether this makes the intended sequence legible. If the house becomes fully solid too early or an irrelevant region changes first, add a small reveal manifest for the relevant semantic groups. Avoid cloning every material blindly; shared materials and geometry need scoped ownership so revealing one room does not alter all others. Keep a separately controllable final foliage/light phase for Bloom.

A generated picture is not a specification to rebuild every leaf or invent an entirely different building. Preserve existing cultural/architectural elements. Do not infer a biographical explanation from an internal code comment alone.

## 4. Motion and responsive contract

### 4.1 Motion phases

For each scene change: approach → settle → hold → leave. Change a dominant visual property first (line-to-volume, room focus, or final bloom), rather than simultaneously orbiting, zooming, revealing and changing lighting.

The controller uses measured DOM positions and a small transition interval around chapter boundaries. A reasonable tuning start is an approach span of roughly 0.2–0.35 viewport height, bounded by actual content clearance; it is not a requirement for tall empty spacers. Reading holds are content-driven, not timed. Do not retain blanket `170svh` phone stops.

Passive scroll may interpolate poses; stop the camera when the relevant reading region is reached. Rapid scroll, a jump to Contact, reverse scroll and browser history must resolve directly to the current destination. Do not enqueue animations for all skipped chapters.

Explicit navigation should scroll/focus promptly, using an immediate jump as the reliable default; a short, interruptible visual settle can accompany it. No distance-dependent multi-second glide. Reduced motion uses immediate state changes. If normal navigation uses smoothing, cap its optional animation to roughly 200–300 ms after the destination is readable; treat this as a tuning proposal, not an accessibility rule or a measured result.

### 4.2 Layout starting values

These are starting constraints to tune against content and screenshots, not a rigid pixel-perfect transcription of the concept board:

- Wide desktop, approximately >=1100 CSS px: text 420–520 px, scene roughly 50–60% of available width; generous outer margins. Text remains on an uncluttered paper surface.
- Intermediate/tablet, approximately 700–1099 px: retain a split only where both columns work; otherwise stack with the same narrative. Never detect the experience solely through user-agent strings.
- Portrait/small width, <700 px: about 20 px side gutters, readable 16–18 px body, 38–44 px opening heading, scene slot about 45 percent of the viewport height (roughly 340–380 px on common phones), sticky at the top only while a transition runs. Let long content grow.
- First viewport, both sizes: role line, promise and the CV link are visible before any scroll. On 390×844 this means the opening sketch shares the first screen with them rather than filling it.
- Short landscape viewports: content-led stacked or compact framing with a retained scene; no clipped fixed-height notes.
- Sticky primary header must reserve space and define scroll offsets. The scene host must also reserve dimensions before any JavaScript, font, still or WebGL completion.
- Language control was omitted from concept pictures, not removed from product scope. Place a compact EN/FR/AR control without crowding CV or primary links; test expanded French and Arabic.
- Preserve Newsreader as the first typography candidate, with a readable system fallback and correct Arabic shaping. The review images use substitute fonts; they do not require a new typeface download.

### 4.3 Motion settings and scene failure

Expose a keyboard-accessible motion preference in a restrained location available during the guided journey. Honor system reduced motion before renderer work begins. A stills/static option remains available without the phrase “Low-end mode.”

In paused mode, scrolling may establish the next chapter's static pose; autonomous camera/ambient animation stays off. In system-reduced mode, prefer matching phase stills and avoid loading the renderer until the visitor explicitly requests it. Keep content and phase identity equivalent.

Hidden tabs and offscreen hosts stop recurring scene and sky work. On return, restart timing without a large delta and establish the latest chapter before rendering. On failed load/context loss, show the corresponding reserved still and retain all links and text. A recovered renderer must not flash the opening sketch when the visitor is at Contact.

## 5. URLs, history, evidence and CV

### 5.1 Fragment compatibility

| Incoming fragment | Destination after migration |
| --- | --- |
| empty / `#intro` | Opening sketch |
| `#work` | Blueprint project index |
| `#bplog` | BP Log chapter; retain this canonical spelling |
| `#whisperbook` | Android Whisperbook chapter |
| `#wattch` | Compatibility alias for `#energy-tools`, with Wattch context reachable on its case |
| `#energy-tools` | Measurement family chapter |
| `#mcq-scan` | Professional MCQ Scan chapter |
| `#workshop` | Secondary experiments/notebook near About; do not silently redirect it to MCQ Scan |
| `#about` | About heading |
| `#contact` | Contact and complete house |

Use real semantic targets or adjacent alias anchors that work without JavaScript; do not use a `display:none` node as the only no-JS destination. Keep alias resolution explicit in navigation data. Respect modifier-click/new-tab behavior and locale/query parameters.

Explicit actions push a history entry and focus the destination heading without a second scroll. Passive scrolling replaces the current fragment without focus movement. Restore history without pushing another entry. Cancel a pending focus/animation when a newer navigation wins.

For case-page return, preserve a same-origin return path with fragment and reading position where available. Prefer browser-native restoration for Back; for an explicit Return link, restore a guarded `sessionStorage` record keyed by page/locale and fall back to the chapter anchor. Storage denial must not break navigation. Do not store a full private browsing history or accept arbitrary external redirect URLs. On changed layout/locale, prefer the stable section/relative offset to a stale absolute pixel position.

### 5.2 View compatibility

- Bare `/`: new guided narrative.
- `?view=garden`: same guided narrative for legacy links; do not auto-enter gesture-capturing free exploration.
- `?view=read` and `?view=stills`: same readable content and phase stills, no live scene until explicitly selected. Preserve semantics for existing low-resource links.
- Unknown `view`: safe default narrative, no blank page.
- Preserve `?lang=en|fr|ar`, `?quality=low`, and saved quality/locale handling, within the updated mode policy.
- Leave unrelated query parameters untouched. Preserve compatible debug/test controls where still needed.

### 5.3 Public routes

Release 1 retains `/work/mcq-scan/`, `/work/wattch/` and `/work/whispbook/`, plus their French copies, with the repairs needed for correct content, complete assets, accessibility and case return. **The existing `/work/whispbook/` page is Whisperbook Android**, not the web studio. Use it as the local case in the release-1 slice, alongside Whisperbook's source and test-release actions. The separate Whispbook web studio in the notebook links to `https://github.com/chakib-belgaid/whispbook`; no new web-studio route is required.

Release 2 creates `/work/bp-log/`, `/work/whisperbook/` (the new Android case), and `/work/energy-tools/`, and expands `/work/mcq-scan/`. Keep `/work/whispbook/` reachable as the legacy Android case with a contextual link to the new Android case. Likewise keep `/work/wattch/` as its detailed legacy case, linked to the new tools story. Do not repurpose either URL or its French counterpart for a different project.

The existing cases ship French copies under `/fr/work/<slug>/` with `hreflang` en/fr/x-default and a shared `public/assets/legacy-evidence.css`. New routes follow the same pairing (`/fr/work/bp-log/`, `/fr/work/whisperbook/`, `/fr/work/energy-tools/`) unless an English-only decision is recorded; in that case the English page carries self-referencing `hreflang` and no dangling French alternate. Add every route to `public/sitemap.xml`.

Use static build output compatible with GitHub Pages. Prefer a small shared case-page renderer and typed data injected during build; no SPA router is necessary. If keeping authored public HTML is substantially simpler, keep the case template and evidence semantics consistent and validate every resulting URL. Public files are copied verbatim, so a new generation step must actually emit `dist/work/<slug>/index.html` and be tested there. Avoid importing runtime TypeScript into a page that Vite only copies.

The CV candidates already exist under `public/resume/` in EN and FR. Audit content, date/currentness, contact details and attribution in P0; correct the HTML sources, rebuild the PDFs where needed, and visually inspect every rendered page in P2 before release 1. In particular, both current HTML sources assert a roughly 300× PowerAPI binary reduction; remove or narrow that claim according to the content contract unless attribution is established. Source inspection does not verify the existing PDF bytes. Preserve filenames used by incoming links and keep HTML/PDF content aligned. Do not silently replace the short CV with the competency dossier. An Arabic page may offer an explicitly labeled English/French CV; do not imply an Arabic PDF exists.

## 6. Detailed work packages

Each package ends with a reviewable artifact and checks. Record status, actual files touched, validation and remaining issues in [PROGRESS.md](PROGRESS.md), one section per phase; each session starts by reading it and ends by updating it. Do not use “done” for code that has not been visually exercised.

### Sequencing: slice before breadth

The packages below are layers. Run P0 and P1 in full, then P2–P4 for the release-1 slice: intro, work index, Whisperbook chapter with source/test-release links and its existing Android case at `/work/whispbook/`, return to that chapter, then contact. P3 repairs that retained case's image dependencies and return behavior; P2 owns short-CV verification for release 1. G2 reviews desktop and portrait captures from the production build after the slice passes P4. Record that review before widening P2–P4 to the remaining chapters and retained cases. These phases' exit criteria apply first to the slice, then to the complete release-1 set. An unresolved CV fact remains recorded against P2 and blocks publication, not P3/P4 layout work or G2's visual review; CV verification must close before the release-1 candidate passes P7/P8.

P5 and P6 are not prerequisites for G2 or release 1. Start them after the release-1 P7/P8 candidate is complete, whether or not publication is authorized. Within release-2 P5, build `/work/whisperbook/` and its return path first, then extend to the remaining main cases. P6 uses the completed P4 adapter for exploration. No additional design gate is implied by that implementation order.

### Release staging

**Release 1** is P0–P4 for all eight chapters, verified EN/FR short CVs, repaired retained cases and their return paths, the applicable P7 checks, and P8. Its destinations are specified in the [content contract](CONTENT_AND_EVIDENCE.md#release-1-destinations); the Explore the finished house action is absent. Retaining cases means preserving their identity and layout, not freezing broken images or unsupported claims. It has a cap of twenty working days. **Release 2** is P5, P6, the remaining P7 work plus regression checks on release-1 behavior, and a second P8. Use the [acceptance applicability table](ACCEPTANCE.md#release-applicability); a deferred release-2 check is not a release-1 pass. A session works on one phase of one release and records which in PROGRESS.md.

### P0 — Baseline and working context

**Tasks**

1. Reconfirm checkout, source SHA, dirty files and existing worktree. Reuse a suitable checkout; no new worktree is required. Start a feature branch such as `feat/sketchbook-house-narrative` when implementation is authorized.
2. Read this package and inspect current source instructions. Record deviations from the inspected SHA before editing.
3. Use the locked dependencies and Node 24+; run the existing build and tests against a production preview on a verified free port.
4. Capture desktop/phone entry, Work, Contact, deep link, paused and no-JS states; inventory public routes, resume links and existing scene features.
5. Refresh a controlled performance baseline using current code and the protocol in ACCEPTANCE. Do not treat the earlier November review as a new measurement.
6. Audit both EN/FR short-CV HTML sources and PDF text against the content contract and authoritative source. Record discrepancies and any genuinely unresolved facts; schedule corrections and rendered-PDF verification in P2, not release 2.
7. Inventory local images, styles and other dependencies of every retained EN/FR case. Start with the six missing images in the content ledger. Record source/provenance if recoverable; otherwise plan a text-first repair in P3. Distinguish missing local files from unverified live-site availability.

**Output:** baseline notes, known failures, screenshots, measurements, route/feature/asset inventory and CV discrepancy list. **Exit:** implementation has a reproducible starting point; existing failures are separated from new regressions and assigned a resolution phase. Baseline failures do not become permanent acceptance exceptions.

### P1 — Actual-house motion study (high-risk slice first)

**Tasks**

1. Reuse `createGarden` in a development-only study using actual geometry. Produce Sketch → Blueprint → reading-pavilion Build → Bloom in both wide and portrait hosts.
2. Tune paper/ink, line opacity, light, contact reveal and framing. Keep room recognition throughout the change. Do not use the generated 2×2 image as the runtime animation.
3. Implement proposed state/pose adapter primitives: progress, focus, snap, guided ambient hold. Test reverse motion and direct destination snapping.
4. Determine whether global growth is sufficient or whether a limited group-reveal manifest is needed. Record a decision and measurements.
5. Capture short motion recordings with reading pauses and direct jumps. Inspect the actual phone framing, not only emulated desktop scaling.

**Output:** motion study, pose/reveal manifest, recorded tradeoffs. **Exit:** the recognizable house visibly grows from drawing to volume and remains readable beside/above text. If this fails aesthetically, fix this slice before multiplying the layout across all chapters. Routine tuning does not require a new permission question.

**Decision gate.** P1 ends with one of three recorded outcomes. (a) Global construction progress plus named focus is legible in both hosts: proceed. (b) A scoped group-reveal manifest is needed: estimate it, then proceed. (c) After a bounded tuning effort of about two working days the transformation is still not legible in portrait hosts at phone size: the user has rejected a stills-only portrait fallback, so the escape is the sticky-during-transition slot at about 45 percent of the viewport (see 2.4 and 4.2), tried before anything else. If that still fails, record it in PROGRESS.md and stop for the user; do not start P4 on an unrecorded (c).

### P2 — Content model and static semantic shell

**Tasks**

1. Introduce the canonical chapter/action/evidence model and static renderer.
2. Render the full approved sequence, project index, one navigation, current CV placement, About timeline and notebook.
3. Add stable IDs and no-JS compatibility anchors. Preserve one h1, logical heading levels, source labels, contact and skip link.
4. Reserve scene-host geometry using CSS; remove the head script that switches initial phone geometry into `data-journey=pending` when it is no longer part of the new controller.
5. Keep the existing controller isolated behind a temporary development flag if needed during migration. Remove the flag and old default path before completion; do not ship two competing visible reading experiences.
6. Update translation messages as copy is added; do not defer all localization discovery until the end.
7. Resolve P0's CV discrepancies in the EN/FR HTML sources, regenerate PDFs as needed, and inspect every rendered page. Verify download language, filenames and contact links. Record source/PDF paths, checksums and validation in PROGRESS.md. An unresolved factual choice blocks publication of the CV and release 1, not independent layout work.

**Output:** content readable with JS disabled, initial stable desktop/mobile layout and EN/FR short CVs verified for release 1. **Slice exit:** approved slice content, CV placement and contact are reachable without 3D or sheets; any unresolved CV verification is recorded and independent layout work may proceed. **Release-1 exit:** all approved chapters and verified CV downloads work, and no known conflicting CV claim remains in the release candidate.

### P3 — Responsive layout, navigation and state restoration

**Tasks**

1. Build wide/stacked layout and portrait scene slots with natural content height. Scope style replacement rather than stacking duplicate `.chapter` / `.journey` rules.
2. Extend `navigation.ts` with new canonical IDs and alias handling. Separate visual phase from content destination.
3. Implement header clearance, destination focus, passive fragment update, interrupted navigation and history arrival. Remove the old `glideTo` dependency for essential navigation.
4. Wire the Work index, next links, retained-case return records and locale-preserving links. For the slice, use the existing Android `/work/whispbook/` route and its French copy; preserve their project identity. Add the minimal Return behavior to these static pages and then the other retained cases. Test storage failure and browser Back/Forward; an explicit return from a guided journey must not accidentally force `view=read`.
5. Verify first viewport at 390×844 and reflow at 320 px/zoom. Include language control; do not let it displace identity or CV.
6. Resolve P0's missing retained-case assets using the content contract's recovery-or-text-first protocol. Apply repairs consistently to EN/FR markup, image preloads, captions and image metadata. Verify every referenced local dependency from a clean `dist/` and preview, with no old Pages files available.

**Output:** navigable static/still version, repaired retained cases and tested return paths. **Exit:** explicit jumps are immediate, passive scroll does not steal focus, legacy URLs find the same projects, all retained-case dependencies resolve in a clean preview, and no nested primary scrolling surface exists.

### P4 — Guided scene integration and lifecycle

**Tasks**

1. Connect document controller to P1's adapter; measure DOM in batched reads, schedule at most one update per frame, cache unaffected geometry.
2. Mount one renderer into desktop rail or dominant portrait host. Preserve dimensions and poster until the matching pose is ready. Test deep-link first load before a scene exists.
3. Establish per-chapter targets and reading holds. Remove `sectionForBeat` ordering assumptions and old fixed-stop/sheet dependency.
4. Freeze guided autonomous animation after settling, including sky, camera drift and unnecessary recurring tally-driven invalidations. Preserve drawing on genuine input changes.
5. Implement reduced-motion, explicit pause, stills mode, save-data choice, context loss/recovery, resize/orientation and hidden-tab behavior.
6. Separate sound consent from any generic gesture; test that Work/CV/contact navigation cannot start audio.
7. Remove planting, postcard and fennec-visit behavior and controls from the release-1 product, including dead translations. Keep reusable exploration internals dormant if useful for P6, with no exploration action or input handlers in release 1. Do not defer removal of discarded features to release 2.
   **Note, 3 November 2026:** the user reversed this task in the decision table of that date. Planting (up to 24 trees), the postcard and the fennec visit after deliberate planting are restored in the current product, together with an explicit "Explore the garden" state. They were restored from `main` as focused modules loaded on request (`src/narrative/explore.ts`, `src/narrative/postcard.ts`, `src/narrative/render-meter.ts`, the garden panel and the scene mount), not by bringing back the old `main.ts`. The removal recorded above happened in P4 and is kept here as history; ACCEPTANCE F25a and F28–F38 hold the current criteria.

**Output:** the actual-model opening → index → Whisperbook → contact slice, then all chapters. **Exit:** all content stays present; no layout swap at enhancement; one renderer; correct pose and poster on direct navigation/failure; reading holds actually stop recurring scene work.

### P5 — Main case pages and evidence assets (release 2)

**Tasks**

1. Deliver the four current main case destinations and preserve legacy cases. Start with the representative Whisperbook layout, then apply the same problem/contribution/decision/result/evidence structure.
2. Use product imagery only from a verified app/source/release state. Record provenance and whether emulator or physical device; keep synthetic outputs labeled. If no approved capture is available, deliver text plus source/evaluation links rather than blocking the case on an image.
3. Treat private MCQ work textually; no private client images, source or datasets. Apply exact constrained-decoding and compilation wording from the content contract.
4. Reuse the EN/FR short CVs already verified in release-1 P2. Check their links on the new case pages; repeat factual/PDF validation only if those assets change or new evidence makes the earlier verification stale.
5. Add case return behavior, source and release links, semantic metadata and responsive evidence display. Keep image zoom optional.

**Output:** complete reachable cases, approved public evidence, working CV links. **Exit:** no review placeholders or blank destinations in release output; no invented proof or metric conflation.

### P6 — Optional finished-house exploration (release 2)

**Tasks**

1. Offer Explore the finished house at Contact; entering is deliberate and reversible. Retain narrative position and focus on exit.
2. Retain, in that context only: the sky with weather and time of day, seasons, the carbon tally on the observatory register, rotate and zoom, quality and sound. Planting, the postcard and the fennec visits were removed from the product in release-1 P4; do not reintroduce them or their tests. Adapt the presentation of the retained features, reusing dormant internals where appropriate.
   **Note, 3 November 2026:** the user reversed the last instruction ("do not reintroduce them or their tests"). Planting, the postcard and the fennec visits are back, with new tests (`tests/exploration.test.mjs`, `postcard.test.mjs`, `fennec-visit.test.mjs`, `garden-panel.test.mjs`, `quality-rebuild.test.mjs`). Exploration was also brought forward from release 2: it is entered from the garden panel's "Explore the garden" (not only at Contact), and the sky, season, planting, turn and quality live in that panel during reading as well. See PROGRESS.md, P6, "3 November 2026 — restoration from main".
3. Enable gesture interception only within active exploration. Provide pointer-independent controls and Escape/visible close. Respect OS/page zoom outside the mode.
4. Keep audio off until its explicit control, suspend it when hidden/exited/paused according to clearly separated settings.
5. Preserve transfer/rendering estimates with their methodology; do not label estimates as Wattch hardware measurements. Keep this secondary to the recruiting story.

**Output:** accessible optional exploration with a clean return. **Exit:** contact is usable without exploration, no loss of state, and secondary controls cannot capture ordinary mobile reading gestures.

### P7 — Regression, localization, accessibility, performance and polish

**Tasks**

1. Migrate conflicting tests intentionally; preserve useful lifecycle, history, evidence and localization coverage. Add behavioral tests for new contracts, not snapshots of every implementation detail.
2. Run EN/FR/AR, RTL, 200% text and 400% zoom checks on the surfaces shipped in this release. Audit translatable attributes, live messages, case links and language persistence. Do not claim a full accessibility audit from an automated scan. Draft every new French and Arabic string and bundle it in PROGRESS.md for asynchronous user review, including strings added after G2; these copy reviews do not add design gates. French requires review before publication. Only Arabic review may be deferred under the recorded descoping order, with the shipped translation visibly marked as a draft for review; English-only case-page exceptions must be recorded separately.
3. Re-capture real-model day/night/stage stills and initial loading preview. Respect appearance policy without blocking semantic paint on weather.
4. Optimize based on measured bottlenecks: unnecessary startup screenshots/fonts, construction batches, material variants, shadow work and autonomous frames. Keep quality recognizable on the chosen phone tier.
5. Run the documented lab protocol and physical-device sessions; record software rendering separately. Do not loosen existing hardware budgets just to make CI green. The user has a Nothing Phone 3 (Android); use it as the representative Android device and name its browser version. No iOS device is confirmed, so state iOS Safari coverage honestly rather than inferring it from desktop Safari or emulation.
6. Remove obsolete controller/CSS branches, duplicate chapter indices, sliders and essential-content sheets. Update README, evidence provenance, public summaries, metadata and validation docs to describe final behavior.

**Output:** complete candidate with visual evidence and test/performance results. **Exit:** the release's applicable ACCEPTANCE checks pass or a specific unresolved issue is reported; release-2-only checks are recorded as deferred during release 1, never as passed. No unsupported “all done” claim.

### P8 — Release candidate and publication handoff

**Tasks**

1. Prepare a coherent diff, concise PR/review description and validation summary. Follow the active implementation-chat and repository instructions for branch names and commit format; mixed historical subjects do not override them. Use the configured `feat/` branch default unless superseded, and include a useful commit body. Do not commit unrelated user changes.
2. Ensure deployment depends on the relevant functional validation. Pull requests already run `test.yml`; the gap is that `deploy.yml` on main does not wait for it. Prefer a reusable test workflow or an explicit job dependency, preserving least-privilege key timing.
   Real-device review before publication: because `deploy.yml` writes straight to the Pages repository, the only HTTPS preview today is pushing main. Use a LAN preview (`vite preview --host`) for phone sessions, or add a `workflow_dispatch` input that publishes to a separate preview Pages repository with the same non-destructive rsync if the user creates one. Record which was used for the final review.
3. Verify output routes, CV assets, llm summaries, canonical/social URLs and absence of private screenshots/dossiers in build output. Check retained-case dependencies against a clean build, including the six missing-image resolutions; non-destructive deployment is not a substitute for self-contained output. Recheck legacy Android identity and French pairing.
4. Keep non-destructive publishing. Never add `rsync --delete` against the Pages repository; it retains legacy materials.
5. When publication is authorized, use the existing pipeline, then verify `version.txt`, live assets and meaningful browser states. A successful source push alone is not live-site verification.
6. Document rollback to a known source/deployed SHA through the same publication process. Reverting the redesign must not delete unrelated case/resume assets.

**Output:** reviewable release candidate; if authorized, verified deployment and rollback reference. **Exit:** scope and actual publication state are accurately reported.

## 7. Dependencies and unresolved inputs

| Item | Default action | What it blocks |
| --- | --- | --- |
| Exact camera/reveal curves | Resolve in P1 using actual model and recorded motion | Final scene choreography, not semantic content |
| Real Whisperbook screenshot | Obtain from known app build and document provenance; retain labeled design placeholder only in review artifacts | Publishing that screenshot, not app navigation/layout |
| Current short CV | P0 audits existing EN/FR source/PDFs; P2 corrects, rebuilds and visually verifies them | Release-1 CV publication and release gate; not independent layout work |
| Six missing retained-case images | P0 inventories; P3 recovers verified public assets or removes unsupported image markup for text-first cases in both languages | Clean-preview completeness and release-1 case acceptance; not the semantic homepage |
| Professional claims | Use user corrections and the content contract; consult current corrected dossier if further detail is needed | New claims outside the supplied evidence |
| Physical phone availability | Use available representative device; name hardware/browser; report absent coverage honestly | Real-device performance conclusion |
| Case-page language support | Retain known language behavior, add EN/FR/AR UI and reviewed translated copy where advertised; label any English-only external material | Claiming localized completeness |
| French copies of the new case pages | Default: ship `/fr/work/` pages for the three new routes, mirroring the existing pairing; English-only is the recorded descope option | `hreflang` correctness and localized-completeness claims, not the English routes |
| Preview hosting for real-device review | Default: LAN preview on the phone; a separate preview Pages repository only if the user creates one | Pre-publication review over HTTPS on real hardware, not local checks |
| Provenance of `public/assets/whisperbook.webp` | Assumed to be a real capture of the Android app from early October 2026; the user confirms the build, or captures a fresh one on the Nothing Phone 3 | Publishing it as product proof (release 2), not the chapter |
| Arabic as a visible site language | Default: keep it, as decided in the review pending the user's explicit confirmation | Nothing; removing it later is a small change |

Do not ask for confirmation simply to choose a file name, CSS breakpoint, module split or ordinary reversible implementation detail. Ask only when a factual/identity decision cannot be resolved from supplied evidence, or the intended scope materially changes.
