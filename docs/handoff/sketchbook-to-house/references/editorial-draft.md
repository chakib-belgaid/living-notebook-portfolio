# Homepage editorial draft

Draft for review · 1 November 2026 · No website implementation

The visitor-facing copy is below. Bracketed action labels describe proposed links; they are not implemented routes. Editorial and presentation notes follow the copy and would not appear on the homepage.

---

## Navigation

Chakib Belgaid

Work · Experience · About · CV · Contact

Secondary invitation: Explore the garden

## Opening

Applied AI & Product Engineer · Ph.D. in Software Engineering

# I turn AI ideas into useful products.

I combine a researcher’s rigor about how they work and what they cost with the business judgment to know what to validate, what to simplify, and when to ship.

[Explore selected work] [Download my CV] [Get in touch]

## Selected work

### BP Log

**A small AI system for a specific everyday problem.**

A photo of a blood-pressure monitor can save some typing. BP Log reads the display, lets the user check and correct the values, and saves them on the phone. It works offline in the browser.

I combined image-processing rules with a small neural network, then used failures on real photographs to guide the improvements. The model’s weights take 54 KB, and inference runs in plain JavaScript.

I deliberately left out heavier runtimes and further compression: the existing solution was small and fast enough for this task. The next useful work was improving the remaining recognition failures.

Personal project · Public code and evaluation · Evaluated on one monitor; readings require user confirmation.

[Read the BP Log story] [View source and evaluation]

### Whisperbook

**Books I could listen to, on my own terms.**

I wanted to spend more time with books, but sitting down to read did not always fit my day. Listening while walking, or with my eyes closed before sleep, did. The options I tried felt expensive or sounded robotic.

I built Whisperbook to turn EPUBs and PDFs into audiobooks entirely on an Android phone, without a subscription or a cloud service. Character voices, editable voice assignments, and synchronized text and playback bring the reading experience together.

The app prepares audio progressively, so listening can begin before the whole book is ready. Privacy is part of the implementation: the app has no runtime network permission.

Personal project · Public source and Android test release. The release notes distinguish the downloadable build from current source features.

[Read the Whisperbook story] [View source] [View test release]

### pyRAPL, pyJoules & Wattch

**Making energy measurement usable.**

During my research, I needed a simple way to examine energy use during Python functions and bounded sections of code. I designed pyRAPL around that need. When we wanted to include GPU sensors and other measurement sources, the work expanded into pyJoules.

I designed both libraries, co-developed pyRAPL, and developed and maintained pyJoules within the research team. Their interfaces make experiments easier to instrument while keeping the limits of the measurements explicit.

Later, restricted hardware access and my macOS work with IJoules exposed another challenge: keeping the workflow simple across platforms and permissions. That led to Wattch, where I designed a protocol separating acquisition from evaluation and reporting, drawing on PowerAPI’s separation of responsibilities. A privileged service collects data; developer tools consume and interpret it.

Collaborative research software and independent tooling · Public implementations. Hardware readings cover device activity during an interval; they do not automatically isolate one function’s energy. Wattch’s Rust implementation was developed with AI coding assistance.

[Read the measurement-tools story] [pyRAPL] [pyJoules] [Wattch Core]

## Professional experience

### MCQ Scan

**Applied AI within real business constraints.**

Lead AI Engineer · 2024–present

At MCQ Scan, I coordinate a two-person technical team under the CTO, working across AI workflows, product interfaces, and deployment. My work includes an ad-ops automation system, a shopping assistant, and tools for understanding the behavior and cost of AI workflows.

**Making outputs useful.** For Store Chat, I worked on model adaptation, the React interface, and deployment. I evaluated constrained-decoding tools and integrated LM Format Enforcer with vLLM to enforce allowed enum values, alongside Pydantic checks for business coherence. A valid JSON response still needs to make sense to the application.

**Understanding performance and cost.** I built tracing for tokens, latency, cost, and tool calls at individual workflow steps. I also improved execution through dependency-aware parallelism, smaller-model routing, and caching.

**Finding a workable delivery path.** A client wanted the application in its own Google Cloud environment; we wanted to avoid handing over source code. When the initial VM approach created security and access friction, I implemented compiled application packaging for serverless deployment. This accommodated the hosting requirement without distributing the source.

**Taking an idea through its business case.** For AgentDiet, I developed the concept and authorization demonstrator and prepared the market analysis, budget, and project plan. The project received a 2026 Hyper Open X grant funded by France 2030. It remains a demonstrator, with MCP/A2A integration as its target.

Professional contribution summary · Company implementation and internal evaluations are not publicly inspectable.

[Read about my work at MCQ Scan]

## About

### Product building, research, and applied AI

I co-founded a serious-games startup before moving into software-engineering research and then applied AI. Across those settings, I have worked on the product people interact with, the systems underneath it, and the evidence used to judge whether it works.

Python is my strongest language. My work also spans APIs, interfaces, model integration, and deployment. I use AI coding assistants and review and validate their output.

- **2014–2018 · Funecs:** Co-founder and CTO, working on product development, team leadership, and client delivery.
- **2018–2022 · Inria / Davidson Consulting:** Research engineering and energy-measurement tooling alongside my Ph.D. at the University of Lille / Inria.
- **2022–2024 · Inria, with Qarnot Computing as industrial partner:** Adaptation of the existing HWPC sensor to Qarnot’s infrastructure.
- **2024–present · MCQ Scan:** Applied AI development, technical coordination, and delivery.

[Download my CV] [LinkedIn]

## From the notebook

Smaller projects and experiments, with their decisions, measurements, and open questions.

- **Whispbook web studio:** A separate audiobook studio for editing documents, assigning voices, and generating chapter audio.
- **Pocket TTS on Android:** A documented experiment in running speech generation on an older phone.
- **Speculative decoding on Apple Silicon:** An experiment that was slower in the recorded protocol, with the result and its limitations published.

[Explore the garden]

## Contact

### Let’s talk about what you’re building.

If you’re hiring an applied AI or product engineer, I’d be glad to hear about the problem, the people it serves, and the constraints you’re working with.

[Email me] [LinkedIn] [Download my CV]

chakib.belgaid@gmail.com

---

# Editorial and presentation notes

These notes are for review and subsequent wireframing. They are not visitor-facing copy.

## Purpose and hierarchy

The first screen establishes identity, a clear promise, and direct routes to work, CV, and contact. Three featured stories provide public evidence. MCQ Scan adds professional delivery and business context. About explains the career path; the notebook offers optional depth. This preserves the agreed selection rather than promoting every additional project into a flagship.

The copy is a complete first draft. The MCQ section is the main candidate for shortening during wireframing: retain a short introduction and the deployment decision on the homepage if its four examples make the page too long, with the other examples on the linked case page. Do not hide essential project summaries in modal sheets.

## Evidence beside each story

| Section | Proposed evidence | Important boundary |
| --- | --- | --- |
| Opening | Restrained garden image or still | Identity and actions remain visible before optional animation loads |
| BP Log | Actual scan → detected values → user confirmation | Use demo data for history; never imply clinical validation |
| Whisperbook | Real app capture of playback, text, and voice selection | Distinguish emulator/QA captures from real-device performance evidence |
| Measurement tools | A short Python usage example plus readable output; a simple Wattch boundary diagram | Label synthetic examples; show specific roles and shared authorship |
| MCQ Scan | Clear prose and, if useful, an explicitly illustrative high-level workflow | Do not use private client images or imply public verification of internal results |
| About | Compact timeline; personal portrait optional | No invented personal or cultural explanation for the garden |

## Desktop and mobile

Use one reading order and the same core copy on both. Desktop can pair text and evidence in generous project rows; mobile places the evidence directly beside the relevant explanation in a single column. Navigation goes directly to sections. Project names and summaries remain visible without extra taps.

The garden is a visual signature and an optional exploration experience. Its controls belong inside that experience. Reading content and essential navigation remain visible while idle; audio is an explicit choice. A static first presentation must avoid the current large mobile layout shift. These are future experience requirements, not implemented changes.

## What belongs on the deeper case pages

- BP Log: the progression from rules to the small neural model; why quantization and heavier runtimes were deferred; development-set versus held-out-digit results; one-monitor scope. If used, 91% complete readings on 55 development photos and 99.5% on 187 held-out digits must remain separate measures. The reported 268 ms phone median covers three runs, not general device performance.
- Whisperbook: personal motivation, local data boundary, progressive audio preparation, voice assignment and editing, import/playback/export flow. Do not invent a delivery deadline, adoption, audio-quality benchmark, or time-to-first-audio result. A specific deliberately deferred feature has not yet been supplied.
- Measurement tools: pyRAPL first, pyJoules broadening acquisition sources, IJoules/macOS experience and privileged access motivating Wattch. Explain the difference in intended usage between bounded developer experiments and continuous infrastructure monitoring without claiming PowerAPI does not measure energy. The RAPL security restriction relates to PLATYPUS/RAPL vulnerabilities, rather than the original Spectre/Meltdown patches. Current locally inspected Wattch RAPL acquisition uses powercap sysfs files; the recalled C/libpfm work and uncertain 2 ms figure are not evidence of direct-register acquisition or speedup in current Rust. Local powermetrics code exists, but public release/runtime status needs verification before an availability claim.
- Wattch contribution: acquisition boundary, protocol, integration and validation. Rust implementation was AI-assisted. Do not present synthetic workflow examples as physical measurements or imply Python-level Rust fluency.
- MCQ Scan: 60% reported internal end-to-end processing-time reduction, with the scope and missing public benchmark explicit; Store Chat's 97% structural/enum validity per request versus 95% semantic accuracy per attribute; color-retrieval investigation; custom observability and monitoring; deployment compromise; AgentDiet proposal and demonstrator. No custom-sampler development. Compilation avoids source-code delivery but does not guarantee protection against reverse engineering. The image-generation case can show the two-phase pipeline textually: Chakib owned generation and GPU deployment, colleagues owned placement and the mobile client. Do not reuse private visuals.
- Qarnot: retain the user's latest clarification that the contribution was adapting HWPC sensor to the infrastructure. Do not attribute PowerAPI as a whole or broader performance results to him.

## Proposed link destinations

- BP Log: https://github.com/chakib-belgaid/bp-tracker
- Whisperbook Android: https://github.com/chakib-belgaid/whisper-book
- Test release: https://github.com/chakib-belgaid/whisper-book/releases (verify the specific release before publishing)
- pyRAPL: https://github.com/powerapi-ng/pyRAPL
- pyJoules: https://github.com/powerapi-ng/pyJoules
- Wattch: https://github.com/chakib-belgaid/wattch-core
- Existing MCQ case: https://chakib-belgaid.github.io/work/mcq-scan/
- Whispbook web: https://github.com/chakib-belgaid/whispbook
- Pocket TTS: https://github.com/chakib-belgaid/pocket-tts-android-benchmark
- Speculative decoding: https://github.com/chakib-belgaid/speculative-decoding-mlx
- LinkedIn: https://www.linkedin.com/in/chakib-belgaid/
- Contact: mailto:chakib.belgaid@gmail.com
- CV: verify the current approved document and language before selecting its destination. The separate correction chat is updating the dossier and LinkedIn; do not confuse the long dossier with the short recruiter CV.

## Source basis

This draft uses the user's decisions and personal explanations in the originating conversation; the current portfolio content; the dossier's MCQ sections and later clarifications; public pyJoules/pyRAPL package metadata confirming shared authorship; the BP Log and Whisperbook project documentation inspected in this conversation; and the current local Wattch acquisition code. It introduces no new performance or commercial-impact claims. Repositories establish code availability, not sole ownership or independently verified business outcomes.

Review artifact only. No website files, configuration, dependencies, or deployment were changed.
