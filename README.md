# A living notebook

A standalone portfolio for Chakib Belgaid. Scroll turns the same 3D garden from faint pencil outlines into an engineering drawing, then a planted, animated world.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm ci
npm run dev -- --port 5198 --strictPort
```

Open http://127.0.0.1:5198.

```sh
npm run build
npm run preview -- --port 5199 --strictPort
```

The production website is generated in `dist/`. Serve it over HTTP, not by opening `index.html` from the filesystem. Public deployment has not been performed.

## The experience

The garden fills the screen. Scrolling (or dragging the ruler at the bottom) builds it: pencil (Sketch), blue engineering drawing (Blueprint), built stone (Build), then the planted, animated world (Bloom). On load the pencil lines draw themselves in.

The story pauses at each stage. The garden only grows in the stretch of scroll between two stages, and the old note leaves as it starts. Within a stage it holds still while several notes follow one another:

- *Sketch*: the name.
- *Blueprint*: an intro, then the career, oldest first, one role per note (Funecs, the Ph.D. at the University of Lille and Inria, Qarnot Computing and Inria, MCQ Scan). Each role lights its level of the tower, and Qarnot lights the observatory.
- *Build*: the buildings stand in stone but nothing is planted yet. An intro, then one note per project. The camera visits the reading pavilion and then the observatory, and "Read the notes" opens the project without leaving the story.
- *Bloom*: the garden comes alive and the widgets come out (Sky, Garden, and the project cards).

The ruler has a dot for each note and a label for each stage. "Pause motion" sits at its right end, so it can be reached at every stage.

Text sits on small paper notes over the garden. Headlines are set in Newsreader, a variable serif, and their weight and ink follow the garden's growth: hairline graphite while sketched, full-weight ink in bloom. Each new headline's letters are set in one after another.

- **Water.** A rill crosses the atelier terrace to a spout, and the waterfall drops on the canal's centre line into its head. The canal runs in a stone bed with curbs to the front edge, with a branch (and stepping stones) that stops short of the observatory steps. Planters, trees, and grass take their height from the level they stand on, and stay off the water and the floors.
- **Buildings are the navigation.** In bloom, callouts mark Whisperbook (reading pavilion), Wattch Core (water-wheel observatory), About (atelier roof) and Contact (greenhouse). Selecting one glides the camera to the building and opens its notes. The masthead links open the same notes. Opening one before bloom grows the garden first.
- **Sky and weather.** A sky sits behind the garden: sun, moon (in today's real phase), drifting clouds, and twinkling stars. Rain, snow, fog, and lightning fall in front of it. Like the garden, the sky is drawn in pencil at Sketch, in blueprint ink at Blueprint, and filled with colour once built. It follows the **current weather** at the visitor's place, from [Open-Meteo](https://open-meteo.com) (free, no key, CC BY 4.0). With no permission prompt, the place is approximated from the browser's time zone ("Europe/Paris" → Paris). "Use my exact location" asks for the device position instead (rounded to about 1 km); if that permission was already granted, it is used directly. Weather refreshes every 15 minutes. Cloud and rain also dim the garden's sunlight and soften its shadows.
- **Fog** hides the far side of the garden in paper-coloured mist (Three.js fog), sends mist banks across the screen, and lays a drifting veil over the notes, ruler, and widgets, which turn frosted while callouts recede. The veil is capped so text stays readable. Rain, snow, and storms add a lighter haze.
- **Seasons.** The garden follows the season at the weather location: the date, with the hemisphere from its latitude (northern if unknown). Spring has fresh greens, pink blossom, and drifting petals; summer has deep greens, full flowers, and butterflies; autumn has orange, gold, and rust canopies, falling leaves, and leaves on the terraces; winter has frosted canopies, dark evergreens, no flowers, and snow patches. Planted trees follow the season too. The Garden widget shows the season ("Autumn in Paris.") with preview buttons; "Now" returns to the real one.
- **Bushes and animals.** Once the garden comes to life, about 45 bushes sit on the ground terraces (placed by ray casting, kept off the water and out from under roofs). They take the season's colours and carry flowers, autumn berries, or frost. A flock of birds circles overhead (not at night or in rain; fewer in winter). Ducks paddle the canal and rest at night. Rabbits hop between spots on the same terrace, turn white in winter, and shelter at night and in rain. A ginger cat sleeps on the bench. Everything stops with "Pause motion" or reduced motion.
- **Sky widget** (in Bloom): shows the live report ("Overcast, 18°C in Paris."), a time-of-day slider (starts at the visitor's clock; lanterns and fireflies come out after dusk), and preview buttons for Clear, Clouds, Rain, Snow, Storm, and Fog. "Live" returns to the real weather. If the weather can't be fetched, the sky falls back to a few clouds and says so.
- **Garden widget** (in bloom): plant up to 24 trees by clicking a terrace, or with "Plant one" from the keyboard. "Turn" rotates the garden; you can also drag it.
- **Rooms.** Each building shows what it stands for, and each has a small widget. On wide screens in bloom, the Whisperbook and Wattch callouts open into cards over their buildings (kept inside the viewport, under the notes and the dock); on narrow screens, and without WebGL, those widgets sit at the top of the building's panel under "Try it".
  - *Whisperbook's reading room*: the pavilion roof is a book lying open, its pages lined with text and an ochre ribbon hanging over the edge; a walkway from the atelier terrace leads out onto it. The side wall facing the garden is a bookcase, the back wall a shelf of spines, and a phone stands on the reading table between two small speakers, the two narrators. The widget is a mini player that reads two lines of *Alice's Adventures in Wonderland* (Lewis Carroll, 1865, public domain), narrator and Alice, with the browser's **on-device** speech voices only (`localService`); network voices are never used. Without a local voice the button is disabled and says so. While it reads, rings of sound spread over the table and a reading light comes on.
  - *Wattch Core's measuring station*: the water wheel dips into a stone race of water and turns a generator, and a cable runs through a daemon box with two client screens to a meter post. The dial's needle and a trace wall inside the ring follow the page's own render cost. The widget is the **Cost to draw meter**: a live sparkline of the CPU time each frame takes to submit, plus triangle and draw-call counts from the renderer. These are real numbers from the visitor's browser (not GPU time, and not energy). Under them sits a **carbon footprint estimate** ("About 0.30 g CO₂e so far, for 2.0 MB loaded."): the bytes the page has loaded over the network, from the browser's resource timing (cached files count as nothing), times the Sustainable Web Design model v4 (0.3 kWh/GB, operational plus embodied) at the global average grid of 494 gCO₂e/kWh. It is labelled as an estimate, not a measurement.
  - *The atelier tower, read from the ground up*: a game table in the ground arch (the serious-games startup), a chalkboard and desk on the terrace (the research), a drafting table on the roof (the atelier), whose sheet is a small drawing of the garden in pencil, blue, or ink with the stage. "The path" in the About panel lights each level as you point at a step; the energy-measurement step lights the observatory.
  - *The greenhouse as a post office for seeds*: a potting bench with seed trays, a watering can and seed packets, and a postbox outside. "Leave a note" in the Contact panel only builds a `mailto:` link for the visitor's own mail app; nothing is sent or stored by the page. The postbox flag rises while a note is written, and a letter drops in on send.
- White paper or blueprint paper, saved locally; otherwise it follows the system setting.
- Reduced motion snaps the garden and headlines to each stage and turns off animations. "Pause motion" (on the ruler) stops ambient movement.
- If WebGL is unavailable, a short note replaces the drawing. The notes and the building pages still work through the masthead links.

## Implementation

Vite + TypeScript + Three.js, with no framework or backend. `src/scene.ts` holds the garden. Added for this version: the line-drawing intro (`setDrawRange` on the merged outlines), the time-of-day lighting with lanterns and fireflies, raycast planting, drag rotation, camera focus, and render stats. `src/sky.ts` paints the sky on two 2D canvases (behind and in front of the WebGL canvas). `src/weather.ts` handles Open-Meteo, the time-zone and device location, WMO weather codes, and the moon phase. `src/main.ts` holds the content, scroll-to-growth mapping, widgets and panels. `src/style.css` holds the overlays. Newsreader (OFL, `public/fonts/`) is the only typeface.

## Content provenance

The Blueprint notes (roles, organisations, years, and one-line summaries, including the PowerAPI deployment across 100+ nodes) come from the same portfolio's verified career timeline (`experience` in `src/content/portfolio.ts`). Project, biography, and contact facts were checked against the existing portfolio's `src/content/portfolio.ts` and `src/content/contacts.ts` in `/Users/chakib/Documents/github/voxel-garden-energy-routes` on 2026-09-08. The verified featured projects are Whisperbook Android and Wattch Core. No placeholder project descriptions from the concept image were reused.

The screenshots are copied from that portfolio's `public/assets/projects/whisperbook/now-playing.webp` and `public/assets/projects/wattch/energy-tests.png`. Wattch's screenshot is explicitly described as deterministic/synthetic workflow evidence, not a physical energy measurement. Source links lead to the actual project repositories. No employment status, quantified performance claims, or release numbers were added.

The supplied concept is retained as `design-reference.png` inside the source archive. It guides the pencil / blueprint / garden direction; its small descriptions are not factual sources. The 3D garden and drones are original procedural geometry.

## Validation

`VALIDATION.md` records checks on the previous presentation. The rewrite was checked with a type check, a production build, and Chrome screenshots at 1440 × 900, 1280 × 800 (blueprint paper), and 390 × 844, with no console errors or horizontal overflow.
