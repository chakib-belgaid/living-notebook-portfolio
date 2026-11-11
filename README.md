# A living notebook

[![Tests](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/test.yml)
[![Deploy](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/deploy.yml)
[![Node.js](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fchakib-belgaid%2Fliving-notebook-portfolio%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&logo=nodedotjs&color=339933)](package.json)

A portfolio for Chakib Belgaid, retaining the procedural garden, the navy night page, Newsreader typography, and verified project content.

[Personal website](https://chakib-belgaid.github.io/) · [Source repository](https://github.com/chakib-belgaid/living-notebook-portfolio)

The homepage is one guided reading in eight chapters (the sketch, the work, BP Log, Whisperbook, pyRAPL, pyJoules & Wattch, MCQ Scan, the path so far, contact). A left text card sits over a full-viewport navy night scene: the same house is drawn as a Sketch, laid out as a Blueprint, built for each project, and in Bloom at Contact. The text is the content; the scene follows it and keeps its ambient animation running while you read, at no more than 30 frames a second.

`?view=read` and `?view=stills` show the same page with each chapter's still image and load no renderer until the visitor turns off **Still images**. Reduced motion and data saver start the same way. Retained case studies live at `/work/<slug>/` and `/fr/work/<slug>/`.

Bots can read `/llms.txt` (the conventional filename) or `/llm.txt` (the same content). Both static files summarize the portfolio, link to its chapters, case studies and canonical project sources, and preserve the limitations of browser illustrations and performance evidence. The HTML links to `/llms.txt` with `rel="describedby"`. Keep both files identical when changing portfolio content.

## Run locally

Vite requires Node.js 20.19+ or 22.12+. Use Node.js 24+ for the regression suite, which uses native TypeScript loading.

```sh
npm ci
npm run dev -- --port 5198 --strictPort
npm run build
npm run preview -- --port 5199 --strictPort
```

Development: http://127.0.0.1:5198. Production preview: http://127.0.0.1:5199. Serve the generated `dist/` over HTTP. If a development server was running before `vite.config.ts` was added, restart it to register the HTML transform.

## Navigation and reading

The header language selector supports English and French in the portfolio, garden, and dialogs. Previous Arabic preferences and links fall back to a supported language. Language changes retain the current scene and mounted controls. Only the language preference is saved (`notebook:locale`).

Share a specific language with `?lang=en` or `?lang=fr`, combined with a view and fragment, for example `?view=read&lang=fr#whisperbook`. The URL takes priority over a saved choice, then the browser’s first supported language, then English. Back/Forward restores the URL’s language. The Whisperbook case's **Listen** illustration uses a voice on the device in the page's language when one exists; it never falls back to an unrelated language or a network voice.

`src/translations.ts` holds the French source-message catalog, including named placeholders for live measurements. `src/i18n.ts` binds English text and accessibility attributes to translations without replacing interactive DOM nodes; newly mounted widgets are localized too. Add catalog entries when editing English copy. The generated HTML remains readable in English when JavaScript is unavailable; translated titles and descriptions are applied during enhancement. `tests/translations.test.mjs` checks that every rendered label has a translation. The previous page's `localization.test.mjs` (language precedence, switching in place, narration) waits in `tests/retired/` for P7.

Stable fragments are the chapter ids `#intro`, `#work`, `#bplog`, `#whisperbook`, `#energy-tools`, `#mcq-scan`, `#about` and `#contact`, plus two legacy aliases: `#wattch` lands on the energy-tools chapter and `#workshop` on the notebook inside About. Explicit navigation adds a history entry, lands at once and focuses the destination heading. Passive scrolling replaces the current fragment without moving focus. Refresh, deep links and Back/Forward restore the chapter, and its still is shown from the first paint (a small inline script sets the rail poster from the fragment). All query parameters are preserved.

The header holds Work, About, Contact, CV, the language selector and a **Motion and sound** disclosure (Pause motion, Still images, Sound). On wide layouts the ruler at the bottom is a reading scale with a dot where each chapter begins, the carbon tally, the garden panel's button, and sound and pause; on stacked layouts only the tally and the garden button remain, in the bottom corner.

## Case studies

The homepage stays text-first and links to three retained cases in English and French: `/work/whispbook/` (Whisperbook Android; the slug predates the web studio, which links to its own repository), `/work/wattch/` and `/work/mcq-scan/`. **Return to the portfolio** (`public/assets/case-return.js`) finds the case's chapter and reading position again, keeping the language and view, and falls back to a plain chapter link without JavaScript or session storage.

Whisperbook shows four screenshots and Wattch two, with their original captions; Wattch's are labelled as deterministic protocol output and synthetic workflow values, not hardware measurements. The files are checked in under `public/assets/projects/`, carry width and height; each hero loads at once and the rest lazily below the fold. Each image is a plain link to its file; `public/assets/case-evidence.js` turns it into an enlargement dialog with **Actual size** / **Fit image** / **Close**, Escape and focus return.

The Whisperbook case also offers two optional illustrations. **Inside Whisperbook** walks through book, chapters, voices and audio (Step inside, Next, Back, Close; one list with reduced motion or without JavaScript). **Listen** reads two lines with a voice already on the visitor's device, in the page's language, with Stop; nothing auto-plays, leaving or hiding the page stops it, and it is labelled as a browser illustration, not the Android narration engine. MCQ Scan is text only (internal client work).

Each case page has its own 1200×630 share card, `public/assets/social/<slug>-<lang>.png`, built from the page's own wording by `npm run share-cards` (`-- --check` validates the committed cards).

## Project availability and evidence

The Whisperbook chapter links to its [source](https://github.com/chakib-belgaid/whisper-book) and [test releases](https://github.com/chakib-belgaid/whisper-book/releases); the case states that the public v0.1 APK is a debug-signed test build for Android 8+ on arm64 and that current source features may differ from it. The Wattch case links to the [Wattch Core repository](https://github.com/chakib-belgaid/wattch-core) and its Energy Tests documentation. The site does not imply a Marketplace release.

The energy-tools chapter also points to the two research libraries Chakib designed, both owned by the PowerAPI organization and developed with its research team:

- [pyRAPL](https://github.com/powerapi-ng/pyRAPL): the first, for energy use during Python experiments.
- [pyJoules](https://github.com/powerapi-ng/pyJoules): its successor, adding GPU and other measurement sources.

BP Log links to its [code and evaluation](https://github.com/chakib-belgaid/bp-tracker). The notebook in About links to the Whispbook web studio, the Pocket TTS Android benchmark and the speculative-decoding experiment on MLX.

Availability of the earlier link set (Whisperbook, Wattch, pyJoules) was checked on 6 October 2026; the pyRAPL, BP Log and notebook links come from the content contract and have not been re-audited here. [Project evidence and benchmark requirements](docs/project-evidence.md) records the sources and remaining measurement gaps. Device latency, narration speed, peak RAM, and daemon overhead must come from reproducible runs; the browser illustrations and synthetic fixtures cannot support these claims.

## The garden

Reading carries one house through Sketch, Blueprint, Build and Bloom. Each chapter has a pose: BP Log frames **the heart garden** (a heart on a plinth behind a pulse trace), Whisperbook the reading pavilion (with Whispbook's web studio as an open laptop on its table), the energy tools the observatory, MCQ Scan **the workshop** in the building site beside Mansourah, About the terrace and tower, and Contact the finished house in Bloom. The terraces, canal, waterfall, drones, greenhouse, seasonal foliage and the animals remain. A passive transition starts as the next chapter comes up and settles while you finish the previous one; explicit navigation snaps to its destination. Once a pose has settled, the garden and sky draw nothing until something changes.

The page shows the 22:00 navy night by default, with the moon, stars and the house's lamps. **Pause motion** keeps everything still and reduced motion snaps every pose. Neither changes sound.

**Make the garden yours** (the sprout button beside the tally) opens the garden panel:

- **Play with the sky**: the hour (a slider and **Use my clock**), the weather (Clear, Clouds, Rain, Snow, Storm, Fog, or **Live** from [Open-Meteo](https://open-meteo.com) for the place the time zone names; **Use my exact location** asks for the device position), and the season (or **Now**, from the date and hemisphere). Nothing is fetched and no permission is asked until the visitor presses Live or Use my exact location.
- **Tend the garden**: **Plant one** or **Plant by clicking** a terrace (up to 24 trees), **Turn**, and **Drawing quality** (Auto, Full, Light).
- **Explore the garden**.

The mount keeps that state, so a garden built later (stills turned off, a lost context, a quality rebuild) opens as the visitor left it.

### Exploring

Exploring is an explicit state, loaded only when asked for (`src/narrative/explore.ts`). Gestures act only inside it: a drag turns the garden, the wheel or a trackpad pinch zooms about the pointer, and two fingers zoom and move it. The toolbar gives each a button (Turn left/right, Zoom in/out, and four Move arrows) plus **Reset view** and **Back to reading**; while exploring, the arrow keys turn and zoom and Shift with an arrow moves the garden, wherever focus is (except in a field or slider). The places are labelled with keyboard-reachable buttons that open their chapters: BP Log, Whisperbook, pyRAPL, pyJoules & Wattch, MCQ Scan and The path so far. The labels are kept inside what the masthead, the chapter card and the toolbar leave clear, and clear of one another (`placeLabels` in `src/scene.ts`). Ambient life (water, sway, animals, drones) runs only while exploring. Wide layouts explore in place behind the card; stacked layouts move the stage into a full-screen dialog and make the rest of the page inert. Escape or Back to reading restores the reading position, focus (the panel's Explore button) and the chapter's pose; a place's button leaves for its chapter instead.

After a deliberate planting, when motion is allowed, the nearest fennec on the tree's level may notice it, trot over by a route checked for water, bridges and steps, settle under it for a few seconds and go back to its day. Fennecs are night animals: they are out by day and by night (with a faint moonlit sheen after dark), in dry weather, in both the full and the light build, so a visit is seen in the default 22:00 night.

### Sound

Sound is off until its own control turns it on (the header's Motion and sound panel, or the speaker in the ruler). `src/soundscape.ts` makes it in the browser with Web Audio, so nothing is downloaded: water once the stone is built, wind that follows the weather, rain, birds by day (a chorus on a sunny morning) and crickets by night, distant thunder in a storm, and piano: a slow loop in D major for the rain and autumn's falling leaves, and a lilting waltz in G major for sunny mornings. One piece plays at a time, changing at a bar line. `soundMix` turns the garden's state into a level per layer; the engine's loudness table is the place to tune by ear. Pause, system-reduced motion and a hidden tab silence it without changing consent; once silent, the engine is suspended. Its processing isn't part of the carbon estimate, which says so.

Contact is an email link and social links; the page sends nothing itself.

## Architecture and performance

Vite + TypeScript + Three.js, without a framework or backend:

- `src/narrative/content.ts` holds the English chapter copy, `src/narrative/model.ts` the chapter ids, aliases, phases and poster sizes; `src/render.ts` renders the semantic page from them. `vite.config.ts` injects that HTML in development and production, so the page is complete without JavaScript.
- `src/main.ts` is the composition root: it only enhances the static document. `src/narrative/controller.ts` tracks the active chapter and performs every jump; `src/navigation.ts` turns links and history into its visits; `src/narrative/return-state.ts` and `public/assets/case-return.js` carry the reading position to and from the case pages.
- `src/narrative/scene-mount.ts` owns the one live scene: renderer lifecycle, the stage moved between the wide rail and each chapter's portrait slot, posters, ambient animation, the visitor's garden state and quality rebuilds. `src/narrative/scene-adapter.ts` poses the garden per chapter; `src/narrative/scene-controls.ts` binds Pause motion, Still images and Sound; `src/narrative/preferences.ts` reads views, motion, data saver and quality.
- `src/narrative/ruler.ts` draws the reading scale and the carbon tally; `src/narrative/garden-panel.ts` the garden panel. `src/narrative/explore.ts` and `src/narrative/render-meter.ts` are separate chunks fetched only when the visitor asks for exploring or the rendering detail. `src/narrative/card-motion.ts` gives each chapter card its landmark stop on wide layouts (the card lingers for an extra stretch of scroll, drifting slowly, and eases in and out of it) and its fade; stacked layouts only fade each chapter's lead in, and reduced motion gets neither.
- `src/scene.ts` builds and draws the garden; `src/sky.ts` its two sky layers; `src/weather.ts` weather and location; `src/soundscape.ts` the sound; `src/transfer.ts` and `src/compute.ts` the carbon estimate; `src/i18n.ts` and `src/translations.ts` the French.

The semantic page and the chapter's still paint before any scene code loads. Reduced motion, data saver and `?view=read|stills` load no renderer until asked. Scene construction yields between batches. The garden and sky loops ask for frames only while there is something to draw: ambient animation continues after chapter transitions settle, at no more than 30 frames a second while a chapter is read (`READING_FRAME_RATE`; transitions and exploring draw at the display's rate), while hidden tabs, offscreen scenes, manual pause and reduced motion stop recurring frames. Every change (scroll, resize, navigation, the panel, context restoration) wakes them, with the clock restarting after a sleep rather than jumping. Instancing the planted trees was measured and not kept: it cut draw calls by 39% with 24 trees but drew no faster (see VALIDATION.md).

On 3 November 2026 the minified entry chunk measured 101.44 kB of JavaScript and 27.22 kB of CSS (92.37 and 24.34 kB before exploration, the postcard and the rendering detail were restored), and the scene chunk 605.14 kB. These are measurements of that build, not budgets.

**Drawing quality** offers Auto, Full and Light, remembered on the device (`notebook:quality`). Auto draws wide screens Full and compact ones Light. Full keeps the original settings (pixel ratio capped at 1.6, 2048 px shadows). Light caps the pixel ratio at 1.25 and the frame rate at 30 and uses cheaper shadows. Compact screens under Light (and `?quality=low` anywhere) also build a lighter garden without the gardener, animals or small props. When a choice changes the build, a new garden is built under the old one, which stays on screen until the new one has drawn with the same chapter, trees, turn, zoom and pan, atmosphere and tally. Posters cover loading, unavailable WebGL and context loss. Print exposes the complete content and removes fixed controls.

## Carbon estimate and deployment metadata

The ruler's tally shows **Estimated impact of this visit so far**; its panel splits it into data transfer and rendering, both computed with [co2.js](https://developers.thegreenwebfoundation.org/co2js/overview/).

- **Data transfer** uses co2.js's SWDM v4 model: reported bytes × 0.3 kWh/decimal GB × 494 g CO₂e/kWh. Positive transfer sizes, confirmed cached resources, and unknown sizes are counted separately; hidden cross-origin timings cannot imply zero transfer. See the [methodology](https://sustainablewebdesign.org/estimating-digital-emissions/) and [Resource Timing distinctions](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/transferSize).
- **Rendering** accumulates the main-thread time of every garden and sky frame actually drawn (animation updates included) at an assumed 10 W, plus the garden's GPU time at an assumed 20 W, × co2.js's world average grid intensity. GPU time comes from `EXT_disjoint_timer_query_webgl2` where the browser exposes it (measured on a sample of frames and scaled to all frames drawn); elsewhere the figure is a CPU-only lower bound and says so. The wattages live in `src/compute.ts`.

**Show rendering detail** in the same panel (`src/narrative/render-meter.ts`, fetched on the first press) draws a sparkline of each frame's CPU time and, where GPU timers exist, the last frame's GPU time, with triangles and draw calls. It samples only while open and the tab is visible. It is labelled as this page's estimated rendering cost, measured in the visitor's browser, and not a Wattch hardware measurement.

By default the page makes no third-party request: fonts, images and share cards are self-hosted, and Open-Meteo is called only from Live or Use my exact location.

The homepage has a descriptive title, description, social metadata, the captured garden preview as its share image, and the navy `#0e2b48` theme color. Each case page points `og:image` and `twitter:image` at its own share card. To generate canonical and absolute social URLs, supply the actual deployment origin when building:

```sh
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
```

Without a configured origin, canonical and absolute social URLs are omitted.

## Publishing

Every push to `main` runs [Deploy personal website](.github/workflows/deploy.yml): install the locked dependencies with Node.js 24, check TypeScript and build, then publish `dist/` to the existing [GitHub Pages repository](https://github.com/chakib-belgaid/chakib-belgaid.github.io). GitHub Pages serves that repository's `main` branch from `/`. Failed builds stop before publication. The workflow can also be run manually from the Actions tab.

The source repository's `PAGES_DEPLOY_KEY` Actions secret holds a dedicated SSH deploy key with write access to the Pages repository. Its public key is listed there as **Living Notebook automatic deployment**. Deployments are serialized. GitHub Pages runs its own deployment after the generated files are pushed; the public update can take a few minutes.

For a manual deployment, build and inspect the production preview, copy `dist/` into a clean, up-to-date checkout of the Pages repository, review the diff, then commit and push there:

```sh
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
rsync -av dist/ /path/to/chakib-belgaid.github.io/
```

Do not use `--delete`: the Pages repository retains existing case studies, project evidence assets, and résumé URLs for incoming links. Its Git history retains the previous homepage for rollback. `.nojekyll` keeps the build as static files. `sw.js` retires the former Systems Garden service worker and removes only its named caches. The notebook does not register an offline worker.

Wait for the Pages deployment to succeed, then verify the public homepage and assets in a browser. The production origin above is also used for canonical and social-image metadata.

## Content provenance

The homepage copy follows the content contract in [docs/handoff/sketchbook-to-house/CONTENT_AND_EVIDENCE.md](docs/handoff/sketchbook-to-house/CONTENT_AND_EVIDENCE.md), whose project, biography and contact facts were checked against the earlier portfolio (`src/content/portfolio.ts` and `src/content/contacts.ts` in `voxel-garden-energy-routes`, 8 September 2026) and corrected with the user. No placeholder descriptions from the concept boards were reused, and no employment status, adoption figures or release numbers were added.

The six case screenshots in `public/assets/projects/` were checked in on 3 November 2026 from the published GitHub Pages repository (their SHA-256 sums match the copies recorded there on 1 November), with their original captions. Wattch's two are deterministic protocol output and synthetic workflow values, labelled as such, not physical energy measurements. Source links lead to the actual project repositories.

The concept boards guide the pencil / blueprint / garden direction; their small descriptions are not factual sources. The 3D garden, house and drones are original procedural geometry, and the posters and share cards are rendered from the page itself; no generated imagery is used as a product asset.

## Validation

Tests run against a production preview:

```sh
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
npm run preview -- --port 5199 --strictPort
TEST_URL=http://127.0.0.1:5199 npm test
```

`npm test` runs `tests/*.test.mjs` one file at a time, so their WebGL scenes do not compete for the same software renderer: `browser-fixture`, `card-motion` (the landmark stop, its curve, reduced motion, stacked layouts, keyboard focus), `case-evidence` (screenshots, the enlargement dialog, Inside Whisperbook, Listen), `exploration`, `fennec-visit`, `garden-panel`, `narrative-model`, `navigation`, `quality-rebuild`, `render-meter`, `scene-lifecycle` (one renderer, continuous visible animation, hidden tab, pause, stills, context loss, sound consent), `sound`, `transfer`, `translations` and `ux-regressions`. Failed fixture setup closes its browser context before reporting the error.

`scripts/verify-case-dependencies.mjs` builds a clean output directory (`DIST`, default `dist`), serves it and checks the six case routes and both `/live/` redirects: every local dependency answers with the right type and decodes, the EN/FR pairs match, and the six case screenshots and six share cards are built and referenced. `scripts/verify-narrative-shell.mjs` checks the static page (no JavaScript, first viewport, fragments, French) against a preview.

`tests/performance.mjs` and `tests/run-performance-budgets.mjs` (`npm run test:performance`, `npm run test:performance:budgets`) are the exploration and animation lifecycle performance harness (scenarios: place response, exploring frame rate and tab resume, drag and fennec-visit long tasks, continued animation after exploring, first pose; `SCENARIOS=` and `TRIALS=` select and repeat them; the report in `.qa/performance/report.json` names the browser and the WebGL renderer so software rendering is visible), and `tests/visuals.mjs` writes review captures of every chapter hold, exploration, the panel, the meter and the case dialog to `.qa/visuals/`. Run budgets on a documented browser/device profile with hardware acceleration; SwiftShader software rendering can fail them, and a passing functional run does not establish performance acceptance.

`tests/retired/` keeps the previous page's seven suites unchanged. The restored features' cases were written fresh in the files above; the folder's README remains the migration ledger for what P7 still keeps, adapts or replaces.

[VALIDATION.md](VALIDATION.md) records the earlier October 1 validation of the previous page. Physical phones, Safari/Firefox, share previews and VoiceOver acceptance remain unverified for the current page. Historical documentation is retained in `docs/garden-presentation-before-quality-review.md` and `docs/validation-2026-09-08.md`; the redesign's plan and progress are in `docs/handoff/sketchbook-to-house/`.
