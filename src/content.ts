export type Spot = "whisperbook" | "wattch" | "about" | "contact";

export const projects = {
  whisperbook: {
    title: "Whisperbook",
    place: "The reading pavilion",
    field: "Local AI on Android",
    lede: "A book can stay yours, even when it speaks.",
    summary: "An Android app that narrates your EPUBs and PDFs on the device.",
    availability: "Android test APK · v0.1",
    status: "Installable test build for Android 8+ on arm64. The public v0.1 APK is debug-signed for direct testing, not Play Store distribution.",
    access: [
      { label: "Get the test APK ↗", url: "https://github.com/chakib-belgaid/whisper-book/releases/tag/v0.1" },
    ],
    performance: "On-device latency, narration speed, and peak RAM: no reproducible device benchmark is linked yet. The browser voice demo cannot establish these numbers.",
    releaseNote: "The source has evolved since v0.1; the release notes describe the downloadable build.",
    outcome: "Book import, chapter playback, local narration, and MP3 export in one reading flow.",
    limits: "The browser passage is an illustration using your device’s voices; it is not the Android app’s narration engine.",
    intro:
      "I built Whisperbook so you can listen to your own EPUBs and PDFs on Android, follow the text as it plays, and give different speakers different voices. The book and its audio stay on the device.",
    built:
      "I took it from the reading flow to the audio pipeline: importing books, finding chapters and speakers, assigning local voices, preparing narration, keeping playback in sync with the text, and exporting an MP3.",
    decision:
      "Privacy had to hold at the system boundary, so the Android app has no runtime network permission. It prepares finalized audio in small segments: you can start listening to the opening chapter while later ones are still being narrated.",
    tech: ["Kotlin", "Jetpack Compose", "Supertonic 3", "Media3"],
    url: "https://github.com/chakib-belgaid/whisper-book",
    image: "/assets/whisperbook.webp",
    size: [420, 920],
    alt: "Whisperbook's Android player showing the current chapter, the narrating voice, and playback controls",
    caption: "The player. Books and narration stay on the phone.",
  },
  wattch: {
    title: "Wattch Core",
    place: "The drum-recorder observatory",
    field: "Systems and energy",
    lede: "Know what you measured before you optimize it.",
    summary: "Linux energy traces for command-line, Python, and VS Code workflows.",
    availability: "Build from source",
    status: "Source-available developer tooling. Build the daemon and clients locally; the documented VS Code setup runs in an Extension Development Host.",
    access: [
      { label: "Build and run ↗", url: "https://github.com/chakib-belgaid/wattch-core#quick-start" },
      { label: "VS Code setup ↗", url: "https://github.com/chakib-belgaid/wattch-core/tree/main/editors/vscode-energy-tests#development" },
    ],
    performance: "Daemon CPU, memory, and sampling overhead versus a native C RAPL reader: no reproducible comparison is linked yet. Synthetic traces validate the workflow only.",
    releaseNote: "No GitHub release assets are published, and the project documentation does not link a Marketplace release. Checked 6 October 2026.",
    outcome: "A measurement daemon and clients that capture, validate, and replay raw energy traces.",
    limits: "The screenshot uses synthetic test data. The garden meter estimates this page’s rendering cost; it is not a Wattch hardware measurement.",
    intro:
      "Wattch Core helps developers bring machine energy data into their workflow. A Rust daemon reads Linux hardware counters and makes the raw trace available to command-line, Python, and VS Code tools.",
    built:
      "I built the boundary between privileged measurement and everyday tools: the daemon, typed protocol, capture and validation commands, replayable traces, Python client, and Energy Tests view in VS Code.",
    decision:
      "I wanted a result you could inspect later. The daemon collects data; clients interpret it. Raw traces remain replayable, and deterministic test data is marked as synthetic rather than presented as a hardware reading.",
    tech: ["Rust", "Linux RAPL", "Python", "VS Code"],
    url: "https://github.com/chakib-belgaid/wattch-core",
    image: "/assets/wattch.png",
    size: [1100, 620],
    alt: "The Energy Tests panel in VS Code listing results from a deterministic test run",
    caption:
      "Energy Tests on a deterministic run. These synthetic values check the workflow, not real energy use.",
  },
};

export const research = [
  { title: "pyJoules", url: "https://github.com/powerapi-ng/pyJoules", summary: "Python energy measurement", status: "Install with pip" },
  { title: "Joulehunter", url: "https://github.com/powerapi-ng/joulehunter", summary: "Find energy hotspots in Python", status: "Archived repository" },
  { title: "PowerAPI", url: "https://github.com/powerapi-ng/powerapi", summary: "Software-defined power meters", status: "Research framework" },
];

export const researchLinks = `<p class="project-shortcuts">${research.map(p => `<a href="${p.url}" target="_blank" rel="noopener noreferrer">${p.title} ↗</a>`).join(" · ")}</p>`;

export const spotOrder: Spot[] = ["whisperbook", "wattch", "about", "contact"];
export const spotNames: Record<Spot, string> = {
  whisperbook: "Whisperbook",
  wattch: "Wattch Core",
  about: "About me",
  contact: "Write to me",
};

/* The story is a run of beats. The garden holds still through a stage's beats
   and only grows between stages. Blueprint walks the career up the tower;
   Build walks through each project, a few notes per building; Bloom is where
   to write. */
export const stages = ["Sketch", "Blueprint", "Build", "Bloom"];
export const stageProgress = [0, 0.33, 0.66, 1];
export type WidgetSpot = Exclude<Spot, "about" | "contact">;
export type Beat = {
  stage: number;
  title: string;
  copy: string;
  label?: string;
  lede?: string;
  hint?: string;
  /** More of the note, after the copy (HTML). */
  body?: string;
  /** Lights a level of the tower (see highlightPath). */
  path?: number;
  /** The camera visits this building. */
  spot?: Spot;
  /** This building's widget mounts in the note's [data-widget] slot. */
  widget?: WidgetSpot;
};

/* Inside Whisperbook: its pipeline, from a book to its audio, a step at a
   time. Each step states one decision already in the project's record above
   (intro, built, decision); nothing here is a new claim. */
export const inside = [
  { title: "Book", text: "You import your own EPUB or PDF on the phone. Privacy holds at the system boundary: the app has no runtime network permission." },
  { title: "Chapters", text: "Chapters and their speakers are found in the text. Audio is prepared in small segments, so the opening chapter plays while later ones are still being narrated." },
  { title: "Voices", text: "Each speaker is given a different local voice, so a conversation reads as a cast. Narration runs on the device." },
  { title: "Audio", text: "Playback follows the text as it plays, and the finished book can be exported as an MP3." },
];
/** The steps as a list: read as a whole on the page, or one at a time in
 * the garden (see main.ts). `heading` is the level that fits around it. */
export function insideMarkup(id: string, heading: "h3" | "h4", stepped: boolean) {
  const p = projects.whisperbook;
  return `<section class="inside" data-inside="${id}" aria-labelledby="inside-${id}-title">
      <${heading} id="inside-${id}-title">Inside Whisperbook</${heading}>
      <p class="inside-intro">Four steps from a book to its audio.</p>
      ${stepped ? `<button type="button" class="chip inside-start" aria-expanded="false" aria-controls="inside-${id}-steps">Step inside</button>` : ""}
      <ol class="inside-steps" id="inside-${id}-steps"${stepped ? " hidden" : ""}>${inside.map((s, i) => `<li data-step="${i}" value="${i + 1}"><strong>${s.title}</strong> <span>${s.text}</span></li>`).join("")}</ol>
      ${stepped ? `<div class="inside-controls" hidden><button type="button" class="link small" data-inside-back>Back</button><span class="inside-count" aria-live="polite"></span><button type="button" class="link small" data-inside-next>Next</button><button type="button" class="link small" data-inside-close>Close</button></div>` : ""}
      <p class="inside-source"><a href="${p.url}" target="_blank" rel="noopener noreferrer">Read the source on GitHub ↗</a></p>
    </section>`;
}

/* Each project has an introduction, a browser illustration, what I built, and
   the decision that shaped it, with its screenshot. */
function projectBeats(spot: "whisperbook" | "wattch"): Beat[] {
  const p = projects[spot];
  return [
    {
      stage: 2,
      label: p.place,
      title: p.title,
      lede: p.lede,
      copy: p.summary,
      body: `<dl class="note-facts">
          <div><dt>Field</dt><dd>${p.field}</dd></div>
          <div><dt>Built with</dt><dd>${p.tech.join(", ")}</dd></div>
          <div><dt>Project status</dt><dd>${p.status}</dd></div>
          <div><dt>Try it</dt><dd>${p.access.map(a => `<a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.label}</a>`).join(" · ")}</dd></div>
          <div><dt>Outcome</dt><dd>${p.outcome}</dd></div>
          <div><dt>Scope and limits</dt><dd>${p.limits}</dd></div>
          <div><dt>Source</dt><dd><a href="${p.url}" target="_blank" rel="noopener noreferrer">Read it on GitHub</a></dd></div>
        </dl>`,
      spot,
    },
    {
      stage: 2,
      label: p.title,
      title: "A small illustration",
      copy: spot === "whisperbook"
        ? "Hear an excerpt in your browser’s local voice. Whisperbook uses its own on-device narration on Android."
        : "Watch what drawing this page costs your device: CPU and GPU time per frame, and the estimated carbon of that work. Browsers report time, not power, so the energy is an estimate.",
      body: `<section class="note-widget try"><div data-widget></div></section>`,
      spot,
      widget: spot,
    },
    {
      stage: 2,
      label: p.title,
      title: "What I built",
      copy: p.built,
      body: `${spot === "whisperbook" ? insideMarkup("garden", "h3", true) : ""}<h3>Performance evidence</h3><p>${p.performance}</p>`,
      spot,
    },
    {
      stage: 2,
      label: p.title,
      title: "The decision that shaped it",
      copy: p.decision,
      body: `<figure class="proof proof-${spot}">
          <a href="${p.image}" data-evidence="${spot}" aria-label="View full screenshot of ${p.title}"><img src="${p.image}" alt="${p.alt}" width="${p.size[0]}" height="${p.size[1]}" decoding="async" loading="lazy" /></a>
          <figcaption>${p.caption} <a href="${p.image}" data-evidence="${spot}">View full screenshot</a></figcaption>
        </figure>`,
      spot,
    },
  ];
}
export const email = "chakib.belgaid@gmail.com";
/** The cue beside "scroll" hints: a mouse whose wheel rolls down, or on touch
 * screens two chevrons that bob, so the hint reads as an action. */
export const scrollCue = `<svg class="scroll-cue-icon" viewBox="0 0 20 28" aria-hidden="true"><g class="cue-mouse"><rect x="3" y="1.5" width="14" height="23" rx="7"/><path class="cue-wheel" d="M10 6.5v3.5"/></g><g class="cue-swipe"><path d="M5 8l5 5 5-5M5 14l5 5 5-5"/></g></svg>`;
const envelopeIcon = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3.5 6.5h17v11h-17zM4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const socialIcons = {
  github: `<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.08c-3.1.68-3.76-1.31-3.76-1.31-.5-1.29-1.23-1.63-1.23-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.67.11 2.95.72.78 1.15 1.77 1.15 2.99 0 4.29-2.62 5.24-5.11 5.52.4.35.76 1.03.76 2.08V22c0 .29.2.63.77.53A11.1 11.1 0 0 0 12 .9Z"/></svg>`,
  linkedin: `<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M5.2 7.8a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2ZM3.4 9.4H7v11.2H3.4zM9.2 9.4h3.4v1.5h.05a3.73 3.73 0 0 1 3.36-1.85c3.6 0 4.27 2.37 4.27 5.45v6.1h-3.55v-5.41c0-1.29-.02-2.94-1.79-2.94-1.8 0-2.07 1.4-2.07 2.85v5.5H9.2z"/></svg>`,
  instagram: `<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3.1" y="3.1" width="17.8" height="17.8" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.8" cy="6.5" r="1.15" fill="currentColor"/></svg>`,
  x: `<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M18.9 3h2.8l-6.1 7 7.2 11h-5.6l-4.4-6.7L7 21H4.2l6.5-7.5L3.8 3h5.8l4 6.1L18.9 3Zm-1 16h1.5L8.7 4.9H7.1L17.9 19Z"/></svg>`,
};
const socialLink = (name: string, href: string, icon: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${name}" title="${name}">${icon}</a>`;
export const contactMarkup = `<p class="note-email"><a href="mailto:${email}">${envelopeIcon}<span>Email me</span><span class="email-address">${email}</span></a></p>
  <nav class="note-links" aria-label="Social links">${socialLink("GitHub", "https://github.com/chakib-belgaid", socialIcons.github)}${socialLink("LinkedIn", "https://www.linkedin.com/in/chakib-belgaid", socialIcons.linkedin)}${socialLink("Instagram", "https://www.instagram.com/chakib.med", socialIcons.instagram)}${socialLink("X", "https://x.com/chakib_med", socialIcons.x)}</nav>`;
export const beats: Beat[] = [
  {
    stage: 0,
    title: "Chakib Belgaid",
    copy: "I’m a product engineer with a Ph.D. in software engineering. I build AI products and developer tools, with a long-running interest in how we measure the energy software uses.",
    body: `<div class="entry-actions"><a class="primary-action" href="#work">Selected work</a><a href="?view=read" data-view="read">Read portfolio</a></div><p class="project-shortcuts"><a href="#whisperbook">Whisperbook</a> · <a href="#wattch">Wattch Core</a></p>`,
    hint: "Scroll, or drag the ruler, to build the garden.",
  },
  {
    stage: 1,
    title: "I start with the question",
    copy: "Can a phone narrate a book without uploading it? What can an energy trace actually tell us? I work from questions like these through the interface, model or measurement system they need. I like making the whole thing usable, then checking whether it does what I claim.",
    hint: "The tower holds the path so far, from the ground up.",
  },
  {
    stage: 1,
    label: "2014–2018",
    title: "Co-founder and CTO, Funecs",
    copy: "I co-founded a serious-games advertising startup and led its product, engineering, and client delivery.",
    path: 0,
  },
  {
    stage: 1,
    label: "2018–2022",
    title: "Ph.D., University of Lille and Inria",
    copy: "I studied how to measure and improve software energy use, grounding the work in experiments rather than assumptions.",
    path: 1,
  },
  {
    stage: 1,
    label: "2022–2024",
    title: "Research engineer, Qarnot Computing and Inria",
    copy: "I helped turn energy-measurement research into working infrastructure, including a PowerAPI deployment across more than 100 computing nodes.",
    body: researchLinks,
    path: 2,
  },
  {
    stage: 1,
    label: "2024–now",
    title: "Lead AI engineer, MCQ Scan",
    copy: "I work across agent workflows, model optimization, APIs, interfaces, and deployment to bring applied AI into production use.",
    path: 3,
  },
  {
    stage: 2,
    title: "The boundaries matter",
    body: `<p class="project-shortcuts"><a href="#whisperbook">Whisperbook</a> · <a href="#wattch">Wattch Core</a></p>`,
    copy: "An offline promise should be enforced by the app. An energy claim should lead back to its source data. Those choices shape the systems I build as much as the screens you can see.",
  },
  ...projectBeats("whisperbook"),
  ...projectBeats("wattch"),
  {
    stage: 3,
    label: "The greenhouse",
    title: "Write to me",
    copy: "I’d like to hear what you’re building.",
    body: contactMarkup,
  },
];
// The first beat of each stage, where the ruler's stage ticks point.
export const stageStart = stages.map((_, s) => beats.findIndex((b) => b.stage === s));
// Where the masthead links and the building labels lead.
export const spotBeat: Record<Spot, number> = {
  whisperbook: beats.findIndex((b) => b.spot === "whisperbook"),
  wattch: beats.findIndex((b) => b.spot === "wattch"),
  about: stageStart[1],
  contact: stageStart[3],
};


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
