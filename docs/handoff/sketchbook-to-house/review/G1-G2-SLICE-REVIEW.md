# G1 and G2 review pack: motion study and release-1 slice

Prepared 2 November 2026 on branch `feat/sketchbook-house-narrative` (not pushed, not deployed). This is the user's review material for the two decision gates in [PROGRESS.md](../PROGRESS.md). Nothing below is a claim that the gates have passed.

## What was built this session

| Phase | Result | Review |
| --- | --- | --- |
| P0 baseline | [baseline/BASELINE.md](../baseline/BASELINE.md): build, tests, 28 captures, SwiftShader performance refresh, CV audit, six-image inventory | clean after one fix round |
| P1 motion study | [motion-study/P1-MOTION-STUDY.md](../motion-study/P1-MOTION-STUDY.md): outcome **(a)**, global growth plus named focus is legible in both hosts; scene adapter (`src/narrative/scene-adapter.ts`) with proven snap / hold / settle primitives; dev-only study page `dev/motion-study.html` | clean after one fix round (BP Log cue) |
| P2 shell | one semantic eight-chapter document from one chapter model; contract copy verbatim; release-1 destinations only; reserved scene hosts; one sticky rail on wide layouts; FR/AR drafts of every new string | clean after one fix round |
| P2 CVs | EN/FR short CVs corrected to the content contract, PDFs rebuilt (`npm run resume:pdf`), every page inspected | clean after one fix round |
| P3 layout and navigation | responsive contract, reading controller, navigation with history and cancellation, retained cases with Return paths and text-first images, 23 browser tests | clean after one fix round |
| P4 scene | one live renderer following the reading; holds draw 0 house and sky frames; motion / stills / sound controls; planting, postcard and fennec visits removed; retired controller deleted; 22 lifecycle tests | clean after one fix round |

The whole-branch review result is recorded in PROGRESS.md and the session ledger once it lands.

## How to look at it

```bash
npm ci
SITE_ORIGIN=https://chakib-belgaid.github.io npm run build
npm run preview -- --port 5199 --strictPort
```

Open `http://127.0.0.1:5199/` at a wide window and in a phone emulation at 390×844. Then `/#whisperbook`, `/#contact` (deep links: the right poster, then the right pose, no sketch flash), `/?lang=fr`, `/?lang=ar`, `/?view=stills` (no live scene), and the case round trip: Whisperbook chapter → "Existing Android case" → `/work/whispbook/` → "Return to the portfolio".

The motion study (G1) runs from the dev server: `npx vite --config dev/vite.study.config.ts --port 5311`, then `http://127.0.0.1:5311/dev/motion-study.html`.

## G1: motion study evidence

- Stills of every chapter in both hosts: `.qa/p1/stills/`; recordings `.qa/p1/video/wide.webm`, `portrait.webm` (the BP Log frames in the recordings predate the cue fix; `.qa/p1/stills/*-bplog.png` are current).
- Measurements: `.qa/p1/measurements.json` — holds draw 0 frames over 10 s at Build and Bloom in both hosts; direct jumps draw in 1 frame; eased settles 1.7–2.9 s on SwiftShader; after `snapTo` the next change still eases (no reduced flag persisted).
- Decision recorded: outcome (a). A group-reveal manifest is not needed; estimated 1.5–2 days if wanted later.

## G2: release-1 slice evidence (production build, actual scene)

- Chapter holds, both layouts: `.qa/p4/stills/{wide,portrait}-{intro,work,bplog,whisperbook,energy-tools,mcq-scan,about,contact}.png`.
- States: `.qa/p4/states/` — deep-link first paint and live at Contact (wide and portrait), reduced motion, failed renderer, context lost, 320 px controls in EN/FR/AR.
- Recordings with reading pauses and a direct jump to Contact: `.qa/p4/video/wide.webm`, `portrait.webm`; frame sheets `frames-wide.png`, `frames-portrait.png`.
- Case round trip and layout checks: `.qa/p3/` (entry, work, whisperbook, Android case EN/FR, after return, contact, 320 px, 1100 px, tablet, 400 % zoom, Arabic first viewport).
- Static shell checks: the P2 worktree's `.qa/p2/` (no-JS at both sizes, fragments, fr/ar).

Implementer self-assessment against ACCEPTANCE §1, confirmed by the reviewers from the captures: V1, V2, V3, V4, V6, V7, V8, V9 pass; **V5 partial** (BP Log's pavilion still dominates the frame, portrait About clips the house on the left, the real rail is a little tighter than the study rail); V10 not applicable yet (no product imagery on the homepage); V11 pass (role line, promise and CV link in the first viewport on desktop and at 390×844).

## Decisions the user should confirm or overturn

1. **Opening animation.** The pencil draw-in is skipped on every landing: the poster covers the pose until it is complete, so a 3.2 s draw-in would play under an opaque poster. The opening is poster → complete sketch. If you want the pencil animation back, P7 can replay a short draw-in after the reveal.
2. **Portrait slot is not sticky during transitions.** The README allows it ("may stick"); P4 plays the transition as the slot scrolls into view instead. The P1 study has a sticky prototype if you prefer it.
3. **Passive scroll eases to the nearest chapter cue** rather than interpolating the pose by scroll position (the plan says "may interpolate").
4. **One sticky rail on wide layouts**, hidden per-chapter hosts; without JavaScript the desktop shows only the sketch poster.
5. **All six missing case images are text-first** in EN and FR (provenance unresolved; two are byte-identical to the already shipped `whisperbook.webp` and `wattch.png`, which the ledger wrongly called different files — corrected in CONTENT_AND_EVIDENCE.md). The recovered copies sit under `.qa/baseline/recovered/` if you can confirm their builds.
6. **Arabic case links and CV.** Arabic visitors get the English case pages and an explicitly labeled English CV; returning from a case without storage drops `lang=ar`. Confirm Arabic stays a visible site language (default: yes).
7. **About's visual phase is Build** with the bloom held back for Contact.

## Open facts only you can settle (they block CV publication, not this branch)

See the "Release-1 issues to resolve" row for the CVs in PROGRESS.md: the "Led…" scope versus "coordinate a two-person team"; BP Log 10,123 parameters / "digits" versus the contract's 54 KB / "crops"; JouleHunter "created"; "Linux RAPL" versus powercap; Funecs and ENSI figures and the thesis date; the name form on the CV; AgentDiet "awarded"; the French role-line translation; the edition-date footer; Davidson Consulting omitted from the Ph.D. entry; PowerAPI in the skills line.

## Strings awaiting your review

PROGRESS.md "Strings awaiting the user's review" lists every new English string with its French and Arabic drafts (P2 shell, P3 Return link, P4 controls). French must be reviewed before publication; Arabic may ship marked as a draft under the recorded descoping order.

## Known gaps left for P7 (not blockers for this review)

- The phase posters are still the old blue-paper crops; the poster-to-live fade shows the style change until they are re-captured from the new poses (`scripts/capture-stills.mjs` is repointed, not run).
- V5 framing tuning (BP Log, portrait About, rail aspect).
- WebKit sound activation after a dynamic import (construct the AudioContext synchronously in the click handler).
- The retired browser suites (`portfolio`, `presentation`, `journey`, `lifecycle`, `localization`, `quality`) still target the old page; `npm test` is red until P7 migrates them. New suites: `narrative-model`, `translations`, `navigation`, `scene-lifecycle`.
- Performance baseline is SwiftShader-only; the accelerated rerun, real-device sessions and the budget protocol are P7.
- `public/llms.txt`, `llm.txt`, README, sitemap and the social preview image still describe the old site (P7/P8).

## Not done, by design

- No new case routes, no exploration mode, no "Explore the finished house" action (release 2).
- Breadth beyond the slice was done where the mechanism was identical (all eight chapters render, navigate and hold), but the G2 question stands as written: is the layout and motion contract right before it is polished eight times over?
- Nothing was pushed or deployed. A push to `main` deploys.
