# A living notebook

[![Tests](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/test.yml)
[![Deploy](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/chakib-belgaid/living-notebook-portfolio/actions/workflows/deploy.yml)
[![Node.js](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fchakib-belgaid%2Fliving-notebook-portfolio%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&logo=nodedotjs&color=339933)](package.json)

A portfolio for Chakib Belgaid, retaining the procedural garden, blueprint paper, Newsreader typography, and verified project content.

[Personal website](https://chakib-belgaid.github.io/) · [Source repository](https://github.com/chakib-belgaid/living-notebook-portfolio)

Desktop defaults to a flowing, scan-friendly portfolio: introduction → selected work and canonical research repositories → Whisperbook → Wattch Core → background → contact. **Explore garden** opts into the interactive playground (`?view=garden`); **Read portfolio** returns to the page (`?view=read`). The reading page does not load the Three.js scene or start garden audio.

Portrait phones default to the animated garden journey: scrolling grows the scene through Sketch, Blueprint, Build, and Bloom, with project details in sheets. Data-saving devices use stills, also selectable with `?view=stills`. **Read as a page** (`?view=read`) explicitly selects the text layout. Direct `?view=garden` links retain the desktop and phone journeys. On phones, opening the garden from the reading page previews it above the page and closes back to the page. Landscape phones and short windows keep flowing content.

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

The header language selector supports English, French, and Arabic in the reading page, phone journey, garden, and dialogs. Arabic uses right-to-left document flow and a system font that preserves joined Arabic letters. Language changes retain the current scene and mounted controls. Only the language preference is saved (`notebook:locale`).

Share a specific language with `?lang=en`, `?lang=fr`, or `?lang=ar`, combined with a view and fragment, for example `?view=read&lang=fr#whisperbook`. The URL takes priority over a saved choice, then the browser’s first supported language, then English. Back/Forward restores the URL’s language. Local browser narration uses a voice in the selected language when available; it never falls back to an unrelated language or a network voice.

`src/translations.ts` holds the French and Arabic source-message catalog, including named placeholders for live measurements. `src/i18n.ts` binds English text and accessibility attributes to translations without replacing interactive DOM nodes; newly mounted widgets are localized too. Add catalog entries when editing English copy. The generated HTML remains readable in English when JavaScript is unavailable; translated titles and descriptions are applied during enhancement. `tests/localization.test.mjs` checks content coverage, language precedence, switching in place, RTL reflow, and narration.

Both projects are linked on entry. Stable fragments are `#work`, `#whisperbook`, `#wattch`, `#about`, and `#contact`. Explicit navigation adds a history entry and focuses the destination heading. Passive scrolling replaces the current fragment without moving focus. Refresh and Back/Forward restore the section; resizing preserves it.

Explicit view choices use `?view=read` or `?view=garden`. Compact windows always retain flowing content. The header wraps; the garden ruler provides four evenly spaced stage buttons and a separate progress slider. Optional weather, planting, and transfer information sit under **Garden controls**.

The journey (`src/phone.ts`, `src/sheet.ts`, `src/phone.css`) is laid over the reading page rather than replacing it: each stop is a section marked `data-stop`, and the nodes marked `data-detail` move into the sheet and back, keeping any playing voice. Bloom's card carries the email and social links itself. The stills in `public/assets/stills/` are captured from the real garden by `npm run stills` (dev server on port 5198; needs `cwebp`): six by day (1 pm) and six by night (`-night`, 10 pm), each set within a 100 KB-each, 600 KB-total budget. A phone shows the set for the visitor's clock and fetches the current still and one ahead. Clouds and leaves are CSS animation, paused by the header's pause button and absent with reduced motion, where wipes also cut instead of sweeping.

Each reading project groups its purpose, contribution, decision, screenshot, and source repository. **View full screenshot** works as an ordinary image link and gains a native dialog when JavaScript is available: caption, source link, fit/actual size, Escape dismissal, and restored focus. Wattch's screenshot remains explicitly synthetic workflow evidence. Browser illustrations remain separately labeled: local browser speech for Whisperbook, and this page's measured CPU and GPU rendering cost, with its estimated carbon, for Wattch.

## Project availability and evidence

Whisperbook links to its published [v0.1 Android test APK](https://github.com/chakib-belgaid/whisper-book/releases/tag/v0.1), with the debug-signing, Android 8+/arm64 requirements, and source-versus-release distinction visible. Wattch links to its [source build instructions](https://github.com/chakib-belgaid/wattch-core#quick-start) and [VS Code development setup](https://github.com/chakib-belgaid/wattch-core/tree/main/editors/vscode-energy-tests#development). The site does not imply a Marketplace release.

The selected-work section also points directly to organization-owned research:

- [pyJoules](https://github.com/powerapi-ng/pyJoules): Python energy measurement; pip installation is documented upstream.
- [Joulehunter](https://github.com/powerapi-ng/joulehunter): Python energy profiling; upstream is archived.
- [PowerAPI](https://github.com/powerapi-ng/powerapi): framework for software-defined power meters.

Availability was checked on 6 October 2026. [Project evidence and benchmark requirements](docs/project-evidence.md) records the sources and remaining measurement gaps. Device latency, narration speed, peak RAM, and daemon overhead must come from reproducible runs; the browser illustrations and synthetic fixtures cannot support these claims.

## The garden

Scrolling carries one garden through Sketch, Blueprint, Build, and Bloom. Only the opening headline uses letter-by-letter animation. Inactive chapters are inert and hidden from assistive navigation.

The original terraces, canal, waterfall, drones, reading pavilion, drum-recorder observatory, atelier tower, greenhouse, seasonal foliage, birds, ducks, fennecs, cat, planting, and rotation remain. The sky follows time of day, moon phase, and weather from [Open-Meteo](https://open-meteo.com). The timezone supplies an approximate place; **Use my exact location** requests device location. Unavailable weather has an explicit fallback. Weather and seasons can be previewed from the controls.

One pause state stops CSS effects, mist, marker pulses, sky, and garden motion. Reduced motion keeps the scene still and the stage changes immediate. The motion button reports its current action and honors the system preference.

The garden has sound, on by default; the speaker beside the pause button (on phones, in the journey's header) turns it off. `src/soundscape.ts` makes it in the browser with Web Audio, so nothing is downloaded: water once the stone is built, wind that follows the weather, rain, birds by day (a chorus of trills and calls on a sunny morning) and crickets by night at Bloom, distant thunder in a storm, and piano: a slow loop in D major for the rain and autumn's falling leaves, and a lilting waltz in G major for sunny mornings, which takes over from the leaves' piece in the morning. One piece plays at a time, changing at a bar line. The water is louder beside the canal, and the garden steps back while Whisperbook reads. `soundMix` turns the garden's state into a level per layer; the engine's loudness table is the place to tune by ear. Browsers allow audio only after a gesture, so no audio context exists before the visitor's first tap, click or key press. The pause button silences sound with the motion, and so do a hidden tab and the reading page; reduced motion doesn't, since sound isn't motion. Once silent, the engine is suspended. Its processing isn't part of the carbon estimate, which says so.

Building labels answer pointer and keyboard focus alike: the label inverts and a ring of lantern light circles its building on the ground. Close on a project, **Back to all work** returns to the overview. Planting plays a short chime while the garden is heard, and the nearest fennec on the tree's level may notice it, trot over by a route checked for water, bridges and steps, settle under it for a few seconds and go back to its day; it never does so while motion is paused or reduced. **Save a postcard** downloads the garden as framed, with its sky and a caption giving the portfolio's address; it is drawn once on request, and nothing is sent.

Whisperbook's "What I built" note offers **Inside Whisperbook**: book, chapters, voices and audio, one step at a time, while the pavilion's lamp and sound rings light up to match. Each step states one decision already in the project's record. The reading page, reduced motion and every language show the steps as one list, with the source a click away.

Left alone for 20 seconds in the garden view, the header, ruler, controls and building labels fade, leaving the garden and the note; any movement or key brings them back. At Bloom, the garden slowly turns, unless motion is paused. Writing a note, planting, or an open slip or dialog keeps the controls.

Contact is an email link and social links; the page sends nothing itself. Missing local speech voices have a readable fallback state.

## Architecture and performance

Vite + TypeScript + Three.js, without a framework or backend:

- `src/content.ts` is the shared content and journey data; `src/render.ts` renders the semantic portfolio.
- `vite.config.ts` injects that HTML in development and production. Base CSS loads independently of JavaScript. Enhancement activates after controller initialization; blocked scripts or a failed controller leave the reading content available.
- `src/navigation.ts`, `src/widgets.ts`, `src/evidence.ts`, and `src/transfer.ts` own navigation, widget lifecycle, screenshot dialogs, and transfer accounting.
- `src/main.ts` coordinates presentation and interactions. `src/scene.ts` draws the garden; `src/sky.ts` draws its two sky layers; `src/weather.ts` handles weather and location.

The semantic page paints before scene loading. Reading mode creates no scene until requested; project images load near use. Scene construction yields between batches, including raycasts for animals and fallen leaves. Instrumentation records construction phases, shader warm-up and first use, first render, and stage changes. Shader error checks remain enabled.

The garden and sky loops ask for frames only while there is something to draw. They stop in a hidden tab, off screen, and once a paused or unfinished garden has settled; every change (scroll, resize, navigation, pointer, weather, hour, planting, context restoration) wakes them, and the clock restarts after a sleep rather than jumping. Materials, outlines, the camera and label positions are recomputed only when their inputs change. Instancing the planted trees was measured and not kept: it cut draw calls by 39% with 24 trees but drew no faster (see VALIDATION.md).

**Drawing quality** in the garden controls offers Auto, Full and Light, remembered on the device. Auto draws desktops Full and phones Light. Full keeps the original settings (pixel ratio capped at 1.6, 2048 px shadows), recasting the shadows of moving animals every other frame. Light caps the pixel ratio at 1.25 and the frame rate at 30, uses 1024 px shadows redrawn only when the garden changes, and drops the shadows of small things. Phones also build a lighter garden (no gardener, animals or small props); moving a phone between Full and Light rebuilds it in place, keeping its trees, turn and stage. `?quality=low` still asks for the lighter build anywhere. A captured garden image covers loading, unavailable WebGL, and context loss. Print exposes the complete reading portfolio and removes fixed controls.

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

The Blueprint notes (roles, organisations, years, and one-line summaries, including the PowerAPI deployment across 100+ nodes) come from the same portfolio's verified career timeline (`experience` in `src/content/portfolio.ts`). Project, biography, and contact facts were checked against the existing portfolio's `src/content/portfolio.ts` and `src/content/contacts.ts` in `/Users/chakib/Documents/github/voxel-garden-energy-routes` on 2026-09-08. The verified featured projects are Whisperbook Android and Wattch Core. No placeholder project descriptions from the concept image were reused.

The screenshots are copied from that portfolio's `public/assets/projects/whisperbook/now-playing.webp` and `public/assets/projects/wattch/energy-tests.png`. Wattch's screenshot is explicitly described as deterministic/synthetic workflow evidence, not a physical energy measurement. Source links lead to the actual project repositories. No employment status, quantified performance claims, or release numbers were added.

The supplied concept is retained as `design-reference.png` inside the source archive. It guides the pencil / blueprint / garden direction; its small descriptions are not factual sources. The 3D garden and drones are original procedural geometry.


## Validation

[VALIDATION.md](VALIDATION.md) records the October 1 implementation, 19 focused checks, five cold loads and journeys in each motion mode, mobile emulation, native Chrome zoom, screenshots, traces, and remaining limits.

```sh
PLAYWRIGHT_CHANNEL=chrome npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:performance   # RUNS=5 SCENARIOS=desktop-garden,phone-journey,…
PLAYWRIGHT_CHANNEL=chrome node tests/visuals.mjs
```

The scripts target port 5199 by default. Override `TEST_URL` and `QA_OUTPUT` as needed. The October 1 validation used Playwright with installed Chrome and native Mac UI checks. Physical phones, Safari/Firefox, share previews, and VoiceOver acceptance remain unverified. Historical presentation documentation is retained in `docs/garden-presentation-before-quality-review.md` and `docs/validation-2026-09-08.md`.
