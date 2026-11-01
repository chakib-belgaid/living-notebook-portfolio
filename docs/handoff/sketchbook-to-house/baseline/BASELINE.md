# P0 baseline: starting point for the sketchbook-to-house redesign

Session date 1 November 2026. Branch `feat/sketchbook-house-narrative`, HEAD `fa4386b984ce8c20dda90ddcfd2943f1b1861ef5`.
Inspected handoff source SHA: `453d26a8a8d26ef2785dc2e6a8c4b5c1af309b58` (`main`).

All paths are repository-relative. Screenshots, raw test logs, performance JSON, PDF renders and fetched candidate images live under `.qa/baseline/`, which is git-ignored. They are local evidence for this session and are not part of the commit; the numbers and findings are reproduced here. Nothing in `src/`, `public/`, `index.html`, `vite.config.ts` or `tests/` was edited, and no recovered image was copied into `public/`.

## 1. Checkout and deviations from the inspected SHA

| Item | Finding |
| --- | --- |
| Branch / HEAD | `feat/sketchbook-house-narrative` at `fa4386b`; `main` is `453d26a` |
| Diff from inspected SHA | `git diff 453d26a --stat -- . ':!docs/handoff'` shows only a 2-line `.gitignore` change (`.qa/`, `.superpowers/`). No source, public, test or config deviation. |
| Dirty files at start | None (`git status` clean) |
| Worktrees | Only the main checkout; no new worktree created |
| Repository instruction files | No `AGENTS.md` or `CLAUDE.md` in the checkout or its parent. The parent directory also holds an unrelated `old_portfolio/` sibling (no case images there). |
| Toolchain | `npm ci` already done from the lockfile; Node v26.12.0 (package.json requires >=24), npm 11.16.0, Playwright 1.62.1 |

## 2. Environment for every number below

| Field | Value |
| --- | --- |
| OS | macOS 27.0.1 (Darwin 27.0.0) |
| Hardware | Apple M5, 10 cores, 32 GB (Apple-silicon Mac) |
| Browser | Playwright bundled Chromium 151.0.7922.34, headless (`PLAYWRIGHT_CHANNEL` not set). The earlier November review used Chrome 156, so browser versions differ. |
| WebGL renderer | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver)`. **Software rendering, not the Mac GPU.** `EXT_disjoint_timer_query_webgl2` is unavailable, so GPU ms/frame is `null`. |
| Build | `SITE_ORIGIN=https://chakib-belgaid.github.io npm run build` (tsc --noEmit then vite build): exit 0. `index.html` 26.34 kB, CSS 57.29 kB, entry JS 191.43 kB, `scene-*.js` 604.13 kB (gzip 163.54 kB), with Vite's 500 kB chunk-size warning. |
| Server | `npm run preview -- --port 5199 --strictPort` on 127.0.0.1:5199. The port was verified free first (`lsof -i :5199` empty) and the server I started was stopped afterwards. |
| Quality tier | Desktop 1440x900: Auto resolves to `full`. Phone 390x844: Auto resolves to `light` (`data-detail=low`). `desktop-garden-light` forces `?quality=light`. |
| Weather | Open-Meteo requests aborted in the perf harness and in captures (the "Failed to load resource: net::ERR_FAILED" console line in the capture log is that aborted request). |
| Clock | Real clock, early evening local time, so the scene is night-lit in captures. |
| Nature of data | Software-rendered **lab** data from desktop-browser emulation. Not a physical device, not field data, not hardware-accelerated. Do not compare frame rates with a GPU-backed browser. |

## 3. Build and test results

### 3.1 Full suite: `TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/baseline npm test`

86 tests, **85 pass, 1 fail**, 0 skipped, 439 s. Log: `.qa/baseline/npm-test.log`.

| Failing test | Reason | Classification / resolution phase |
| --- | --- | --- |
| `a deep link opens the journey at its stop` (`tests/portfolio.test.mjs:279`) | At 390x844 with `#wattch`, `.journey-label` was `''` after a fixed 600 ms wait; the test expected `Build · Wattch Core`. | **Timing-flaky at baseline.** Re-run alone twice: passed both times (1/1, 1/1). It failed once inside the full sequential run. The assertion encodes the old journey label and the old stop model, so it is obsolete and replaced in P4/P7 (test migration map). It is not accepted as a permanent exception; the replacement deep-link test must wait on observable readiness instead of 600 ms. |

Other noteworthy suite output: no failures in sound, quality, transfer, localization, presentation, journey, browser-fixture or lifecycle files in the standard (non-budget) run. Planting, postcard and fennec tests all pass at baseline; they become obsolete in P4/P7 because those features are being removed (F25a).

### 3.2 Hardware-budget selection: `... npm run test:performance:budgets`

5 selected tests, **2 pass, 3 fail**, 56 s. Log: `.qa/baseline/performance-budgets.log`. The command sets `PERFORMANCE_BUDGETS=1`, which turns the diagnostic thresholds into assertions. No limit was relaxed.

| Test | Result | Reason |
| --- | --- | --- |
| `a building answers its label pointed at or focused` | pass | |
| `reduced motion: the label answers, and no fennec walks over` | pass | |
| `a fennec visits a new tree, settles under it, and goes back to its day` | **fail** | `fennec stall 317.0 ms exceeds the 100 ms budget` (`tests/interaction.test.mjs:164`) |
| `a paused, settled garden and sky stop asking for frames, and wake for changes` | **fail** | `active garden: 9 frames; expected more than 20 in 1 s` (`tests/lifecycle.test.mjs:73`) |
| `a hidden tab stops the loops; showing it again resumes without a jump` | **fail** | `shown again: 9 frames; expected more than 10 in 0.8 s` (`tests/lifecycle.test.mjs:111`) |

Interpretation: all three failures are frame-rate or long-task limits measured on SwiftShader, so they are **environmental** (software rendering), not evidence of a code regression. The same lifecycle tests pass in the non-budget run, where the same numbers are only diagnostics. Resolution: P7 must run these on hardware acceleration (or a real device) and record the result; the fennec test is deleted with the fennec feature in P4/P7. The named selection in `tests/run-performance-budgets.mjs` includes fennec tests and must be updated so it cannot silently drop to zero relevant checks. These are not permanent acceptance exceptions.

## 4. Performance baseline (refreshed, not the earlier November numbers)

Command: `TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/baseline RUNS=5 npm run test:performance`. Raw data: `.qa/baseline/performance.json` and `performance-summary.json`, log `.qa/baseline/performance.log`. Source SHA `fa4386b` (source identical to `453d26a`). Environment as in section 2.

### 4.1 What ran, and what the harness does not do

The existing `tests/performance.mjs` defines exactly five scenarios, all of which ran for 5 runs each (25 runs). Each run is a fresh browser context, so a cold HTTP cache; the network is localhost and unthrottled.

| Scenario | Viewport / DPR | Notes |
| --- | --- | --- |
| `desktop-garden` | 1440x900 @1.6, full quality | `/?view=garden`; windows: opening-sketch, stage-transitions, bloom-settled, project-focus, planting, heavy-weather, paused-settled, paused-hidden, resumed, hidden, visible-again, full-garden |
| `desktop-garden-light` | same, `?quality=light` | same windows |
| `phone-journey` | 390x844 @3, touch, mobile emulation, light quality | windows: opening-sketch, journey-scroll, bloom-settled, hidden, paused-settled |
| `phone-stills` | same phone, `?view=stills` | window: stills-scroll; no scene |
| `reading` | 1440x900 @1.6, `?view=read` | window: reading-navigation; no scene |

Not covered by the existing harness, so **not measured** here (each is a protocol gap to fill when scenarios are migrated in P7, not something to infer from these numbers): LCP and its element, CLS, CPU or network throttling (the prior review used 4x CPU, 1.6 Mbit/s and 150 ms), a fixed 7 s startup window with its own transfer figure, a fresh load at Whisperbook or Contact, an explicit Work -> project -> case -> back journey, locale change, resize, stills/reduced-motion variants beyond the two above, actual hidden-tab behaviour (hidden is simulated by overriding `document.hidden`), weather with normal failure/latency, physical-device frame pacing. The "bytes" column counts everything the run fetched across its scripted journey, so it is **not** comparable with the prior review's 7-second startup transfer.

### 4.2 Per-run results

Columns: transfer bytes and request count over the whole scripted run; first-contentful-paint; scene construction; scene-to-first-render; shader warm-up (all ms).

| Scenario | Run | Bytes | Req | FCP | Construct | To 1st render | Shader warm-up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop-garden | 1 | 877172 | 10 | 80 | 634 | 693 | 2089 |
| | 2 | 877172 | 10 | 172 | 600 | 650 | 1388 |
| | 3 | 877172 | 10 | 120 | 611 | 662 | 1404 |
| | 4 | 877172 | 10 | 104 | 629 | 680 | 1383 |
| | 5 | 945026 | 11 | 40 | 617 | 672 | 1414 |
| desktop-garden-light | 1 | 877172 | 10 | 100 | 610 | 658 | 1279 |
| | 2 | 945026 | 11 | 48 | 598 | 651 | 1319 |
| | 3 | 945026 | 11 | 52 | 629 | 684 | 1279 |
| | 4 | 877172 | 10 | 72 | 627 | 678 | 1275 |
| | 5 | 877172 | 10 | 72 | 633 | 686 | 1364 |
| phone-journey | 1 | 627116 | 9 | 40 | 125 | 172 | 1107 |
| | 2 | 627116 | 9 | 40 | 119 | 160 | 1035 |
| | 3 | 627116 | 9 | 40 | 117 | 157 | 1046 |
| | 4 | 627116 | 9 | 48 | 119 | 159 | 1048 |
| | 5 | 627116 | 9 | 40 | 120 | 160 | 1023 |
| phone-stills | 1-5 | 574286 (all) | 11 | 40, 48, 44, 48, 40 | n/a | n/a | n/a |
| reading | 1-5 | 712486 (all) | 8 | 44, 52, 44, 44, 44 | n/a | n/a | n/a |

No page errors in any of the 25 runs. Scene size: desktop 62 draw calls and 4880 triangles (opening); phone light 50 draw calls and 2232 triangles. Byte split for a desktop run: JS 70 KB entry + 164 KB scene chunk (transferred), fonts 280 KB (two Newsreader woff2), images 342 KB, CSS 12 KB, document 9 KB.

### 4.3 Medians (p95 in brackets; 5 runs, so p95 is the max, not a field percentile)

| Scenario | Bytes | FCP ms | Construct ms | To 1st render ms | Shader warm-up ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| desktop-garden | 877172 (945026) | 104 (172) | 617 (634) | 672 (693) | 1404 (2089) |
| desktop-garden-light | 877172 (945026) | 72 (100) | 627 (633) | 678 (686) | 1279 (1364) |
| phone-journey | 627116 | 40 (48) | 119 (125) | 160 (172) | 1046 (1107) |
| phone-stills | 574286 | 44 (48) | n/a | n/a | n/a |
| reading | 712486 | 44 (52) | n/a | n/a | n/a |

Render windows (median of 5 runs). `draws/s` counts animation frames that actually drew; `raf/s` counts requestAnimationFrame requests the page made; "missed" is the share of draw intervals over 34 ms; "long task" is the longest main-thread task in the window.

| Scenario / window | draws/s | raf/s | draw interval p95 ms | missed >34 ms | long task ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| desktop-garden / opening-sketch | 0 | 99.4 | n/a | n/a | 0 |
| desktop-garden / stage-transitions | 3.8 | 12.8 | 397 | 100% | 839 |
| desktop-garden / bloom-settled | 6.1 | 12.2 | 226 | 100% | 225 |
| desktop-garden / project-focus | 3.8 | 8.0 | 395 | 100% | 392 |
| desktop-garden / planting | 7.2 | 14.3 | 160 | 100% | 175 |
| desktop-garden / heavy-weather | 3.8 | 7.6 | 337 | 100% | 2892 |
| desktop-garden / paused-settled | 0 | 0 | n/a | n/a | 0 |
| desktop-garden / paused-hidden | 0 | 0 | n/a | n/a | 0 |
| desktop-garden / resumed | 6.6 | 13.2 | 257 | 100% | 256 |
| desktop-garden / hidden (simulated) | 0.3 | 0.6 | n/a | n/a | 144 |
| desktop-garden / full-garden (24 trees) | 6.5 | 13.0 | 161 | 100% | 161 |
| desktop-garden-light / bloom-settled | 8.9 | 17.9 | 139 | 100% | 147 |
| desktop-garden-light / paused-settled | 0 | 0 | n/a | n/a | 0 |
| phone-journey / opening-sketch | 30.0 | 227.8 | 34 | 3% | 0 |
| phone-journey / journey-scroll | 19.5 | 81.2 | 96 | 53% | 1286 |
| phone-journey / bloom-settled | 29.0 | 66.6 | 42 | 31% | 0 |
| phone-journey / hidden (simulated) | 0.3 | 0.7 | n/a | n/a | 0 |
| phone-journey / paused-settled | 0 | 0 | n/a | n/a | 0 |
| phone-stills / stills-scroll | 0 | 26.6 | n/a | n/a | 0 |
| reading / reading-navigation | 0 | 236.2 | n/a | n/a | 0 |

How to read these: the desktop rows draw at 4 to 9 frames per second because SwiftShader is rasterizing in software; that figure is a property of this environment, not of the code. The scheduling facts survive that caveat and are the useful baseline: a paused, settled scene issues zero draws and zero rAF callbacks; simulated hidden is down to about 0.3 draws/s; `stills` and `reading` issue zero draws. What the current code does **not** do, and the redesign must: the built scene (`bloom-settled`) keeps drawing continuously after it has settled (6.1 draws/s on desktop, 29 draws/s on phone), against the target of 0 recurring draws during a guided reading hold. The phone `opening-sketch` window draws at 30 draws/s with a very high rAF request rate (228/s) because of the harness's own probe and the page's loops.

The earlier November review's table (Chrome 156, throttled, LCP/CLS/first-draw) is context only; this refresh is not comparable to it because of different browser, no throttling, software GL and no LCP/CLS.

## 5. Captures

Captured with Playwright via a throwaway script (not committed), Chromium 151, SwiftShader. Desktop 1440x900 DPR 1; phone 390x844 DPR 3, touch, mobile. Files in `.qa/baseline/captures/` (28 PNG, plus `capture-log.json` with per-capture state: canvas present, quality, hash, journey label, console errors, image decode status). All JS captures wait for the `enhanced` class and 4 s.

| State | Desktop file | Phone file |
| --- | --- | --- |
| Entry `/` | `desktop-entry.png` | `phone-entry.png` |
| `/#work` | `desktop-work.png` | `phone-work.png` |
| `/#contact` | `desktop-contact.png` | `phone-contact.png` |
| Deep link `/#whisperbook`, fresh load | `desktop-deeplink-whisperbook.png` | `phone-deeplink-whisperbook.png` |
| Reduced motion (`prefers-reduced-motion: reduce`) | `desktop-reduced-motion.png` | `phone-reduced-motion.png` |
| No JavaScript | `desktop-no-js.png` | `phone-no-js.png` |
| `?view=read` | `desktop-view-read.png` | `phone-view-read.png` |
| `?view=stills` | `desktop-view-stills.png` (desktop forces the live garden) | `phone-view-stills.png` |
| Case pages (full page) | `desktop-case-{work,fr-work}-{whispbook,wattch,mcq-scan}.png` | `phone-case-...` same names |

Visually confirmed with the Read tool: desktop entry (night sketch scene, name, product-engineer sentence, "Selected work"/"Low-end mode", no role line and no CV link visible), phone Whisperbook deep link (Build · Whisperbook stop, correct pose on fresh load), phone no-JS (readable semantic page with a still garden illustration), phone reduced motion (sketch pose, play control shown, journey paused), Android case page desktop (broken image frames, see section 7). The remaining captures were produced by the same script and checked through `capture-log.json` (canvas, hash, label and error fields) rather than each opened individually.

Paused state: `reduced-motion` captures show the system-paused state (the pause control shows Play). A separate user-initiated pause is exercised by the performance windows `paused-settled` and `paused-hidden` and by the lifecycle tests, not by a screenshot.

Note: `npm test` with `QA_OUTPUT=.qa/baseline` also wrote its own screenshots (contact, journey at 320/375/390, reflow, no-javascript, print PDF, evidence dialog and others) into `.qa/baseline/`.

## 6. Route, link and feature inventory

### 6.1 Public routes at `fa4386b` (build output under `dist/`)

| Route | Source | Notes |
| --- | --- | --- |
| `/` | `index.html` + `src/render.ts` via `vite.config.ts` | Hash targets in `src/navigation.ts:1-2`: `#intro`, `#work`, `#whisperbook`, `#wattch`, `#workshop`, `#bplog`, `#about`, `#contact`. Query: `?view=garden|read|stills` (`src/main.ts:156`), `?quality=low|light|full` (`:1585`), `?lang=en|fr|ar` (`src/i18n.ts:8`). |
| `/work/mcq-scan/`, `/fr/work/mcq-scan/` | `public/work/mcq-scan/index.html`, `public/fr/work/mcq-scan/index.html` | Case pages; hreflang en/fr/x-default present and self-consistent. Sections `#agentdiet`, `#store-chat` are linked from the homepage (`src/recent.ts:17,24`). |
| `/work/wattch/`, `/fr/work/wattch/` | likewise | Two image dependencies missing (section 7). |
| `/work/whispbook/`, `/fr/work/whispbook/` | likewise | Android case (title "Whisperbook Android case study"); four image dependencies missing. |
| `/live/`, `/fr/live/` | `public/live/index.html`, `public/fr/live/index.html` | Meta-refresh to `/?view=read&lang=en|fr`; land on the readable page. |
| `/resume/chakib-belgaid-product-engineer-{en,fr}.html` and `.pdf` | `public/resume/` | Plus `resume.css`. |
| `/llms.txt`, `/llm.txt` | `public/` | Identical files (8835 bytes each). |
| `/robots.txt`, `/sitemap.xml`, `/sw.js`, `/favicon.svg` | `public/` | **Sitemap lists only `https://chakib-belgaid.github.io/`**; none of the case, resume or FR routes are listed. `sw.js` is a self-unregistering cleanup worker that deletes `systems-garden-*` caches; nothing in `src/` registers it. |

`og:image` and `twitter:image` (from `vite.config.ts`, with `SITE_ORIGIN` set) are `https://chakib-belgaid.github.io/assets/garden-preview.png`; `og:description` is "Applied AI, developer tools, and software energy measurement. Explore Whisperbook and Wattch Core."; `og:title` "Chakib Belgaid — Product engineer, Ph.D.".

### 6.2 Resume links and case links from the homepage

- The built `dist/index.html` contains **no link to either short-CV PDF or HTML**. Its only outbound targets are `#work`, `/work/mcq-scan/#agentdiet`, `/work/mcq-scan/#store-chat`, LinkedIn and the email `mailto:`. V11/F2/F11 (CV link in the first view) therefore start from nothing.
- The homepage does **not link to `/work/whispbook/` or `/work/wattch/`** either; those routes are reachable only by URL. F10 (case return) work in P3 starts from cases that nothing on the page opens.
- Every case page links to its own-language PDF (`/resume/...-en.pdf` or `-fr.pdf`), the other language copy, and back to `/?view=read#work`. Link labels and the PDF's actual language agree (EN case -> EN PDF, FR case -> FR PDF). CV pages are audited in section 8.

### 6.3 Existing scene features and where they are wired

| Feature | Where (file:line at `fa4386b`) | Release-1 treatment per handoff |
| --- | --- | --- |
| Garden/stills/read view modes | `src/main.ts:156-158` (param), `:1496-1497` (view toggle), `:1532-1536` (compact -> stills/read), `:1570-1573` (stills) | adapt |
| Quality tiers (Auto/Full/Light), `?quality=low` | UI `src/main.ts:123-125`; logic `:1579-1594`, rebuild `:1613-1647`; scene `src/scene.ts:87` (`Quality`), `setQuality` `:4363` | retained (release 2 in exploration) |
| Phone journey, stills, details sheet | `src/phone.ts:74` (`createPhoneJourney`), `:55-59` details, `:197` still src; `src/sheet.ts` | retire as primary path |
| Time of day | `#hour` slider `src/main.ts:95`, logic `:773-840`; `src/sky.ts` hour/night `:100`, `:243`, `setHour` | retain in exploration |
| Weather (live from Open-Meteo, presets) | `src/main.ts:96-98`, `:841-960`; `src/weather.ts:1`, fetch `:95`, geocoding `:111`, geolocation `:122-124` | retain; no unsolicited permission (F26) |
| Seasons | `src/main.ts:112-115`, `:887-915`; `src/scene.ts:6` | retain |
| Sky (sun, moon, stars, clouds, rain, fog) | `src/sky.ts:89` (`createSky`), `setWeather` `:653`, `setGrowth` `:642` | retain |
| Carbon tally and transfer/compute estimate | `src/main.ts:70-79` markup, `:1062` Escape, `:1196-1290` figures; `src/transfer.ts`, `src/compute.ts` | retain, keep measured/estimated distinction (F27) |
| Rotate ("Turn") and zoom | `src/main.ts:120`, `:989` (`#turn`), `:205` (`onZoom`); `src/scene.ts:4262` `rotate`, `:4313` `zoomBy` | retain in exploration |
| Planting (up to 24 trees) | `src/main.ts:118-119`, `:966-993`; `src/scene.ts:2478` `MAX_TREES`, `:4271`, `:4395` `plant`; chime `src/soundscape.ts:494,549` | **remove** (F25a) |
| Postcard | `src/main.ts:121`, `:995-1058` | **remove** (F25a) |
| Fennec visits | `src/scene.ts:2868-3017` (build, notice/approach/settle), `:3427-3543` (seasonal colour/life) | **remove** (F25a) |
| Soundscape (wind, birds, crickets, thunder, piano) | `src/soundscape.ts:64` `soundMix`, `:161` `createSoundscape`, `:521` `setAudible`; wiring `src/main.ts:262-340` (`soundOn = true`, first-gesture unlock at `:337`) | replace default-on/first-gesture with explicit opt-in (F21) |
| Motion pause and reduced motion | `src/main.ts:226-255` (`reducedQuery`, `paused`), button `:84` | retain; keep independent of sound (F22) |
| Idle drift | `src/main.ts:409` (`idle`), `:1076-1114` (`IDLE_AFTER = 20000`, `setIdle`) | remove from guided content (V6) |
| Navigation (push on explicit, replace on passive) | `src/navigation.ts:6-43`; 1600 ms release lock at `:19`; `hashchange`/`popstate` `:36-37` | extend; replace timing lock |
| Chapter list in two divergent models | `src/main.ts:613` (section ids), `src/content.ts:73,304` (`spotOrder`, `spotBeat`) | unify (P2) |
| Locale (en/fr/ar, URL then saved then browser then en) | `src/i18n.ts:5-16`, `LOCALE_STORAGE_KEY` `:4` | retain |
| Evidence image dialog | `src/evidence.ts` (uses `projects[].image` = `public/assets/whisperbook.webp` `src/content.ts:28`, `public/assets/wattch.png` `:57`) | retain for secondary images |
| Dev scene hook for stills | `src/main.ts:1706`; `scripts/capture-stills.mjs`, `scripts/capture-loading-still.mjs` | update in P4 |
| Tests/perf hooks | `window.__notebookStats` (used by `tests/performance.mjs`), `#scene[data-*]` attributes | keep for instrumentation |

## 7. Retained-case dependency inventory (missing local files vs live-site availability)

Method: parsed every local reference (src, href, content, CSS `url()`) in the six case pages, both `live` redirects, both CV HTMLs and the two stylesheets; checked each against `dist/` on disk and against the production preview. Output: `.qa/baseline/dependency-check-dist.txt`. A quirk worth knowing: **the preview server answers a missing file with `200 text/html`** (SPA fallback), so an HTTP 200 proves nothing about an image. Browser decode status (`naturalWidth`, from `capture-log.json`) is 0 for all six images.

### 7.1 The six images named in the content ledger

All six are **absent from the checkout** (and from `dist/`), referenced by both language pages.

| Expected path under `public/assets/projects/` | Referenced by | Local status | Exists on deployed Pages repo / live site? | Size (bytes) | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| `whisperbook/now-playing.webp` | `/work/whispbook/`, `/fr/work/whispbook/` (hero, eager, plus `<link rel=preload>`) | Missing | Yes / Yes (200 `image/webp`) | 177008 | `ec740fea1fc7baf6d9bd68ce1ccbba4a7c8f396dfe36d92ef3f2cdb1e5c2bff8` |
| `whisperbook/read-along.webp` | same | Missing | Yes / Yes | 109716 | `0b025fe3cc5c4d86187e305c200ab2f2185bd6dc83ec0402baf3d9d5593f4847` |
| `whisperbook/voice-cast.webp` | same | Missing | Yes / Yes | 123552 | `02d48dced381230837d06c88405744a78aa5a60d6fff29eed63e1ccf2a2dbf14` |
| `whisperbook/library.webp` | same | Missing | Yes / Yes | 114764 | `2729d3f51837340d374da3bda27c8dc9709bd842a872c8f68bd8c9821b083f84` |
| `wattch/deterministic-trace.png` | `/work/wattch/`, `/fr/work/wattch/` (eager, plus preload) | Missing | Yes / Yes | 219565 | `ec0b3208215371f1278817e2dfcbfa7eff63c6152d0c6f2eae215a105ab4de1b` |
| `wattch/energy-tests.png` | same | Missing | Yes / Yes | 95452 | `7dfbd30b07b7f860221b18251d5fafcd3be1e0b4710d489aa25070971d1c45d9` |

Candidates were fetched read-only from the Pages repository `chakib-belgaid/chakib-belgaid.github.io` at its HEAD `4c0d83ad838eaacf86f4c2d89110d07b0d236780` ("deploy living notebook 453d26a", 2026-10-31) and from the live site, and saved only under `.qa/baseline/recovered/` (`pages-repo/` and `live-site/`). Bytes and SHA-256 are identical between the two sources for all six. Nothing was copied to `public/`.

**A successful download does not establish provenance.** What the evidence does and does not show:

- The Pages repository's history for all six files points to one commit, `8f7db996` (2026-08-21, "update: publish Whisperbook and Wattch Core portfolio"), i.e. the earlier portfolio that predates the living notebook. They are in no commit of this repository (`git log --all -- public/assets/projects` finds none).
- **Two of the six are byte-identical to root-level assets already in this checkout:** `whisperbook/now-playing.webp` equals `public/assets/whisperbook.webp` (same SHA-256 `ec740fea...`, 941x1672; the ledger says this file was added 1 October 2026 and its build is unconfirmed) and `wattch/energy-tests.png` equals `public/assets/wattch.png` (`7dfbd30b...`, 1440x900). The ledger instructs that the root and `projects/` files are different files and must not be silently substituted. For these two the bytes are in fact identical, which means they carry the same unresolved provenance question: the whisperbook screen existed by 21 August 2026, and the October copy is not a newer capture.
- The Wattch images are self-labelled. `deterministic-trace.png` (1600x1000) is a terminal transcript of a dry run, captioned inside the image "Recorded from the checked-in Wattch Core deterministic test daemon on 2026-07-14. ... not a hardware-energy measurement." `energy-tests.png` is the Energy Tests surface labelled "DETERMINISTIC DAEMON", captioned "Captured on 21 August 2026 ... synthetic counter values ... not measurements of physical hardware." Those labels support keeping them as synthetic workflow evidence. They do not by themselves prove the capture method.
- The four Whisperbook images are 941x1672 phone-aspect screens of a sample book ("The Moonlit Wood", "Alice's Adventures", "The Secret Garden") with illustrated art. I did not establish whether they are device captures, an emulator or mock-ups, which build produced them, or their public-use status. The case page captions describe them as "the production Compose surface"; that is an old caption and is not evidence.
- Deployed Pages also holds unlinked extras: `assets/projects/wattch/deterministic-trace.svg` (sha `ac0b49b0...`) and `deterministic-trace.txt` (sha `6f3ecd9c...`), which are not referenced by any retained page.

Resolution plan for P3 (user decision required for provenance; the repair works either way):

1. If the user confirms the build/capture and public-use status of a file, it can be added at its expected path in `public/` so a clean build owns it, keeping the Wattch synthetic labels. The two duplicates raise the same question as `whisperbook.webp`, which the open question already asks the user to settle.
2. For any file whose provenance is not confirmed, take the text-first repair in both languages: remove the `<img>`, `<link rel=preload>`, caption/figure and image-specific metadata, keep the case URL and project identity, keep source and evaluation links.
3. Because `whisperbook.webp` and `wattch.png` are already shipped and used by the evidence dialog, the question is not hypothetical for them.

### 7.2 Other missing local dependencies found by the inventory (not in the ledger)

| Missing file(s) | Referenced from | Observed effect at baseline | Live/Pages status |
| --- | --- | --- | --- |
| `assets/ibm-plex-mono-latin-{400,500,600}-normal-*.woff2/.woff` (6 files) and `assets/jersey-10-latin-400-normal-*.woff2/.woff` (2 files), 8 total | `url()` in `public/assets/legacy-evidence.css` (copied from an old build) | Chromium reports each `@font-face` as `unloaded` on all six case pages (I did not determine why; likely the rendered text does not use them), so no visible failure was captured, but the dependency is real: the preview returns HTML with status 200 for these URLs | All 8 exist at the same paths in the Pages repository (sizes 7320 to 15620 bytes) |
| `social/mcq-{en,fr}.svg`, `social/wattch-{en,fr}.svg`, `social/whispbook-{en,fr}.svg` (6 files) | `og:image` and `twitter:image` on the six case pages (`image/svg+xml`) | Social preview images 404 (preview serves HTML 200) | All 6 exist on Pages, plus `social/home-{en,fr}.svg` which no current page references |

Neither group is in the six-image ledger; both break the same rule ("release 1 must work without borrowing files that only survive in an old deployment") and need an owner in P3. Not fetched or copied. Note also that SVG is a poor `og:image` format for most crawlers; that decision belongs to P3/P8, not here.

### 7.3 Local dependencies that do resolve

`/assets/legacy-evidence.css`, `/favicon.svg`, `/resume/*.pdf` and `/resume/resume.css` all exist and return the right content type from the preview. Case pages ship no scripts other than a JSON-LD block. `/live/` and `/fr/live/` resolve (meta refresh to `/?view=read&lang=...`; the target page loads). Every case page's EN/FR `hreflang` pair resolves to an existing page.

## 8. CV audit (HTML source and PDF text against the content contract)

Sources: `public/resume/chakib-belgaid-product-engineer-{en,fr}.html` and `.pdf`. PDF text extracted with macOS PDFKit (`PDFDocument.string`; no `pdftotext` available) to `.qa/baseline/cv/{en,fr}-pdf.txt`. Both PDFs were also rendered to `.qa/baseline/cv/{en,fr}-pdf-p{1,2}.png` and I opened the EN page 1 and FR page 2 renders. EN page 2 and FR page 1 were not opened, but the extracted text of every page was compared line by line with the HTML. That is an audit, not P2's required visual inspection of every rendered page.

| File | SHA-256 | Bytes | Pages | PDF producer / date |
| --- | --- | ---: | ---: | --- |
| `chakib-belgaid-product-engineer-en.pdf` | `7751470499821ca585c61d18db41ff0ba4e67543c7f0a9bbff4c17d53262b4a6` | 49523 | 2 | ReportLab, 2026-10-30 |
| `chakib-belgaid-product-engineer-fr.pdf` | `e016c9688cd27085df8d12066e008605c6421d43afce5b02b539f8e932a0d7f9` | 50114 | 2 | ReportLab, 2026-10-30 |
| `chakib-belgaid-product-engineer-en.html` | `4fc3f9f13115aba8fbc839cd10abd07fce9a3c04cbf25dfd9ae85227648de0b7` | 6743 | | |
| `chakib-belgaid-product-engineer-fr.html` | `b09a7a17a438b910b2ababb6203fa67d658514bb2410f9b64cbea21d37ba7c61` | 6905 | | |

Both PDFs are byte-identical to the files on the deployed Pages repository (same sizes). The PDFs are generated from the HTML by `scripts/render-public-resumes.py` (ReportLab), which is the P2 rebuild path.

### 8.1 Checks the brief named

| Check | EN HTML | EN PDF | FR HTML | FR PDF | Verdict |
| --- | --- | --- | --- | --- | --- |
| "300x" PowerAPI binary reduction | present: "Reduced the PowerAPI binary size by roughly 300×" | present | present: "Réduction d’environ 300 fois" | present | **FAIL in all four.** Unattributed; contract says do not import it. |
| Qarnot wording | "Contributed to deploying PowerAPI on the infrastructure of Qarnot Computing" | same | "Contribution à la mise en production de PowerAPI sur l’infrastructure de Qarnot Computing" | same | **FAIL in all four.** Reads as deploying PowerAPI itself; the contract requires "adapted the existing HWPC sensor to Qarnot's infrastructure" and no PowerAPI ownership. HWPC is not mentioned anywhere. |
| "custom sampler" | absent | absent | absent | absent | Pass (not present). |
| Constrained-decoding wording | "Evaluated and integrated LM Format Enforcer with local vLLM inference" | same | "Évaluation et intégration de LM Format Enforcer avec vLLM local" | same | **Partial.** Correct in substance, but lacks "evaluated constrained-decoding tools", the enum-enforcement purpose and the Pydantic business-validation clause required by the contract. |
| French proficiency "bilingual" | no languages section at all | none | no languages section | none | **Absent.** The word "bilingual"/"bilingue" appears nowhere; the contract expects it in professional materials. Not a wrong claim, but a missing one; whether to add a language line is a P2 decision. |
| Role line "Applied AI & Product Engineer · Ph.D. in Software Engineering" | "Full-stack Product Engineer · AI systems & developer tools" under the name "Mohammed Chakib Belgaid, Ph.D." | same | "Ingénieur produit full-stack · Systèmes IA & outils développeurs" | same | **FAIL in all four.** Different role line; "Ph.D." is only a name suffix; profile says "Full-stack product engineer". The PDF metadata title is "Mohammed Chakib Belgaid - Applied AI and software engineering" (English, also in the FR PDF), which disagrees with both visible headings. |
| Contact details | `chakib.belgaid@gmail.com`, `github.com/chakib-belgaid`, `linkedin.com/in/chakib-belgaid`, Lille, France | same, links live in the PDF (mailto, GitHub, LinkedIn, four project links verified with PDFKit annotations) | same | same | Pass on email and LinkedIn (contract LinkedIn lacks `www.`/trailing slash only). Phone deliberately omitted (stated on the page). |
| Name | "Mohammed Chakib Belgaid" | same | same | same | Differs from the contract name "Chakib Belgaid" (the site uses "Chakib Belgaid"); needs the user to confirm which is intended in the CV. |
| Dates | MCQ Scan 2024-present; Inria/Qarnot 2022-2024; Ph.D. 2018-2022; Funecs 2014-2018 | same | same | same | Consistent with the contract's About timeline. EN/FR PDFs print hyphens where HTML has en dashes ("2024-present"). |
| HTML and PDF agree | | | | | **Text agrees line for line** in both languages (only the en/em dash typography and "Source"/"Code source" labels differ). |

### 8.2 Other discrepancies and unresolved facts

1. Typography in both PDFs: en dashes and an em dash are flattened to hyphens ("2024-present", "end to end-from product workflow", "test-measure-optimize"); the sentence "Builds measurable systems end to end-from product workflow..." reads as a typo in the PDF while the HTML has a proper em dash. The contact line also ends with a dangling " ·" after LinkedIn in both PDFs. (Seen in the EN page 1 render and in the extracted text of both PDFs; the FR page 2 render shows the same hyphen style.)
2. "Led a production-facing no-code multi-agent platform from API architecture..." (EN) / "Pilotage d'une plateforme..." (FR). The contract describes coordinating a two-person technical team under the CTO and "own/team responsibilities" clearly separated; "Led" and the platform scope are not established by the contract. **Unresolved fact: confirm scope of the claim.**
3. MCQ Scan bullet 2 "Reduced end-to-end workflow processing time by 60%": contract allows 60% as a reported internal reduction in request-to-final-result time, not an isolated model speedup. The CV says "(internal measurements)" but attributes it to graph parallelism, small-model routing and caching, which is a mechanism list the contract does not give.
4. 97% / 95% are stated correctly as separate (per request vs per attribute). Pass.
5. AgentDiet: "awarded a 2026 Hyper Open X grant funded by France 2030". The contract says to use the user's/dossier wording and not invent amount or date. Present wording does not add them. **Unresolved:** user to confirm "awarded" versus the dossier status.
6. BP Log: CV says "10,123-parameter CNN" while the content contract says "54 KB neural model" and "187 held-out crops"; the CV says "187 held-out digits". **Unresolved: verify against the BP Log repository.** Also "Offline browser OCR" vs the contract's phone/offline use.
7. Wattch Core: "Linux RAPL" support. The contract records that the Linux acquisition reads powercap sysfs and that macOS uses powermetrics, and that current platform support must be checked before it is advertised. "Rust reading proficiency, Python expertise" matches the contract's Rust caveat. Pass on AI assistance.
8. pyJoules entry: "Developed and maintained pyJoules and co-developed pyRAPL ... created JouleHunter". The contract says the user designed both libraries; "designed" is not stated. "created JouleHunter" is not in the contract. **Unresolved:** confirm JouleHunter authorship.
9. Funecs: "Won Ooredoo T-Start in 2014", "over 300,000 unique subscriber numbers", "led six employees and two interns", Education "ENSI Algiers 2017", "thesis defended in December 2022" are not covered by the contract. Not contradicted, but **unverified by this audit**.
10. "10+ years" in the profile versus the 2014-2026 timeline is arithmetically fine.
11. Whispbook entry is the **web studio** (React/FastAPI) and links to `github.com/chakib-belgaid/whispbook`; this matches the contract's separate web-studio distinction. The CV does not mention Whisperbook Android (not required).
12. The CV pages themselves: footer line "Public portfolio edition..." is fine; no external image dependencies; `<html lang>` is correct (`en`/`fr`). The PDF footer reads "October 2026" / "Octobre 2026".
13. Adjacent claims outside the CVs that repeat the same unsupported content and must be fixed in the same P2 pass: the 300x sentence is also in `src/content.ts:270`, the FR/AR translations (`src/recent-translations.ts:106-108`), `public/llms.txt:74` and `public/llm.txt:74`; "a PowerAPI deployment across more than 100 computing nodes" is in `src/translations.ts:102` and `README.md:125`. The already-corrected "evaluated constrained-decoding tools ... not a custom sampler" wording exists in `src/recent.ts:23`, `public/llms.txt:46` and both MCQ Scan case pages (`/work/mcq-scan/` and `/fr/work/mcq-scan/`), so the case pages and the CVs currently disagree.

Rendered-PDF verification (every page, after correction) and the corrections themselves are scheduled for **P2**, not release 2.

## 9. Existing failures separated from future regressions

| Baseline failure or gap | Cause | Resolution phase | Permanent exception? |
| --- | --- | --- | --- |
| `a deep link opens the journey at its stop` fails once in the full run | Fixed 600 ms wait; passes alone | Obsolete in P4/P7 (journey model replaced); new test waits on readiness | No |
| 3 of 5 hardware-budget tests fail | SwiftShader frame rate and a 317 ms fennec stall | P7 on hardware acceleration; fennec test removed with the feature (P4/P7); update the named selection in `tests/run-performance-budgets.mjs` | No |
| Six legacy case images missing locally | Never carried into this repository | Decide with user, repair in P3 (section 7.1) | No |
| 8 font files and 6 social SVGs missing locally | Same cause | P3 | No |
| Sitemap lists `/` only; no CV or case link from the homepage | Pre-redesign state | P2/P3/P8 | No |
| CV: 300x claim, Qarnot wording, role line, missing bilingual line, partial constrained-decoding wording | Not yet corrected | P2 | No |
| Perf harness lacks LCP, CLS, throttling, 7 s startup window, true hidden tab, new scenarios | Harness predates the contract | Migrate in P7 (ACCEPTANCE sections 4 and 6) | No |
| Built scene keeps drawing after it settles | Current behaviour | P4 (guided reading holds) | No |

## 10. How to reproduce

```sh
npm ci
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
lsof -i :5199                       # must be empty
npm run preview -- --port 5199 --strictPort
TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/baseline npm test
TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/baseline RUNS=5 npm run test:performance
TEST_URL=http://127.0.0.1:5199 QA_OUTPUT=.qa/baseline npm run test:performance:budgets
```

The capture script, the dependency checker, and the PDFKit text/render helpers used here were throwaway scripts in a temporary directory and are not committed; they are described in sections 5, 7 and 8 closely enough to recreate.
