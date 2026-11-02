/** The homepage's English source copy, verbatim from
 * docs/handoff/sketchbook-to-house/CONTENT_AND_EVIDENCE.md §1–§2, release 1.
 * French and Arabic are in src/translations.ts, keyed by this text.
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

/** The current short CV. English by default and for Arabic (labelled as
 * English in Arabic, never implying an Arabic PDF); French for French. */
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
  promise: "I turn AI ideas into useful products.",
  statement: "I combine a researcher’s rigor about how they work and what they cost with the business judgment to know what to validate, what to simplify, and when to ship.",
} as const;

export const site = {
  title: "Chakib Belgaid — Applied AI & Product Engineer",
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
    actions: [
      { label: "Explore my work", type: "section", href: "#work", primary: true },
      { label: "Get in touch", type: "section", href: "#contact" },
    ],
    scene: { phase: "sketch", focus: null, progress: 0, framing: { desktop: "world", portrait: "world" }, poster: "sketch" },
  },
  {
    id: "work",
    short: "The work",
    title: "From an idea to something useful.",
    motivation: ["Three projects, and the decisions that shaped them."],
    actions: [],
    scene: { phase: "blueprint", focus: null, progress: 0.4, framing: { desktop: "world", portrait: "world" }, poster: "blueprint" },
  },
  {
    id: "bplog",
    short: "BP Log",
    label: "Selected work · Personal project",
    title: "BP Log",
    subtitle: "A small AI system for an everyday problem.",
    motivation: ["A photo, a quick check, and a saved reading. BP Log reads a blood-pressure monitor and keeps the results on the phone, offline."],
    decision: { heading: "The decision", text: "I combined image-processing rules with a 54 KB neural model in plain JavaScript. I focused on recognition failures instead of adding a heavier runtime." },
    evidence: { text: "Public code and evaluation. Evaluated on one monitor; users check and confirm the readings.", kinds: ["public-code", "public-evaluation"] },
    actions: [{ label: "Code & evaluation", type: "source", href: links.bpLogSource }],
    index: { title: "BP Log", summary: "Practical AI · A small system for a specific task." },
    scene: { phase: "build", focus: "bplog", progress: 0.52, framing: { desktop: "focus", portrait: "focus" }, poster: "build" },
  },
  {
    id: "whisperbook",
    short: "Whisperbook",
    label: "Selected work · Personal project",
    title: "Whisperbook",
    subtitle: "Books I could listen to, on my own terms.",
    motivation: ["I wanted to enjoy books while walking or before sleep. The options I tried felt expensive or sounded robotic."],
    decision: { heading: "The decision", text: "I built an Android app that narrates EPUBs and PDFs on the phone, with character voices and synchronized text. Progressive preparation lets listening begin before the whole book is ready." },
    evidence: { text: "No subscription or cloud service. No runtime network permission. Public source and Android test release.", kinds: ["public-code"] },
    actions: [
      { label: "Source", type: "source", href: links.whisperbookSource },
      { label: "Test releases", type: "source", href: links.whisperbookReleases },
      { label: "Read Android case study", type: "case", ...cases.whispbook },
    ],
    index: { title: "Whisperbook", summary: "Product ownership · Audiobooks on my own terms." },
    scene: { phase: "build", focus: "whisperbook", progress: 0.66, framing: { desktop: "focus", portrait: "focus" }, poster: "whisperbook" },
  },
  {
    id: "energy-tools",
    short: "Energy tools",
    label: "Selected work · Research & independent tools",
    title: "pyRAPL, pyJoules & Wattch",
    subtitle: "Making energy measurement usable.",
    motivation: ["I designed pyRAPL for bounded Python experiments. GPU and other measurement sources led us to pyJoules."],
    decision: { heading: "The decision", text: "Restricted access and macOS work later led to Wattch: separate collection, evaluation and reporting, while keeping the developer’s workflow simple." },
    evidence: { text: "I designed both Python libraries and developed them with the research team. Wattch’s Rust implementation is AI-assisted. Hardware readings cover device activity during an interval; they do not automatically isolate one function’s energy.", kinds: ["public-code"] },
    actions: [
      { label: "Wattch case", type: "case", ...cases.wattch },
      { label: "pyRAPL source", type: "source", href: links.pyRAPL },
      { label: "pyJoules source", type: "source", href: links.pyJoules },
    ],
    index: { title: "pyRAPL, pyJoules & Wattch", summary: "Research discipline · Making measurement usable." },
    scene: { phase: "build", focus: "wattch", progress: 0.76, framing: { desktop: "focus", portrait: "focus" }, poster: "wattch" },
  },
  {
    id: "mcq-scan",
    short: "At MCQ Scan",
    label: "Professional experience · Lead AI Engineer · 2024–present",
    title: "MCQ Scan",
    subtitle: "The client’s cloud. A workable path to shipping.",
    motivation: ["The client wanted hosting in its Google Cloud environment. We wanted to deliver the application without handing over the source. The initial VM approach created security and access friction."],
    decision: { heading: "My contribution", text: "I implemented compiled application packaging for serverless deployment, accommodating the hosting requirement without distributing the source." },
    evidence: { text: "I coordinate a two-person technical team under the CTO. Company implementation and internal evaluations are not public.", kinds: ["internal-account"] },
    actions: [{ label: "More about my work at MCQ Scan", type: "case", ...cases.mcqScan }],
    index: { title: "At MCQ Scan", summary: "Shipping within business constraints.", professional: true },
    scene: { phase: "build", focus: "workshop", progress: 0.84, framing: { desktop: "focus", portrait: "focus" }, poster: "build" },
  },
  {
    id: "about",
    short: "About me",
    title: "Product building, research, and applied AI.",
    motivation: [
      "I co-founded a serious-games startup before moving into software-engineering research and then applied AI. Across those settings, I have worked on the product people interact with, the systems underneath it, and the evidence used to judge whether it works.",
      "Python is my strongest language. My work spans APIs, interfaces, model integration, and deployment. I use AI coding assistants and review and validate their output.",
    ],
    actions: [cvAction("Download CV"), linkedIn],
    scene: { phase: "build", focus: "about", progress: 0.93, framing: { desktop: "wide", portrait: "wide" }, poster: "build" },
  },
  {
    id: "contact",
    short: "Contact",
    title: "Let’s talk about what you’re building.",
    motivation: ["If you’re hiring an applied AI or product engineer, I’d be glad to hear about the problem, the people it serves, and the constraints you’re working with."],
    actions: [{ label: "Email me", type: "contact", href: links.email, primary: true }, linkedIn, cvAction("Download CV")],
    scene: { phase: "bloom", focus: null, progress: 1, framing: { desktop: "world", portrait: "world" }, poster: "bloom" },
  },
];

export const chapter = (id: ChapterId) => chapters.find(c => c.id === id)!;

/** About's career timeline: separate from the scene's growth data. */
export const timeline = [
  { years: "2014–2018", place: "Funecs", text: "Co-founder and CTO, working on product development, team leadership, and client delivery." },
  { years: "2018–2022", place: "Inria / Davidson Consulting", text: "Research engineering and energy-measurement tooling alongside my Ph.D. at the University of Lille / Inria." },
  { years: "2022–2024", place: "Inria, with Qarnot Computing as industrial partner", text: "Adaptation of the existing HWPC sensor to Qarnot’s infrastructure." },
  { years: "2024–present", place: "MCQ Scan", text: "Applied AI development, technical coordination, and delivery." },
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
