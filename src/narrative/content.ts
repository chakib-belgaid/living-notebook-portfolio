/** The homepage's English source copy, grounded in
 * docs/handoff/sketchbook-to-house/CONTENT_AND_EVIDENCE.md §1–§2.
 * French is in src/translations.ts, keyed by this text.
 * Build-time safe: no browser globals. */
import type { Action, Chapter, ChapterId } from "./model.ts";

export const owner = "Chakib Belgaid";
export const email = "chakib.belgaid@gmail.com";

export const links = {
  bpLogSource: "https://github.com/chakib-belgaid/bp-tracker",
  whisperbookSource: "https://github.com/chakib-belgaid/whisper-book",
  whisperbookReleases: "https://github.com/chakib-belgaid/whisper-book/releases",
  pyRAPL: "https://github.com/powerapi-ng/pyRAPL",
  pyJoules: "https://github.com/powerapi-ng/pyJoules",
  whispbookStudio: "https://github.com/chakib-belgaid/whispbook",
  pocketTts: "https://github.com/chakib-belgaid/pocket-tts-android-benchmark",
  speculativeDecoding: "https://github.com/chakib-belgaid/speculative-decoding-mlx",
  linkedIn: "https://www.linkedin.com/in/chakib-belgaid/",
  email: `mailto:${email}`,
} as const;

/** The current short CV, in the selected English or French locale. */
export const cv = {
  en: "/resume/chakib-belgaid-product-engineer-en.pdf",
  fr: "/resume/chakib-belgaid-product-engineer-fr.pdf",
} as const;

/** Retained case pages (release 1), with their French copies. */
export const cases = {
  whispbook: { href: "/work/whispbook/", hrefFr: "/fr/work/whispbook/" },
  wattch: { href: "/work/wattch/", hrefFr: "/fr/work/wattch/" },
  mcqScan: { href: "/work/mcq-scan/", hrefFr: "/fr/work/mcq-scan/" },
} as const;

const cvAction = (label: string): Action => ({ label, type: "download", href: cv.en, hrefFr: cv.fr });
const linkedIn: Action = { label: "LinkedIn", type: "contact", href: links.linkedIn };

export const identity = {
  name: owner,
  role: "Applied AI & Product Engineer · Ph.D. in Software Engineering",
  promise: "I build AI that fits its constraints, then I measure it.",
  statement: "I build AI products and developer tools, from the interface to the systems underneath. My Ph.D. studied how to measure the energy software uses. The habit stayed: keep the system small, then check the claim.",
  /** Shown only once the page is enhanced: the tally exists only then. */
  tallyCue: "The small figure at the bottom of the screen is this visit’s estimated carbon cost so far.",
  /** The closing bookend, beside Contact's annotation. */
  tallyClose: "The figure at the bottom of the screen is what drawing it for you has cost, as an estimate.",
} as const;

export const site = {
  title: "Chakib Belgaid, Ph.D. — Applied AI & Product Engineer",
  description: `${identity.role}. ${identity.promise}`,
  ogDescription: `${identity.role}. Selected work: BP Log, Whisperbook, pyRAPL, pyJoules & Wattch, and MCQ Scan.`,
} as const;

export const chapters: Chapter[] = [
  {
    id: "intro",
    short: "The sketch",
    label: identity.role,
    title: identity.promise,
    motivation: [identity.statement],
    annotation: "A living notebook. Scroll to watch the house take shape.",
    place: "The sketch",
    actions: [
      { label: "Explore my work", type: "section", href: "#work", primary: true },
      { label: "Get in touch", type: "section", href: "#contact" },
    ],
    scene: { phase: "sketch", focus: null, progress: 0, framing: { desktop: "world", portrait: "world" }, poster: "sketch" },
  },
  {
    id: "work",
    short: "The work",
    title: "I start with the question.",
    motivation: ["A photo. A book. An energy trace. Each started with a question."],
    place: "The blueprint",
    actions: [],
    scene: { phase: "blueprint", focus: null, progress: 0.4, framing: { desktop: "world", portrait: "world" }, poster: "blueprint" },
  },
  {
    id: "bplog",
    short: "BP Log",
    label: "Personal project",
    place: "The heart garden",
    title: "BP Log",
    subtitle: "Can a photo save some typing?",
    motivation: ["A blood-pressure reading should be easy to keep. BP Log reads the monitor from a photo, lets the user check the values, and saves them on the phone, offline."],
    decision: { heading: "Keep the system small", text: "Image-processing rules handle the display’s layout; a small neural network, trained only on generated digits, reads the digits in plain JavaScript. When a photo failed, I fixed that failure. A heavier runtime would not have solved it." },
    // The repository's README, checked 10 November 2026.
    measured: [
      { figure: "54 KB", of: "the whole network: 10,123 parameters, no libraries" },
      { figure: "40% → 91%", of: "of 55 real photos read fully, one monitor" },
      { figure: "99.5%", of: "of 187 held-out digits read right" },
    ],
    turn: "Another everyday friction led me to the reading pavilion.",
    evidence: { text: "Public code, data and evaluation. The 55 photos also guided development, so they are not an independent test. Users check and confirm every reading before it is saved.", kinds: ["public-code", "public-evaluation"] },
    actions: [{ label: "Code & evaluation", type: "source", href: links.bpLogSource }],
    index: { title: "BP Log", summary: "A photo instead of typing a reading." },
    scene: { phase: "build", focus: "bplog", progress: 0.52, framing: { desktop: "focus", portrait: "focus" }, poster: "build" },
  },
  {
    id: "whisperbook",
    short: "Whisperbook",
    label: "Personal project",
    place: "The reading pavilion",
    title: "Whisperbook",
    subtitle: "Can a phone narrate a book without uploading it?",
    motivation: ["I wanted to enjoy books while walking or before sleep. The options I tried felt expensive or sounded robotic. A book can stay yours, even when it speaks."],
    decision: { heading: "Enforce the promise in the app", text: "Whisperbook narrates EPUBs and PDFs on the phone, with character voices and synchronized text. Its manifest removes the network permission, so the promise does not rest on my word. Audio is prepared progressively: the opening chapter can play while the rest is still being narrated." },
    // The app's AndroidManifest.xml and the README, checked 10 November 2026.
    measured: [
      { figure: "0", of: "network permissions at runtime: the manifest removes them" },
      { figure: "not yet", of: "on-device latency, narration speed and peak RAM: no reproducible benchmark is linked" },
    ],
    turn: "Running software locally also raises a question: what does it cost?",
    evidence: { text: "No subscription or cloud service. Public source and an Android test release.", kinds: ["public-code"] },
    actions: [
      { label: "Source", type: "source", href: links.whisperbookSource },
      { label: "Test releases", type: "source", href: links.whisperbookReleases },
      { label: "Read Android case study", type: "case", ...cases.whispbook },
    ],
    index: { title: "Whisperbook", summary: "A book that speaks without leaving the phone." },
    scene: { phase: "build", focus: "whisperbook", progress: 0.66, framing: { desktop: "focus", portrait: "focus" }, poster: "whisperbook" },
  },
  {
    id: "energy-tools",
    short: "Energy tools",
    label: "Research & independent tools",
    place: "The observatory",
    title: "pyRAPL, pyJoules & Wattch",
    subtitle: "What can an energy trace actually tell us?",
    motivation: ["Know what you measured before you optimize it. I designed pyRAPL to examine energy use during Python experiments. GPU and other measurement sources led us to pyJoules."],
    decision: { heading: "Keep the measurement inspectable", text: "Restricted access and work on macOS led to Wattch: separate collection, evaluation and reporting, with a simple workflow and raw traces developers can inspect." },
    measured: [
      { figure: "not yet", of: "Wattch’s overhead against a native RAPL reader: no reproducible comparison is linked" },
    ],
    turn: "At work, the constraints come from other people too.",
    evidence: { text: "I designed both Python libraries and developed them with the research team. Wattch’s Rust implementation is AI-assisted. Hardware readings cover device activity during an interval; they do not automatically isolate one function’s energy.", kinds: ["public-code"] },
    actions: [
      { label: "Wattch case", type: "case", ...cases.wattch },
      { label: "pyRAPL source", type: "source", href: links.pyRAPL },
      { label: "pyJoules source", type: "source", href: links.pyJoules },
    ],
    index: { title: "pyRAPL, pyJoules & Wattch", summary: "Energy measurements a developer can inspect." },
    scene: { phase: "build", focus: "wattch", progress: 0.76, framing: { desktop: "focus", portrait: "focus" }, poster: "wattch" },
  },
  {
    id: "mcq-scan",
    short: "At MCQ Scan",
    label: "Lead AI Engineer · 2024–present",
    place: "The workshop",
    title: "MCQ Scan",
    subtitle: "Who decides what an agent may do?",
    motivation: [
      "A client’s cloud. A business rule. A tool an agent must not call. Here the constraints are not mine to choose.",
      "For Store Chat, a clothing-shopping assistant, I evaluated constrained-decoding tools and integrated LM Format Enforcer with vLLM to enforce allowed enum values, alongside Pydantic validation for business coherence. For a client that required hosting in its own Google Cloud, I implemented compiled application packaging for serverless deployment, so we delivered without distributing the source.",
    ],
    decision: { heading: "Check the permission where the tool runs", text: "I conceived AgentDiet, an agent-governance project: signed Biscuit tokens, delegations that can only narrow, and local checks before a tool is used. I built the Python/FastAPI demonstrator and prepared the technical proposal, market analysis, budget and project plan. It received a 2026 Hyper Open X grant, funded by France 2030." },
    // Internally reported figures (CONTENT_AND_EVIDENCE.md, MCQ Scan: exact
    // boundaries). 97% is per request and 95% per attribute: never one number.
    measured: [
      { figure: "97%", of: "of Store Chat requests structurally valid, internal evaluation" },
      { figure: "95%", of: "semantic accuracy per attribute, the same internal evaluation" },
      { figure: "60%", of: "less end-to-end processing time for a workflow, internal measurement" },
    ],
    turn: "These decisions grew out of a longer path.",
    evidence: { text: "I coordinate a two-person technical team under the CTO. The AgentDiet demonstrator validates simulated authorizations; MCP/A2A integration is its target. Company code and internal evaluations are not public.", kinds: ["internal-account"] },
    actions: [{ label: "More about my work at MCQ Scan", type: "case", ...cases.mcqScan }],
    index: { title: "At MCQ Scan", summary: "Shipping within business constraints.", professional: true },
    scene: { phase: "build", focus: "workshop", progress: 0.84, framing: { desktop: "focus", portrait: "focus" }, poster: "build" },
  },
  {
    id: "about",
    short: "About me",
    title: "The path so far.",
    place: "The tower",
    motivation: [
      "First, a serious-games startup. Then software-engineering research. Now applied AI. Across those settings, I have kept returning to the same work: building something people can use, understanding the system underneath, and checking whether it delivers.",
      "Python is my strongest language. My work spans APIs, interfaces, model integration, and deployment. I use AI coding assistants and review and validate their output.",
    ],
    actions: [cvAction("Download CV"), linkedIn],
    turn: "The next part starts with a conversation.",
    scene: { phase: "build", focus: "about", progress: 0.93, framing: { desktop: "wide", portrait: "wide" }, poster: "build" },
  },
  {
    id: "contact",
    short: "Contact",
    title: "Let’s talk about what you’re building.",
    place: "The greenhouse",
    annotation: "The house is built.",
    motivation: ["If you’re hiring an applied AI or product engineer, I’d be glad to hear about the problem, the people it serves, and the constraints you’re working with."],
    actions: [{ label: "Email me", type: "contact", href: links.email, primary: true }, linkedIn, cvAction("Download CV")],
    scene: { phase: "bloom", focus: null, progress: 1, framing: { desktop: "world", portrait: "world" }, poster: "bloom" },
  },
];

export const chapter = (id: ChapterId) => chapters.find(c => c.id === id)!;

/** About's career timeline: separate from the scene's growth data. */
export const timeline = [
  { years: "2014–2018", place: "Funecs", text: "Co-founder and CTO of a serious-games startup. I led six employees and two interns and delivered two Unity games after winning Ooredoo T-Start in 2014. Our 2016 national campaign drew more than 300,000 unique subscriber numbers." },
  { years: "2018–2022", place: "Inria / Davidson Consulting", text: "Ph.D. at the University of Lille / Inria on measuring and improving the energy software uses, with research engineering and measurement tooling alongside." },
  { years: "2022–2024", place: "Inria, with Qarnot Computing as industrial partner", text: "Adaptation of the existing HWPC sensor to Qarnot’s infrastructure." },
  { years: "2024–present", place: "MCQ Scan", text: "Lead AI engineer in a two-person technical team under the CTO: applied AI development, technical coordination, and delivery." },
] as const;

/** The secondary notebook near About; carries the legacy #workshop target. */
export const notebook = {
  heading: "From the notebook",
  entries: [
    { title: "Whispbook web studio", text: "A separate audiobook studio for editing documents, assigning voices, and generating chapter audio.", href: links.whispbookStudio, label: "Web studio source" },
    { title: "Pocket TTS on Android", text: "A documented experiment in running speech generation on an older phone.", href: links.pocketTts, label: "Source" },
    { title: "Speculative decoding on Apple Silicon", text: "An experiment that was slower in the recorded protocol, with the result and its limitations published.", href: links.speculativeDecoding, label: "Source" },
  ],
} as const;

/** Phase stills' alt text: they describe the phase, not a product. */
export const posterAlt = {
  sketch: "Sketch: the house drawn in fine pale lines on the night-blue page, under the moon, before anything is built.",
  blueprint: "Blueprint: the plan of the house, its walls, terraces and trees marked in light blue line on the night page.",
  build: "Build: the house standing in pale stone under the night sky, its windows lit, its trees still bare.",
  whisperbook: "Build: the reading pavilion at night, an open book for a roof above a lamplit desk and bookshelves.",
  wattch: "Build: the observatory at night, a ring of columns around an energy meter.",
  bloom: "Bloom: the finished house on a summer night, its trees in leaf, the water lit and the lamps on.",
} as const;

/** Images the evidence dialog (src/evidence.ts) can enlarge, keyed by the
 * link's data-evidence value. Release 1's homepage is text-first, so none:
 * the Whisperbook capture awaits build confirmation and Wattch's visual is
 * synthetic (CONTENT_AND_EVIDENCE.md §5). */
export interface EvidenceImage { title: string; image: string; alt: string; caption: string; url: string }
export const evidenceImages: Record<string, EvidenceImage> = {};
