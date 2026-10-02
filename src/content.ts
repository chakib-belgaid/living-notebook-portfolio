export type Spot = "whisperbook" | "wattch" | "about" | "contact";

export const projects = {
  whisperbook: {
    title: "Whisperbook",
    place: "The reading pavilion",
    field: "Local AI on Android",
    lede: "A book can stay yours, even when it speaks.",
    summary: "An Android app that narrates your EPUBs and PDFs on the device.",
    status: "Source code and an Android player screenshot are linked here. Release availability is not documented on this page.",
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
    status: "Source code and a VS Code screenshot are linked here. Release availability is not documented on this page.",
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
export type WidgetSpot = Exclude<Spot, "about">;
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
      copy: p.intro,
      body: `<dl class="note-facts">
          <div><dt>Field</dt><dd>${p.field}</dd></div>
          <div><dt>Built with</dt><dd>${p.tech.join(", ")}</dd></div>
          <div><dt>Project status</dt><dd>${p.status}</dd></div>
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
    { stage: 2, label: p.title, title: "What I built", copy: p.built, spot },
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
    body: `<p class="note-email"><a href="mailto:${email}">${email}</a></p>
      <section class="note-widget" data-widget></section>
      <p class="note-links"><a href="https://github.com/chakib-belgaid" target="_blank" rel="noopener noreferrer">GitHub</a> <a href="https://www.linkedin.com/in/chakib-belgaid" target="_blank" rel="noopener noreferrer">LinkedIn</a> <a href="https://www.instagram.com/chakib.med" target="_blank" rel="noopener noreferrer">Instagram</a> <a href="https://x.com/chakib_med" target="_blank" rel="noopener noreferrer">X</a></p>`,
    widget: "contact",
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
