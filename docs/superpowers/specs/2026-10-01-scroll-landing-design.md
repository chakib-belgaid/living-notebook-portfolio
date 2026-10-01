# The story as the landing page

Date: 2026-10-01
Status: design approved in chat, awaiting spec review

## Problem

Project details live in side panels that open over the garden. The visitor has to leave the scroll to read them. Bloom ends on "The garden is open", so contact details are one click and one panel away. The carbon footprint of the page is buried inside the Wattch widget.

## Goal

The page reads as one landing page that the visitor navigates by scrolling:

- A brief carbon-footprint summary of this page stays on the side the whole way.
- Build walks through each project in full, a few notes per project, just before Bloom.
- Bloom is the contact section: the email and a way to leave a note, shown clearly.
- The side panels are removed; buildings and nav links scroll the story instead.

No new factual claims. All text comes from the existing `projects`, beats, and About and Contact panel copy in `src/main.ts`.

## 1. Carbon card on the side (`src/main.ts`, `src/style.css`)

- A new dock widget, `widget-carbon`, first in the dock, `data-from="0"` (shown from Sketch on).
- Content, in the style of the stats on chakib-belgaid.github.io/live:
  - Figure, large: `0.42 g CO₂e` (or `Under 0.01 g CO₂e`).
  - Label: "This page's carbon footprint so far".
  - Source line, small and muted: "2.8 MB loaded · Sustainable Web Design model, world grid. Estimated, not measured."
- Without resource timing, the figure reads "—" and the source line reads "This browser does not report what the page has loaded."
- It updates on the existing 300 ms interval through `drawCarbon`, which writes to the figure and source line of every mounted carbon readout.
- The figure has `aria-live="off"`. The value is readable on demand but not announced every 300 ms.
- Narrow screens (< 900 px): the dock is a row along the bottom, and its widgets only show in Bloom (`data-from="3"`), because before Bloom that space belongs to the note. The carbon card follows the same rule there: `syncStory` treats its `data-from` as 3 while `narrow` matches. In Bloom it is the first card in the row, with the figure and label on one line and the source line below.
- The Wattch widget no longer shows the carbon lines. It keeps the sparkline, the CPU readout and "Measured live in your browser, like the dial in the observatory."

## 2. Build: the projects as notes (`src/main.ts`)

Build has 7 beats:

1. *Constraints decided early*: unchanged.
2. **Whisperbook**, `spot: "whisperbook"`, label "The reading pavilion": title, lede, intro, then the facts list (Field, Built with, Source: "Read it on GitHub"), then *Try it* with the player.
3. **Whisperbook**, `spot: "whisperbook"`: heading "What I built", `built` text.
4. **Whisperbook**, `spot: "whisperbook"`: heading "The decision that shaped it", `decision` text, the screenshot with its caption.
5–7. **Wattch Core**: the same three notes, `spot: "wattch"`, with the CPU meter as *Try it*.

The `Beat` type gains an optional `body` (HTML for the extra content) and `widget` (a `Spot` whose widget mounts in the note). The camera visits the building for every beat with that `spot`, as it does today.

### Widgets in notes

- One widget is mounted at a time, in the active note's `[data-widget]` slot, through the existing `mountProjectWidget`. When the active beat changes, the previous widget's cleanup runs first. This stops narration, which calls `setNarrating(false)`.
- The note stays one card, at most `calc(100svh - 11rem)` tall. Images are capped at 14rem tall on wide screens and 10rem on narrow ones (`object-fit: contain`), so a note never needs its own scroll.

## 3. Bloom: write to me (`src/main.ts`, `src/style.css`)

The Bloom beat becomes the contact note:

- Stage label: "Bloom · The greenhouse". Title: "Write to me".
- Copy: "For product engineering, applied AI, or energy-aware software."
- The email, large, as a `mailto:` link: chakib.belgaid@gmail.com.
- *Leave a note*: the existing `mountNote` widget (textarea with count, **Send by email**, **Copy address**, and "This opens your email app. Nothing is sent or stored by this page.").
- A last line with links: GitHub and LinkedIn.
- The postbox flag behaves as before: up while writing, a letter drops on send, and back to idle when the visitor scrolls away from Bloom.
- The note's position and the dock layout in Bloom stay as they are. The note is taller, so on narrow screens the garden inset for stage 3 grows to match. This is checked with screenshots.

## 4. Navigation without panels (`src/main.ts`, `src/style.css`)

- Removed: `#panel`, `panelHtml`, `openPanel`, `closePanel`, `mountPanelWidget`, the panel's previous and next links, the `.reading` state, the *Path* widget (`mountPath`) and every panel style.
- `[data-open]` now scrolls to a beat with the existing hold positions (`holdAt`), smoothly (instantly with reduced motion):
  - Work and the Whisperbook label: Whisperbook's first note.
  - The Wattch Core label: Wattch's first note.
  - About and the About me label: the Blueprint opener ("A question first, then a structure").
  - Contact and the Write to me label: Bloom.
- After scrolling, focus moves to that note's heading (`tabindex="-1"`), so keyboard and screen-reader users land on it.
- The Blueprint opener's copy gains the About panel's unique sentence: "I like following an idea all the way from a rough sketch to something people can use, and checking what is actually true along the way." It keeps its hint.
- `highlightPath` stays, driven by the career beats as today. Its About-panel hover use goes away with the widget.
- Escape no longer has a panel to close. The planting mode's Escape handling is unchanged.

## 5. Content and docs

- README: the "Rooms" and "Buildings are the navigation" bullets describe the scroll (projects in Build, contact in Bloom, the carbon card on the side) instead of panels.
- The 2026-10-01 rooms spec stays as a record. Its panel placement is superseded by this spec.

## Error handling

- No WebGL: the notes, widgets and carbon card still work. The Wattch widget shows its "Rendering is off" text, and building labels are hidden as today. Nav links still scroll.
- No `speechSynthesis` or local voice: the player behaves as today.
- No resource timing: see section 1.

## Verification

No test framework. Checks:

1. `npm run build` is clean.
2. Playwright screenshots at 1400 × 900 and 390 × 844 of every Build beat and of Bloom. Checks: no note is cut off or covers the dock, images fit, there is no horizontal overflow, and the carbon card shows from Sketch on wide screens.
3. Console has no errors while scrolling the whole story.
4. Scrolling from Whisperbook's first note to its second stops narration (`setNarrating(false)`). Typing in Bloom raises the flag. Send opens a `mailto:` link with the note encoded (checked by intercepting navigation).
5. Each nav link and building label scrolls to its beat and focuses the heading.

## Out of scope

- New projects or new copy beyond moving existing text.
- A contact form backend.
- Changes to the garden scene other than what the removed panels drove (focus behaviour stays beat-driven).
