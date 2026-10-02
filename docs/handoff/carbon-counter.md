# Handoff: the carbon counter, in the ruler and in the observatory

## Where things stand

The visit's carbon estimate (data transfer + rendering, in g CO₂e) lives today in a card at the top of the **Garden controls** dock. We want it out of the dock and visible all the time.

We tried a floating airship carrying the figure, first as an SVG doodle, then as a 3D model in the scene. **That idea is dropped.** The 3D craft never looked like it belonged in the garden, and the figure was HTML text laid over a 3D object, so it looked pasted on.

The decision is to show the figure in **two places**, each matching its own medium:

- **A. In the ruler:** a running counter next to the pause button, like a car's odometer. It is the reliable readout that is always on screen, and the breakdown opens from it.
- **B. In the observatory:** a mechanical counter with rolling digit wheels on the Wattch Core meter post, under the existing dial, like an electricity meter. Its digits are drawn into the 3D scene, so they share its light, angle and stages.

## 1. Revert the airship first

`src/main.ts` and `src/style.css` had no uncommitted changes before the airship work, so they can be reset. `src/scene.ts` also contains earlier uncommitted camera work (each project's notes zoom into its room). That work is saved in `docs/handoff/camera-room-zoom.patch` and must be re-applied:

```sh
git checkout src/main.ts src/style.css src/scene.ts
git apply docs/handoff/camera-room-zoom.patch   # restores the rooms / focusZoom camera edits
git diff --stat                                  # expect only src/scene.ts, about +15 −2
```

`dist/` was rebuilt with the airship in it. Run `npm run build` again after the revert if anything serves `dist/` (the `vite preview` on port 5199 does).

## 2. How the meter works today (committed code)

Line numbers below are for `HEAD`. In `src/scene.ts`, lines after ~2660 shift by about +10 once the camera patch is applied, so search for the quoted text.

- **Markup:** `src/main.ts:77–88`. Inside `<details class="dock">` is `<section class="widget widget-carbon" data-from="0">`, holding:
  - `[data-carbon-figure]` (the total)
  - `#carbon-label` ("Estimated impact of this visit so far")
  - a `dl.carbon-split` with `[data-carbon-transfer]` and `[data-carbon-compute]`
  - `[data-carbon-source]` and `[data-compute-source]`
  - a nested `<details class="carbon-details">` with the methodology and links
- **Update:** `drawCarbon()` at `src/main.ts:663` fills those elements by `data-` attribute. A `setInterval` at `src/main.ts:730` calls it every 300 ms, skipped when the tab is hidden. The total is `moved.grams + drawn.grams`, formatted by `formatGrams` (`src/transfer.ts:5`), which shows small values in mg. It reads "Unavailable" when neither part is known.
- **Visibility:** `syncWidgets()` (`src/main.ts:253`) shows dock widgets by stage. The carbon card has `data-from="0"`, so it shows at every stage. On narrow screens it waits for Bloom; that rule can go once the card leaves the dock.
- **Reading view:** `syncPresentation()` moves `.ruler` and `.dock` into `#preview-tools` when the page is in reading view with the garden preview open (`src/main.ts:920`). The ruler counter goes along with the ruler automatically.
- **CSS:** carbon styles are at `src/style.css:880–916`. Narrow-screen carbon rules are at `:1119–1137`, and there's a late override `.carbon-figure { font-size: 1.3rem; }` at `:1230`. The ruler is at `:592` (base) and `:1219` (later override, `border-radius: 1rem`). The read-view static rule is at `:1235`.

## 3. Part A: the ruler counter

**Markup.** In `.ruler`, put a `<details class="tally">` between `.ruler-track` and `#motion-toggle`.

- `<summary>`: the figure, e.g. `0.58 g CO₂e`, as an odometer-style readout (tabular numerals, the stage colour `var(--stage)` as accent) with a small "this visit" under or after it.
  - It must be at least 2.75rem tall, like the other ruler buttons.
  - Give it an accessible name, e.g. `aria-describedby="carbon-label"`, or put the label in visually hidden text.
- Panel: opens **above** the ruler (absolutely positioned, `bottom: calc(100% + 0.5rem)`, right-aligned) as a slip like `.note` and `.widget`: `var(--slip)`, blur, hairline border, `var(--lift)`. It contains the label, the split, the two source lines and the nested methodology `<details>`.
  - Move these elements over as they are, so `drawCarbon()` keeps working unchanged.
  - Cap its height (`max-height` + `overflow-y: auto`) so it never runs under the masthead.

**Remove** the `widget-carbon` section from the dock, and its narrow-screen CSS.

**Layout.** The ruler is `min(34rem, 100vw − 2·edge)` wide. Adding a counter means either widening it (e.g. 40rem) or keeping the counter compact. Check 900–1100px-wide windows, where the note, ruler and dock all compete for room.

**Reading view.** The ruler is static inside `#preview-tools`. Make sure the panel still opens on screen there; it may need to open downward or sit in the normal flow.

**Fog / pause.** Fog restyles the ruler (`src/style.css:1175`). Check that the panel follows it.

## 4. Part B: the observatory register

**Where.** The Wattch Core meter post and dial are in the observatory block of `src/scene.ts`:

- `const dialCenter = new T.Vector3(-2.92, 1.52, 1.07)` at `:696`
- the post: `box(dialCenter.x, 1.1, dialCenter.z, 0.05, 0.44, 0.05, "dark")` at `:706`, spanning y 0.88–1.32
- the dial disc: radius 0.2, turned `rotateY(0.75)` so it faces the camera

Mount the register on the post just below the dial, facing the same way:

- housing about 0.42 × 0.12 × 0.07, centred near y 1.2, rotated 0.75 about Y
- a thin unit plate under it, painted "g CO₂e"

At the Wattch close-up (camera zoom 1.8) that is roughly 100 × 30 px on a 1440-wide window, enough to read about five wheels.

**Build it like the rest of the garden:**

- **Housing:** use the construction helpers (`box` / `add` with a palette colour, e.g. `"dark"` and `"light"`) **before** the batching loop (`for (const [color, geometries] of batches)`, `:1091`). It then gets the pencil and blueprint outlines and fades in with the build for free.
- **Digit face:** a plane just in front of the housing, with a `CanvasTexture`. Copy the drum paper exactly: `paperCanvas` / `paperTexture` / `paperMaterial` from `:1459`, `drawPaper()` at `:1504`, and `paperMaterial.opacity = solid` (with `visible = solid > 0.01`) in `updateRooms` at `:1666`.
  - Draw dark wheel windows with cream digits, e.g. `000.58` (grams with two decimals, about five wheels).
  - Let the last wheel **roll**: draw the digit strip offset by the fractional part, so it turns smoothly instead of jumping.
  - Add `texture.dispose()` in `dispose()` next to `paperTexture.dispose()` (`:3198`).
- **Data in:** add `setTally(grams: number | null)` to the `Garden` interface (`:7`) and call it from `drawCarbon()` with the same total the ruler shows.
  - In the scene, ease a displayed value toward it, and redraw the canvas only when the displayed value changes visibly (e.g. by 0.0005 g).
  - `null` shows dashes.
- **Stages:** Sketch and Blueprint show only the housing outline, which comes free from the helpers. The digits appear with the build (`solid`), like the drum paper, needle and pen.

**Performance (this page measures its own carbon):**

- The render loop deliberately goes idle when nothing changes before Bloom: `if ((paused || progress < 0.5) && !changed && !dirty) return;` at `:2802`.
- Don't force extra frames for the counter. Redrawing the texture and setting `dirty = true` when the displayed value changes is enough. After Bloom the loop renders continuously anyway.
- If the wheel's roll animation needs frames before Bloom, make it part of `roomsSettling()` (`:1638`) only while the wheel is actually moving.

## 5. Lessons from the airship attempt

- **Text has to be part of the medium it sits on.** HTML laid over 3D looks pasted on. In the scene, draw text into a texture; on the page, give it a home in the existing UI.
- **Moving controls are hard to click.** Anything that drifts or bobs must hold still on hover or focus. Better: don't put controls on moving things.
- **Dev servers:** the masthead is injected by a `transformIndexHtml` hook in `vite.config.ts`. A dev server started before a config change serves pages without it, and `main.ts` then throws `ResizeObserver … not of type 'Element'`. Restart the server after config edits. Port 5199 is `vite preview` (serves `dist/`); 5173 is `vite` dev.
- **Playwright** has no bundled browser here. Use the installed Chrome: `PLAYWRIGHT_CHANNEL=chrome npm test` for tests, and `chromium.launch({ channel: 'chrome' })` in ad-hoc scripts.

## 6. Check before calling it done

- `npx tsc --noEmit`, `PLAYWRIGHT_CHANNEL=chrome npm test` (22 tests, all passing before this work), `npm run build`.
- Screenshot every chapter at 1440 × 900. Scroll to each `.chapter`'s `offsetTop` and wait about 2 s each.
  - The ruler counter is readable at all four stages and its panel opens clear of the note and dock.
  - At the Wattch Core chapters, the register digits are legible and match the ruler.
- Also check about 1000 × 700 (desktop, tight) and the compact reading view with the garden preview open (below 900px wide or 600px tall).
- Check that pausing motion, fog, and losing or restoring the WebGL context still behave (the tests cover these, but look at the counter in each).
