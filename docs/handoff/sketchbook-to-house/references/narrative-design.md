# Narrative homepage — detailed design review v3

1 November 2026. Design artifacts only; no portfolio implementation or deployment.

## What is being reviewed

The experience is one continuous sketchbook-to-house narrative. These individually linked HTML documents are review states, not a proposal to make every chapter a separate website route. The generated illustrations are phase references, not a WebGL capture, exact new geometry specification, performance result or verified product screenshot.

Keep the approved positioning and evidence boundaries. The final architecture must remain recognizably the user's existing house. This set refines navigation, hierarchy, reading holds, evidence access, portrait framing and the final invitation.

## Chapter map

| State | Visitor learns | Scene and movement | Reading hold / next step |
| --- | --- | --- | --- |
| 01 Sketch | Name, role, research discipline and practical product judgment | Whole house is a pencil drawing on the page; a dimensional edge can hint at what follows | Promise and actions available immediately; ordinary scroll or Explore my work |
| 02 Blueprint / Work | The three featured stories and professional experience | Guides clarify, foundations rise; whole-house view | Named links provide direct access; this is also the Work navigation destination |
| 03 BP Log | Narrow problem, small model, practical restraint | Foundation and practical-work area begin to become solid | One decision plus its public evaluation boundary; case/source links |
| 04 Whisperbook | Personal motivation, product ownership, local operation | Camera approaches reading pavilion as it becomes solid | Scene settles; motivation, decision and evidence link stay readable |
| 05 Energy tools | Research-to-tooling progression and measurement scope | Reframe toward observatory; acquisition/evaluation/reporting can be diagrammed on case page | Contribution limits stay visible; do not attribute all PowerAPI work to Chakib |
| 06 MCQ Scan | Business constraints and a workable delivery compromise | Workshop context; solid structure fills out | No invented metrics or private imagery; professional detail remains reachable |
| 07 About | Founder → research → applied AI | Camera widens toward terrace/tower; final bloom held back | Timeline and secondary notebook links use natural page flow |
| 08 Bloom / Contact | How to get in touch | Finished house, greenery, warm light; whole-world composition | Contact visible with scene; optional exploration requires deliberate activation |
| 09 Whisperbook evidence | What exists and what can be inspected | Separate reading-focused case page; no scene competing with the evidence | Back returns to the same Whisperbook position and house state |

The four illustration poses are used as consistent phase references. Per-project construction granularity and camera framing remain a later visual specification; the state review does not claim each distinct model pose already exists. All material, growth and camera changes should follow the active chapter, not run as a disconnected background movie.

## Scroll choreography

Use ordinary document scrolling. Reading sections determine the scene; the scene never takes over scrolling or forces a dwell time. The specific motion curves and distances are not decided by these stills.

1. **Approach:** as a new chapter enters the main reading region, the prior scene begins to transition. A single visual change should lead: lines acquire depth, a part becomes solid, or the camera reframes. Avoid all three competing at once.
2. **Settle:** the appropriate building and composition become stable as the title and key decision reach a comfortable reading position.
3. **Hold:** hold the camera and construction stage while the text is being read. Neither text nor navigation fades after inactivity. Ambient motion is optional and must not compete with reading.
4. **Leave:** the next chapter advances the same world. Reverse scroll restores its previous state without replaying a long scripted sequence.

Desktop: a large scene can remain beside the document column across the work section. The text itself participates in the main document scroll; do not recreate the old independently scrolling overlay.

Mobile: place the scene in the main page between the short project motivation and the decision. The scene can transform while its reserved region is visible; it should scroll away when the visitor reaches longer evidence text. Do not pin a large canvas over the entire mobile reading session. Keep the same house and narrative, using deliberate framing rather than shrinking a desktop screenshot.

The mobile opening shows identity and promise before the first drawing. Its primary action remains visible before that drawing. The portrait scene is retained within the initial view; the approved headline and supporting statement are not reduced to an unreadable overlay.

## Navigation and state

- One primary navigation: Work, About, Contact, CV; name returns to the opening.
- Desktop: single top row. Mobile: name and CV, then Work / About / Contact. No redundant hamburger menu.
- The proposed navigation remains available during scroll without hiding text; keyboard focus and section titles must clear its reserved height.
- Work goes to the blueprint project index; each named entry goes directly to its project, including MCQ Scan under professional experience. All stories also remain reachable by ordinary scrolling.
- Direct navigation establishes the destination's house state immediately or through a short optional transition; it does not replay the whole journey.
- The Sketch / Blueprint / Build / Bloom line is a quiet, non-draggable progress indicator. It is not another navigational dock or a slider that the visitor must understand.
- A next-chapter text link supports an explicit step forward. It uses the same section anchors as scrolling rather than a separate state machine.
- Section anchors must be addressable and back/forward navigation must behave normally. Returning from a case preserves the project and reading position.
- No autoplay sound. Optional atmosphere controls can live inside the finished-house exploration experience.

## Evidence access

The Whisperbook case review demonstrates a separate, spacious evidence page with a clear back link, product workflow, public source and test releases. It intentionally uses a labeled screenshot placeholder. An existing portfolio asset was inspected but was not sufficient to establish a verified Android capture, so it is not presented as proof.

A final evidence page should show source provenance and release context alongside its actual product captures. Do not turn the generated house imagery into purported product evidence. Preserve the difference between the public test release and newer source features.

Other case pages retain the deeper material from the approved editorial draft. Their layouts are outside this representative wireframe set, and their links in the review are explicitly marked as pending. They must be reachable without entering the 3D buildings.

## Full copy and scope continuity

The main homepage has been shortened for this narrative rhythm. Preserve, on the linked cases or the appropriate secondary section:

- BP Log: separate development-photo and held-out-digit evaluation; one-monitor boundary and user confirmation.
- Whisperbook: personal motivation, progressive preparation, local narration, voice assignment, and release/source distinction. No invented quality or latency benchmark.
- Measurement tools: user designed pyRAPL and pyJoules; collaborative code/maintenance. Wattch separates acquisition, evaluation and reporting and uses AI-assisted Rust. No unsupported direct-register Rust backend or sampling-speed claim.
- MCQ Scan: constrained-decoding evaluation and LM Format Enforcer integration with vLLM plus Pydantic; no custom sampler. Observability, latency work, AgentDiet proposal/demonstrator, and the compiled/serverless client-cloud delivery compromise remain on the professional case. Compilation is not a guarantee against reverse engineering.
- About: preserve full career provenance and the narrower Qarnot HWPC adaptation contribution. Python is the strongest language. AI coding assistance is acknowledged and its output reviewed and validated.
- Notebook: Whispbook web is separate from Whisperbook Android; Pocket TTS and the speculative-decoding negative result remain secondary links.

## Alternative presentation and performance intent

The ambitious narrative is the default design direction. Immediate sketch presentation, reserved scene dimensions, staged asset loading and rendering concentrated around relevant motion are implementation intentions, not measured results.

Reduced motion preserves the same scene progression using stable chapter illustrations and direct state changes, without camera travel. If interactive rendering is unavailable, use the matching composed phase stills with all text and links intact. The visitor does not need to understand a technical low-end-mode label.

Free exploration at the end is optional. Entering it must have an explicit return to the reading experience; touch gestures are enabled only within that intentional mode. No exploration controls obscure email/CV/contact.

## Open items for the next design pass

1. Refine exact model correspondence and project camera compositions using the actual scene geometry.
2. Specify and test the transition itself in a motion study; still boards cannot establish timing or comfort.
3. Replace the evidence placeholder with an approved, verified app capture.
4. Select the current approved short CV and language; the long dossier is not its substitute.
5. Confirm the proposed narrative reading density and spatial balance before implementing the portfolio.

## Artifact behavior

The review deck links among static HTML states to demonstrate destinations. Source/release/LinkedIn links are real outbound destinations. CV and unfinished case links lead to explicit review notes. The email link opens a composer; this review sends nothing.

## Validation

Rendered and visually checked at 1440 px desktop and 390 px mobile. All nine states have no horizontal overflow at those widths. Long content is allowed to continue in document flow, particularly About and the evidence page. This is visual/layout verification of review documents, not a runtime, accessibility-conformance or production-performance audit.

House art was generated with the built-in image-generation tool from the approved storyboard reference. Prompt saved as art-prompt.txt. No website files were changed.
