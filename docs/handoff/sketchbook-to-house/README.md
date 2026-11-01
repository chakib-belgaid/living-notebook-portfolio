# Sketchbook → living house: implementation handoff

Prepared 1 November 2026 against source commit `453d26a8a8d26ef2785dc2e6a8c4b5c1af309b58` on `main`.

**Status: implementation plan, not implemented.** The user requested a detailed handoff after agreeing to the narrative design direction. This package changes documentation and reference assets only. It does not authorize a deployment by itself.

## The outcome

Build a recruiter-facing portfolio where the same recognizable architectural world develops from a pencil sketch into a fully dimensional, living 3D house as the visitor discovers Chakib's work. The wow factor is a core requirement. Clear content, navigation, and evidence must coexist with that experience.

> **I turn AI ideas into useful products.**
>
> I combine a researcher’s rigor about how they work and what they cost with the business judgment to know what to validate, what to simplify, and when to ship.

Do not revert to the earlier generic editorial portfolio with an optional garden thumbnail. That direction was explicitly rejected. Do not implement the new version as a slideshow of generated pictures: the enhanced experience must use the actual procedural 3D house. Still images are legitimate first-paint, reduced-motion, and failure presentations.

## Read in this order

1. [Visual overview](references/overview.webp) and [art direction](references/art-direction.webp).
2. [Implementation plan](IMPLEMENTATION_PLAN.md): architecture, repository touchpoints, sequencing, dependencies and concrete tasks.
3. [Content and evidence contract](CONTENT_AND_EVIDENCE.md): exact positioning, chapter copy, case-page destinations, attribution and assets.
4. [Acceptance and release checks](ACCEPTANCE.md): observable checks, test migration, performance protocol and delivery criteria.
5. [Complete desktop sequence](references/desktop-sequence.webp), [mobile sequence](references/mobile-sequence.webp), and [navigation/evidence board](references/routes-evidence.webp).

The [narrative design notes](references/narrative-design.md) and [long editorial draft](references/editorial-draft.md) retain the broader discussion. This handoff resolves implementation details left open there. Explicit user corrections and evidence limits always take precedence over older repository text.

## The eight chapters

Sketch / identity → Blueprint / selected-work index → BP Log → Whisperbook → pyRAPL, pyJoules & Wattch → MCQ Scan → About → Bloom / contact.

The first three project stories are public personal/research work. MCQ Scan is professional experience, separately labeled. Smaller experiments remain a secondary notebook near About.

## Non-negotiables

- The sketchbook-to-house transformation is the primary experience on desktop **and** mobile.
- Use one semantic document and one reading order; never hide essential summaries inside a building interaction or bottom sheet.
- One primary navigation: Work, About, Contact, CV, with the name returning to the opening. Retain existing EN/FR/AR support through a restrained language control.
- Ordinary document scrolling drives the scene. No captured scroll, forced dwell, three-second navigation flight, or nested scrolling note.
- The scene settles during reading. Text, navigation and contact do not disappear on idle.
- Sound is off until explicitly enabled. Clicking Work, scrolling, or pressing a generic key does not enable it.
- Preserve the actual house identity, project contribution boundaries, existing public URLs, and the user's strongest-language distinction.
- Verify real screenshots and the current short CV. The generated architectural reference is art direction, not product evidence.
- No framework migration, backend, new CMS, analytics service, or paid dependency is required.

## Implementation sequence

| Phase | Deliverable | Dependency |
| --- | --- | --- |
| P0 | Baseline, working branch, URL/asset inventory and short-CV audit | None |
| P1 | Actual-house motion and portrait-framing study | P0 |
| P2 | Typed chapter data, stable semantic page and verified EN/FR short CVs | P0; direction from P1 |
| P3 | Responsive layout, navigation, retained-case repairs and return-state handling | P2 |
| P4 | Scene adapter, scroll progression, reading holds and fallback | P1 + P3 |
| P5 | Four main case destinations and evidence (release 2) | Release-1 candidate complete; P2 model |
| P6 | Finished-house exploration with the retained secondary features (release 2) | Release-1 candidate complete; P4 |
| P7 | Localization, accessibility, performance and regression closure (run for each release) | Release 1: P0–P4; release 2: P5–P6 plus retained behavior |
| P8 | Reviewable release candidate and authorized publication (run for each release) | P7 |

The phases are layers; the slice is the order of work inside them. Run P0 and P1 in full. Then run P2–P4 for one release-1 slice only: opening → work index → Whisperbook (source and test-release actions, plus the retained Android case at `/work/whispbook/`) → case → back to the chapter → contact, on desktop and mobile. P3 includes the minimal asset and return-link repairs needed by that retained case. Review production captures at G2, then widen P2–P4 to all eight chapters and the other retained cases. Their exit criteria apply first to the slice, then to the complete release-1 set. No new case route or exploration mode is required for G2 or release 1.

Complete release-1 P7/P8 before starting P5/P6; a reviewable candidate is sufficient if publication is not authorized. In release 2, implement the new Whisperbook case and return path first within P5, then the other main cases; P6 adds exploration. Do not ship either representative slice as a completed release. [Acceptance](ACCEPTANCE.md#release-applicability) identifies which checks apply to each release.

Two decision gates are recorded, not implied: after P1 (does the actual house transform legibly, see the P1 decision gate in the plan) and after the slice review (is the layout and motion contract right before it is multiplied by eight).

## Decisions from the review (1 November 2026)

Settled with the user after the plan review. They override anything older in this folder or in `references/`.

- **Staged delivery.** Release 1: all eight homepage chapters with the transformation on desktop and mobile, the new navigation, sound opt-in, reduced-motion and failure stills, verified EN/FR short CVs, and retained case pages for MCQ Scan, Wattch and Whisperbook Android. BP Log and Whisperbook retain source actions; Whisperbook also links its test releases and existing Android case. Retained cases keep their identity and layout, with necessary factual, asset, accessibility and return-link repairs. No exploration mode. Release 2: three new case routes plus the expanded MCQ Scan case, exploration, and the remaining polish. The slice is still never a release.
- **Effort cap.** Twenty working days to release 1. Past that, the descoping order below applies without a new discussion.
- **Mobile transformation is mandatory.** A stills-only portrait fallback was rejected. The portrait scene slot is about 45 percent of the viewport height and may stick to the top of the viewport only while a transition runs, then release into document flow. No canvas stays fixed across the whole reading session.
- **First viewport.** Role line, promise and the CV link are visible before any scroll on desktop and at 390 px, with the ambition kept everywhere else.
- **Two earlier choices reversed on purpose.** Sound is off until its own control; the 20-second idle fade and the Bloom drift are gone from guided reading.
- **Exploration keeps** the sky, time of day, the carbon tally, rotate and zoom. Planting, the postcard and the fennec visits are dropped from the product; their code may be removed.
- **Evidence is text-first** wherever an image is missing. No slot waits on a capture.
- **Translations.** The implementer drafts French and Arabic for every new string; the user reviews both. If Arabic review is the bottleneck, it ships as a draft marked for review.
- **Arabic stays a visible site language.** Recorded as the default pending the user's explicit confirmation.
- **Progress record.** [PROGRESS.md](PROGRESS.md), one section per phase, is the shared state between sessions; the two gate reviews are entries in it.
- **Review cadence.** Each session works on one phase. The only design gates are P1 and the release-1 slice gate. Bundle French/Arabic copy for asynchronous review in PROGRESS.md, including strings added after the slice; this is the separately agreed translation review, not another design gate.

## Review decisions versus blockers

Proceed with routine engineering choices within this plan. Motion checkpoints are concrete artifact reviews, not instructions to ask permission for every small change. Missing screenshots or an uncertain CV block their publication, not architecture and layout work. Keep an explicit unresolved-items list rather than inventing claims or silently dropping existing features.

If release 1 overruns its twenty days, descope in this order and record each cut: first the night variants of the phase stills, then Arabic review (ship the implementer's draft marked for review), then any chapter-specific camera choreography beyond global growth plus focus. Exploration and the new case pages are already release 2. Never descope the semantic document, URL compatibility, the mobile transformation, reduced-motion behavior, the first-viewport constraint or sound opt-in.

## Handoff prompt

> Implement the portfolio redesign described in `docs/handoff/sketchbook-to-house/README.md` and its linked plan, content contract and acceptance checks. Preserve the actual house and make its sketch-to-3D transformation the core narrative on desktop and mobile. Start with the actual-model motion study and the release-1 slice through the existing Android case at `/work/whispbook/`; then complete all eight chapters, retained-case repairs and verified CVs. Complete the release-1 candidate before starting the new case routes and exploration in release 2. Use the existing Vite/TypeScript/Three.js stack, a single semantic reading document, explicit sound opt-in, and existing localization. Preserve URL identity: `/work/whispbook/` is Android; the separate web studio links to its repository. Do not turn concept imagery into purported product screenshots. Record progress against phase and release IDs, apply the release-specific acceptance checks, and visually inspect desktop/mobile states. Treat deployment according to the authorization in the implementation chat; a push to main currently triggers publication.

## Validation of this handoff package

All relative Markdown links were checked and resolve within the repository. Visual boards are copied into this folder, so the handoff does not depend on the author's external review directory. Application source, dependencies, tests and deployment configuration were not changed. Runtime tests were not rerun for this documentation-only handoff; the prior lab data is clearly labeled as historical context.

The five boards under `references/` are WebP re-encodings of the generated PNGs. The PNG originals live in the author's review directory (`~/Documents/Codex/reviews/living-notebook-2026-11-01/narrative-v3/`). Nothing in the handoff text depends on their resolution.

## Revision notes

Revised 1 November 2026 after a review against the same commit, before any implementation. Changes: the inventory gained the self-unregistering service worker, the French static case pages and `hreflang` pairing, the `/live/` redirects, the single-URL sitemap and the social preview image; the phase table was reconciled with the vertical slice and two decision gates were added; a descoping order was added; the commit-convention and branch-prefix claims were corrected against git history; the existing pull-request test run was recorded; the available Android device was named; new case routes now require French pairing or a recorded decision; the size of the reference images was flagged.

Second pass, same day, after a question-and-answer review with the user: the decisions section above was added; the release was split in two; the stills fallback for portrait was removed from the P1 gate and replaced by the sticky-during-transition slot; the first-viewport constraint became acceptance check V11; the exploration feature tier was fixed; the translation workflow and the progress record were defined; the reference boards were re-encoded to WebP.

Third pass, same day, after repository review: corrected `/work/whispbook/` and its French copy to their actual Android identity; made the release-1 slice use that retained route; moved CV verification into P0/P2 and retained-case asset repairs into P0/P3; inventoried six absent case images with a text-first resolution path; assigned acceptance checks by release; removed obsolete planting/postcard/fennec retention requirements from test migration; and reconciled progress tracking and translation review with the two design gates. This pass updates the handoff only: CV correction, asset recovery and application implementation remain recorded work.
