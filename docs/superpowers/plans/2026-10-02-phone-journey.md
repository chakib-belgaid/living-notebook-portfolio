# Phone Garden Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, replace the long reading page with the garden journey: short cards over animated stills of the real garden (Sketch → Blueprint → Build → Bloom), full details in a bottom sheet, and the live garden available behind the sprout.

**Architecture:**
- A new `src/phone.ts` lays the journey over the existing semantic reading page. Each stop is an existing section, marked `data-stop`. Its long content is marked `data-detail` and moves into a shared `<dialog>` sheet (`src/sheet.ts`) on demand.
- The garden is six pre-rendered WebP stills in a fixed layer. Scroll position drives the wipes between stills.
- `main.ts` only decides when the journey is active and drives the live WebGL garden when the visitor asks for it. Desktop is untouched.

**Tech Stack:** Vite 7 + TypeScript (no framework), Three.js (existing scene), Playwright (tests and still capture), `cwebp` (Homebrew), Node 26 test runner with native TS loading.

**Spec:** `docs/superpowers/specs/2026-10-02-phone-journey-design.md`

## Global Constraints

- **Viewports:**
  - Desktop (≥ 900 px wide) is unchanged.
  - The journey runs only when enhanced, at `(max-width: 899px) and (min-height: 500px)`, without `?view=read`.
  - Landscape phones (e.g. 844 × 390) keep the reading page.
- **Copy:** no new factual claims. Card copy is existing copy or a trim of it. The only reworded line is the Sketch line: "Product engineer, Ph.D. AI products, developer tools, and how we measure the energy software uses."
- **Data budget:**
  - Six stills (`sketch`, `blueprint`, `build`, `whisperbook`, `wattch`, `bloom`), WebP, 780 × 1688, at most 100 KB each and 600 KB together.
  - Phones fetch the current still plus at most one ahead, and never `garden-preview.png`.
- **Motion:**
  - All time-based motion is CSS animation, paused by `:root[data-motion-paused="true"]` and removed by `prefers-reduced-motion: reduce`.
  - Under reduced motion, wipes cut at their midpoint. Scroll-linked effects remain.
- **Accessibility:**
  - Every control has a 44 px (2.75rem) target.
  - The sheet is a modal `<dialog>`. It closes with Escape, the close button, a backdrop tap or a drag down, and restores focus to its opener.
  - The tab order matches the visual order.
- **Fallbacks:** no-JS, print, `?view=read`, the evidence dialog, the contact draft (page memory only) and fragment navigation keep working.
- **Code style:** match the surrounding code. Short "why" comments in the existing voice, no framework, and no new runtime dependencies.

## Deviations from the spec (decided while planning)

- **Work stop:** it shows the first two sentences of its paragraph as its line and has **no** More sheet. A sheet holding a single extra sentence isn't worth a tap. The full paragraph stays in the reading page.
- **Page background:** it stays `var(--paper)`. Each still fades to transparent at its bottom edge through a mask, so the seam disappears without fixing the page to one sky colour.

## Review Focus

1. **Rotating to landscape with a sheet open:** the journey tears down, the sheet closes, and the details return to their sections with no loss. *(Test in Task 4.)*
2. **Opening a deep link like `/#wattch` on a phone:** it lands on the Wattch stop, with its still and the label "Build · Wattch Core". *(Test in Task 4.)*
3. **Opening and closing the sheet under reduced motion:** it opens and closes instantly, and focus returns to the button. *(Test in Task 5.)*
4. **A night-time visit:** `--paper` is dark at night and the stills are captured at 1 pm. The bottom fade and the header must still look intentional. *(Visual check in Task 7.)*
5. **A slow connection:** cards are readable on plain paper before the first still arrives, and nothing flashes a broken image. *(Visual check in Task 7.)*

## File Structure

| File | Responsibility |
|---|---|
| `src/content.ts` (modify) | `stops`: the journey's stop list (name, stage, camera spot, label). Shared by `phone.ts`, `main.ts` and the capture script. |
| `src/lettered.ts` (create) | `lettered()`: letter-by-letter headline markup, moved out of `main.ts` so `phone.ts` can reuse it |
| `scripts/capture-stills.mjs` (create) | Drives the real garden in the dev server and writes the six WebP stills, enforcing the budget |
| `public/assets/stills/*.webp` (create) | The six stills |
| `src/render.ts` (modify) | Marks stops (`data-stop`), cards (`.stop-card`), details (`data-detail`), the Sketch line and the journey-only link |
| `src/style.css` (modify) | Guard rules for journey-only markup. Contact widget rules keyed to `[data-contact-read]` so they hold inside the sheet |
| `src/sheet.ts` (create) | The bottom sheet: moves detail nodes in and out, open/close animation, drag to dismiss, focus |
| `src/phone.ts` (create) | The journey: activation and teardown, still layer, wipes, card reveals, stage label, More buttons, pause button, ambient layers |
| `src/phone.css` (create) | All journey and sheet styles, scoped to `@media screen` and `:root[data-journey="true"]` |
| `src/main.ts` (modify) | Creates the journey, decides when it is active, wires pause and the live garden, and fixes passive section detection for the reordered DOM |
| `tests/journey.test.mjs` (create) | Unit checks of `stops` and the stills budget (Node, no browser) |
| `tests/portfolio.test.mjs` (modify) | Browser checks for markup, the journey, the sheet, motion, the live garden and the budget |
| `README.md` (modify) | Describes the phone journey |

**Running browser tests.** `tests/portfolio.test.mjs` runs against a production preview on port 5199. After any source change:

```sh
npm run build
npx vite preview --host 127.0.0.1 --port 5199 --strictPort &   # once; it serves the rebuilt dist/
PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="<pattern>" tests/portfolio.test.mjs
```

Stop the preview with `pkill -f "vite preview --host 127.0.0.1 --port 5199"` when done.

---

### Task 1: Shared stop data, `lettered`, and the development hook

**Files:**
- Modify: `src/content.ts` (append after `spotBeat`)
- Create: `src/lettered.ts`
- Modify: `src/main.ts:21-32` (remove local `lettered`) and the import block at the top, plus one line after `loadGarden` (dev hook)
- Test: `tests/journey.test.mjs`

**Interfaces:**
- Produces:
  - `export type StopName = "sketch" | "blueprint" | "build" | "whisperbook" | "wattch" | "bloom"`
  - `export type Stop = { name: StopName; stage: number; spot: Spot | null; label: string }`
  - `export const stops: Stop[]`
  - `export function lettered(text: string): string` from `src/lettered.ts`
  - In development only: `window.__notebook.garden` (the live `Garden | undefined`)

- [ ] **Step 1: Write the failing test**

Create `tests/journey.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stops, stageProgress } from '../src/content.ts';

test('the phone journey visits Sketch, Blueprint, Build and Bloom in order', () => {
  assert.deepEqual(stops.map(s => s.name), ['sketch', 'blueprint', 'build', 'whisperbook', 'wattch', 'bloom']);
  assert.deepEqual(stops.map(s => s.stage), [0, 1, 2, 2, 2, 3]);
  assert.deepEqual(stops.map(s => s.spot), [null, 'about', null, 'whisperbook', 'wattch', null]);
  for (const s of stops) assert.equal(typeof stageProgress[s.stage], 'number');
  assert.deepEqual(stops.map(s => s.label), ['Sketch', 'Blueprint · Background', 'Build', 'Build · Whisperbook', 'Build · Wattch Core', 'Bloom · Write to me']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/journey.test.mjs`
Expected: FAIL with `SyntaxError: The requested module '../src/content.ts' does not provide an export named 'stops'`

- [ ] **Step 3: Add `stops` to `src/content.ts`**

Append at the end of the file:

```ts
/* The phone journey (src/phone.ts): one stop per card, each with the stage
   its still shows and where the camera looks. The capture script and the
   live garden use the same list, so stills and garden agree. */
export type StopName = "sketch" | "blueprint" | "build" | "whisperbook" | "wattch" | "bloom";
export type Stop = { name: StopName; stage: number; spot: Spot | null; label: string };
export const stops: Stop[] = [
  { name: "sketch", stage: 0, spot: null, label: "Sketch" },
  { name: "blueprint", stage: 1, spot: "about", label: "Blueprint · Background" },
  { name: "build", stage: 2, spot: null, label: "Build" },
  { name: "whisperbook", stage: 2, spot: "whisperbook", label: "Build · Whisperbook" },
  { name: "wattch", stage: 2, spot: "wattch", label: "Build · Wattch Core" },
  { name: "bloom", stage: 3, spot: null, label: "Bloom · Write to me" },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/journey.test.mjs`
Expected: PASS (1 test)

- [ ] **Step 5: Move `lettered` into its own module**

Create `src/lettered.ts`:

```ts
/* Headline letters are wrapped so they can be set in one after another. */
export function lettered(text: string) {
  let i = 0;
  const words = text
    .split(" ")
    .map(
      (w) =>
        `<span class="word">${[...w].map((c) => `<span class="char" style="--i:${i++}">${c}</span>`).join("")}</span>`,
    )
    .join(" ");
  return `<span class="sr-only">${text}</span><span aria-hidden="true">${words}</span>`;
}
```

In `src/main.ts`, delete the local definition (the comment `/* Headline letters are wrapped so they can be set in one after another. */` and the whole `function lettered(text: string) { … }` block). Add this import after `import { initEvidence } from "./evidence";`:

```ts
import { lettered } from "./lettered";
```

- [ ] **Step 6: Expose the garden in development**

In `src/main.ts`, directly after the closing `}` of `async function loadGarden() { … }`, add:

```ts
// scripts/capture-stills.mjs drives the garden through this, in development only.
if (import.meta.env.DEV) Object.assign(window, { __notebook: { get garden() { return garden; } } });
```

- [ ] **Step 7: Type-check and run the unit tests**

Run: `npx tsc --noEmit && node --test tests/journey.test.mjs tests/transfer.test.mjs`
Expected: no type errors. All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/content.ts src/lettered.ts src/main.ts tests/journey.test.mjs docs/superpowers/specs/2026-10-02-phone-journey-design.md docs/superpowers/plans/2026-10-02-phone-journey.md
git commit -m "add,journey, stop list shared by phone journey and garden; lettered module; dev garden hook"
```

---

### Task 2: Capture the six stills

**Files:**
- Create: `scripts/capture-stills.mjs`
- Create: `public/assets/stills/{sketch,blueprint,build,whisperbook,wattch,bloom}.webp`
- Modify: `package.json` (add `"stills"` script)
- Test: `tests/journey.test.mjs` (add budget test)

**Interfaces:**
- Consumes:
  - `stops` and `stageProgress` from `src/content.ts`
  - `window.__notebook.garden` with `setProgress(p, immediate)`, `focus(spot, shiftX, shiftY)` and `frame(top, bottom)`
- Produces: `/assets/stills/<StopName>.webp`, 780 × 1688

- [ ] **Step 1: Write the failing budget test**

Append to `tests/journey.test.mjs`:

```js
import { readdir, readFile } from 'node:fs/promises';

test('six phone stills exist as WebP within the data budget', async () => {
  const dir = new URL('../public/assets/stills/', import.meta.url);
  const names = (await readdir(dir)).filter(n => n.endsWith('.webp')).sort();
  assert.deepEqual(names, ['bloom', 'blueprint', 'build', 'sketch', 'wattch', 'whisperbook'].map(n => `${n}.webp`));
  let total = 0;
  for (const name of names) {
    const file = await readFile(new URL(name, dir));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(file.toString('ascii', 8, 12), 'WEBP', name);
    assert.ok(file.length <= 100 * 1024, `${name} is ${file.length} bytes`);
    total += file.length;
  }
  assert.ok(total <= 600 * 1024, `stills total ${total} bytes`);
});
```

Move the new `import { readdir, readFile } …` line up to sit with the other imports at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/journey.test.mjs`
Expected: FAIL with `ENOENT: no such file or directory, scandir '…/public/assets/stills/'`

- [ ] **Step 3: Write the capture script**

Create `scripts/capture-stills.mjs`:

```js
// Captures the phone journey's stills from the real garden in the dev server.
// Run `npm run dev -- --port 5198 --strictPort` first, then `npm run stills`.
// Re-run whenever the garden changes. Requires cwebp (brew install webp).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stops, stageProgress } from '../src/content.ts';

const base = process.env.DEV_URL || 'http://127.0.0.1:5198';
const out = new URL('../public/assets/stills/', import.meta.url).pathname;
const each = 100 * 1024, total = 600 * 1024;
await mkdir(out, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), 'stills-'));

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
// 900 px wide is the narrowest garden view; the height gives a phone's portrait ratio (390 × 844).
const page = await browser.newPage({ viewport: { width: 900, height: 1948 }, deviceScaleFactor: 1 });
await page.route('**/*open-meteo.com/**', route => route.abort());
await page.goto(base + '/');
await page.waitForFunction(() => window.__notebook?.garden);
await page.addStyleTag({ content: '.masthead, .chapters, .ruler, .dock, .mist, .hotspot, .skip-link, #portfolio { visibility: hidden !important; }' });
// Fixed conditions, so a re-run matches: 1 pm, autumn, a clear sky.
await page.evaluate(() => {
  const hour = document.querySelector('#hour');
  hour.value = '13';
  hour.dispatchEvent(new Event('input'));
  document.querySelector('button[data-season="autumn"]').click();
  document.querySelector('button[data-weather="clear"]').click();
});

const sizes = {};
for (const stop of stops) {
  await page.evaluate(([progress, spot]) => {
    const garden = window.__notebook.garden;
    garden.setProgress(progress, true);
    garden.focus(spot, 0, 0);
    garden.frame(0.06, 0.58);
  }, [stageProgress[stop.stage], stop.spot]);
  await page.waitForTimeout(3500); // the camera eases to its spot
  const png = join(scratch, `${stop.name}.png`);
  await page.screenshot({ path: png });
  const webp = join(out, `${stop.name}.webp`);
  execFileSync('cwebp', ['-quiet', '-q', process.env.STILL_QUALITY || '70', '-resize', '780', '1688', png, '-o', webp]);
  sizes[stop.name] = (await stat(webp)).size;
}
await browser.close();

const sum = Object.values(sizes).reduce((a, b) => a + b, 0);
console.table(Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, `${Math.round(v / 1024)} KB`])));
console.log(`total ${Math.round(sum / 1024)} KB`);
const over = Object.entries(sizes).filter(([, v]) => v > each);
if (over.length || sum > total) {
  console.error(`Over budget (${each / 1024} KB each, ${total / 1024} KB total). Re-run with STILL_QUALITY=60.`);
  process.exit(1);
}
```

In `package.json` `"scripts"`, add after `"test:performance"`:

```json
    "stills": "node scripts/capture-stills.mjs"
```

(Add a comma to the preceding line.)

- [ ] **Step 4: Capture the stills**

```sh
npm run dev -- --port 5198 --strictPort &
npm run stills
```

Expected: a table of six sizes, each ≤ 100 KB, total ≤ 600 KB, exit 0. If it is over budget, run `STILL_QUALITY=60 npm run stills`.

- [ ] **Step 5: Look at every still**

Open each `public/assets/stills/*.webp` with the Read tool and check:
- `sketch` shows pencil lines.
- `blueprint` shows blue ink centred on the tower.
- `build` shows the whole garden in stone.
- `whisperbook` shows the pavilion close up.
- `wattch` shows the observatory close up.
- `bloom` shows the whole garden in colour.
- In every still, the garden sits in the upper ~60%, with plain sky below.

If a camera framing is wrong (garden cut off, empty), adjust `frame(0.06, 0.58)` and re-run. Then stop the dev server: `pkill -f "vite --host 127.0.0.1 --port 5198"`.

- [ ] **Step 6: Run the budget test**

Run: `node --test tests/journey.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add scripts/capture-stills.mjs public/assets/stills package.json tests/journey.test.mjs
git commit -m "add,stills, capture six phone journey stills from the real garden"
```

---

### Task 3: Mark stops, cards and details in the semantic page

**Files:**
- Modify: `src/render.ts` (full replacement of `renderPortfolio`'s template)
- Modify: `src/style.css` (guard rules, print rule, contact selectors)
- Modify: `src/main.ts` (`.scene-fallback img` gets `loading="lazy"`)
- Test: `tests/portfolio.test.mjs`

**Interfaces:**
- Produces, in the served HTML:
  - `data-stop="<StopName>"` on `#intro`, `.work-opener`, `#whisperbook`, `#wattch`, `#about` and `#contact`.
  - One `.stop-card` inside each stop, holding the visible card content and the stop's heading.
  - `data-detail="about" | "whisperbook" | "wattch" | "contact"` on every node that moves into a sheet.
  - `.stop-line`, shown only in the journey.
  - `.work-copy`, the full Work paragraph, hidden in the journey.
  - `.journey-only` and `.journey-hidden` links.

- [ ] **Step 1: Write the failing test**

In `tests/portfolio.test.mjs`, add after the `healthy` helper:

```js
test('every journey stop and its details are in the served page', async () => {
  const html = await (await fetch(base + '/')).text();
  for (const s of ['sketch', 'blueprint', 'build', 'whisperbook', 'wattch', 'bloom']) assert.match(html, new RegExp(`data-stop="${s}"`), s);
  for (const d of ['about', 'whisperbook', 'wattch', 'contact']) assert.match(html, new RegExp(`data-detail="${d}"`), d);
  assert.equal((html.match(/class="[^"]*\bstop-card\b/g) || []).length, 6);
  assert.match(html, /class="stop-line">Product engineer, Ph\.D\. AI products, developer tools, and how we measure the energy software uses\.</);
  assert.match(html, /class="static-garden"[^>]*loading="lazy"/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="every journey stop" tests/portfolio.test.mjs` (with the 5199 preview running)
Expected: FAIL with `The input did not match the regular expression /data-stop="sketch"/`

- [ ] **Step 3: Replace the template in `src/render.ts`**

Replace everything from `return \`` to the closing `` `; `` of `renderPortfolio` with:

```ts
  const workCopy = beats.find(b => b.stage === 2 && !b.spot)!.copy;
  return `
    <a class="skip-link" href="#intro">Skip to portfolio</a>
    <header class="masthead">
      <a class="owner" href="#intro">Chakib Belgaid</a>
      <nav aria-label="Sections"><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
      <a class="view-switch script-only" href="?view=read" data-view="read">Read portfolio</a>
      <div class="read-ruler script-only" aria-hidden="true"><span class="read-fill"></span>${["intro", "work", "about", "contact"].map(id => `<i data-at="${id}"></i>`).join("")}</div>
    </header>
    <main id="portfolio" class="portfolio">
      <section id="intro" class="reading-intro" data-stop="sketch" aria-labelledby="intro-title">
        <div class="intro-copy stop-card"><p class="eyebrow">A living notebook</p>
          <h1 id="intro-title" tabindex="-1">Chakib Belgaid</h1>
          <p class="reading-lede">${e(beats[0].copy)}</p>
          <p class="stop-line">Product engineer, Ph.D. AI products, developer tools, and how we measure the energy software uses.</p>
          <div class="entry-actions"><a class="primary-action" href="#work">Selected work</a><a class="script-only journey-hidden" href="?view=garden" data-view="garden">Explore the garden</a><a class="script-only journey-only" href="?view=read" data-view="read">Read as a page</a></div>
          <p class="project-shortcuts"><a href="#whisperbook">Whisperbook</a> · <a href="#wattch">Wattch Core</a></p>
        </div>
        <div class="garden-preview" id="garden-preview">
          <div class="preview-frame" id="preview-frame"><img class="static-garden" src="/assets/garden-preview.png" width="1440" height="900" alt="The notebook garden in autumn, with a reading pavilion, energy observatory, atelier, and greenhouse." loading="lazy" fetchpriority="low" /></div>
          <p class="preview-caption">An idea, drawn and brought to life.</p>
          <div id="preview-tools"></div>
        </div>
      </section>
      <section id="work" class="reading-section" aria-labelledby="work-title">
        <div class="work-opener" data-stop="build">
          <div class="stop-card"><p class="eyebrow">Selected work</p><h2 id="work-title" tabindex="-1">The boundaries matter</h2>
            <p class="work-copy">${e(workCopy)}</p>
            <p class="stop-line">${e(workCopy.split(". ").slice(0, 2).join(". "))}.</p>
          </div>
          <nav class="project-shortcuts project-index" aria-label="Selected projects">${Object.entries(projects).map(([id, p], i) => `<a href="#${id}"><span class="index-number">0${i + 1}</span><span class="index-title">${e(p.title)}</span><span class="index-field">${e(p.field)}</span></a>`).join("")}</nav>
        </div>
        ${Object.entries(projects).map(([id, p]) => `
          <article class="reading-project" id="${id}" data-stop="${id}" aria-labelledby="${id}-title">
            <div class="project-copy">
              <div class="stop-card"><p class="eyebrow">${e(p.field)}</p><h3 id="${id}-title" tabindex="-1">${e(p.title)}</h3>
                <p class="reading-lede">${e(p.lede)}</p></div>
              <div class="stop-detail" data-detail="${id}"><p>${e(p.intro)}</p>
                <h4>What I built</h4><p>${e(p.built)}</p><h4>The decision that shaped it</h4><p>${e(p.decision)}</p>
                <p class="project-tech">${e(p.tech.join(" · "))}</p><a class="source-link" href="${p.url}" target="_blank" rel="noopener noreferrer">Read ${e(p.title)} on GitHub ↗</a>
                <details class="reading-illustration script-only" data-illustration="${id}"><summary>${id === "whisperbook" ? "Hear a passage in your browser" : "Measure what drawing this page costs"}</summary><p>${e(id === "whisperbook" ? "Hear an excerpt in your browser’s local voice. Whisperbook uses its own on-device narration on Android." : "Watch what drawing this page costs your device: CPU and GPU time, and the estimated carbon of that work. Enable the garden preview to measure it.")}</p><div data-reading-widget="${id}"></div></details>
              </div>
            </div>
            <figure class="reading-proof proof-${id}" data-detail="${id}"><a href="${p.image}" data-evidence="${id}" aria-label="View full screenshot of ${e(p.title)}"><img src="${p.image}" width="${p.size[0]}" height="${p.size[1]}" alt="${e(p.alt)}" loading="lazy" decoding="async" /></a>
              <figcaption>${e(p.caption)} <a href="${p.image}" data-evidence="${id}">View full screenshot</a></figcaption>
            </figure>
          </article>`).join("")}
      </section>
      <section class="reading-section" id="about" data-stop="blueprint" aria-labelledby="about-title">
        <div class="stop-card"><p class="eyebrow">Current work and background</p><h2 id="about-title" tabindex="-1">${e(beats[1].title)}</h2></div>
        <div class="stop-detail" data-detail="about"><p>${e(beats[1].copy)}</p>
          <ol class="career-list">${career.map(b => `<li><p class="eyebrow">${e(b.label!)}</p><h3>${role(b.title)}</h3><p>${e(b.copy)}</p></li>`).join("")}</ol>
        </div>
      </section>
      <section class="reading-section reading-contact" id="contact" data-stop="bloom" aria-labelledby="contact-title">
        <div class="stop-card"><p class="eyebrow">Write to me</p><h2 id="contact-title" tabindex="-1">I’d like to hear what you’re building.</h2>
          <p class="note-email"><a href="mailto:${email}">${email}</a></p>
          <p class="note-links"><a href="https://github.com/chakib-belgaid" target="_blank" rel="noopener noreferrer">GitHub</a> <a href="https://www.linkedin.com/in/chakib-belgaid" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>
        </div>
        <div class="note-widget script-only" data-contact-read data-detail="contact"></div>
        <p class="sign-off"><a href="#intro">Back to the top ↑</a></p>
      </section>
    </main>`;
```

`.stop-card`, `.stop-detail` and `.work-opener` are plain blocks outside the journey, so the reading page looks the same apart from the contact links now sitting above the note form.

- [ ] **Step 4: Add guard rules and key the contact styles to the widget**

In `src/style.css`, directly after the line `.enhanced a.script-only { display: inline-flex; }`, add:

```css
/* Journey markup (styled in phone.css) stays out of the reading page. */
:root:not([data-journey="true"]) .stop-line,
:root:not([data-journey="true"]) .journey-only { display: none !important; }
```

Replace these five selectors in place, keeping their declarations unchanged. They then follow the widget into the sheet:

| Old selector | New selector |
|---|---|
| `.reading-contact .note-widget {` | `.note-widget[data-contact-read] {` |
| `.reading-contact .note-widget h3 {` | `[data-contact-read] h3 {` |
| `.reading-contact .note-label {` | `[data-contact-read] .note-label {` |
| `.reading-contact textarea {` | `[data-contact-read] textarea {` |
| `.reading-contact [data-send]` (both rules, including `:disabled`) | `[data-contact-read] [data-send]` |

In the second `@media print` block, change `.entry-actions, .project-shortcuts, .sign-off { display: none; }` to:

```css
  .entry-actions, .project-shortcuts, .sign-off, .stop-line { display: none; }
```

- [ ] **Step 5: Stop the fallback image loading where it isn't shown**

In `src/main.ts`, in the `#experience` template, change:

```html
<div class="scene-fallback"><img src="/assets/garden-preview.png" width="1440" height="900" alt=
```

to:

```html
<div class="scene-fallback"><img src="/assets/garden-preview.png" width="1440" height="900" loading="lazy" alt=
```

- [ ] **Step 6: Run the new test and the whole suite**

Run: `npx tsc --noEmit && npm run build && PLAYWRIGHT_CHANNEL=chrome npm test`
Expected: all tests PASS, including "every journey stop and its details are in the served page".

- [ ] **Step 7: Commit**

```bash
git add src/render.ts src/style.css src/main.ts tests/portfolio.test.mjs
git commit -m "add,markup, mark journey stops, cards and sheet details in the reading page"
```

---

### Task 4: The journey and its sheet

**Files:**
- Create: `src/sheet.ts`
- Create: `src/phone.ts`
- Create: `src/phone.css`
- Modify: `src/main.ts`:
  - create the journey after `const announce = …`;
  - `syncPresentation`;
  - `measure` (section detection);
  - add a `phoneQuery` change listener next to the `compact` one.
- Test: `tests/portfolio.test.mjs`

**Interfaces:**
- Consumes:
  - `stops`, `Stop` and `StopName` (Task 1);
  - `lettered` (Task 1);
  - the markup hooks (Task 3).
- Produces:
  - `createSheet(): Sheet` with `open(key: string, title: string, opener: HTMLElement): void`, `close(immediate?: boolean): void` and `readonly openKey: string | null`.
  - `createPhoneJourney(options: { onStop: (stop: Stop) => void }): Journey`.
  - `Journey`: `readonly active: boolean`, `readonly stop: Stop`, `readonly layer: HTMLElement`, `setActive(on: boolean): void`, `notify(text: string): void`.
  - The DOM: `root.dataset.journey = "true"` while active; `.journey` (the fixed layer); `.journey-still[data-still]`; `.journey-bar` with `.journey-label`; `dialog.sheet`; and buttons named "More about my background", "More about Whisperbook", "More about Wattch Core" and "Leave a note".

- [ ] **Step 1: Write the failing tests**

In `tests/portfolio.test.mjs`, replace the whole `for (const [width,height] of [[390,844],[375,667],[320,568],[844,390]]) { test(\`normal-flow reading exposes required content …\` … }` block with:

```js
for (const [width,height] of [[390,844],[375,667],[320,568]]) {
  test(`the phone journey at ${width}×${height}`, async () => {
    const p = await page({viewport:{width,height}});
    try {
      await ready(p);
      assert.equal(await p.locator('html').getAttribute('data-view'), 'read');
      assert.equal(await p.locator('html').getAttribute('data-journey'), 'true');
      assert.equal(await p.locator('#scene canvas').count(), 0, 'the journey does not initialize WebGL');
      await p.waitForFunction(() => { const i = document.querySelector('.journey-still[data-still="sketch"]'); return i?.complete && i.naturalWidth > 0; });
      assert.equal(await p.evaluate(()=>scrollY), 0, 'the introduction starts above the fold');
      assert.ok(await p.locator('#intro-title').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.masthead').getBoundingClientRect().bottom),'the header does not obscure the introduction');
      const clipped = await p.locator('.masthead a').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(e=>e.textContent));
      assert.deepEqual(clipped, []);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.screenshot({path:output+`/journey-${width}x${height}.png`});
      await go(p,'contact');
      const leave = p.getByRole('button',{name:'Leave a note',exact:true});
      await leave.click();
      await p.locator('dialog.sheet textarea').fill('A visible mobile draft.');
      await p.screenshot({path:output+`/sheet-${width}x${height}.png`});
      await p.keyboard.press('Escape');
      await p.waitForFunction(()=>!document.querySelector('dialog.sheet').open);
      assert.equal(await p.locator('#contact textarea').inputValue(), 'A visible mobile draft.', 'the draft goes back with the form');
      assert.equal(await leave.evaluate(e=>e===document.activeElement), true, 'focus returns to the opener');
      healthy(p);
    } finally { await p.context().close(); }
  });
}

test('landscape phones keep the reading page', async () => {
  const p = await page({viewport:{width:844,height:390}});
  try {
    await ready(p);
    assert.equal(await p.locator('html').getAttribute('data-journey'), null);
    assert.equal(await p.locator('#portfolio').isVisible(), true);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.screenshot({path:output+'/reading-844x390.png'});
    await go(p,'contact');
    await p.locator('#contact textarea').fill('A visible landscape draft.');
    assert.equal(await p.locator('#contact textarea').evaluate(e=>getComputedStyle(e).position),'static');
    healthy(p);
  } finally { await p.context().close(); }
});

test('a card’s More opens its details in a sheet and puts them back', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'whisperbook');
    assert.equal(await p.locator('.journey-label').textContent(), 'Build · Whisperbook');
    const more = p.getByRole('button',{name:'More about Whisperbook',exact:true});
    await more.click();
    const sheet = p.locator('dialog.sheet');
    await sheet.waitFor({state:'visible'});
    assert.equal(await sheet.locator('h2').innerText(), 'Whisperbook');
    assert.equal(await sheet.getByRole('link',{name:/Read Whisperbook on GitHub/}).isVisible(), true);
    assert.equal(await sheet.locator('img[src$="whisperbook.webp"]').isVisible(), true);
    assert.ok(await sheet.evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}), 'the sheet fits the screen');
    await sheet.getByRole('button',{name:'Close',exact:true}).click();
    await p.waitForFunction(()=>!document.querySelector('dialog.sheet').open);
    assert.equal(await p.locator('#whisperbook [data-detail="whisperbook"]').count(), 2, 'both detail nodes are back');
    assert.equal(await more.evaluate(e=>e===document.activeElement), true);
    healthy(p);
  } finally { await p.context().close(); }
});

test('rotating to landscape with a sheet open restores the reading page intact', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'wattch');
    await p.getByRole('button',{name:'More about Wattch Core',exact:true}).click();
    await p.locator('dialog.sheet').waitFor({state:'visible'});
    await p.setViewportSize({width:844,height:390});
    await p.waitForTimeout(400);
    assert.equal(await p.locator('html').getAttribute('data-journey'), null);
    assert.equal(await p.locator('dialog.sheet').evaluate(d=>d.open), false);
    assert.equal(await p.locator('#wattch [data-detail="wattch"]').count(), 2);
    assert.equal(await p.locator('#wattch .project-tech').isVisible(), true);
    assert.deepEqual(await p.locator('#portfolio > section').evaluateAll(es=>es.map(e=>e.id)), ['intro','work','about','contact'], 'reading order is restored');
    healthy(p);
  } finally { await p.context().close(); }
});

test('a deep link opens the journey at its stop', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p, '#wattch');
    await p.waitForTimeout(600);
    assert.equal(await p.locator('.journey-label').textContent(), 'Build · Wattch Core');
    assert.equal(await p.locator('.journey').getAttribute('data-at'), 'wattch');
    assert.equal(await p.locator('.journey-still[data-still="wattch"]').evaluate(e=>getComputedStyle(e).getPropertyValue('--wipe').trim()), '1.000');
    healthy(p);
  } finally { await p.context().close(); }
});

test('a phone load fetches the first still, at most one ahead, and no preview image', async () => {
  const p = await page({viewport:{width:390,height:844}});
  const urls = [];
  p.on('request', r => urls.push(r.url()));
  try {
    await ready(p);
    await p.waitForTimeout(800);
    const stills = urls.filter(u => u.includes('/assets/stills/'));
    assert.ok(stills.some(u => u.endsWith('/sketch.webp')), stills.join());
    assert.ok(stills.length <= 2, stills.join());
    assert.equal(urls.filter(u => u.includes('garden-preview.png')).length, 0);
    healthy(p);
  } finally { await p.context().close(); }
});
```

In the `200% text enlargement and 400% reflow` test, replace:

```js
    await go(p,'contact');
    await p.locator('#contact textarea').fill('Enlarged text remains readable.');
```

with:

```js
    await go(p,'contact');
    await p.getByRole('button',{name:'Leave a note',exact:true}).click();
    const sheet = p.locator('dialog.sheet');
    await sheet.locator('textarea').fill('Enlarged text remains readable.');
    assert.ok(await sheet.evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1;}),'the sheet stays within the viewport');
    await p.screenshot({path:output+'/text-200-sheet.png'});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="phone journey|landscape|More opens|rotating|deep link|first still|200%" tests/portfolio.test.mjs`
Expected: the journey, sheet, rotation, deep link, budget and 200% tests FAIL (`data-journey` is `null`). The landscape test PASSES.

- [ ] **Step 3: Write `src/sheet.ts`**

```ts
/* One bottom sheet for the phone journey. Opening it moves a section's
   [data-detail] nodes in, so live state (a draft, a playing voice) moves
   with them; closing puts each back where a marker kept its place. */
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");

export type Sheet = {
  open: (key: string, title: string, opener: HTMLElement) => void;
  close: (immediate?: boolean) => void;
  readonly openKey: string | null;
};

export function createSheet(): Sheet {
  const dialog = document.createElement("dialog");
  dialog.className = "sheet";
  dialog.setAttribute("aria-labelledby", "sheet-title");
  dialog.innerHTML = `<div class="sheet-head"><span class="sheet-handle" aria-hidden="true"></span><h2 id="sheet-title" tabindex="-1"></h2><button type="button" class="sheet-close" aria-label="Close">×</button></div><div class="sheet-body"></div>`;
  document.body.append(dialog);
  const head = dialog.querySelector<HTMLElement>(".sheet-head")!;
  const title = dialog.querySelector<HTMLElement>("#sheet-title")!;
  const body = dialog.querySelector<HTMLElement>(".sheet-body")!;
  let openKey: string | null = null;
  let opener: HTMLElement | null = null;
  let moved: { node: Element; marker: Comment }[] = [];

  function restore() {
    moved.forEach(({ node, marker }) => marker.replaceWith(node));
    moved = [];
    openKey = null;
    if (opener?.isConnected && !opener.closest("[hidden]")) opener.focus({ preventScroll: true });
    opener = null;
  }
  function finish() {
    dialog.classList.remove("closing");
    dialog.style.removeProperty("--drag");
    if (dialog.open) dialog.close();
    restore();
  }
  function close(immediate = false) {
    if (!openKey) return;
    const still = immediate || reducedQuery.matches || document.documentElement.dataset.motionPaused === "true";
    if (still) return finish();
    dialog.classList.add("closing");
    dialog.addEventListener("animationend", finish, { once: true });
    // In case the animation never runs (a hidden tab), close anyway.
    window.setTimeout(() => { if (openKey && dialog.classList.contains("closing")) finish(); }, 400);
  }
  function open(key: string, heading: string, from: HTMLElement) {
    if (openKey) close(true);
    openKey = key;
    opener = from;
    title.textContent = heading;
    moved = [...document.querySelectorAll(`[data-detail="${key}"]`)].map((node) => {
      const marker = document.createComment(`detail ${key}`);
      node.before(marker);
      body.append(node);
      return { node, marker };
    });
    body.scrollTop = 0;
    dialog.showModal();
    title.focus({ preventScroll: true });
  }

  // Escape: close with the animation. If the browser closes it outright, still put the details back.
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dialog.addEventListener("close", () => { if (openKey) restore(); });
  dialog.querySelector(".sheet-close")!.addEventListener("click", () => close());
  // A tap on the backdrop, outside the sheet's box.
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) close();
  });
  // Drag the head down: past a quarter of the sheet, or a quick flick, closes it.
  let drag: { y: number; t: number; dy: number } | null = null;
  head.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest("button")) return;
    drag = { y: e.clientY, t: performance.now(), dy: 0 };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    dialog.style.setProperty("--drag", `${drag.dy}px`);
  });
  const release = () => {
    if (!drag) return;
    const { dy, t } = drag;
    drag = null;
    const flick = dy > 24 && dy / Math.max(1, performance.now() - t) > 0.6;
    if (dy > dialog.offsetHeight * 0.25 || flick) close();
    else dialog.style.removeProperty("--drag");
  };
  head.addEventListener("pointerup", release);
  head.addEventListener("pointercancel", release);

  return { open, close, get openKey() { return openKey; } };
}
```

- [ ] **Step 4: Write `src/phone.ts`**

```ts
import "./phone.css";
import { stops, type Stop, type StopName } from "./content";
import { lettered } from "./lettered";
import { createSheet } from "./sheet";

/* The garden journey on phones (docs/superpowers/specs/2026-10-02-phone-journey-design.md).
   It is laid over the reading page: each stop is one of its sections, shown
   as a short card over a still of the garden, and the stills wipe into one
   another as the visitor scrolls. Details open in a sheet. */
export type JourneyOptions = {
  /** The visitor reached a new stop. */
  onStop: (stop: Stop) => void;
};
export type Journey = {
  readonly active: boolean;
  readonly stop: Stop;
  /** The fixed layer behind the cards; main.ts puts the live garden in it. */
  readonly layer: HTMLElement;
  setActive: (on: boolean) => void;
  /** A short message in the header for a few seconds. */
  notify: (text: string) => void;
};

const details: Partial<Record<StopName, { key: string; title: string; text: string; label?: string }>> = {
  blueprint: { key: "about", title: "Background", text: "More", label: "More about my background" },
  whisperbook: { key: "whisperbook", title: "Whisperbook", text: "More", label: "More about Whisperbook" },
  wattch: { key: "wattch", title: "Wattch Core", text: "More", label: "More about Wattch Core" },
  bloom: { key: "contact", title: "Leave a note", text: "Leave a note" },
};
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function createPhoneJourney(options: JourneyOptions): Journey {
  const root = document.documentElement;
  const $ = <E extends HTMLElement>(s: string) => document.querySelector<E>(s)!;

  const layer = document.createElement("div");
  layer.className = "journey";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `${stops.map((s) => `<img class="journey-still" data-still="${s.name}" alt="" decoding="async" />`).join("")}<span class="journey-edge"></span>`;
  const stills = [...layer.querySelectorAll<HTMLImageElement>(".journey-still")];

  const bar = document.createElement("div");
  bar.className = "journey-bar";
  bar.innerHTML = `<span class="journey-label"></span><span class="journey-toast" role="status"></span>`;
  const label = bar.querySelector<HTMLElement>(".journey-label")!;
  const toast = bar.querySelector<HTMLElement>(".journey-toast")!;

  // Blueprint's card carries the career as a timeline that fills with scroll.
  const years = [...document.querySelectorAll(".career-list .eyebrow")].map((e) => e.textContent!.slice(0, 4)).reverse();
  const timeline = document.createElement("div");
  timeline.className = "mini-timeline";
  timeline.setAttribute("aria-hidden", "true");
  timeline.innerHTML = `<span class="mini-line"></span>${[...years, "now"].map((y) => `<span class="mini-year">${y}</span>`).join("")}`;

  const sheet = createSheet();
  const moreButtons = stops.flatMap((s) => {
    const d = details[s.name];
    if (!d) return [];
    const button = document.createElement("button");
    button.type = "button";
    button.className = s.name === "bloom" ? "stop-more primary" : "stop-more";
    button.textContent = d.text;
    if (d.label) button.setAttribute("aria-label", d.label);
    button.addEventListener("click", () => sheet.open(d.key, d.title, button));
    return [{ stop: s.name, button }];
  });

  const portfolio = $("#portfolio"), about = $("#about"), work = $("#work"), contact = $("#contact");
  const title = $("#intro-title");
  const titleText = title.textContent!;
  const stopEls = stops.map((s) => $(`[data-stop="${s.name}"]`));
  let active = false;
  let current: Stop | undefined;
  let observer: IntersectionObserver | undefined;
  let toastTimer = 0;

  function load(i: number) {
    const img = stills[i];
    if (img && !img.getAttribute("src")) img.src = `/assets/stills/${stops[i].name}.webp`;
  }

  function measure() {
    if (!active) return;
    const h = innerHeight;
    const tops = stopEls.map((el) => el.getBoundingClientRect().top);
    // The current stop is the last one whose top has passed the middle of the screen.
    let at = 0;
    tops.forEach((top, i) => { if (top <= h * 0.5) at = i; });
    load(at);
    load(at + 1);
    let wiping = -1;
    stills.forEach((img, i) => {
      // A still wipes in while its stop rises from the bottom of the screen
      // to 40% from the top; with reduced motion it cuts at halfway.
      const raw = i === 0 ? 1 : clamp((h - tops[i]) / (h * 0.6));
      const wipe = reducedQuery.matches ? (raw >= 0.5 ? 1 : 0) : raw;
      if (wipe > 0 && wipe < 1) wiping = wipe;
      img.style.setProperty("--wipe", wipe.toFixed(3));
      // While its stop holds, the still drifts a little closer.
      const span = i < stops.length - 1 ? tops[i + 1] - tops[i] : h;
      img.style.setProperty("--drift", clamp(-tops[i] / Math.max(1, span)).toFixed(3));
    });
    layer.toggleAttribute("data-wiping", wiping >= 0);
    layer.style.setProperty("--edge", Math.max(wiping, 0).toFixed(3));
    const b = stops.findIndex((s) => s.name === "blueprint");
    timeline.style.setProperty("--fill", clamp((h - tops[b]) / Math.max(1, tops[b + 1] - tops[b])).toFixed(3));
    if (stops[at] !== current) {
      current = stops[at];
      layer.dataset.at = current.name;
      label.textContent = current.label;
      options.onStop(current);
    }
  }
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; measure(); });
  }

  function setActive(on: boolean) {
    if (on === active) return;
    active = on;
    if (on) {
      root.dataset.journey = "true";
      document.body.prepend(layer);
      $(".masthead .read-ruler").before(bar);
      // The journey runs Sketch, Blueprint, Build, Bloom: the background comes
      // before the work, in the tab order as well as on screen.
      portfolio.insertBefore(about, work);
      $('[data-stop="blueprint"] .stop-card').append(timeline);
      for (const { stop, button } of moreButtons) $(`[data-stop="${stop}"] .stop-card`).append(button);
      title.innerHTML = lettered(titleText);
      observer = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("seen"); }), { threshold: 0.15 });
      document.querySelectorAll(".stop-card").forEach((card) => observer!.observe(card));
      current = undefined;
      addEventListener("scroll", schedule, { passive: true });
      addEventListener("resize", schedule);
      measure();
    } else {
      sheet.close(true);
      delete root.dataset.journey;
      layer.remove();
      bar.remove();
      timeline.remove();
      moreButtons.forEach(({ button }) => button.remove());
      portfolio.insertBefore(about, contact);
      title.textContent = titleText;
      observer?.disconnect();
      document.querySelectorAll(".stop-card.seen").forEach((card) => card.classList.remove("seen"));
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    }
  }

  function notify(text: string) {
    toast.textContent = text;
    bar.classList.add("toasting");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { bar.classList.remove("toasting"); toast.textContent = ""; }, 5000);
  }

  return {
    get active() { return active; },
    get stop() { return current ?? stops[0]; },
    layer,
    setActive,
    notify,
  };
}
```

- [ ] **Step 5: Write `src/phone.css`**

```css
/* The phone journey (src/phone.ts). Loaded only with JavaScript, and only for
   screens: printing falls back to the reading page. */
@media screen {
  /* The garden: stills in a fixed layer behind the cards. Each still wipes
     up over the one before (--wipe, 0–1), fades out at its foot into the
     paper, and drifts closer while its stop holds (--drift). */
  .journey { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
  .journey-still {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; object-position: 50% 0;
    transform: scale(calc(1 + var(--drift, 0) * 0.04)); transform-origin: 50% 32%;
    mask-image:
      linear-gradient(to top, #000 calc(var(--wipe, 0) * 115% - 15%), transparent calc(var(--wipe, 0) * 115%)),
      linear-gradient(#000 68%, transparent 94%);
    mask-composite: intersect;
  }
  .journey-still:not([src]) { visibility: hidden; }
  /* A pencil line rides the edge of a wipe. */
  .journey-edge {
    position: absolute; left: 0; right: 0; height: 1px;
    bottom: calc(var(--edge, 0) * 115% - 7.5%);
    background: linear-gradient(90deg, transparent, var(--blueprint) 30%, var(--blueprint) 70%, transparent);
    box-shadow: 0 0 10px var(--blueprint);
    opacity: 0;
  }
  .journey[data-wiping] .journey-edge { opacity: 0.85; }

  /* Stops: each is a stretch of scroll with its card held at the foot. */
  :root[data-journey="true"] .portfolio { position: relative; z-index: 1; padding: 0 1rem; }
  :root[data-journey="true"] [data-stop] {
    display: flex; flex-direction: column; justify-content: flex-end;
    min-height: 150svh; margin: 0; padding: 0 0 1rem; border: 0;
  }
  :root[data-journey="true"] #contact { min-height: 100svh; }
  :root[data-journey="true"] #work { padding: 0; margin: 0; border: 0; }
  :root[data-journey="true"] .portfolio [data-detail],
  :root[data-journey="true"] #intro .reading-lede,
  :root[data-journey="true"] .garden-preview,
  :root[data-journey="true"] .project-shortcuts,
  :root[data-journey="true"] .work-copy,
  :root[data-journey="true"] .sign-off,
  :root[data-journey="true"] .journey-hidden { display: none !important; }

  /* Cards: a slip of paper over the garden, rising into place when seen. */
  :root[data-journey="true"] .stop-card {
    position: sticky; bottom: 1rem;
    padding: 1.1rem 1.2rem 1.2rem;
    border: 1px solid var(--hairline); border-radius: 1rem;
    background: color-mix(in srgb, var(--paper) 84%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: 0 18px 40px -28px rgb(0 0 0 / 0.6);
    opacity: 0; transform: translateY(24px);
    transition: opacity 0.5s var(--ease), transform 0.6s var(--ease);
  }
  :root[data-journey="true"] .stop-card.seen { opacity: 1; transform: none; }
  :root[data-journey="true"] .stop-card .eyebrow { margin: 0; }
  :root[data-journey="true"] .stop-card h1 { font-size: 2.6rem; margin: 0.2rem 0 0.6rem; }
  :root[data-journey="true"] .stop-card h2,
  :root[data-journey="true"] .stop-card h3 { font-size: 1.9rem; line-height: 1.12; margin: 0.15rem 0 0.5rem; }
  :root[data-journey="true"] .stop-card .reading-lede,
  :root[data-journey="true"] .stop-line { font-size: 1.15rem; line-height: 1.4; margin: 0 0 0.9rem; }
  :root[data-journey="true"] .stop-card .entry-actions { margin: 0.25rem 0 0; }
  :root[data-journey="true"] .stop-card .note-links { margin-top: 0.5rem; }
  :root[data-journey="true"] .char { animation: set-in 0.7s calc(0.15s + var(--i) * 28ms) var(--ease) both; }
  .stop-more {
    display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2.75rem; margin-top: 0.4rem; padding: 0 1.1rem;
    border: 1px solid var(--hairline); border-radius: 999px; background: none; font-size: 1rem; cursor: pointer;
  }
  .stop-more::after { content: "↑"; color: var(--blueprint); }
  .stop-more.primary { background: var(--ink); border-color: var(--ink); color: var(--paper); font-weight: 600; }
  .stop-more.primary::after { content: none; }

  /* Blueprint's timeline, inked in as its stop is read. */
  .mini-timeline { position: relative; display: flex; justify-content: space-between; margin: 0.2rem 0 0.9rem; padding-top: 0.9rem; font-size: 0.8125rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .mini-timeline::before, .mini-line { content: ""; position: absolute; top: 0.3rem; left: 0; right: 0; height: 1px; background: var(--hairline); }
  .mini-line { height: 2px; background: var(--blueprint); transform-origin: left; transform: scaleX(var(--fill, 0)); }
  .mini-year { position: relative; }
  .mini-year::before { content: ""; position: absolute; top: -0.78rem; left: 0; width: 0.45rem; height: 0.45rem; border-radius: 50%; border: 1.5px solid var(--blueprint); background: var(--paper); }
  .mini-year:last-child::before { left: auto; right: 0; }

  /* Header: translucent over the garden, with a second row naming the stop. */
  :root[data-journey="true"] .masthead { background: color-mix(in srgb, var(--paper) 78%, transparent); backdrop-filter: blur(12px); }
  .journey-bar { order: 3; flex-basis: 100%; display: flex; align-items: center; justify-content: space-between; min-height: 2rem; margin-top: -0.35rem; font-size: 0.8125rem; letter-spacing: 0.06em; color: var(--muted); }
  .journey-label { text-transform: uppercase; }
  .journey-toast { display: none; color: var(--ink); }
  .journey-bar.toasting .journey-label { display: none; }
  .journey-bar.toasting .journey-toast { display: block; }

  /* The sheet. */
  .sheet {
    position: fixed; inset: auto 0 0; width: 100%; max-width: none; max-height: calc(100% - 3rem); margin: 0; padding: 0;
    border: 1px solid var(--hairline); border-bottom: 0; border-radius: 1.1rem 1.1rem 0 0;
    background: var(--paper); color: var(--ink);
    transform: translateY(var(--drag, 0px)); transition: transform 0.2s var(--ease);
  }
  .sheet[open] { display: flex; flex-direction: column; animation: sheet-up 0.28s var(--ease); }
  .sheet.closing { animation: sheet-down 0.22s ease-in forwards; }
  @keyframes sheet-up { from { transform: translateY(100%); } }
  @keyframes sheet-down { to { transform: translateY(100%); } }
  .sheet::backdrop { background: rgb(6 22 38 / 0.55); }
  .sheet-head { position: relative; display: flex; align-items: center; gap: 0.75rem; padding: 1.1rem 0.75rem 0.5rem 1.25rem; touch-action: none; cursor: grab; }
  .sheet-handle { position: absolute; top: 0.45rem; left: 50%; width: 2.5rem; height: 0.3rem; margin-left: -1.25rem; border-radius: 999px; background: var(--hairline); }
  .sheet-head h2 { flex: 1; font-size: 1.5rem; font-weight: 550; line-height: 1.15; }
  .sheet-close { flex: none; width: 2.75rem; height: 2.75rem; border: 1px solid var(--hairline); border-radius: 50%; background: none; font-size: 1.4rem; line-height: 1; cursor: pointer; }
  .sheet-body { overflow: auto; overscroll-behavior: contain; padding: 0.25rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom)); font-size: 1.0625rem; }
  .sheet-body p { max-width: 65ch; }
  .sheet-body h4 { font-size: 1.125rem; font-weight: 650; margin: 1.5rem 0 0.35rem; }
  .sheet-body .reading-proof { margin-top: 1.5rem; }
  .sheet-body .note-widget[data-contact-read] { max-width: none; margin: 0; padding: 0; border: 0; }
  .sheet-body .note-widget[data-contact-read] h3 { display: none; }
  .sheet-body .note-widget[data-contact-read] .note-label { position: static; width: auto; height: auto; clip-path: none; }

  @media (prefers-reduced-motion: reduce) {
    :root[data-journey="true"] .stop-card { opacity: 1; transform: none; }
    .journey-edge { display: none; }
  }
}
```

- [ ] **Step 6: Wire the journey into `src/main.ts`**

(a) Add to the imports:

```ts
import { createPhoneJourney } from "./phone";
```

(b) Directly after `const announce = (text: string) => ($("#announce").textContent = text);`, add:

```ts
/* Phones in portrait get the garden journey over the reading page. */
const phoneQuery = matchMedia("(max-width: 899px) and (min-height: 500px)");
const journey = createPhoneJourney({ onStop: () => {} });
```

(c) In `syncPresentation()`, directly after `root.dataset.view = reading ? "read" : "garden";`, add:

```ts
  journey.setActive(reading && phoneQuery.matches && !requestedView);
```

(d) In `measure()`, the reading branch currently picks the last section in array order whose top has passed the threshold. The journey moves `#about` before `#work`, so pick the section nearest the threshold instead. Replace:

```ts
    let current: SectionId = "intro";
    for (const id of sections) {
      const section = $("#" + id);
      const threshold = Math.max(innerHeight * 0.35, parseFloat(getComputedStyle(section).scrollMarginTop) || 0);
      if (section.getBoundingClientRect().top <= threshold + 1) current = id;
    }
```

with:

```ts
    // The section whose top most recently passed the threshold, whatever the DOM order.
    let current: SectionId = "intro";
    let best = -Infinity;
    for (const id of sections) {
      const section = $("#" + id);
      const threshold = Math.max(innerHeight * 0.35, parseFloat(getComputedStyle(section).scrollMarginTop) || 0);
      const top = section.getBoundingClientRect().top;
      if (top <= threshold + 1 && top > best) { best = top; current = id; }
    }
```

(e) Directly after the `compact.addEventListener("change", () => { … });` block, add:

```ts
phoneQuery.addEventListener("change", () => {
  const section = navigation.section;
  syncPresentation();
  navigation.go(section, false, false);
});
```

- [ ] **Step 7: Run the new tests**

Run: `npx tsc --noEmit && npm run build && PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="phone journey|landscape|More opens|rotating|deep link|first still|200%" tests/portfolio.test.mjs`
Expected: all PASS.

- [ ] **Step 8: Run the whole suite**

Run: `PLAYWRIGHT_CHANNEL=chrome npm test`
Expected: all PASS. The `compact garden preview` test still passes, because `?view=garden` turns the journey off in this task.

- [ ] **Step 9: Look at it**

Open `/private/tmp/notebook-qa/journey-390x844.png` and `sheet-390x844.png`, and take extra screenshots at `#about`, `#work`, `#whisperbook` and `#contact`. Check:
- the card sits at the foot over the still;
- the Blueprint timeline is inked part-way;
- the header shows the stop label;
- the sheet shows its title, handle and close button.

- [ ] **Step 10: Commit**

```bash
git add src/sheet.ts src/phone.ts src/phone.css src/main.ts tests/portfolio.test.mjs
git commit -m "add,journey, phone garden journey with stills, cards and a details sheet"
```

---

### Task 5: Ambient motion and the pause button

**Files:**
- Modify: `src/phone.ts` (pause button, clouds, leaves, `setMotion`, `onTogglePause`)
- Modify: `src/phone.css` (clouds, leaves, pause button, reduced motion)
- Modify: `src/main.ts` (pass `onTogglePause`, call `journey.setMotion` from `syncMotion`)
- Test: `tests/portfolio.test.mjs`

**Interfaces:**
- Consumes: `motionButton` (`#motion-toggle`) and `syncMotion()` in `main.ts`
- Produces:
  - `JourneyOptions.onTogglePause: () => void`;
  - `Journey.setMotion(stopped: boolean, systemReduced: boolean): void`;
  - a header button named "Pause motion" / "Resume motion" / "Motion paused by your system preference", with `aria-pressed`.

- [ ] **Step 1: Write the failing test**

Add to `tests/portfolio.test.mjs`:

```js
test('phone motion pauses from the header, and reduced motion keeps the journey still', async () => {
  const running = p => p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'contact');
    await p.waitForTimeout(600);
    assert.ok(await running(p) > 0, 'clouds drift and leaves fall in Bloom');
    await p.getByRole('button',{name:'Pause motion',exact:true}).click();
    assert.equal(await running(p), 0);
    assert.equal(await p.getByRole('button',{name:'Resume motion',exact:true}).getAttribute('aria-pressed'),'true');
    healthy(p);
  } finally { await p.context().close(); }
  const r = await page({viewport:{width:390,height:844}, reducedMotion:'reduce'});
  try {
    await ready(r);
    await go(r,'wattch');
    assert.equal(await running(r), 0);
    const wipes = await r.locator('.journey-still').evaluateAll(es=>es.map(e=>getComputedStyle(e).getPropertyValue('--wipe').trim()));
    assert.ok(wipes.every(w=>w==='0.000'||w==='1.000'), wipes.join());
    const more = r.getByRole('button',{name:'More about Wattch Core',exact:true});
    await more.click();
    assert.equal(await r.locator('dialog.sheet').evaluate(d=>d.open), true);
    await r.keyboard.press('Escape');
    assert.equal(await r.locator('dialog.sheet').evaluate(d=>d.open), false, 'closes at once');
    assert.equal(await more.evaluate(e=>e===document.activeElement), true);
    healthy(r);
  } finally { await r.context().close(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="phone motion" tests/portfolio.test.mjs`
Expected: FAIL. With no ambient layer on phones, the first assertion fails (`clouds drift and leaves fall in Bloom`), or no "Pause motion" button is found.

- [ ] **Step 3: Add the ambient layers and the pause button to `src/phone.ts`**

(a) Extend the options and the returned type:

```ts
export type JourneyOptions = {
  /** The visitor reached a new stop. */
  onStop: (stop: Stop) => void;
  /** The header's pause button was pressed. */
  onTogglePause: () => void;
};
```

and add to `Journey`:

```ts
  /** Shows the motion state on the header's pause button. */
  setMotion: (stopped: boolean, systemReduced: boolean) => void;
```

(b) Above `export function createPhoneJourney`, add:

```ts
// Outlined like the sketched clouds on the desktop sky.
const cloud = `<svg viewBox="0 0 120 50" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 44h94c9 0 13-7 10-13-2-5-8-7-13-5 0-10-9-16-18-13-4-9-15-13-24-9-7 3-11 10-10 17-6-3-15 0-17 7-8-1-14 4-13 10 1 4 5 6 11 6z"/></svg>`;
```

(c) Replace the `layer.innerHTML = …` line with:

```ts
  layer.innerHTML = `${stops.map((s) => `<img class="journey-still" data-still="${s.name}" alt="" decoding="async" />`).join("")}<span class="journey-edge"></span>
    <div class="journey-clouds">${cloud}${cloud}</div>
    <div class="journey-leaves">${Array.from({ length: 10 }, (_, i) => `<i style="--n:${i}"></i>`).join("")}</div>`;
```

(d) Replace the `bar.innerHTML = …` line, and add the pause wiring below `const toast = …`:

```ts
  bar.innerHTML = `<span class="journey-label"></span><span class="journey-toast" role="status"></span><button type="button" class="journey-pause" aria-pressed="false" aria-label="Pause motion" title="Pause motion"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-pause" d="M8 5.5v13M16 5.5v13"/><path class="icon-play" d="M8 5.5v13l10-6.5Z"/></svg></button>`;
```

```ts
  const pause = bar.querySelector<HTMLButtonElement>(".journey-pause")!;
  pause.addEventListener("click", () => options.onTogglePause());
  function setMotion(stopped: boolean, systemReduced: boolean) {
    const name = systemReduced ? "Motion paused by your system preference" : stopped ? "Resume motion" : "Pause motion";
    pause.setAttribute("aria-pressed", String(stopped));
    pause.setAttribute("aria-label", name);
    pause.title = name;
    pause.disabled = systemReduced;
  }
```

(e) Add `setMotion,` to the returned object, after `notify,`.

- [ ] **Step 4: Style them in `src/phone.css`**

Inside `@media screen { … }`, before the nested `@media (prefers-reduced-motion: reduce)` block, add:

```css
  /* Ambient motion: two sketched clouds, and leaves falling in Bloom. Paused
     with the rest of the page, and off with reduced motion. */
  .journey-clouds { position: absolute; inset: 0 0 auto; height: 45%; z-index: 3; color: rgb(230 240 248 / 0.4); }
  .journey-clouds svg { position: absolute; top: 16%; width: 8.5rem; height: auto; animation: cloud-drift 80s linear infinite -25s; }
  .journey-clouds svg + svg { top: 30%; width: 6rem; animation-duration: 110s; animation-delay: -70s; }
  @keyframes cloud-drift { from { transform: translateX(-10rem); } to { transform: translateX(calc(100vw + 1rem)); } }
  .journey-leaves { position: absolute; inset: 0; z-index: 3; opacity: 0; transition: opacity 0.8s ease; }
  .journey[data-at="bloom"] .journey-leaves { opacity: 1; }
  .journey-leaves i {
    position: absolute; top: -3%; left: calc(var(--n) * 9.5% + 3%); width: 0.5rem; height: 0.32rem;
    border-radius: 60% 0; background: #d98a3a;
    animation: leaf-fall calc(9s + var(--n) * 0.7s) linear infinite; animation-delay: calc(var(--n) * -1.9s);
  }
  .journey-leaves i:nth-child(3n) { background: #c4572e; }
  .journey-leaves i:nth-child(4n) { background: #e8b84a; }
  .journey:not([data-at="bloom"]) .journey-leaves i { animation-play-state: paused; }
  @keyframes leaf-fall { to { transform: translate(-3rem, 72vh) rotate(540deg); } }
  .journey-pause { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; margin: -0.4rem -0.6rem -0.4rem 0; border: 0; background: none; color: var(--ink); cursor: pointer; }
  .journey-pause:disabled { color: var(--muted); cursor: default; }
  .journey-pause svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
  .journey-pause .icon-play { display: none; }
  .journey-pause[aria-pressed="true"] .icon-pause { display: none; }
  .journey-pause[aria-pressed="true"] .icon-play { display: inline; fill: currentColor; }
```

and extend the nested reduced-motion block to:

```css
  @media (prefers-reduced-motion: reduce) {
    :root[data-journey="true"] .stop-card { opacity: 1; transform: none; }
    .journey-edge, .journey-clouds, .journey-leaves { display: none; }
  }
```

- [ ] **Step 5: Wire pause in `src/main.ts`**

Change the journey creation to:

```ts
const journey = createPhoneJourney({
  onStop: () => {},
  // The journey's own button stands in for the ruler's, which phones don't show.
  onTogglePause: () => motionButton.click(),
});
```

In `syncMotion()`, after `motionButton.setAttribute("aria-label", motionButton.title);`, add:

```ts
  journey.setMotion(stopped, reduced);
```

- [ ] **Step 6: Run the motion test, then the suite**

Run: `npx tsc --noEmit && npm run build && PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="phone motion" tests/portfolio.test.mjs && PLAYWRIGHT_CHANNEL=chrome npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/phone.ts src/phone.css src/main.ts tests/portfolio.test.mjs
git commit -m "add,journey, ambient clouds and leaves with a header pause button"
```

---

### Task 6: The live garden behind the sprout

**Files:**
- Modify: `src/main.ts`:
  - the journey `onStop`;
  - a new `driveLive`;
  - `syncPresentation`;
  - the `[data-view]` click handler;
  - `frameGarden`;
  - `loadGarden` (the reading branch, the failure path and context loss).
- Modify: `src/phone.css` (live garden layer rules)
- Test: `tests/portfolio.test.mjs` (replace the `compact garden preview…` test)

**Interfaces:**
- Consumes:
  - `journey.layer`, `journey.stop`, `journey.active` and `journey.notify` (Task 4);
  - `stageProgress` (content).
- Produces: `?view=garden` on a portrait phone keeps the journey and shows the live garden in `.journey`. Closing removes `view` from the URL.

- [ ] **Step 1: Write the failing test**

Replace the whole `test('compact garden preview, view history and keyboard stage controls stay in document flow', …)` with:

```js
test('on phones the sprout swaps the stills for the live garden, which follows the stops', async () => {
  const p=await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await p.locator('.view-switch').click();
    await p.waitForFunction(()=>!!document.querySelector('.journey #scene canvas'));
    assert.equal(await p.locator('html').getAttribute('data-journey'),'true');
    assert.equal(await p.locator('#stage').isVisible(),true);
    assert.equal(await p.locator('.journey-still[data-still="sketch"]').isVisible(),false);
    assert.match(p.url(),/view=garden/);
    await p.locator('.view-switch').click();
    assert.equal(await p.locator('#stage').isVisible(),false);
    assert.doesNotMatch(p.url(),/view=/);
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.locator('#stage').isVisible(),true);
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.locator('#stage').isVisible(),false);
    await p.locator('.view-switch').click();
    await go(p,'wattch');
    await p.waitForTimeout(500);
    assert.equal(await p.locator('#scrub').inputValue(),'660');
    healthy(p);
  } finally {await p.context().close();}
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build && PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="sprout swaps" tests/portfolio.test.mjs`
Expected: FAIL: `waitForFunction` times out, because `.journey #scene canvas` never exists (the garden goes into the reading preview frame).

- [ ] **Step 3: Drive the live garden from the stops**

In `src/main.ts`, change `onStop: () => {},` to:

```ts
  onStop: (stop) => { if (previewEnabled) driveLive(stop); },
```

Add after `function frameGarden() …`:

```ts
/* In the journey the live garden shows each stop as its still does. */
function driveLive(stop: Stop) {
  const growth = stageProgress[stop.stage];
  scrub.value = String(Math.round(growth * 1000));
  garden?.setProgress(growth, reduced || paused);
  sky?.setGrowth(growth);
  garden?.focus(stop.spot, 0, 0);
}
```

Add `type Stop` to the existing `./content` import: `…, type Spot, type WidgetSpot, type Stop } from "./content";`.

Replace `function frameGarden() { garden?.frame(reading ? 0.04 : 0.08, reading ? 0.96 : 0.95); }` with:

```ts
function frameGarden() {
  // In the journey the garden sits where the stills have it, above the cards.
  if (journey.active) garden?.frame(0.06, 0.58);
  else garden?.frame(reading ? 0.04 : 0.08, reading ? 0.96 : 0.95);
}
```

- [ ] **Step 4: Keep the journey while the garden is live**

In `syncPresentation()`:

(a) Replace `journey.setActive(reading && phoneQuery.matches && !requestedView);` with:

```ts
  const journeyOn = reading && phoneQuery.matches && requestedView !== "read";
  journey.setActive(journeyOn);
```

(b) Replace `(reading ? $("#preview-frame") : $("#experience")).prepend(stageElement);` with:

```ts
  (journeyOn ? journey.layer : reading ? $("#preview-frame") : $("#experience")).prepend(stageElement);
```

(c) Replace the block

```ts
  if (reading && previewEnabled) {
    garden?.setProgress(1, reduced || paused); garden?.focus(null); sky?.setGrowth(1);
```

so that it begins:

```ts
  if (reading && previewEnabled && journeyOn) driveLive(journey.stop);
  else if (reading && previewEnabled) {
    garden?.setProgress(1, reduced || paused); garden?.focus(null); sky?.setGrowth(1);
```

(the rest of that block is unchanged).

- [ ] **Step 5: Close the live garden back to the journey**

In the `$$<HTMLAnchorElement>("[data-view]").forEach(a => a.addEventListener("click", e => { … }))` handler, replace:

```ts
  requestedView = a.dataset.view!;
  previewEnabled = compact.matches && previewEnabled && a.classList.contains("view-switch") ? false : requestedView === "garden";
  const url = new URL(location.href);
  url.searchParams.set("view", compact.matches && !previewEnabled ? "read" : requestedView);
```

with:

```ts
  const closingInJourney = journey.active && previewEnabled && a.classList.contains("view-switch");
  requestedView = a.dataset.view!;
  previewEnabled = compact.matches && previewEnabled && a.classList.contains("view-switch") ? false : requestedView === "garden";
  // On a compact screen, closing the garden returns to the journey there,
  // otherwise to the reading page.
  if (compact.matches && !previewEnabled) requestedView = closingInJourney ? null : "read";
  const url = new URL(location.href);
  if (requestedView) url.searchParams.set("view", requestedView);
  else url.searchParams.delete("view");
```

- [ ] **Step 6: Start and fail in the journey**

In `loadGarden()`:

(a) Replace `if (reading) { garden.setProgress(1, reduced || paused); sky.setGrowth(1); }` with:

```ts
    if (journey.active) driveLive(journey.stop);
    else if (reading) { garden.setProgress(1, reduced || paused); sky.setGrowth(1); }
```

(b) In the `garden-context-lost` listener, add as its first line:

```ts
      if (journey.active) { previewEnabled = false; syncPresentation(); journey.notify("The live garden’s graphics were lost."); }
```

(c) At the end of the `.catch(error => { … })` body, before its closing `});`, add:

```ts
    if (journey.active) { previewEnabled = false; syncPresentation(); journey.notify("The live garden can’t be drawn in this browser."); }
```

- [ ] **Step 7: Place the live garden in the layer (`src/phone.css`)**

Inside `@media screen { … }`, after the `.journey[data-wiping] .journey-edge` rule, add:

```css
  /* The live garden, when the sprout asks for it, replaces the stills. */
  .journey .stage { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
  .journey .scene-fallback, .journey .hotspot { display: none; }
  :root[data-preview="true"] .journey-still,
  :root[data-preview="true"] .journey-clouds,
  :root[data-preview="true"] .journey-leaves,
  :root[data-preview="true"] .journey-edge { visibility: hidden; }
```

- [ ] **Step 8: Run the test, then the suite**

Run: `npx tsc --noEmit && npm run build && PLAYWRIGHT_CHANNEL=chrome node --test --test-name-pattern="sprout swaps" tests/portfolio.test.mjs && PLAYWRIGHT_CHANNEL=chrome npm test`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/main.ts src/phone.css tests/portfolio.test.mjs
git commit -m "add,journey, the sprout brings the live garden into the phone journey"
```

---

### Task 7: Verify on screen, check the edge cases, document

**Files:**
- Modify: `README.md` (first paragraph and "Navigation and reading")
- No source changes unless a check below fails. Fix in the owning file, re-run the suite, and include the fix in this commit.

- [ ] **Step 1: Full suite from a clean build**

Run: `npx tsc --noEmit && npm run build && PLAYWRIGHT_CHANNEL=chrome npm test`
Expected: all PASS. Record the count.

- [ ] **Step 2: Walk the journey on screen**

With the 5199 preview running, write a throwaway Playwright script in the scratchpad (not the repo) at iPhone 13 (390 × 844, DPR 2). It should screenshot:
1. the first screen;
2. mid-wipe between Sketch and Blueprint (scroll to `#about`'s top minus 0.7 × innerHeight);
3. each stop after `go`;
4. each sheet open;
5. the live garden at Wattch;
6. 320 × 568 at Sketch and Bloom.

Read every image. Check:
- cards never cover the header;
- the wipe's pencil line is visible mid-wipe;
- there is no seam where the still's foot fades into the paper;
- text in cards is legible over every still.

- [ ] **Step 3: Night-time visit (Review Focus 4)**

In the same script, before navigation, call `await page.clock.setFixedTime(new Date('2026-10-02T22:30:00'))` in a fresh context. Screenshot Sketch and Bloom. The paper is dark there: check that the header and the stills' faded foot still read as intentional. If there's a hard seam, raise the fade in `.journey-still`'s second mask gradient (e.g. `#000 60%, transparent 90%`), rebuild and re-check.

- [ ] **Step 4: Slow connection (Review Focus 5)**

In a fresh context, delay stills by 3 s: `await page.route('**/assets/stills/**', async r => { await new Promise(f => setTimeout(f, 3000)); await r.continue(); })`. Screenshot at 500 ms. The card must read cleanly on plain paper, with no broken-image icon. Screenshot again at 3.5 s: the still appears.

- [ ] **Step 5: Update the README**

In `README.md`, replace the sentence `Below 900 px wide or 600 px high, the portfolio uses normal document flow. **Explore garden** adds an interactive preview in a bounded frame.` with:

```markdown
Phones in portrait (below 900 px wide, at least 500 px high) get the garden journey: short cards over stills of the garden that wipe from Sketch to Bloom as you scroll, with each section's details in a bottom sheet (**More**, or **Leave a note**). The sprout swaps the stills for the live garden, which follows the same stops. Landscape phones, short windows and **Read as a page** (`?view=read`) use normal document flow.
```

In "Navigation and reading", after the paragraph beginning `Explicit view choices use`, add:

```markdown
The journey (`src/phone.ts`, `src/sheet.ts`, `src/phone.css`) is laid over the reading page rather than replacing it: each stop is a section marked `data-stop`, and the nodes marked `data-detail` move into the sheet and back, keeping the contact draft and any playing voice. The six stills in `public/assets/stills/` are captured from the real garden by `npm run stills` (dev server on port 5198; needs `cwebp`), within a 100 KB-each, 600 KB-total budget. A phone fetches the current still and one ahead. Clouds and leaves are CSS animation, paused by the header's pause button and absent with reduced motion, where wipes also cut instead of sweeping.
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "update,docs, describe the phone garden journey"
```
