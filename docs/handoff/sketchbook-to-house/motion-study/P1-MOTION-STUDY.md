# P1 motion study: the actual house, from drawing to volume

Session 1 November 2026 (day 2 of the release-1 cap). Branch `feat/sketchbook-house-narrative`, starting at `ba6a38f`.
Environment as in `baseline/BASELINE.md` section 2: Apple M5, macOS 27, Playwright 1.62.1 with bundled headless Chromium 151.0.7922.34, **SwiftShader software WebGL**. Frame rates below are properties of software rendering; frame *counts* during holds and the scheduling facts are not.

**Decision-gate outcome: (a).** Global construction progress plus a named focus is legible in both hosts. No group-reveal manifest is built.

## 1. What was built

| Piece | Path | Notes |
| --- | --- | --- |
| Scene adapter | `src/narrative/scene-adapter.ts` | `createSceneAdapter(garden, host)`, the `sceneCues` table, `chapterOrder`, `stageProgress`, `poseFor`. No DOM of its own. |
| Study page (dev only) | `dev/motion-study.html`, `src/narrative/motion-study.ts` | Served by Vite in dev at `/dev/motion-study.html`. `vite build` takes only `index.html`; checked with `npm run build` and `ls dist` (no `dev/`, no `motion-study` string in `dist/`). |
| Study dev server config | `dev/vite.study.config.ts` | The site config plus a watcher that ignores `.claude/`, `.qa/`, `dist/`, `.superpowers/`, so a build in another worktree does not reload a recording. |
| Automation | `dev/motion-study-stills.mjs`, `dev/motion-study-run.mjs` | Stills; measurements; recordings. |
| Scene changes | `src/scene.ts` | Four scoped methods, a focus aim fix and warm-paper ink tuning (section 3). No rewrite. |

The study page uses placeholder copy (labelled as such), the real `createGarden` model with no hotspots, warm ivory paper `#f5f0e5`, and `setTheme(false)`, which is now the warm-paper ink set (the live page keeps `setTheme(true)`). Hosts:

- **Wide** (viewport ≥ 700 px in the study; the plan's wide desktop is ≥ 1100): a 420 to 480 px text column beside a sticky rail that holds the scene (about 60 percent of 1440 px). The active chapter is the section crossing 45 percent of the viewport.
- **Portrait** (< 700 px): each chapter has a 45vh slot (380 px at 390×844) between its motivation and its decision. The single scene element moves into the active chapter's slot when that slot comes 70 percent of the way up the view. While a scroll-driven transition runs, that slot is `position: sticky; top: 0`; when the adapter reports settled, it releases into flow with a 260 ms slide from its stuck position. Explicit jumps never stick. Phones build the `low`/`light` garden, as the live page does.

Chapter buttons are direct jumps (instant document scroll plus `snapTo` of the cue). Ordinary scrolling drives eased transitions. A guided reading hold is on from load (`?ambient=on` turns it off).

## 2. Adapter API (interface for P4)

```ts
createSceneAdapter(garden: Garden, host?: HostKind /* "wide" */): SceneAdapter

interface SceneAdapter {
  setPhase(progress: number): void;                          // eased by the scene; immediate under a still preference
  snapTo(target: { progress: number; focus?: CueRef | null }): void; // drawn at once, once; sets no reduced flag
  focus(target: CueRef | null): void;                         // chapter's named point with host overrides; null = whole world
  frame(top: number, bottom: number): void;
  hold(): void;                                               // guided reading hold: ambient off, 0 frames once settled
  release(): void;                                            // ambient on again
  setMotionPreference(p: "normal" | "user-paused" | "system-reduced"): void;
  setHost(host: "wide" | "portrait"): void;                   // re-poses the current cue without a glide
  go(chapter: ChapterId, options?: { immediate?: boolean }): void; // a whole cue
  isSettled(): boolean;
  onSettled(cb: () => void): () => void;                      // returns unsubscribe
  state(): { chapter; progress; focus; held; preference; host };
}
type CueRef = ChapterId | SceneCue;
```

Semantics P4 relies on:

- **Snap is not reduced motion.** The adapter never calls `setProgress(p, true)`; it sets goals with `setProgress(p, false)` and `focus(...)`, then `garden.snap()`. Measured: after `snapTo({progress: 0.33})`, the next `go("whisperbook")` eases (0.33 → 0.51 at 120 to 170 ms, settled after 2.3 to 2.7 s). Contrast, the scene's own `setProgress(0.33, true)` followed by `focus("wattch")` lands in 1 frame (22 to 30 ms) because `reduced` persists.
- **Hold is not pause.** `hold()` turns ambient life off through `Garden.setAmbient(false)`; the visitor's pause and system reduced motion go through `Garden.setMotion(true)`. A held scene still eases to new goals and still runs the pencil draw-in; a paused one does not draw in.
- **Still preferences** (`user-paused`, `system-reduced`): every change snaps (1 frame) and nothing moves on its own.
- **Only the latest destination.** Each call overwrites the goals; nothing is queued. Rapid scroll from intro to about passed six chapters and produced exactly one settle event, at `about`.
- `isSettled()` is true only once the destination has been drawn (a snap is not settled until its frame). An offscreen garden does not draw, so it reports settled when it comes back on screen.

## 3. Scene changes (`src/scene.ts`)

| Change | Why |
| --- | --- |
| `setAmbient(on)` | A guided hold separate from `setMotion`. Off: the life clock, animals, gardener, visitor, drum, pen, needle and sound rings stop where they are, and a settled garden sleeps at any progress (previously only `paused || progress < 0.5` slept). Foliage sway freezes in place (the life uniform is kept, unlike pause, so nothing pops). Draw-in and transitions still run. |
| `snap()` | Jumps progress, rotation, focus amount/zoom/point, shift, room, frame band, user zoom and pan to their goals; the next frame draws them. Sets no `reduced`. |
| `isSettled()`, `onSettled(cb)` | Settle detection from the render loop: the `changed` expression is now the `moving()` function; a `settling` flag is raised by `setProgress`, `focus`, `frame`, `snap` and any moving frame, and cleared (listeners run as microtasks) by the first frame with nothing left to move. |
| Focus aims at the target scale | `focus()` multiplied the spot by the *current* world scale; the sketch world is drawn at 0.77 (and 0.55 tall), so a focus set together with a new progress landed short of the room. It now uses the scale at `targetProgress` (`worldScaleAt`, shared with the render). The live page focuses after the build has grown, so its poses are unchanged in practice (smoke check: `/#whisperbook` at 1440 and 390 opens with no page errors). |
| Warm-paper ink (light set only) | Pencil `0x85898b` → graphite `0x605f59`; line opacity on the sketch 0.21 → 0.44, at blueprint 0.60 → 0.66. At 0.21 the opening sketch was too faint to read in a 380 px slot (stills `.qa/p1/stills-v0/`). The dark (blueprint-paper) set used by the live page is unchanged. |

Not changed: lighting, exposure, contact/bloom reveal curves and framing math (`src/framing.ts`). Framing is done per cue through `shift` and `room` (section 4). The built house reads a little bright and white on ivory; that is noted as a P4 tuning option, not a P1 blocker.

## 4. Cue table (model points, not board coordinates)

`room` values under focus compensate `Garden.focus`'s room zooms (×2.6 Whisperbook, ×2.8 Wattch, ×3 workshop and BP Log, ×1.4 for `about`), giving about 1.3× overall, so the whole house stays recognizable around the room. Positive `shift[1]` lifts the garden; negative lowers it.

| Chapter | Stage | Progress | Focus (model point) | Wide shift / room | Portrait override |
| --- | --- | ---: | --- | --- | --- |
| intro | sketch | 0 | whole world | [0, 0.07] / 1.04 | [0, 0.10] / 1.08 |
| work | blueprint | 0.40 | whole world | [0, 0.04] / 0.96 | [0, 0.06] / 1.02 |
| bplog | build | 0.52 | `bplog` room (6.75, 0.65, 3.0) | [0.04, −0.07] / 0.44 | [0.03, −0.32] / 0.46 |
| whisperbook | build | 0.66 | `whisperbook` room (3.4, 1.7, −0.55) | [0, −0.06] / 0.50 | [0, −0.04] / 0.56 |
| energy-tools | build | 0.76 | `wattch` room (−3.4, 1.45, 0.45) | [0.02, −0.06] / 0.46 | [0.02, −0.04] / 0.50 |
| mcq-scan | build | 0.84 | `workshop` room (6.65, 0.75, −0.2) | [0.02, −0.06] / 0.43 | [0.02, −0.04] / 0.46 |
| about | bloom | 0.93 | `about` point (Mansourah tower) | [0.08, 0] / 0.78 | [0.06, 0] / 0.78 |
| contact | bloom | 1 | whole world | [−0.02, 0.03] / 0.92 | [−0.02, 0.04] / 0.90 |

Work sits at 0.40 rather than the 0.33 hold so the first foundation planes are just visible (solid ≈ 0.10). BP Log at 0.52 shows translucent planes with the heart as the first opaque object; Whisperbook at 0.66 is the Build hold, fully dimensional; life (foliage) begins at 0.69, so energy-tools and mcq-scan show it arriving and about/contact show Bloom.

## 5. Measurements

Raw data: `.qa/p1/measurements.json` (with progress samples, logs and the sticky trace), `.qa/p1/recordings.json`. Wide is 1440×900 DPR 1 full detail; portrait is 390×844 DPR 3, `isMobile`, touch, light detail.

| Check | Wide | Portrait |
| --- | --- | --- |
| Guided hold at Whisperbook (0.66), frames before → after 10 s settled | 167 → 167 (0) | 97 → 97 (0) |
| Guided hold at Contact (1.0), 10 s | 168 → 168 (0) | 98 → 98 (0) |
| Control: same Contact with `release()`, 10 s | +130 (13/s, SwiftShader) | +298 (30/s, Light cap) |
| Direct jump after a hold (`jump("work")`) | 1 frame, progress 0.400 | 1 frame, progress 0.400 |
| Direct jumps, time to drawn destination (5 jumps) | 3 to 6 ms, 1 frame each | 2 to 3 ms, 1 frame each |
| Eased intro → whisperbook | 2.90 s, 47 frames | 2.27 s, 68 frames |
| Eased reverse whisperbook → work | 2.55 s, 45 frames | 2.31 s, 69 frames |
| Eased work → contact | 2.50 s, 27 frames | 2.01 s, 48 frames |
| Eased reverse contact → intro | 1.71 s, 73 frames | 1.81 s, 54 frames |
| `snapTo` then eased `go` (no reduced flag) | 0.33 → 0.508 at 168 ms | 0.33 → 0.511 at 122 ms |
| Legacy `setProgress(p, true)` then `focus` | 1 frame (reduced persisted) | 1 frame |
| Rapid scroll intro → about (350 ms) | 6 chapters passed, 1 settle (about, 3.5 s), progress 0.93 | same, 1 settle (2.4 s) |
| `system-reduced`: `go("contact")` | 1 frame; 0 frames in the next 3 s | same |
| Portrait sticky slot (reader keeps scrolling during the transition) | n/a | stuck at top 0 from 0.91 s to 2.45 s, released at settle and slid to its flow position (−106 px) |

Reverse motion resolves directly: whisperbook → work progress samples 0.553, 0.469, 0.431 ... 0.400, monotonic, no overshoot, nothing replayed for the chapters in between. Settle time is dominated by the camera (exponential ease at 3.2/s) while construction progress eases at 7/s and is 95 percent there in about 0.45 s, so the build is the first visible change and the camera follows: the plan's "one dominant property first". Eased settles of 1.7 to 2.9 s are long for scroll; P4 may shorten the camera ease for the guided page. Explicit navigation already meets the "immediate jump" default.

## 6. What I looked at (visual verification)

Stills opened and judged with the Read tool: `.qa/p1/stills/sheet-wide.png`, `.qa/p1/stills/sheet-portrait.png` (all eight cues in both hosts), the individual portrait BP Log, Whisperbook and intro stills, `.qa/p1/stills/portrait-sticky-transit.png`, and frames extracted from both recordings at mid-transition (`.qa/p1/frames/sheet-wide.png`, `.qa/p1/frames/sheet-portrait.png`).

- **Sketch, portrait 390 px:** a recognizable graphite drawing of the house (observatory ring, pergola terrace, pavilion, tower, channel) sharing the first screen with the role line, the promise and the CV link. After tuning it reads; before tuning (0.21 grey) it was too faint.
- **Blueprint:** blue construction lines with dashed guides; the strongest of the four stages in both hosts.
- **Build (BP Log, Whisperbook):** volumes arrive over the lines. BP Log reads as "under construction" (translucent planes, heart opaque). Whisperbook reads as a dimensional reading pavilion with the open-book roof and shelves; tower, channel and observatory remain in frame, so the room is recognizable as part of the house.
- **Bloom (about, contact):** foliage, water and the full composition; the house is the same model throughout.
- **Mid-transition frames:** pencil to blue, and blue lines with planes fading in, read as one drawing becoming volume; there is no cut.

## 7. Decision gate: (a), with reasoning

Global progress plus focus is legible in both hosts: every stage is recognizable at 390 px in a 380 px slot, the transformation is visibly continuous in the recordings, and the focus localizes "which room" without losing the house.

A scoped group-reveal manifest (b) was considered because the mobile board shows a local build (pavilion built while the observatory is still drawn). Not taken, for these measured or structural reasons:

- Geometry is merged per colour across the whole model (`batches`, `src/scene.ts` around line 226 and 1664), which keeps the scene to few draw calls (the baseline records 62 on desktop and 50 on phone, `baseline/BASELINE.md` section 4.2). A per-region reveal needs each colour batch split by region: roughly 5 regions × the per-colour batches, i.e. several times the draw calls, plus per-region fade state in the style pass and shadow invalidation.
- Estimate if the user wants it later (release 2): about 1.5 to 2 days (region tags at build time, region × colour batching, a `reveal(region, amount)` API, retuning the cue table, re-measuring draw calls and phone frame times).
- The focus already does the localizing work the boards ask of the reveal, at no cost.

The sticky-during-transition portrait slot (the (c) escape) is also implemented and measured above; it was not needed as an escape because (a) holds, and it is the plan's portrait layout anyway.

## 8. Tradeoffs and open issues for P4

- **Sticky slot covers text while stuck.** The stuck slot sits over the decision paragraph's first lines until the transition settles (about 1.5 s here); see `portrait-sticky-transit.png`. Options: shorter camera ease, a smaller stuck height, or starting the transition earlier.
- **Vacated portrait slots are blank paper.** When the scene moves to the next chapter's slot, the previous slot is empty if still on screen. P4 may want a still or a collapsed height.
- **Activation thresholds** (45 percent wide, 70 percent portrait slot) are study values tuned for placeholder copy. Real copy lengths will need retuning; very short chapters can activate the next chapter while the reader is still on the decision.
- **Built house is bright on ivory** (tone mapping exposure 1.2 in the light set). Readable, but whiter than the boards' warm render; a P4 tuning option.
- **Eased settles of 1.7 to 2.9 s** under software GL; measure again on accelerated hardware (P7).
- The study does not draw the sky (`src/sky.ts`); hidden-tab behaviour is the scene's existing IntersectionObserver and `document.hidden` handling, unchanged.

## 9. Captures (git-ignored, local)

| What | Path |
| --- | --- |
| Recordings, four-phase sequence with 2.5 s reading pauses, a direct jump to Bloom, a reverse scroll, a jump back to Sketch | `.qa/p1/video/wide.webm` (1440×900), `.qa/p1/video/portrait.webm` (390×844, DPR 3, mobile) |
| Step timestamps for the recordings | `.qa/p1/recordings.json` |
| Stills, every cue, both hosts | `.qa/p1/stills/{wide,portrait}-<chapter>.png`, sheets `sheet-wide.png`, `sheet-portrait.png` |
| Sticky slot during and after a transition | `.qa/p1/stills/portrait-sticky-transit.png`, `portrait-sticky-released.png` |
| Tuning iterations | `.qa/p1/stills-v0/` (before ink and framing), `stills-v1/`, `stills-v2/`, `stills-v3/` |
| Frames from the recordings | `.qa/p1/frames/` |
| Measurements | `.qa/p1/measurements.json` |

Reproduce: `npx vite --config dev/vite.study.config.ts --host 127.0.0.1 --port 5311`, then `STUDY_URL=http://127.0.0.1:5311 node dev/motion-study-stills.mjs .qa/p1/stills` and `node dev/motion-study-run.mjs all`.
