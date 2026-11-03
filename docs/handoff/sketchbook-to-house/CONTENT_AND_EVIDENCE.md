# Content and evidence contract

This document is the implementer's factual boundary. It consolidates the approved narrative and the user's corrections. Older source text, comments, screenshots and package metadata do not override a direct correction.

## 1. Identity and opening

Name: **Chakib Belgaid**.

Role: **Applied AI & Product Engineer · Ph.D. in Software Engineering**.

Heading:

> I turn AI ideas into useful products.

Supporting statement:

> I build AI products and developer tools, from the interface to the systems underneath. Research taught me to question what works; building products taught me what to simplify and when to ship.

Opening annotation: **A living notebook. Scroll to watch the ideas take shape.**

Primary action: **Explore my work** → `#work`.

The role line, the heading and the CV link are visible before any scroll on desktop and at 390 px wide.

Secondary action: **Get in touch** → `#contact`.

Primary navigation: Work, About, Contact, CV. Name returns to `#intro`. Keep a compact language control with English and French. Arabic was removed from the current version at the user's request on 2 November 2026. French proficiency in professional materials is **bilingual**, not merely fluent/intermediate.

Use the sketchbook as the actual opening composition, not a preview card for an optional separate tour. The visitor sees the house develop through the journey. Do not invent a personal or cultural explanation for its architecture. Existing architectural identity is preserved independently of whether explanatory biography has been provided.

## 2. Homepage chapter copy

The following concise copy is the starting implementation copy. Layout-dependent line breaks are not part of the content. Translating or light copyediting must preserve meaning, attribution and uncertainty.

### Release 1 destinations

This table governs the first release and its slice. Existing case pages keep their project identity and layout, with necessary factual, asset, accessibility and return-link repairs in P3. The three new routes (`/work/bp-log/`, `/work/whisperbook/`, `/work/energy-tools/`) belong to release 2; no release-1 action points to an unbuilt route.

| Entry | Release-1 actions and destinations | Local case return fallback |
| --- | --- | --- |
| BP Log | Code & evaluation → `https://github.com/chakib-belgaid/bp-tracker` | No local case yet |
| Whisperbook Android | Source → `https://github.com/chakib-belgaid/whisper-book`; Test releases → `https://github.com/chakib-belgaid/whisper-book/releases`; Existing Android case → `/work/whispbook/` | `#whisperbook` |
| Measurement tools | Wattch case → `/work/wattch/`; pyRAPL and pyJoules → their canonical repositories below | `#energy-tools` |
| MCQ Scan | More about my work at MCQ Scan → `/work/mcq-scan/` | `#mcq-scan` |
| Whispbook web studio (secondary notebook) | Web studio source → `https://github.com/chakib-belgaid/whispbook` | No local web-studio case |

Use `/fr/work/<slug>/` for the retained French cases. Preserve locale/view on explicit return where available; the no-storage/no-JS fallback is the matching homepage chapter. The existing Android case participates in the slice's case → back check. A source link is labeled as source, not as an unwritten case story.

### Work index

Heading: **I start with the question.**

Introduction: A photo. A book. An energy trace. Each started with a question.

- **BP Log** — A photo instead of typing a reading.
- **Whisperbook** — A book that speaks without leaving the phone.
- **pyRAPL, pyJoules & Wattch** — Energy measurements a developer can inspect.
- Separate professional entry: **At MCQ Scan** — Shipping within business constraints.

These entries navigate directly to inline homepage chapters. They are not four equally labeled personal projects.

### BP Log

Label: The heart garden · Personal project.

Title: **BP Log**.

Subtitle: **Can a photo save some typing?**

Motivation: A blood-pressure reading should be easy to keep. BP Log reads the monitor from a photo, lets the user check the values, and saves them on the phone, offline.

Decision — **Keep the system small**: I combined image-processing rules with a 54 KB neural model in plain JavaScript. The useful next step was fixing recognition failures; a heavier runtime would not solve those.

Transition: Another everyday friction led me to the reading pavilion.

Evidence note: Public code and evaluation. Evaluated on one monitor; users check and confirm the readings.

Actions: Release 1: Code & evaluation → canonical repository. Release 2 adds Read the story → `/work/bp-log/`.

### Whisperbook

Label: The reading pavilion · Personal project.

Title: **Whisperbook**.

Subtitle: **Books I could listen to, on my own terms.**

Motivation: I wanted to enjoy books while walking or before sleep. The options I tried felt expensive or sounded robotic.

Decision — **Let listening start early**: I built an Android app that narrates EPUBs and PDFs on the phone, with character voices and synchronized text. It prepares audio progressively, so the opening chapter can play while the rest is still being narrated.

Transition: Running software locally also raises a question: what does it cost?

Evidence note: No subscription or cloud service. No runtime network permission. Public source and Android test release.

Actions: Release 1: Source, Test releases and Existing Android case → destinations in the table above. Release 2 uses Read the story & evidence → `/work/whisperbook/`, retaining source/release access and compatibility with the old Android case URL.

### Measurement tools

Label: The observatory · Research & independent tools.

Title: **pyRAPL, pyJoules & Wattch**.

Subtitle: **Making energy measurement usable.**

Motivation: I designed pyRAPL to examine energy use during Python experiments. GPU and other measurement sources led us to pyJoules.

Decision — **Keep the measurement inspectable**: Restricted access and work on macOS led to Wattch: separate collection, evaluation and reporting, with a simple workflow and raw traces developers can inspect.

Transition: At work, the constraints come from other people too.

Evidence note: I designed both Python libraries and developed them with the research team. Wattch’s Rust implementation is AI-assisted. Hardware readings cover device activity during an interval; they do not automatically isolate one function’s energy.

Actions: Release 1: Wattch case → `/work/wattch/`, plus pyRAPL and pyJoules source links. Release 2 adds Read the measurement story → `/work/energy-tools/`.

### MCQ Scan

Label: The workshop · Lead AI Engineer · 2024–present.

Title: **MCQ Scan**.

Subtitle: **The client’s cloud. A workable path to shipping.**

Context: The client wanted hosting in its Google Cloud environment. We wanted to deliver the application without handing over the source. The initial VM approach created security and access friction.

Contribution — **Find a workable delivery path**: I implemented compiled application packaging for serverless deployment. The client could host the application in its own environment, and we could deliver it without distributing the source.

Transition: These decisions grew out of a longer path.

Evidence note: I coordinate a two-person technical team under the CTO. Company implementation and internal evaluations are not public.

Action: More about my work at MCQ Scan → `/work/mcq-scan/`.

### About

Title: **The path so far.**

Introduction: First, a serious-games startup. Then software-engineering research. Now applied AI. Across those settings, I have kept returning to the same work: building something people can use, understanding the system underneath, and checking whether it delivers.

Transition after the timeline and notebook: The next part starts with a conversation.

Practice: Python is my strongest language. My work spans APIs, interfaces, model integration, and deployment. I use AI coding assistants and review and validate their output.

Timeline:

- **2014–2018 · Funecs:** Co-founder and CTO, working on product development, team leadership, and client delivery.
- **2018–2022 · Inria / Davidson Consulting:** Research engineering and energy-measurement tooling alongside my Ph.D. at the University of Lille / Inria.
- **2022–2024 · Inria, with Qarnot Computing as industrial partner:** Adaptation of the existing HWPC sensor to Qarnot’s infrastructure.
- **2024–present · MCQ Scan:** Applied AI development, technical coordination, and delivery.

Secondary notebook:

- **Whispbook web studio:** A separate audiobook studio for editing documents, assigning voices, and generating chapter audio.
- **Pocket TTS on Android:** A documented experiment in running speech generation on an older phone.
- **Speculative decoding on Apple Silicon:** An experiment that was slower in the recorded protocol, with the result and its limitations published.

Keep these entries discoverable but visually secondary. Preserve `#workshop` as a legacy target in this notebook area. Actions: current short CV and LinkedIn.

### Contact / Bloom

Heading: **Let’s talk about what you’re building.**

Copy: If you’re hiring an applied AI or product engineer, I’d be glad to hear about the problem, the people it serves, and the constraints you’re working with.

Actions: Email me, LinkedIn, Download CV.

Email: `chakib.belgaid@gmail.com`.

Release-2 secondary action: **Explore the finished house**, an explicitly entered interaction mode with a visible exit. Omit this action entirely in release 1. The mail link opens the user's email application; neither the page nor this implementation task sends a message.

## 3. Case-page requirements

All four primary cases need a useful public page, not just a GitHub button, in release 2. Where an image is missing, the page is text plus source and evaluation links; no section waits on a capture. Use problem → my responsibility → key decision → observed result/status → evidence and limits. Establish value before long installation/status notes, but keep every material qualification beside its claim.

| Case | Must explain | Evidence and explicit limits |
| --- | --- | --- |
| BP Log | Personal monitor workflow; rules plus small neural model; failure-driven iteration; why heavier runtimes/extra compression were deferred | Code and evaluation. If retaining numbers, keep 91% complete readings on 55 development photos distinct from 99.5% digits on 187 held-out crops. One monitor. The 268 ms phone median is from three reported runs, not a device-independent latency claim. Verify current repository wording before publication. |
| Whisperbook Android | Personal walking/sleep motivation; EPUB/PDF import; chapter/speaker processing; local voices; progressive preparation; synchronized playback/export | Verified app captures and public source/test release, with build provenance. Current source features may differ from the downloadable v0.1 test build. No invented adoption, shipping deadline, time-to-first-audio, audio-quality or device-speed benchmark. Source-available/noncommercial terms are not OSI open source. |
| Measurement tools | pyRAPL came first; broader GPU/other sources motivated pyJoules; simple bounded experiment API; IJoules/macOS and permissions motivated Wattch's collection/evaluation/reporting boundary | User designed both Python libraries; co-developed pyRAPL and developed/maintained pyJoules in a team. Wattch Rust is AI-assisted. Current code/release/platform support must be checked before claiming availability. A shared hardware interval is not exclusive function attribution. |
| MCQ Scan | Delivery anecdote plus Store Chat, observability/performance decisions and AgentDiet demonstrator/business case; clear own/team responsibilities | Company work is not publicly inspectable. Internal metrics remain internally reported, with denominator and timing scope. No private client visuals or source. No custom sampler. |

### MCQ Scan: exact boundaries

Correct Store Chat claim:

> I evaluated constrained-decoding tools and integrated LM Format Enforcer with vLLM to enforce allowed enum values, alongside Pydantic validation for business coherence.

French equivalent:

> Évaluation d’outils de décodage contraint et intégration de LM Format Enforcer avec vLLM pour imposer les valeurs autorisées par les énumérations, complétées par une validation Pydantic de la cohérence métier.

Do not say “designed/developed a custom sampler.” The user's explicit correction applies to homepage, cases, metadata, translations, CV-derived material and public summaries.

If retained on the case page:

- **60%** is a reported internal reduction in end-to-end request-to-final-result processing time. It is not a clean isolated model-inference speedup or a public benchmark.
- **97%** structural/enum validity is per request; **95%** semantic accuracy is per attribute. They cannot be averaged or represented as one overall accuracy. Dataset/split/stage details are not established publicly.
- Model adaptation included Llama 3.1 8B LoRA; constrained decoding selected LM Format Enforcer; Pydantic checked business coherence.
- User's custom work included request tracing for per-step tokens, latency, cost and tool calls, plus availability alerts. “Custom tracing” must not become “custom sampler.”
- Delivery moved from an access-friction-heavy VM approach to compiled application packaging with serverless deployment in the client's GCP environment. Compilation avoids distributing source; it does not guarantee IP protection or prevent reverse engineering.
- AgentDiet: user conceived the project, built a Python/FastAPI authorization demonstrator and prepared market analysis, budget and project plan. Grant: 2026 Hyper Open X / France 2030 as described by the user/dossier; do not invent amount, exact award date or public award proof. MCP/A2A integration is a target, not delivered production integration.
- Image-generation case, if included: user owned generation/backend/GPU deployment; colleagues owned garment placement and mobile frontend. Client images are not approved for public use.

A separate chat was authorized to correct the competency dossier and LinkedIn. This website handoff does not imply that work is finished and does not authorize unrelated profile edits. Use the corrected claim regardless of older source wording.

### Energy tools: exact boundaries

- Do not claim ownership of PowerAPI as a whole. Qarnot work adapted the existing HWPC sensor to its infrastructure.
- Do not import the older 300× binary claim or broad deployment results as personal outcomes without clarified attribution.
- pyRAPL predates pyJoules. The user designed both; shared authorship remains visible.
- The motivating RAPL permission issue is associated with PLATYPUS/RAPL restrictions, not the original Spectre/Meltdown patches. If explaining the historical technical cause, cite the primary advisory rather than trusting recollection.
- The user recalls direct-register work in C/libpfm but is uncertain about the sampling interval and whether it was ported to Rust. Do not claim a direct-register Rust backend or a 2 ms speed comparison.
- Earlier local inspection found Wattch's Linux acquisition reading powercap sysfs and a macOS powermetrics backend. That observation does not establish current public release or runtime support; check before advertising it.
- The intended distinction is bounded developer measurement versus continuous infrastructure monitoring. Do not claim that PowerAPI does not measure energy.
- Python is the user's strongest language. Do not imply equivalent Rust fluency; implementation assistance is acknowledged.

## 4. Links and route distinctions

| Label | Destination |
| --- | --- |
| BP Log source | https://github.com/chakib-belgaid/bp-tracker |
| Whisperbook Android source | https://github.com/chakib-belgaid/whisper-book |
| Android test releases | https://github.com/chakib-belgaid/whisper-book/releases |
| pyRAPL | https://github.com/powerapi-ng/pyRAPL |
| pyJoules | https://github.com/powerapi-ng/pyJoules |
| Wattch Core | https://github.com/chakib-belgaid/wattch-core |
| Whispbook web studio | https://github.com/chakib-belgaid/whispbook |
| Pocket TTS | https://github.com/chakib-belgaid/pocket-tts-android-benchmark |
| Speculative decoding | https://github.com/chakib-belgaid/speculative-decoding-mlx |
| LinkedIn | https://www.linkedin.com/in/chakib-belgaid/ |
| Email | mailto:chakib.belgaid@gmail.com |

Verify outbound destinations and release state during implementation. These links were the agreed sources, not a current availability audit performed for this handoff.

At the inspected source SHA, `/work/whispbook/` and `/fr/work/whispbook/` already describe **Whisperbook Android**. Preserve that meaning; the spelling of the slug does not make them web-studio pages. Release 2 adds `/work/whisperbook/` for the new Android story and links to it from the retained legacy Android case. The separate Whispbook web studio uses its repository destination above in both releases; a local web-studio case is outside this plan.

`/work/wattch/` remains reachable; the new family page is `/work/energy-tools/`. Existing cases have French copies under `/fr/work/<slug>/` linked by `hreflang`; new case pages follow the same pairing unless an English-only decision is recorded. `/live/` and `/fr/live/` are redirects into the reading view and must still land on readable content. Never advertise an alternate or case route before it exists in that release's build.

## 5. Asset ledger to create during implementation

For each production visual, record: file path, project, source/build SHA or release, capture date, capture method/device, synthetic versus actual state, public-use status, intended caption/alt text, dimensions and encoded bytes. Keep private local provenance details out of public captions.

| Asset | Current handoff status | Required action |
| --- | --- | --- |
| Architectural concept boards | Generated art direction, copied under references | Do not load as production 3D or product proof; reproduce the direction with the actual model. |
| Initial/phase stills | Existing real-model stills available, different composition | Re-capture from new production poses, including portrait composition and failure states. |
| `public/assets/whisperbook.webp` | 941×1672 phone-aspect capture added 1 October 2026; assumed real, build unconfirmed | The user confirms the build or captures a fresh one on the Nothing Phone 3; until then it is not labeled as product proof. |
| `public/assets/wattch.png` | Existing Energy Tests visual described as synthetic workflow evidence | Preserve the synthetic label; verify the intended build/source before reusing. |
| BP Log captures | None exist in the repository | Text-first: code and evaluation links. A sample-reading photo is optional, later, and must not show private health history. |
| MCQ Scan visuals | Client/private material not authorized for publication | Use text or a clearly illustrative high-level diagram without private details. |
| EN/FR short CVs | HTML/PDF files exist in `public/resume`; both HTML sources retain the 300× PowerAPI claim excluded above without clarified attribution. PDF content/rendering not audited by this handoff review. | Release 1: P0 audits both formats, P2 corrects/rebuilds as needed and inspects every rendered PDF page. Preserve URLs, align HTML/PDF claims and record validation. Do not defer to P5. |
| `public/assets/garden-preview.png` / `.webp` | Social `og:image` and reading-page preview of the finished garden | Re-capture to match the new opening or an agreed pose; keep the file names if external links use them. |
| `public/assets/social/<slug>-<lang>.png` (six) | Added 3 November 2026 (product decision 66): one self-hosted 1200×630 PNG share card per retained case and language (`whispbook`, `wattch`, `mcq-scan` × `en`, `fr`), referenced by each case page's `og:image` and `twitter:image`. Built by `npm run share-cards` (`scripts/build-share-cards.mjs`) from each page's own section label, `<h1>` and summary, in the navy page identity with self-hosted Newsreader; Whisperbook and Wattch cards show their own screenshots whole, MCQ Scan sits on the site's rendered night still. No generated imagery, logos or device frames | Rebuild after changing a case's hero wording; `npm run share-cards -- --check` validates dimensions and size budget; `scripts/verify-case-dependencies.mjs` requires all six in a clean build. |

### Retained-case assets missing from this checkout

Confirmed absent locally on 1 November 2026 at the inspected SHA. These are references in existing public HTML, not a live-site availability or provenance audit. Each English case and its French copy require the same files. Two of them are byte-identical to the root-level assets above (`now-playing.webp` = `public/assets/whisperbook.webp`, `energy-tests.png` = `public/assets/wattch.png`; P0 `baseline/BASELINE.md` §7.1, correcting an earlier "different files" line). Identical bytes do not establish provenance: the root assets must not be substituted as evidence for these cases.

| Expected repository path | Referencing case routes | Current status |
| --- | --- | --- |
| `public/assets/projects/whisperbook/now-playing.webp` | `/work/whispbook/`, `/fr/work/whispbook/` | ~~Missing; provenance unresolved → text-first in EN/FR (P3, 2 November 2026)~~ **Checked in 3 November 2026** from the Pages repository, figure and caption restored in EN/FR (table below) |
| `public/assets/projects/whisperbook/read-along.webp` | `/work/whispbook/`, `/fr/work/whispbook/` | ~~Missing; provenance unresolved → text-first in EN/FR (P3, 2 November 2026)~~ **Checked in 3 November 2026** from the Pages repository, figure and caption restored in EN/FR (table below) |
| `public/assets/projects/whisperbook/voice-cast.webp` | `/work/whispbook/`, `/fr/work/whispbook/` | ~~Missing; provenance unresolved → text-first in EN/FR (P3, 2 November 2026)~~ **Checked in 3 November 2026** from the Pages repository, figure and caption restored in EN/FR (table below) |
| `public/assets/projects/whisperbook/library.webp` | `/work/whispbook/`, `/fr/work/whispbook/` | ~~Missing; provenance unresolved → text-first in EN/FR (P3, 2 November 2026)~~ **Checked in 3 November 2026** from the Pages repository, figure and caption restored in EN/FR (table below) |
| `public/assets/projects/wattch/deterministic-trace.png` | `/work/wattch/`, `/fr/work/wattch/` | ~~Missing; provenance unresolved → text-first in EN/FR (P3, 2 November 2026)~~ **Checked in 3 November 2026** from the Pages repository, figure, caption and synthetic label restored in EN/FR (table below) |
| `public/assets/projects/wattch/energy-tests.png` | `/work/wattch/`, `/fr/work/wattch/` | ~~Missing; provenance unresolved → text-first in EN/FR (P3, 2 November 2026)~~ **Checked in 3 November 2026** from the Pages repository, figure, caption and synthetic label restored in EN/FR (table below) |

Release-1 resolution protocol (P0 inventory, P3 repair, P7/P8 verification):

1. Check the owning project, prior source artifacts or the published Pages repository for recoverable assets. Record where each recovered file came from, its build/capture context, checksum and public-use status. A successful download or an old caption alone does not establish product provenance.
2. If the asset is verified and appropriate, include it at the expected path in `public/` so a clean build has it. Keep Wattch synthetic/protocol evidence labeled; do not promote it to hardware measurements.
3. If provenance or recovery remains unresolved, retain a useful text-first case with source/evaluation links. Remove the unavailable image, associated preload, image-specific caption and metadata in **both** languages; do not ship broken images, invented substitutes or review placeholders. Retain the case URL and project identity. Record the resolution per asset in PROGRESS.md. This fallback does not authorize deleting unrelated assets from the deployed Pages repository.
4. Verify all remaining local image/style dependencies in a clean `dist/` and production preview, including image decoding rather than accepting an HTML fallback response as an image. Check both EN/FR routes. Release 1 must work without borrowing files that only survive in an old deployment.

**Resolution, 3 November 2026.** In the decision table of that date the user chose to restore the six screenshots, superseding the P3 text-first resolutions. The files were checked into `public/assets/projects/` from the published Pages repository (`chakib-belgaid.github.io`); their SHA-256 sums equal the candidates recorded in P0 (PROGRESS.md asset table), so they are the files the case pages always referenced. Each figure is back in both languages with its original caption and alt text, width and height attributes matching the files, the hero eager and the others `loading="lazy"`, and a plain link to the file; `public/assets/case-evidence.js` adds the enlargement dialog. The root `public/assets/whisperbook.webp` and `wattch.png` are still not used as case evidence. Wattch's two images stay labelled as deterministic protocol output and synthetic values, not hardware measurements. The build behind the Whisperbook captures is still not separately confirmed; the case presents them with the captions they had on the published site.

| Path | Pixels | Bytes | SHA-256 | Loading | English caption |
| --- | --- | ---: | --- | --- | --- |
| `whisperbook/now-playing.webp` | 941×1672 | 177008 | `ec740fea1fc7baf6d9bd68ce1ccbba4a7c8f396dfe36d92ef3f2cdb1e5c2bff8` | hero, eager | Now Playing keeps the active speaker, chapter controls and offline state visible on the production Compose surface. |
| `whisperbook/read-along.webp` | 941×1672 | 109716 | `0b025fe3cc5c4d86187e305c200ab2f2185bd6dc83ec0402baf3d9d5593f4847` | lazy | Read Along follows the active passage and keeps manual speaker correction available. |
| `whisperbook/voice-cast.webp` | 941×1672 | 123552 | `02d48dced381230837d06c88405744a78aa5a60d6fff29eed63e1ccf2a2dbf14` | lazy | Voice Cast manages per-book language and previewable local voices without leaving the device. |
| `whisperbook/library.webp` | 941×1672 | 114764 | `2729d3f51837340d374da3bda27c8dc9709bd842a872c8f68bd8c9821b083f84` | lazy | The Library restores each book's own listening position and preparation state. |
| `wattch/deterministic-trace.png` | 1600×1000 | 219565 | `ec0b3208215371f1278817e2dfcbfa7eff63c6152d0c6f2eae215a105ab4de1b` | hero, eager | Real dry-run output from the checked-in deterministic laptop scenario; it is protocol evidence, not a hardware-energy claim. |
| `wattch/energy-tests.png` | 1440×900 | 95452 | `7dfbd30b07b7f860221b18251d5fafcd3be1e0b4710d489aa25070971d1c45d9` | lazy | The shipped Energy Tests surface rendered from an actual deterministic demo run; synthetic values verify the workflow, not physical hardware. |

`scripts/verify-case-dependencies.mjs` now requires these six files and the six share cards in a clean build and checks that each decodes.

Recovering these six legacy images is distinct from confirming `public/assets/whisperbook.webp` for possible release-2 reuse. Neither missing set blocks a text-first case once its unsupported image references are repaired.

Do not invent dates, location, availability, compensation, customer counts, metrics, management scope or testimonials to fill a visual slot. If a metric or screenshot is not ready, redesign that slot around verified material.
