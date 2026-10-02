# The garden journey on phones

Date: 2026-10-02
Status: approach and journey approved in chat; awaiting spec review

## Problem

On phones the portfolio is a long text page. The desktop's identity (the garden growing from Sketch to Bloom) is absent, and nothing moves.

## Goal

Phones get their own experience: the garden journey, told with short cards over animated stills of the real garden. Full details stay one tap away in a bottom sheet.

- Desktop (≥ 900 px wide) is unchanged.
- No new factual claims. Card copy is existing copy or a direct trim of it.
- The semantic reading page stays the base: no-JS, print, fragments and landscape phones keep it.
- Motion respects reduced motion and the pause control. It stays light on battery and data.

## 1. When the journey runs

- Condition: JavaScript enhanced, `(max-width: 899px) and (min-height: 500px)`, and no `?view=read` in the URL.
- Landscape phones (e.g. 844 × 390) and `?view=read` keep today's reading page.
- `root.dataset.view` stays `"read"`, and the journey adds `root.dataset.journey = "true"`. The existing reading logic (navigation, contact draft, evidence dialog, illustrations) keeps working underneath.
- Leaving the condition (rotation, resize) tears the journey down and restores the reading page in place, including its DOM order (see §3).

## 2. Stops and copy

| # | Section | Stage | Still | Card |
|---|---|---|---|---|
| 1 | `#intro` | Sketch | `sketch`: whole garden, pencil lines | Name (letter reveal). "Product engineer, Ph.D. AI products, developer tools, and how we measure the energy software uses." |
| 2 | `#about` | Blueprint | `blueprint`: blueprint ink, camera on the tower (`focus("about")`) | "I start with the question", plus a mini timeline 2014 · 2018 · 2022 · 2024–now whose line fills as the stop scrolls |
| 3 | `#work` | Build | `build`: whole garden in build materials | "The boundaries matter". "An offline promise should be enforced by the app. An energy claim should lead back to its source data." |
| 4 | `#whisperbook` | Build | `whisperbook`: camera on the reading pavilion | *Local AI on Android*. **Whisperbook**. "A book can stay yours, even when it speaks." |
| 5 | `#wattch` | Build | `wattch`: camera on the observatory | *Systems and energy*. **Wattch Core**. "Know what you measured before you optimize it." |
| 6 | `#contact` | Bloom | `bloom`: whole garden in full colour | "Write to me", the email large, GitHub · LinkedIn, **Leave a note** |

Each card except Sketch has **More** (Bloom: **Leave a note**), which opens that section's sheet (§5).

- Sheet contents:
  - About: the question paragraph and the full career list.
  - Work: the opener paragraph.
  - Each project: intro, What I built, The decision, screenshot, browser illustration, GitHub link.
  - Contact: the note widget.
- The Sketch card also has the two existing actions: **Selected work** (to stop 3) and a quiet **Read as a page** link (`?view=read`).

## 3. Structure (`src/phone.ts`, `src/phone.css`, `src/render.ts`)

- `render.ts` adds, inside each stop's section:
  - a `.stop-card` block (hidden outside the journey), holding the card copy above;
  - a `.stop-detail` wrapper around the content that moves into the sheet.
- Outside the journey, `.stop-detail` renders as today and `.stop-card` is `display: none`. No-JS and print are unchanged.
- `src/phone.ts` (new) owns the journey: activation, still layer, stop measurement, wipes, card reveals, the stage label, and teardown. `main.ts` calls `createPhoneJourney({...})` once and passes callbacks for pause and the live garden (§6).
- `src/phone.css` (new) is imported by `phone.ts`, so it only loads with JavaScript. Every rule is scoped under `:root[data-journey="true"]`.
- DOM order: the journey needs intro → about → work → contact. `phone.ts` moves `#about` before `#work` on activation and back on teardown, so tab order matches what is seen.
- Each stop is a section at least `100svh` tall. Its card is sticky at the bottom of the viewport while the stop is in view. The garden layer is `position: fixed` behind everything.
- The reading page's static `garden-preview` image gets `loading="lazy"`. It is hidden in the journey, so phones don't download it.

## 4. The stills and motion

### Producing the stills (`scripts/capture-stills.mjs`)

- In development only, `main.ts` exposes `window.__notebook = { garden }` (`import.meta.env.DEV`).
- The script loads the dev server at 900 × 1300 (garden view) with fixed conditions: hour 13, autumn, clear weather, motion paused, chrome hidden. For each still it calls `setProgress(stageProgress[s], true)`, `focus(spot)` and `frame(0.06, 0.58)`, waits for the camera to settle, and screenshots the stage plus both sky layers.
- The script then crops to a 390 × 844 portrait at 2× and encodes with `cwebp -q 70` into `public/assets/stills/<name>.webp`.
- Budget: ≤ 100 KB per still, ≤ 600 KB for all six. The script prints sizes and fails above budget.
- Stills are committed. The script is re-run by hand when the garden changes.

### In the page

- The still layer holds six `<img>` elements with `data-src`, created by `phone.ts`. The first still loads immediately. Each next still loads when its predecessor's stop is reached, so at most one still is fetched ahead.
- The page background in the journey is fixed to the stills' sky colour at the bottom edge, so cards and stills meet without a seam.
- **Wipe between stops.** Scroll progress across the gap between two stops sets `--wipe` (0–1). The next still is revealed bottom-up through a soft-edged mask, with a thin bright pencil line riding the edge.
- **Drift.** While a stop holds, its still scales 1 → 1.04, linked to scroll rather than time.
- **Cards** slide up 24 px and fade in when they enter, via IntersectionObserver plus a class and CSS transition.
- **Blueprint timeline** fills with scroll.
- **Name** reveals letter by letter on load.
- **Ambient, time-based motion:** two clouds drift across the sky, and leaves fall in Bloom. This is CSS animation only.
- **Pause and reduced motion.** The existing `data-motion-paused` rule pauses all CSS animations. Reduced motion removes the ambient layer and the card transitions, and the wipe becomes a cut at its midpoint. Scroll-linked effects are visitor-driven and stay.

### Header

- Row 1 is today's slim header: name, Work · About · Contact, and the sprout.
- Row 2 is 32 px tall. It shows the current stop's stage label on the left, e.g. "Build · Whisperbook", and a 44 px **Pause motion / Resume motion** button on the right.
- The reading ruler sits under row 2 as today, with its marks on the stops.

## 5. The sheet (`src/sheet.ts`)

- One shared `<dialog class="sheet">` opened with `showModal()`.
  - Header: a drag handle, the section title as `h2`, and a close button.
  - Body: scrolls on its own and holds the moved `.stop-detail` node.
- **Opening:** moves the node in. It slides up over 280 ms (instant with reduced motion). The garden behind dims.
- **Closing:**
  - Triggers: the close button, Escape, a backdrop tap, or dragging the header down past 25 % of the sheet's height or with a fast flick.
  - It slides down, returns the node to its section, and restores focus to the button that opened it.
- Moving nodes keeps live state: the contact draft, a playing voice, an open illustration.
- Closing does not stop narration. The player's own controls do.
- The evidence dialog can open above the sheet, and dismissing it returns focus inside the sheet.
- No history entry. Back is not used to close the sheet.

## 6. The live garden (sprout)

- In the journey, the sprout loads the WebGL garden into the fixed layer in place of the stills.
- As stops change, `phone.ts` calls back to `main.ts`, which drives the live garden with the same mapping as the stills: `setProgress`, then `focus` (whisperbook, wattch, about or null).
- Tapping again (now a ✕) disposes nothing, hides the canvas, shows the stills and pauses the garden.
- The quality is the existing compact `low`.
- WebGL failure or context loss shows the stills, with the existing fallback message as a toast.

## 7. Tests (`tests/portfolio.test.mjs`)

- **390 × 844, 375 × 667, 320 × 568** replace today's reading checks:
  - `data-journey="true"`, no WebGL canvas, the first still loaded.
  - The header does not cover the name, no clipped header links, no horizontal overflow.
  - `go('contact')`, then **Leave a note** opens the sheet. Typing works, Escape closes it, the draft survives, and focus is back on the button.
- **844 × 390** stays a reading-page test (`data-journey` absent).
- **Sheet:** Whisperbook's **More** shows the screenshot and the GitHub link. Closing returns `.stop-detail` into `#whisperbook`.
- **Motion:**
  - With reduced motion, no running animations.
  - The header pause button stops every running animation and its label flips.
  - Wipes cut instead of animating.
- **Live garden:** replaces the compact preview test. The sprout creates `#scene canvas` in the fixed layer and hides the stills. Going to `#wattch` focuses it, and the sprout again restores the stills.
- **Budget:**
  - Stills on disk total ≤ 600 KB.
  - A 390 × 844 load fetches only the first still and at most one ahead before scrolling.
  - It does not fetch `garden-preview.png`.
- **200 % text:** no overflow. Cards grow, and the sheet stays within the viewport.
- No-JS, print, desktop and landscape tests are unchanged.

## Out of scope

Desktop changes, a carbon readout in the phone header, landscape journeys, history entries for the sheet, new copy beyond the trims above.
