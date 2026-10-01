# Rooms and widgets for every building

Date: 2026-10-01
Status: approved direction, awaiting spec review

## Problem

All four buildings are generic architecture. The reading pavilion (Whisperbook) is a slab with wood slats, and the observatory (Wattch Core) is a column ring with a water wheel. The atelier tower (About) is stacked terraces, and the greenhouse (Contact) is an empty glass house. Only the callout labels connect them to what they stand for. The dock widgets (Sky, Garden, Cost to draw) are about the garden, not the work.

## Goal

Every building shows what it stands for, and each one has a small widget the visitor can use:

| Building | Room becomes | Widget | Widget lives |
|---|---|---|---|
| Reading pavilion | Whisperbook's reading room | Mini player (on-device speech) | Garden card (wide) / panel (narrow) |
| Water-wheel observatory | Wattch Core's measuring station | Live render-cost meter | Garden card (wide) / panel (narrow) |
| Atelier tower | The path, read from the ground up | "The path" timeline | About panel |
| Greenhouse | A post office for seeds | "Leave a note" (mailto) | Contact panel |

Scope: the two verified projects plus About and Contact. No new projects. No new factual claims: every text comes from `projects`, the About panel or the Contact panel in `src/main.ts`.

## Approach

Keep all four buildings' shells and positions, which keeps the concept's stone-terrace architecture and the pencil → blueprint → build → bloom sequence. Add specific props and a few animated parts. Static geometry goes through the existing `box` / `cylinder` / `beam` / `add` helpers, so it is drawn in pencil, inked in blueprint, and built like everything else. Animated parts are separate meshes that fade in with the build, as the water wheel does.

## 1. The rooms (`src/scene.ts`)

### Whisperbook: the reading pavilion (centre ≈ 3.33, –0.75)

- **Book roof.** The flat roof slab (`box(3.33, 2.9, …)`) becomes two shallow slabs that meet at a slight valley along the x axis, like a book lying open. A thin "spine" strip runs along the valley. The roof planter and tree stay on top.
- **Shelf of spines.** The slatted back wall (the 9 slats at z ≈ –2.09) becomes book spines: varied heights (1.0–1.47), widths and depths, alternating `wood`, `trim` and `dark`, standing on two shelf boards.
- **Reading table.** The existing table keeps its place. On it: an upright phone on a stand (a `dark` slab with a `glass` face) and two small rounded speaker "voices", one `flower` and one `coral` (the two narrators).
- **Sound rings (animated).** Three thin torus rings, flat on the table and centred on the phone, expand and fade in a loop **only while the Whisperbook widget is narrating**. A warm point light over the table brightens at the same time.
- Steps, side rail and side planter are unchanged.

### Wattch Core: the water-wheel observatory (centre ≈ –3.55, 0.2)

- **Generator.** A short `dark` cylinder housing on the wheel's axle, so the wheel visibly drives something.
- **Cable.** A `beam` chain from the generator, down the plinth and across to a meter post on the observatory's south-east edge, inside the column ring.
- **Meter post and dial (animated needle).** A post topped by a round `light` dial face with tick marks (thin boxes) and a `dark` needle. The needle angle follows the page's **real render cost per frame**, which the scene already measures as `renderMs`: 0 ms points to the left, ≥ 8 ms to the right, eased.
- **Daemon box and clients.** A small `dark` box with a `glass` status strip (the privileged daemon) sits between the cable and two small client "screens" on low stands. This mirrors the daemon / client split described in the project notes. The pieces are structural only and carry no text.
- **Trace wall (animated).** A curved panel inside the ring (a partial cylinder, inward-facing) carries a `CanvasTexture` that shows the same render-cost samples as a scrolling line trace. It is redrawn at most every 300 ms, and only once the build is visible.
- The central glass disc, column ring and torus are unchanged.

### About: the atelier tower, read from the ground up (centre ≈ 0, –1.8)

Each level of the tower is one step of the path the About panel already describes.

- **Ground arches: the startup.** Under the arches, a low `wood` table with a game board (a thin `light` slab with an inlaid `dark` checker of 4 × 4 tiles), a few small cylinder pieces in `flower` and `coral`, and two dice (small `light` cubes).
- **Middle terrace: the research.** The back wall's three wood slats (z ≈ –2.765) are replaced by a `dark` chalkboard in a `wood` frame. In front of it are a small desk with a stack of papers (thin `light` boxes at slightly varied rotations) and a reading lamp (a `dark` stem with a `flower` shade).
- **Roof: the atelier.** The roof planter shrinks to the back half of the roof, and the tree stays in it. The front half holds a drafting table: a tilted board on two `dark` legs, a stool, and a bin of rolled drawings (thin `light` cylinders at angles).
- **Drafting sheet (canvas texture).** The board carries a `CanvasTexture` with a small isometric line drawing of the garden's plots: the tower, pavilion, ring and greenhouse as simple outlines. It is redrawn only when the stage changes: grey pencil at Sketch, blue at Blueprint, and dark ink with a green wash from Build on.
- **Energy step.** The path's third step, energy-measurement infrastructure, has no tower level. It highlights the observatory instead (see "The path" widget).
- The `about` callout point moves to the front half of the roof if needed, so it stays above the drafting table.

### Contact: the greenhouse as a post office for seeds (centre ≈ 2.02, 3.11)

- **Postbox.** A `dark` post with a `coral` box at the greenhouse's front-right corner, outside the glass (≈ 3.0, ground, 3.95). It has a small flag on a hinge (animated) and a slot facing the camera.
- **Potting bench.** The right-hand inner planter (x ≈ 2.43) is replaced by a `wood` bench. On it: two seed trays (shallow `dark` boxes with rows of tiny `grass` cones), a watering can (a `trim` cylinder, a tilted spout `beam`, and a handle torus), and four seed packets (small upright `light` / `flower` / `coral` slabs, unlabelled). The left planter stays.
- **Flag (animated).** It lies down at rest and rises while the visitor is writing a note.
- **Letter (animated).** On "Send by email", a small `light` envelope (a thin box) drops from above the postbox into the slot over about 0.8 s and disappears. Reduced motion or paused motion skips the drop.

### Motion and stages

- Before Build, only the static outlines show. Sound rings, needle, trace, tower highlight, flag and letter stay hidden until the water wheel would be visible.
- "Pause motion" and reduced motion freeze the rings, needle, trace and letter drop. The narration lamp and the tower highlight still switch on and off.
- Callout anchor points stay where they are today (`points.*`), with small moves if a silhouette changes.

### New `Garden` API

```ts
/** Whisperbook pavilion reacts while the widget narrates. */
setNarrating: (on: boolean) => void;
/** Highlight one step of the path: 0 ground (startup), 1 terrace (research), 2 observatory (energy), 3 roof (atelier); null clears. */
highlightPath: (step: number | null) => void;
/** Contact postbox: flag up while writing, a letter drop on send. */
setPostbox: (state: "idle" | "writing" | "sent") => void;
```

The needle and trace read `renderMs` internally, so they need no new API.

**Highlight look.** One shared group of `EdgesGeometry` line boxes, drawn in the stage colour with a soft additive glow box, moved and resized to the chosen level's bounds (or the observatory ring). It fades in and out over 250 ms (instantly with reduced motion).

## 2. The widgets (`src/main.ts`, `src/style.css`)

### Placement

- **Wide screens (≥ 900 px), in Bloom:** the Whisperbook and Wattch callout pills become small paper cards, about 230 × 120 px, in the same style as the dock widgets. Each card sits above its building's projected point and is connected to it by the existing leader line. The card is clamped inside the viewport, and it may sit under the chapter note and the dock, never over them. The card's title is a button that opens the project panel, as the pill does today. About and Contact stay pills.
- **Narrow screens (< 900 px):** callouts stay pills. The widget is rendered at the top of that project's panel, under the lede, with the heading "Try it".
- One widget implementation, `mountProjectWidget(spot, container)`, mounts into either place and returns a cleanup function.

### Whisperbook widget: a mini player

- Content: a ▶ / ■ button, the line being read, and which voice is reading.
- Excerpt (public domain, *Alice's Adventures in Wonderland*, 1865): the narrator reads "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do." Alice reads "And what is the use of a book, without pictures or conversations?"
- Voices: `speechSynthesis.getVoices()` filtered to `localService === true`, with English voices preferred. The narrator and Alice use two different local voices when there are two or more. With one voice, both parts use it, Alice at a higher pitch, and the card says "One voice on this device".
- Honesty line under the player: "Read by your device. Nothing leaves this page." The claim is shown only when a local voice was found.
- No local voice, or no `speechSynthesis`: the button is disabled and the card says "This browser has no on-device voice." Network voices are **never** used.
- While speaking: `garden.setNarrating(true)`, and `false` on end, error, stop, panel close or unmount.

### Wattch widget: the page's own energy story

- The existing **Cost to draw** meter moves out of the dock into this widget: sparkline, "Pause motion" link, and the readout text, which is unchanged ("1.7 ms of CPU per frame. 40,854 triangles in 189 draw calls.").
- One added line: "Measured live in your browser, like the dial in the observatory." There is no energy or joule figure, because the page has no hardware counters, and the project rules forbid passing anything off as a measurement.
- The meter loop (`drawMeter`, every 300 ms) draws into whichever sparkline canvases are mounted.
- "Pause motion" must stay reachable at every stage, so it does **not** move with the meter. It joins the Sky widget's footer links ("Use my clock · Use my exact location · Pause motion"). Sky is shown from Sketch onwards. It keeps the id `motion-toggle`.

### About widget: "The path" (About panel only)

- Rendered in the About panel between the lede and the existing paragraphs, under the heading "The path".
- Four steps, as an ordered list of buttons, with wording taken from the panel's existing sentence and no dates:
  1. Co-founded a serious-games startup
  2. Doctoral research, University of Lille and Inria
  3. Energy-measurement infrastructure
  4. Production AI workflows, from sketch to use
- Hover or focus calls `garden.highlightPath(i)`. Leaving the list, or closing the panel, calls `highlightPath(null)`. The camera stays on the tower for steps 1, 2 and 4. For step 3, if the observatory is outside the About focus framing, the camera eases back to the whole garden (`focus(null)`) while step 3 is highlighted, and returns to the tower afterwards.
- Tapping a step on touch screens toggles its highlight.

### Contact widget: "Leave a note" (Contact panel only)

- Rendered in the Contact panel under the email line, under the heading "Leave a note".
- A labelled `<textarea>` (max 600 characters, with a live count) and two buttons:
  - **Send by email:** opens `mailto:chakib.belgaid@gmail.com?subject=From%20the%20garden&body=<encoded note>`. It is disabled while the note is empty.
  - **Copy address:** `navigator.clipboard.writeText`. If that fails, it selects the address text instead. Its label reads "Copied" for 2 s.
- Below the buttons: "This opens your email app. Nothing is sent or stored by this page."
- The postbox follows the box: non-empty text → `setPostbox("writing")`, empty → `"idle"`, Send → `"sent"`, which then settles back to `"idle"`. Closing the panel resets the postbox to `"idle"`. The draft text is not saved.

### Dock after the change

Sky (from Sketch) and Garden (in Bloom). `widget-meter` is removed.

## 3. Content

- The Bloom chapter copy is unchanged. It already points visitors to the buildings.
- The README's "Cost to draw meter" bullet moves under a new "Rooms" bullet that describes all four rooms and widgets. It includes the on-device speech rule, the Alice excerpt's public-domain source, and the `mailto:`-only contact note. The "Buildings are the navigation" bullet's building names stay the same.

## Error handling

- WebGL unavailable: no cards in the garden. The panels still mount all four widgets; `highlightPath` and `setPostbox` are no-ops, the speech player works, and the Wattch widget shows "Rendering is off in this browser, so there is nothing to measure."
- `speechSynthesis.getVoices()` is empty at first load in Chrome: listen for `voiceschanged` once before deciding there is no local voice.
- Leaving the page or hiding the tab while speaking: `speechSynthesis.cancel()` on `visibilitychange` (hidden) and on unmount.

## Verification

There is no test framework in the project. Checks:

1. `npm run build` (runs `tsc --noEmit`) is clean.
2. Playwright screenshots of the dev server at 1440 × 900 (Sketch, Blueprint, Build, Bloom; blueprint paper in Bloom) and at 390 × 844 (Bloom, then the Whisperbook, About and Contact panels open). Checks: each room reads as what it stands for, the cards don't cover the note or the dock, and there is no horizontal overflow.
3. Console has no errors. Pressing Play triggers `setNarrating` (rings visible in a screenshot) and is fine with no local voice (forced by stubbing `getVoices` to `[]`).
4. In the About panel, hovering each step highlights the right level or the observatory (screenshot per step). In the Contact panel, typing raises the flag and Send opens a `mailto:` link with the note encoded (checked by intercepting navigation).
5. The needle angle changes with load (checked by reading a `data-meter` attribute on the scene container, in the style of the existing `data-*` debug attributes).

## Out of scope

- AgentDiet or any third project building.
- A contact form backend or stored messages.
- Real energy measurement in the browser.
