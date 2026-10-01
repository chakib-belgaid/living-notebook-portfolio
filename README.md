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

Text sits on small paper notes over the garden. Headlines are set in Newsreader, a variable serif, and their weight and ink follow the garden's growth: hairline graphite while sketched, full-weight ink in bloom. Each new headline's letters are set in one after another.

- **Buildings are the navigation.** In bloom, callouts mark Whisperbook (reading pavilion), Wattch Core (water-wheel observatory), About (atelier roof) and Contact (greenhouse). Selecting one glides the camera to the building and opens its notes. The masthead links open the same notes. Opening one before bloom grows the garden first.
- **Sky and weather.** A sky sits behind the garden: sun, moon (in today's real phase), drifting clouds, and twinkling stars. Rain, snow, fog, and lightning fall in front of it. Like the garden, the sky is drawn in pencil at Sketch, in blueprint ink at Blueprint, and filled with colour once built. It follows the **current weather** at the visitor's place, from [Open-Meteo](https://open-meteo.com) (free, no key, CC BY 4.0). With no permission prompt, the place is approximated from the browser's time zone ("Europe/Paris" → Paris). "Use my exact location" asks for the device position instead (rounded to about 1 km); if that permission was already granted, it is used directly. Weather refreshes every 15 minutes. Cloud and rain also dim the garden's sunlight and soften its shadows.
- **Fog** hides the far side of the garden in paper-coloured mist (Three.js fog), sends mist banks across the screen, and lays a drifting veil over the notes, ruler, and widgets, which turn frosted while callouts recede. The veil is capped so text stays readable. Rain, snow, and storms add a lighter haze.
- **Seasons.** The garden follows the season at the weather location: the date, with the hemisphere from its latitude (northern if unknown). Spring has fresh greens, pink blossom, and drifting petals; summer has deep greens, full flowers, and butterflies; autumn has orange, gold, and rust canopies, falling leaves, and leaves on the terraces; winter has frosted canopies, dark evergreens, no flowers, and snow patches. Planted trees follow the season too. The Garden widget shows the season ("Autumn in Paris.") with preview buttons; "Now" returns to the real one.
- **Sky widget**: shows the live report ("Overcast, 18°C in Paris."), a time-of-day slider (starts at the visitor's clock; lanterns and fireflies come out after dusk), and preview buttons for Clear, Clouds, Rain, Snow, Storm, and Fog. "Live" returns to the real weather. If the weather can't be fetched, the sky falls back to a few clouds and says so.
- **Garden widget** (in bloom): plant up to 24 trees by clicking a terrace, or with "Plant one" from the keyboard. "Turn" rotates the garden; you can also drag it.
- **Cost to draw meter**: a live sparkline of the CPU time each frame takes to submit, plus triangle and draw-call counts from the renderer. These are real numbers from the visitor's browser (not GPU time).
- White paper or blueprint paper, saved locally; otherwise it follows the system setting.
- Reduced motion snaps the garden and headlines to each stage and turns off animations. "Pause motion" stops ambient movement.
- If WebGL is unavailable, a short note replaces the drawing. The notes and the building pages still work through the masthead links.

## Implementation

Vite + TypeScript + Three.js, with no framework or backend. `src/scene.ts` holds the garden. Added for this version: the line-drawing intro (`setDrawRange` on the merged outlines), the time-of-day lighting with lanterns and fireflies, raycast planting, drag rotation, camera focus, and render stats. `src/sky.ts` paints the sky on two 2D canvases (behind and in front of the WebGL canvas). `src/weather.ts` handles Open-Meteo, the time-zone and device location, WMO weather codes, and the moon phase. `src/main.ts` holds the content, scroll-to-growth mapping, widgets and panels. `src/style.css` holds the overlays. Newsreader (OFL, `public/fonts/`) is the only typeface.

## Content provenance

Project, biography, and contact facts were checked against the existing portfolio's `src/content/portfolio.ts` and `src/content/contacts.ts` in `/Users/chakib/Documents/github/voxel-garden-energy-routes` on 2026-09-08. The verified featured projects are Whisperbook Android and Wattch Core. No placeholder project descriptions from the concept image were reused.

The screenshots are copied from that portfolio's `public/assets/projects/whisperbook/now-playing.webp` and `public/assets/projects/wattch/energy-tests.png`. Wattch's screenshot is explicitly described as deterministic/synthetic workflow evidence, not a physical energy measurement. Source links lead to the actual project repositories. No employment status, quantified performance claims, or release numbers were added.

The supplied concept is retained as `design-reference.png` inside the source archive. It guides the pencil / blueprint / garden direction; its small descriptions are not factual sources. The 3D garden and drones are original procedural geometry.

## Validation

`VALIDATION.md` records checks on the previous presentation. The rewrite was checked with a type check, a production build, and Chrome screenshots at 1440 × 900, 1280 × 800 (blueprint paper), and 390 × 844, with no console errors or horizontal overflow.
