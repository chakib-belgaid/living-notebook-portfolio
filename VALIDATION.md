# Living Notebook quality-review validation

Implemented and checked locally on **2026-10-01**. The existing uncommitted garden/content work was retained. Changes remain uncommitted on `main`; there is no public deployment or email backend.

The flow under test was: entry → either project → reading/garden switch → about/contact → resize and history restoration → screenshot dialog or retained draft → intercepted email-app handoff.

## Environment and evidence

- Mac17,2, Apple M5, 32 GB RAM, macOS 27.0.1.
- Installed Chrome 154.0.8037.58; Playwright 1.62.1; Node.js 26.8.1.
- Production preview: http://127.0.0.1:5199. Development: http://127.0.0.1:5198.
- **Browser plugin not available.** Used regular Playwright and native Mac UI control. Chrome could not launch within the filesystem sandbox, so the browser checks used approved execution outside it.
- Artifacts: [verification manifest](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/verification.json), [performance results](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/performance.json), [default trace](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/trace-default.json), [paused trace](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/trace-paused.json), [reduced-motion trace](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/trace-reduced.json).

The original review is [living-notebook-quality-review.pdf](/Users/chakib/Documents/Codex/2026-10-01/website-quality-review/living-notebook-quality-review.pdf). The previous validation record is preserved in [docs/validation-2026-09-08.md](docs/validation-2026-09-08.md); its older accessibility/theme claims are historical and are not carried forward as current results.

## Findings addressed

| Review finding | Result and verification |
| --- | --- |
| 1. Wheel containment | Note overscroll chains into the document. A regression uses an actually overflowing note at 1440×600, scrolls it to the bottom, then confirms wheel input advances the document. |
| 2. Draft loss | Page-memory draft survives chapter navigation, view changes, compact/desktop resizing, and email handoff; count and send state restore. Reload clears it. Typing before the deferred scene arrives now preserves focus as well as the draft. A test intercepts the mailto anchor, verifies recipient/body encoding, and sends nothing. |
| 3. Cramped responsive overlays | Below 900 px wide or 600 px high, content flows normally. The optional garden is bounded, navigation wraps, and controls are a disclosure. Tests and screenshots cover all requested viewports. |
| 4. Partial pause | One state stops CSS animations, marker pulses, mist, sky, and garden. Fog plus pause yields no running CSS animations, unchanged pixels in both sky layers, and a stable garden animation clock. Reduced motion holds the scene still. |
| 5. Accessibility navigation | Four semantic stage buttons support keyboard activation and identify the current stage; the slider is separate. Inactive immersive sections are inert. Plain headings and unique IDs replace repeated letter labels. Chrome accessibility trees expose one main and each reading section once. VoiceOver acceptance remains unverified below. |
| 6. Reading and direct navigation | Introduction, both grouped project summaries, current role/background, contact. Entry links expose both projects. Explicit links focus headings and add history; passive scroll replaces the current fragment. Refresh, Back/Forward, view changes, and resize preserve the section. |
| 7. Unreadable evidence | Larger screenshots sit beside summaries. Ordinary image links enhance into a native dialog with caption/source, fit/actual size, Escape, and restored focus. Wattch's synthetic-data disclosure remains visible. |
| 8. Startup and transition blocking | Baseline recorded before tuning. Construction, placement raycasts, merging, and shader work now yield in batches. Scene import is deferred until after page paint; reading creates no scene until requested. Shader diagnostics stay enabled. Local performance gates pass in the tested protocol. |
| 9. Carbon wording/accounting | Renamed to estimated reported-transfer impact; methodology sits under Details. Reported bytes, confirmed cache hits, unknown sizes, and unavailable timing remain distinct. Two focused accounting tests pass. Rendering energy is explicitly excluded. |
| 10. Empty initial HTML, print, metadata | Shared Vite HTML renderer works in development and production, with independent base CSS. JavaScript disabled, blocked module, and interrupted controller initialization all leave semantic content and contact links usable. Captured garden fallback handles loading/WebGL failure/context loss. Print and optional-origin metadata checks pass. |

## Browser and visual checks

**19/19 focused checks passed**, plus two development-server smoke checks. TypeScript and production build pass. Vite's uncompressed scene chunk advisory remains (about 575 KB, 152 KB gzip); reading mode does not load that chunk until the garden is requested.

| Check | Result |
| --- | --- |
| Page identity, meaningful first screen, no framework overlay | Pass in production and restarted development server. |
| Application runtime health | No page errors in normal test contexts. Deliberate controller/WebGL failure cases report their expected failure and preserve content. The visual captures record expected network resource errors from deliberately blocked weather requests, with no shader warnings or application exceptions. |
| Keyboard paths | Stage activation, explicit heading focus, screenshot dialog, Escape, and focus restoration pass. Ordinary scroll and resize do not move keyboard focus. |
| Navigation and history | Direct fragments, reload, Back/Forward, explicit view history, passive updates, and selected-section preservation pass. |
| Responsive layout | 1440×900; 390×844; 375×667; 320×568; 844×390. No horizontal document overflow or clipped header links. Normal-flow content and contact controls remain reachable by scrolling. |
| Enlargement | 200% CSS text enlargement at 390×844, 360×225 reflow proxy, and actual Chrome 400% browser zoom. The native check preserved `#wattch` and showed the heading in the flowing document. Zoom returned to 100%. |
| Screenshot dialog | Caption/synthetic disclosure, repository link, actual-size view, Escape, and opener focus pass. |
| Resilience | No JavaScript, blocked entry module, failed controller initialization, unavailable WebGL, context loss/restoration, offline weather, denied clipboard, and missing local speech voices pass. |
| Print | [Three-page A4 output](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/portfolio-print.pdf) rendered and visually inspected on every page. Both projects, contributions, decisions, source links, full background, and contact are present; fixed UI is absent. |
| Metadata | Development and production raw HTML contain semantic content, CSS and descriptive/social metadata. A separate build with a reserved test origin produced canonical/absolute preview URLs. Default production omits unknown deployment URLs. No public preview was tested. |

Visual inspection caught and fixed initial-header occlusion, oversized-text grid overflow, and section drift during zoom. Header clearance follows its measured height; very short windows put the header in normal flow. Full and lower-quality garden screenshots were compared under the same clear weather, autumn season, and 13:00 lighting. Desktop retains the original full settings; lower pixel ratio/shadows are retained for compact previews, where the softer edges remain readable.

[Default desktop garden](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/desktop-default.png), [Reading desktop](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/desktop-reading.png), [Whisperbook evidence](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/desktop-whisperbook.png), [Wattch evidence](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/desktop-wattch.png), [dialog](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/evidence-dialog.png), [320×568 entry](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/reading-320x568.png), [390×844 entry](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/reading-390x844.png), [375×667 entry](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/reading-375x667.png), [landscape contact](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/contact-844x390.png), [200% text](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/text-200.png), [400% reflow](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/reflow-400.png), [compact garden](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/mobile-garden-preview.png), [full settings](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/quality-full.png), [lower settings](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/quality-low.png).

## Performance protocol and results

[Baseline observer result](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/baseline.json) and [baseline trace](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/baseline-trace.json) were captured before editing: a 310 ms startup task on a direct full-garden load. This is one diagnostic baseline, not five matched comparison runs. Intermediate traces identified animal-placement and fallen-leaf raycasts as remaining blocking work; those loops now yield every eight attempts, preserving seeded placement.

Final runs used fresh isolated Chrome contexts, 1440×900 at device scale 1.6, no CPU/network throttling, and deliberately unavailable weather. OS/browser-process/GPU caches were not flushed. Each mode recorded five cold document loads and five journeys through all 16 notes, stage changes, Fog, and navigation. PerformanceObserver captured tasks above its 50 ms reporting threshold; a requestAnimationFrame probe sampled frame intervals without screenshot capture. One CDP trace per mode retains detailed tasks and user-timing marks.

| Mode (five runs each) | Tasks >50 ms during load or journey | Journey intervals below 33 ms | p95 interval |
| --- | --- | --- | --- |
| Default animation | None observed | 99.56–100% | 16.7–16.8 ms |
| Paused | None observed | 99.57–100% | 16.7–16.8 ms |
| Reduced motion | None observed | 99.78–100% | 16.7–16.8 ms |

The paused/reduced rows measure the probe's scheduling intervals while ambient animation is stopped; they are not evidence of active rendering work. Default first contentful paint was 40–64 ms, before scene construction began in those five runs. Construction took 291–322 ms in elapsed wall time while yielding. The largest RunTask in the captured default/paused/reduced traces was 40.7/37.8/36.4 ms respectively. Zero `maxCold` or `maxInteraction` in the JSON means no task exceeded the observer's 50 ms threshold, not zero work.

Five additional 390×844 reading loads and navigation journeys recorded no tasks above 50 ms and created zero WebGL canvases. Compact garden appearance was inspected separately; its active-performance acceptance on physical phones is not established.

The local gates pass: no unexplained observed interaction task above 100 ms, and at least 95% of sampled active default-journey intervals below 33 ms. These are main-thread/browser scheduling measurements, not GPU timing, device energy, or physical-phone guarantees.

## Remaining limits

- **VoiceOver is unverified.** Native Chrome accessibility inspection and saved [reading](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/accessibility-reading.json)/[garden](/Users/chakib/Documents/Codex/2026-10-01/living-notebook-implementation-validation/accessibility-garden.json) trees confirm the heading/landmark structure. Command-F5 and rotor attempts did not produce a visible VoiceOver result; selecting the VoiceOver app timed out. A final process check confirmed it was not left running. Auditory announcements and real rotor navigation still require a manual Mac check.
- Physical phones, Safari, Firefox, deployed share previews, and public hosting remain unverified. No deployment was attempted.
- Email construction was inspected without opening an email app or sending mail. Actual OS email-app acceptance is a separate handoff check.
- Exact-location permission was not requested during QA. Weather unavailability was exercised with aborted requests.

## Reproduce

```sh
npm run build
npm run preview -- --port 5199 --strictPort
PLAYWRIGHT_CHANNEL=chrome npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:performance
PLAYWRIGHT_CHANNEL=chrome node tests/visuals.mjs
```

Scripts use `TEST_URL` (default http://127.0.0.1:5199) and `QA_OUTPUT` (default /private/tmp/notebook-qa). The stable evidence linked above was copied outside the repository after inspection. Tests are in `tests/portfolio.test.mjs` and `tests/transfer.test.mjs`; performance/capture procedures are in `tests/performance.mjs` and `tests/visuals.mjs`.
