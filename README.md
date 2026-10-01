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
- **Light widget** (from Build): drag the sun across the day. It starts at the visitor's local time. After dusk, the lanterns light up and fireflies come out.
- **Garden widget** (in bloom): plant up to 24 trees by clicking a terrace, or with "Plant one" from the keyboard. "Turn" rotates the garden; you can also drag it.
- **Cost to draw meter**: a live sparkline of the CPU time each frame takes to submit, plus triangle and draw-call counts from the renderer. These are real numbers from the visitor's browser (not GPU time).
- White paper or blueprint paper, saved locally; otherwise it follows the system setting.
- Reduced motion snaps the garden and headlines to each stage and turns off animations. "Pause motion" stops ambient movement.
- If WebGL is unavailable, a short note replaces the drawing. The notes and the building pages still work through the masthead links.

## Implementation

Vite + TypeScript + Three.js, with no framework or backend. `src/scene.ts` holds the garden. Added for this version: the line-drawing intro (`setDrawRange` on the merged outlines), the time-of-day lighting with lanterns and fireflies, raycast planting, drag rotation, camera focus, and render stats. `src/main.ts` holds the content, scroll-to-growth mapping, widgets and panels. `src/style.css` holds the overlays. Newsreader (OFL, `public/fonts/`) is the only typeface.

## Content provenance

Project, biography, and contact facts were checked against the existing portfolio's `src/content/portfolio.ts` and `src/content/contacts.ts` in `/Users/chakib/Documents/github/voxel-garden-energy-routes` on 2026-09-08. The verified featured projects are Whisperbook Android and Wattch Core. No placeholder project descriptions from the concept image were reused.

The screenshots are copied from that portfolio's `public/assets/projects/whisperbook/now-playing.webp` and `public/assets/projects/wattch/energy-tests.png`. Wattch's screenshot is explicitly described as deterministic/synthetic workflow evidence, not a physical energy measurement. Source links lead to the actual project repositories. No employment status, quantified performance claims, or release numbers were added.

The supplied concept is retained as `design-reference.png` inside the source archive. It guides the pencil / blueprint / garden direction; its small descriptions are not factual sources. The 3D garden and drones are original procedural geometry.

## Validation

`VALIDATION.md` records checks on the previous presentation. The rewrite was checked with a type check, a production build, and Chrome screenshots at 1440 × 900, 1280 × 800 (blueprint paper), and 390 × 844, with no console errors or horizontal overflow.
