# A living notebook

A portfolio for Chakib Belgaid, retaining the procedural garden, blueprint paper, Newsreader typography, and verified project content.

[Personal website](https://chakib-belgaid.github.io/) · [Source repository](https://github.com/chakib-belgaid/living-notebook-portfolio)

Desktop opens the garden journey. **Read portfolio** switches to introduction → Whisperbook → Wattch Core → current work and background → contact. Phones in portrait (below 900 px wide, at least 500 px high) get the garden journey: short cards over stills of the garden that wipe from Sketch to Bloom as you scroll, with each section's details in a bottom sheet (**More**, or **Leave a note**). The sprout swaps the stills for the live garden, which follows the same stops. Landscape phones, short windows and **Read as a page** (`?view=read`) use normal document flow.

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

Both projects are linked on entry. Stable fragments are `#work`, `#whisperbook`, `#wattch`, `#about`, and `#contact`. Explicit navigation adds a history entry and focuses the destination heading. Passive scrolling replaces the current fragment without moving focus. Refresh and Back/Forward restore the section; resizing preserves it.

Explicit view choices use `?view=read` or `?view=garden`. Compact windows always retain flowing content. The header wraps; the garden ruler provides four evenly spaced stage buttons and a separate progress slider. Optional weather, planting, and transfer information sit under **Garden controls**.

The journey (`src/phone.ts`, `src/sheet.ts`, `src/phone.css`) is laid over the reading page rather than replacing it: each stop is a section marked `data-stop`, and the nodes marked `data-detail` move into the sheet and back, keeping the contact draft and any playing voice. The six stills in `public/assets/stills/` are captured from the real garden by `npm run stills` (dev server on port 5198; needs `cwebp`), within a 100 KB-each, 600 KB-total budget. A phone fetches the current still and one ahead. Clouds and leaves are CSS animation, paused by the header's pause button and absent with reduced motion, where wipes also cut instead of sweeping.

Each reading project groups its purpose, contribution, decision, screenshot, and source repository. **View full screenshot** works as an ordinary image link and gains a native dialog when JavaScript is available: caption, source link, fit/actual size, Escape dismissal, and restored focus. Wattch's screenshot remains explicitly synthetic workflow evidence. Browser illustrations remain separately labeled: local browser speech for Whisperbook, and this page's measured CPU and GPU rendering cost, with its estimated carbon, for Wattch.

## The garden

Scrolling carries one garden through Sketch, Blueprint, Build, and Bloom. Only the opening headline uses letter-by-letter animation. Inactive chapters are inert and hidden from assistive navigation.

The original terraces, canal, waterfall, drones, reading pavilion, drum-recorder observatory, atelier tower, greenhouse, seasonal foliage, birds, ducks, rabbits, cat, planting, and rotation remain. The sky follows time of day, moon phase, and weather from [Open-Meteo](https://open-meteo.com). The timezone supplies an approximate place; **Use my exact location** requests device location. Unavailable weather has an explicit fallback. Weather and seasons can be previewed from the controls.

One pause state stops CSS effects, mist, marker pulses, sky, and garden motion. Reduced motion keeps the scene still and the stage changes immediate. The motion button reports its current action and honors the system preference.

Contact builds an email-app handoff only. The draft, character count, and button state survive navigation, resizing, view changes, and the handoff. The draft lives in page memory and clears on reload. The page neither sends email nor persists a draft. Clipboard rejection and missing local speech voices have readable fallback states.

## Architecture and performance

Vite + TypeScript + Three.js, without a framework or backend:

- `src/content.ts` is the shared content and journey data; `src/render.ts` renders the semantic portfolio.
- `vite.config.ts` injects that HTML in development and production. Base CSS loads independently of JavaScript. Enhancement activates after controller initialization; blocked scripts or a failed controller leave the reading content available.
- `src/navigation.ts`, `src/contact.ts`, `src/widgets.ts`, `src/evidence.ts`, and `src/transfer.ts` own navigation, memory-only drafts, lifecycle, screenshot dialogs, and transfer accounting.
- `src/main.ts` coordinates presentation and interactions. `src/scene.ts` draws the garden; `src/sky.ts` draws its two sky layers; `src/weather.ts` handles weather and location.

The semantic page paints before scene loading. Reading mode creates no scene until requested; project images load near use. Scene construction yields between batches, including raycasts for animals and fallen leaves. Instrumentation records construction phases, shader warm-up and first use, first render, and stage changes. Shader error checks remain enabled.

Desktop retains the full settings (pixel ratio capped at 1.6, 2048 px shadows). Compact previews use a 1.25 cap and 1024 px shadows after visual comparison. A captured garden image covers loading, unavailable WebGL, and context loss. Print exposes the complete reading portfolio and removes fixed controls.

## Carbon estimate and deployment metadata

The display is **Estimated impact of this visit so far**, split into data transfer and rendering, both computed with [co2.js](https://developers.thegreenwebfoundation.org/co2js/overview/).

- **Data transfer** uses co2.js's SWDM v4 model: reported bytes × 0.3 kWh/decimal GB × 494 g CO₂e/kWh. Positive transfer sizes, confirmed cached resources, and unknown sizes are counted separately; hidden cross-origin timings cannot imply zero transfer. See the [methodology](https://sustainablewebdesign.org/estimating-digital-emissions/) and [Resource Timing distinctions](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/transferSize).
- **Rendering** accumulates the main-thread time of every garden and sky frame actually drawn (animation updates included) at an assumed 10 W, plus the garden's GPU time at an assumed 20 W, × co2.js's world average grid intensity. GPU time comes from `EXT_disjoint_timer_query_webgl2` where the browser exposes it (measured on a sample of frames and scaled to all frames drawn); elsewhere the figure is a CPU-only lower bound and says so. The wattages live in `src/compute.ts`.

The page has a descriptive title, description, social metadata, and the captured preview image. To generate canonical and absolute social URLs, supply the actual deployment origin when building:

```sh
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
```

Without a configured origin, canonical and absolute social URLs are omitted.

## Publishing

This repository contains the source. The production build is published at the root of the existing [GitHub Pages repository](https://github.com/chakib-belgaid/chakib-belgaid.github.io), which serves `main` from `/`. Source pushes alone do not deploy the site.

After building, testing, and inspecting the production preview, copy `dist/` into a clean, up-to-date checkout of the Pages repository, review the diff, then commit and push there:

```sh
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
rsync -av dist/ /path/to/chakib-belgaid.github.io/
```

Do not use `--delete`: the Pages repository retains existing case studies, project evidence assets, and résumé URLs for incoming links. Its Git history retains the previous homepage for rollback. `.nojekyll` keeps the build as static files. `sw.js` retires the former Systems Garden service worker and removes only its named caches. The notebook does not register an offline worker.

Wait for the Pages deployment to succeed, then verify the public homepage and assets in a browser. The production origin above is also used for canonical and social-image metadata.

## Content provenance

The Blueprint notes (roles, organisations, years, and one-line summaries, including the PowerAPI deployment across 100+ nodes) come from the same portfolio's verified career timeline (`experience` in `src/content/portfolio.ts`). Project, biography, and contact facts were checked against the existing portfolio's `src/content/portfolio.ts` and `src/content/contacts.ts` in `/Users/chakib/Documents/github/voxel-garden-energy-routes` on 2026-09-08. The verified featured projects are Whisperbook Android and Wattch Core. No placeholder project descriptions from the concept image were reused.

The screenshots are copied from that portfolio's `public/assets/projects/whisperbook/now-playing.webp` and `public/assets/projects/wattch/energy-tests.png`. Wattch's screenshot is explicitly described as deterministic/synthetic workflow evidence, not a physical energy measurement. Source links lead to the actual project repositories. No employment status, quantified performance claims, or release numbers were added.

The supplied concept is retained as `design-reference.png` inside the source archive. It guides the pencil / blueprint / garden direction; its small descriptions are not factual sources. The 3D garden and drones are original procedural geometry.


## Validation

[VALIDATION.md](VALIDATION.md) records the October 1 implementation, 19 focused checks, five cold loads and journeys in each motion mode, mobile emulation, native Chrome zoom, screenshots, traces, and remaining limits.

```sh
PLAYWRIGHT_CHANNEL=chrome npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:performance
PLAYWRIGHT_CHANNEL=chrome node tests/visuals.mjs
```

The scripts target port 5199 by default. Override `TEST_URL` and `QA_OUTPUT` as needed. The October 1 validation used Playwright with installed Chrome and native Mac UI checks. Physical phones, Safari/Firefox, share previews, and VoiceOver acceptance remain unverified. Historical presentation documentation is retained in `docs/garden-presentation-before-quality-review.md` and `docs/validation-2026-09-08.md`.
