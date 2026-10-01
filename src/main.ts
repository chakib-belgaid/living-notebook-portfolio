import "./style.css";
import type { Garden, Season } from "./scene";
import { createSky } from "./sky";
import {
  currentWeather,
  placeFromDevice,
  placeFromTimeZone,
  presets,
  type Place,
  type Weather,
  type WeatherKind,
} from "./weather";

type Spot = "whisperbook" | "wattch" | "about" | "contact";

const projects = {
  whisperbook: {
    title: "Whisperbook",
    place: "The reading pavilion",
    field: "Local AI on Android",
    lede: "Your books, given a voice.",
    intro:
      "An offline Android app that turns your own EPUBs and PDFs into multi-voice audiobooks, with synchronized reading. Nothing is uploaded.",
    built:
      "I designed and built it end to end: document import, speaker attribution, local voice casting, progressive narration, playback, and MP3 export.",
    decision:
      "Privacy is part of the architecture. The app has no network permission at runtime. Audio is prepared in small, finalized segments, so the first chapter can play while the rest of the book is still being narrated.",
    tech: ["Kotlin", "Jetpack Compose", "Supertonic 3", "Media3"],
    url: "https://github.com/chakib-belgaid/whisper-book",
    image: "/assets/whisperbook.webp",
    size: [420, 920],
    alt: "Whisperbook's Android player showing the current chapter, the narrating voice, and playback controls",
    caption: "The player. Books and narration stay on the phone.",
  },
  wattch: {
    title: "Wattch Core",
    place: "The water-wheel observatory",
    field: "Systems and energy",
    lede: "Energy measurement developers can rely on.",
    intro:
      "A foundation for energy-aware software. A Rust daemon connects hardware counters to reproducible traces, Python workflows, and editor tools.",
    built:
      "I designed and implemented the daemon and client boundary, the typed protocol, deterministic validation, replayable capture tools, the Python client, and the Energy Tests workflow for VS Code.",
    decision:
      "Keep the evidence intact. Privileged acquisition is separated from everyday clients, raw traces stay replayable, and synthetic test data is always labeled as synthetic, never passed off as a hardware measurement.",
    tech: ["Rust", "Linux RAPL", "Python", "VS Code"],
    url: "https://github.com/chakib-belgaid/wattch-core",
    image: "/assets/wattch.png",
    size: [1100, 620],
    alt: "The Energy Tests panel in VS Code listing results from a deterministic test run",
    caption:
      "Energy Tests on a deterministic run. These synthetic values check the workflow, not real energy use.",
  },
};

const spotOrder: Spot[] = ["whisperbook", "wattch", "about", "contact"];
const spotNames: Record<Spot, string> = {
  whisperbook: "Whisperbook",
  wattch: "Wattch Core",
  about: "About me",
  contact: "Write to me",
};

/* The story is a run of beats. The garden holds still through a stage's beats
   and only grows between stages. Blueprint walks the career up the tower;
   Build walks through each project, a few notes per building; Bloom is where
   to write. */
const stages = ["Sketch", "Blueprint", "Build", "Bloom"];
const stageProgress = [0, 0.33, 0.66, 1];
type WidgetSpot = Exclude<Spot, "about">;
type Beat = {
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

/* A project as three notes: what it is (and a try of it), what I built, and
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
          <div><dt>Source</dt><dd><a href="${p.url}" target="_blank" rel="noopener noreferrer">Read it on GitHub</a></dd></div>
        </dl>
        <section class="note-widget try"><h3>Try it</h3><div data-widget></div></section>`,
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
          <img src="${p.image}" alt="${p.alt}" width="${p.size[0]}" height="${p.size[1]}" decoding="async" />
          <figcaption>${p.caption}</figcaption>
        </figure>`,
      spot,
    },
  ];
}
const email = "chakib.belgaid@gmail.com";
const beats: Beat[] = [
  {
    stage: 0,
    title: "Chakib Belgaid",
    copy: "Product engineer, Ph.D. I build applied AI, developer tools, and software that can account for the energy it uses.",
    hint: "Scroll, or drag the ruler, to build the garden.",
  },
  {
    stage: 1,
    title: "A question first, then a structure",
    copy: "Can a phone narrate a whole book without sending a page to a server? How much energy does a test suite use? I write the question down, then draw the system that could answer it. I like following an idea all the way from a rough sketch to something people can use, and checking what is actually true along the way.",
    hint: "The tower holds the path so far, from the ground up.",
  },
  {
    stage: 1,
    label: "2014–2018",
    title: "Co-founder and CTO, Funecs",
    copy: "Led product, engineering and client delivery for a serious-games advertising startup.",
    path: 0,
  },
  {
    stage: 1,
    label: "2018–2022",
    title: "Ph.D., University of Lille and Inria",
    copy: "Doctoral research on green coding and empirical, energy-aware software engineering.",
    path: 1,
  },
  {
    stage: 1,
    label: "2022–2024",
    title: "Research engineer, Qarnot Computing and Inria",
    copy: "Moved energy-measurement research toward operational infrastructure and deployed PowerAPI across 100+ nodes.",
    path: 2,
  },
  {
    stage: 1,
    label: "2024–now",
    title: "Lead AI engineer, MCQ Scan",
    copy: "Leads production-facing agent workflows, model optimization, APIs, frontend integration and deployment.",
    path: 3,
  },
  {
    stage: 2,
    title: "Constraints decided early",
    copy: "Whisperbook has no network permission at all. Wattch keeps raw traces replayable and labels synthetic data as synthetic. Most of the work is in decisions people never see.",
  },
  ...projectBeats("whisperbook"),
  ...projectBeats("wattch"),
  {
    stage: 3,
    label: "The greenhouse",
    title: "Write to me",
    copy: "For product engineering, applied AI, or energy-aware software.",
    body: `<p class="note-email"><a href="mailto:${email}">${email}</a></p>
      <section class="note-widget" data-widget></section>
      <p class="note-links"><a href="https://github.com/chakib-belgaid" target="_blank" rel="noopener noreferrer">GitHub</a> and <a href="https://www.linkedin.com/in/chakib-belgaid" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>`,
    widget: "contact",
  },
];
// The first beat of each stage, where the ruler's stage ticks point.
const stageStart = stages.map((_, s) => beats.findIndex((b) => b.stage === s));
// Where the masthead links and the building labels lead.
const spotBeat: Record<Spot, number> = {
  whisperbook: beats.findIndex((b) => b.spot === "whisperbook"),
  wattch: beats.findIndex((b) => b.spot === "wattch"),
  about: stageStart[1],
  contact: stageStart[3],
};

/* Headline letters are wrapped so they can be set in one after another. */
function lettered(text: string) {
  let i = 0;
  const words = text
    .split(" ")
    .map(
      (w) =>
        `<span class="word">${[...w].map((c) => `<span class="char" style="--i:${i++}">${c}</span>`).join("")}</span>`,
    )
    .join(" ");
  return `<span class="sr-only">${text}</span><span aria-hidden="true">${words}</span>`;
}

const sunIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>`;
const moonIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.8A8 8 0 0 1 9.2 4.5a8 8 0 1 0 10.3 10.3Z"/></svg>`;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="stage" id="stage">
    <canvas class="sky sky-back" aria-hidden="true"></canvas>
    <div id="scene" role="img" aria-label="A garden of stone terraces, pavilions, and water. It is drawn first as pencil lines, then as a blue engineering drawing, then built and planted."></div>
    <p class="scene-fallback" hidden>The garden can’t be drawn in this browser. Everything else on the page still works.</p>
    <canvas class="sky sky-front" aria-hidden="true"></canvas>
    ${spotOrder.map((s) => `<div class="hotspot" data-spot="${s}"><button type="button" class="hotspot-title" data-open="${s}" tabindex="-1">${spotNames[s]}</button></div>`).join("")}
  </div>

  <header class="masthead">
    <a class="owner" href="#" data-home>Chakib Belgaid</a>
    <nav aria-label="Sections">
      <button type="button" class="link" data-open="whisperbook">Work</button>
      <button type="button" class="link" data-open="about">About</button>
      <button type="button" class="link" data-open="contact">Contact</button>
    </nav>
  </header>

  <main class="chapters">
    ${beats
      .map(
        (b, i) => `${i > 0 && b.stage !== beats[i - 1].stage ? `
      <div class="move" data-move="${i}" aria-hidden="true"></div>` : ""}
      <section class="chapter" data-chapter="${i}" aria-labelledby="chapter-${i}">
        <div class="note">
          <p class="note-stage">${stages[b.stage]}${b.label ? ` · ${b.label}` : ""}</p>
          ${i === 0 ? `<h1 id="chapter-${i}" tabindex="-1">${lettered(b.title)}</h1>` : `<h2 id="chapter-${i}" tabindex="-1">${lettered(b.title)}</h2>`}
          ${b.lede ? `<p class="note-lede">${b.lede}</p>` : ""}
          <p class="note-copy">${b.copy}</p>
          ${b.body ? `<div class="note-body">${b.body}</div>` : ""}
          ${b.hint ? `<p class="note-hint">${b.hint}</p>` : ""}
        </div>
      </section>`,
      )
      .join("")}
  </main>

  <div class="ruler">
    <div class="ruler-track">
      <input type="range" id="scrub" min="0" max="1000" step="1" value="0" aria-label="Story" />
      <div class="ruler-ticks" aria-hidden="true">
        ${beats.map((_, i) => `<span class="ruler-dot" data-dot="${i}"></span>`).join("")}
        ${stages.map((s, i) => `<button type="button" tabindex="-1" data-go="${i}">${s}</button>`).join("")}
      </div>
    </div>
    <button type="button" class="ruler-motion" id="motion-toggle" aria-pressed="false" aria-label="Pause motion" title="Pause motion"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path class="icon-pause" d="M8 5.5v13M16 5.5v13"/><path class="icon-play" d="M8 5.5v13l10-6.5Z"/></svg></button>
  </div>

  <aside class="dock" aria-label="Garden controls">
    <section class="widget widget-carbon" data-from="0" aria-labelledby="carbon-label">
      <p class="carbon-figure" aria-live="off" data-carbon-figure>—</p>
      <p class="carbon-label" id="carbon-label">This page’s carbon footprint so far</p>
      <p class="widget-fine carbon-source" data-carbon-source></p>
    </section>

    <section class="widget widget-sky" data-from="3" aria-labelledby="sky-title">
      <div class="widget-head">
        <h3 id="sky-title">Sky</h3>
        <output id="hour-readout" for="hour">1:00 pm</output>
      </div>
      <p class="sky-report" id="sky-report" aria-live="polite">Looking up the weather</p>
      <div class="sky-arc" aria-hidden="true"><span class="sky-body"></span></div>
      <input type="range" id="hour" min="5" max="23" step="0.25" value="13" aria-label="Time of day" />
      <div class="weather-chips" role="group" aria-label="Weather">
        <button type="button" class="chip" data-weather="live" aria-pressed="true">Live</button>
        ${(["clear", "cloudy", "rain", "snow", "storm", "fog"] as WeatherKind[]).map((k) => `<button type="button" class="chip" data-weather="${k}" aria-pressed="false">${{ clear: "Clear", cloudy: "Clouds", rain: "Rain", snow: "Snow", storm: "Storm", fog: "Fog" }[k as "clear"]}</button>`).join("")}
      </div>
      <p class="widget-foot">
        <button type="button" class="link small" id="hour-now">Use my clock</button>
        <button type="button" class="link small" id="locate">Use my exact location</button>
      </p>
      <p class="widget-foot credit"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo</a></p>
    </section>

    <section class="widget widget-garden" data-from="3" aria-labelledby="garden-title">
      <div class="widget-head">
        <h3 id="garden-title">Garden</h3>
        <output id="tree-count">0 of 24 trees</output>
      </div>
      <p class="season-report" id="season-report" aria-live="polite"></p>
      <div class="weather-chips" role="group" aria-label="Season">
        <button type="button" class="chip" data-season="now" aria-pressed="true">Now</button>
        ${(["spring", "summer", "autumn", "winter"] as Season[]).map((k) => `<button type="button" class="chip" data-season="${k}" aria-pressed="false">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}
      </div>
      <div class="widget-actions">
        <button type="button" class="chip" id="plant-mode" aria-pressed="false">Plant by clicking</button>
        <button type="button" class="chip" id="plant-one">Plant one</button>
        <button type="button" class="chip" id="turn">Turn</button>
      </div>
    </section>
  </aside>

  <div class="mist" aria-hidden="true"></div>
  <p id="announce" class="sr-only" role="status"></p>
`;

const root = document.documentElement;
const $ = <E extends HTMLElement>(s: string) => document.querySelector<E>(s)!;
const $$ = <E extends HTMLElement>(s: string) => [
  ...document.querySelectorAll<E>(s),
];
let garden: Garden | undefined;
// 0–1 mist over the garden and the page, set by the weather.
let fog = 0;
const sky = createSky($(".sky-back"), $(".sky-front"));
const announce = (text: string) => ($("#announce").textContent = text);

/* The notebook is always drawn on blueprint paper. */
function syncTheme() {
  garden?.setTheme(true);
  sky.refresh(true);
  applyFog();
}
syncTheme();

/* Motion. */
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduced = reducedQuery.matches;
let paused = reduced;
const motionButton = $<HTMLButtonElement>("#motion-toggle");
function syncMotion() {
  motionButton.setAttribute("aria-pressed", String(paused));
  motionButton.title = paused ? "Resume motion" : "Pause motion";
  garden?.setMotion(paused);
  sky.setMotion(paused);
}
motionButton.addEventListener("click", () => {
  paused = !paused;
  syncMotion();
});
reducedQuery.addEventListener("change", (e) => {
  reduced = e.matches;
  paused = reduced;
  syncMotion();
  measure();
});
syncMotion();

/* Scroll → story. Each beat's section is a stretch where the garden holds
   still. A stage's first section is preceded by a move, where the garden grows
   from the previous stage: the old note leaves as it starts, and the new note
   sets in once the garden has settled. */
const chapterEls = $$<HTMLElement>(".chapter");
const moveEls = new Map(
  $$<HTMLElement>(".move").map((m) => [Number(m.dataset.move), m]),
);
const scrub = $<HTMLInputElement>("#scrub");
const hotspots = $$<HTMLElement>(".hotspot");
const widgets = $$<HTMLElement>(".widget");
let stage = -1;
// The beat whose note is showing; -1 while the garden moves between stages.
let beat = -1;

const maxScroll = () => Math.max(1, root.scrollHeight - innerHeight);
// Where a beat's hold starts.
const holdAt = (i: number) => Math.min(chapterEls[i].offsetTop, maxScroll());

function storyAt(y: number) {
  let i = 0;
  while (i + 1 < beats.length && y >= holdAt(i + 1)) i++;
  const move = moveEls.get(i + 1);
  if (move && y > move.offsetTop) {
    const t = Math.min(1, (y - move.offsetTop) / Math.max(1, holdAt(i + 1) - move.offsetTop));
    const from = beats[i].stage,
      to = beats[i + 1].stage;
    return {
      beat: -1,
      stage: t < 0.5 ? from : to,
      growth: stageProgress[from] + (stageProgress[to] - stageProgress[from]) * smoothstep(0, 1, t),
    };
  }
  return { beat: i, stage: beats[i].stage, growth: stageProgress[beats[i].stage] };
}

/* The ruler is the whole story: a dot for each beat, a label at each stage. */
let rulerFor = "";
function layoutRuler() {
  const max = maxScroll();
  const key = `${max}:${innerHeight}`;
  if (key === rulerFor) return;
  rulerFor = key;
  $$<HTMLElement>("[data-dot]").forEach((d, i) =>
    d.style.setProperty("--at", (holdAt(i) / max).toFixed(4)),
  );
  $$<HTMLElement>("[data-go]").forEach((b, s) =>
    b.style.setProperty("--at", (holdAt(stageStart[s]) / max).toFixed(4)),
  );
}

/* The camera follows the story: a lit level of the tower in Blueprint, a
   building in Build. */
const narrow = matchMedia("(max-width: 899px)");
function syncStory() {
  const b = beats[beat];
  garden?.highlightPath(b?.path ?? null);
  if (b?.spot)
    garden?.focus(b.spot, narrow.matches ? 0 : 0.16, narrow.matches ? 0 : 0.04);
  else garden?.focus(null);
}

/* The dock's widgets come out with the stage. On narrow screens the dock is a
   row along the bottom and, before Bloom, that space belongs to the note, so
   every widget (the carbon card too) waits for Bloom. */
function syncWidgets() {
  widgets.forEach((w) => {
    const from = narrow.matches ? 3 : Number(w.dataset.from);
    const show = stage >= from;
    w.classList.toggle("shown", show);
    w.inert = !show;
  });
}

/* On narrow screens the garden sits at the top, in a frame of one size per
   stage: from below the masthead down to the top of that stage's tallest
   note, so no note of the stage covers it. The camera eases from one frame
   to the next as the stage changes. */
let frames: [number, number][] = [];
// A note's widget is only mounted while it shows, so each slot keeps the
// height its widget takes, measured once per width by mounting it briefly.
let slotsFor = 0;
function sizeSlots() {
  if (innerWidth === slotsFor) return;
  slotsFor = innerWidth;
  chapterEls.forEach((c, i) => {
    const b = beats[i];
    const slot = c.querySelector<HTMLElement>("[data-widget]");
    if (!b.widget || !slot) return;
    slot.style.minHeight = "";
    const cleanup = i === beat ? null : mountProjectWidget(b.widget, slot);
    slot.style.minHeight = `${slot.offsetHeight}px`;
    cleanup?.();
  });
}
function measureFrames() {
  if (!narrow.matches) return frameGarden();
  sizeSlots();
  const h = $("#scene").clientHeight || innerHeight;
  const top = $(".masthead").offsetHeight;
  frames = stages.map((_, s) => {
    let bottom = h;
    chapterEls.forEach((c, i) => {
      if (beats[i].stage !== s) return;
      const note = c.querySelector<HTMLElement>(".note")!;
      const noteTop = h - parseFloat(getComputedStyle(note).bottom) - note.offsetHeight;
      bottom = Math.min(bottom, noteTop - 16);
    });
    return [top / h, Math.max(bottom, top + 0.15 * h) / h];
  });
  frameGarden();
}
function frameGarden() {
  const f = narrow.matches ? frames[stage] : undefined;
  garden?.frame(f?.[0] ?? 0, f?.[1] ?? 1);
}

/* One widget is mounted at a time, in the active note. */
let widgetCleanup: (() => void) | null = null;
function mountNoteWidget() {
  widgetCleanup?.();
  widgetCleanup = null;
  const b = beats[beat];
  const slot = chapterEls[beat]?.querySelector<HTMLElement>("[data-widget]");
  if (b?.widget && slot) widgetCleanup = mountProjectWidget(b.widget, slot);
}

/* Links scroll the story to a beat; once there, focus moves to its heading. */
let focusTo = -1;
function focusHeading(i: number) {
  chapterEls[i].querySelector<HTMLElement>("h1, h2")!.focus({ preventScroll: true });
}
function goTo(i: number) {
  setPlanting(false);
  scrollTo({ top: holdAt(i), behavior: reduced ? "instant" : "smooth" });
  if (beat === i) focusHeading(i);
  else focusTo = i;
}

function measure() {
  layoutRuler();
  const now = storyAt(scrollY);
  const s = now.stage;
  const growth = reduced ? stageProgress[s] : now.growth;
  root.style.setProperty("--grow", growth.toFixed(3));
  if (document.activeElement !== scrub)
    scrub.value = String(Math.round((scrollY / maxScroll()) * 1000));
  scrub.setAttribute(
    "aria-valuetext",
    now.beat < 0
      ? `Growing into ${stages[s]}`
      : `${stages[s]}, note ${now.beat + 1} of ${beats.length}`,
  );
  if (s !== stage) {
    stage = s;
    root.dataset.stage = String(s);
    sky.refresh(true);
    $$<HTMLButtonElement>("[data-go]").forEach((b, i) =>
      b.classList.toggle("current", i === s),
    );
    syncWidgets();
    frameGarden();
  }
  if (now.beat !== beat) {
    beat = now.beat;
    chapterEls.forEach((c, i) => {
      const active = i === beat;
      c.classList.toggle("active", active);
      c.querySelector<HTMLElement>(".note")!.inert = !active;
    });
    $$<HTMLElement>("[data-dot]").forEach((d, i) =>
      d.classList.toggle("current", i === beat),
    );
    mountNoteWidget();
    syncStory();
    if (beat >= 0 && beat === focusTo) {
      focusTo = -1;
      focusHeading(beat);
    }
  }
  const live = growth > 0.86 && !!garden;
  hotspots.forEach((h) => {
    h.classList.toggle("visible", live);
    h.querySelector("button")!.tabIndex = live ? 0 : -1;
    h.inert = !live;
  });
  garden?.setProgress(growth, reduced);
  sky.setGrowth(growth);
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    measure();
  });
}
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", () => {
  schedule();
  measureFrames();
});
// A link's scroll that ends short of its beat (the visitor took over) drops
// the focus it would have moved.
addEventListener("scrollend", () => {
  measure();
  focusTo = -1;
});

scrub.addEventListener("input", () =>
  scrollTo({ top: (Number(scrub.value) / 1000) * maxScroll(), behavior: "instant" }),
);
$$<HTMLButtonElement>("[data-go]").forEach((b) =>
  b.addEventListener("click", () =>
    scrollTo({
      top: holdAt(stageStart[Number(b.dataset.go)]),
      behavior: reduced ? "instant" : "smooth",
    }),
  ),
);
$("[data-home]").addEventListener("click", (e) => {
  e.preventDefault();
  scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
});

/* Light: the garden follows the visitor's clock until they pick an hour. */
const hourInput = $<HTMLInputElement>("#hour");
function clockHour() {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.round((h < 5 ? 23 : Math.min(h, 23)) * 4) / 4;
}
function formatHour(h: number) {
  const hh = Math.floor(h),
    mm = Math.round((h - hh) * 60);
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "pm" : "am"}`;
}
const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
let isNight: boolean | null = null;
// Blueprint paper: a lighter blue by day, the deep blue at night. The day
// blue is as light as it can be while the muted text keeps 4.5:1 contrast.
const dayPaper = [0x1c, 0x4b, 0x7c],
  nightPaper = [0x0e, 0x2b, 0x48];
function setPaper(night: number) {
  const paper =
    "#" +
    dayPaper
      .map((d, i) =>
        Math.round(d + (nightPaper[i] - d) * night)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  root.style.setProperty("--paper", paper);
  $("meta[name=theme-color]").setAttribute("content", paper);
  sky.refresh(true);
  applyFog();
}
function setHour(h: number) {
  hourInput.value = String(h);
  $("#hour-readout").textContent = formatHour(h);
  hourInput.setAttribute("aria-valuetext", formatHour(h));
  const night = Math.min(
    1,
    smoothstep(19.2, 21.5, h) + (1 - smoothstep(5, 6.6, h)),
  );
  root.style.setProperty("--night", night.toFixed(3));
  setPaper(night);
  root.style.setProperty(
    "--arc",
    Math.min(Math.max((h - 5) / 18, 0), 1).toFixed(3),
  );
  if (isNight !== night > 0.5) {
    isNight = night > 0.5;
    $(".sky-body").innerHTML = isNight ? moonIcon : sunIcon;
  }
  garden?.setHour(h);
  sky.setHour(h);
}
hourInput.addEventListener("input", () => setHour(Number(hourInput.value)));
$("#hour-now").addEventListener("click", () => {
  setHour(clockHour());
  announce(`Light set to ${formatHour(clockHour())}.`);
});
setHour(clockHour());

/* Weather: live from the visitor's place, or a chosen preview. */
let place: Place | null = null;
let live: Weather | null = null;
let weatherMode: "live" | WeatherKind = "live";
const report = $("#sky-report");
const fogByKind: Record<WeatherKind, number> = {
  clear: 0,
  partly: 0,
  cloudy: 0.1,
  fog: 1,
  drizzle: 0.3,
  rain: 0.35,
  snow: 0.4,
  storm: 0.45,
};
function applyFog() {
  const paper = getComputedStyle(root).getPropertyValue("--paper").trim();
  garden?.setFog(fog, parseInt(paper.slice(1), 16) || 0xf1f2ee);
  // Capped so the notes stay readable through the thickest fog.
  $(".mist").style.opacity = String(fog * 0.6);
}
function currentWeatherState() {
  return weatherMode === "live" ? (live ?? presets.partly) : presets[weatherMode];
}
function applyWeather() {
  const w = currentWeatherState();
  fog = fogByKind[w.kind];
  applyFog();
  sky.setWeather(w);
  garden?.setWeather(w.cloud, w.precip);
  root.dataset.weather = w.kind;
  $$<HTMLButtonElement>("[data-weather]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.weather === weatherMode)),
  );
  if (weatherMode !== "live")
    report.textContent = `Previewing ${w.label.toLowerCase()}.`;
  else if (live && place)
    report.textContent = `${live.label}, ${Math.round(live.temperature ?? 0)}°C in ${place.name}.`;
}
async function loadWeather(from: Place) {
  live = await currentWeather(from);
  place = from;
  applyWeather();
  applySeason();
}

/* Seasons follow the date and the hemisphere of the weather location. */
let seasonMode: "now" | Season = "now";
function seasonNow(): Season {
  const month = new Date().getMonth();
  const north: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const s = north[month];
  if (!place || place.latitude >= 0) return s;
  return ({ spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" } as const)[s];
}
function applySeason() {
  const s = seasonMode === "now" ? seasonNow() : seasonMode;
  garden?.setSeason(s);
  root.dataset.season = s;
  const name = s[0].toUpperCase() + s.slice(1);
  $("#season-report").textContent =
    seasonMode !== "now"
      ? `Previewing ${s}.`
      : place
        ? `${name} in ${place.name}.`
        : `${name}.`;
  $$<HTMLButtonElement>("[data-season]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.season === seasonMode)),
  );
}
$$<HTMLButtonElement>("[data-season]").forEach((b) =>
  b.addEventListener("click", () => {
    seasonMode = b.dataset.season as typeof seasonMode;
    applySeason();
  }),
);
async function startWeather() {
  try {
    let granted = false;
    try {
      granted =
        (await navigator.permissions?.query({ name: "geolocation" }))
          ?.state === "granted";
    } catch {
      /* Permissions API unavailable. */
    }
    const from = granted ? await placeFromDevice() : await placeFromTimeZone();
    if (!from) {
      report.textContent =
        "Your time zone doesn’t name a city. Use your exact location for live weather.";
      applyWeather();
      return;
    }
    await loadWeather(from);
  } catch {
    report.textContent = "Live weather isn’t available right now.";
    applyWeather();
  }
}
$$<HTMLButtonElement>("[data-weather]").forEach((b) =>
  b.addEventListener("click", () => {
    weatherMode = b.dataset.weather as typeof weatherMode;
    applyWeather();
  }),
);
$("#locate").addEventListener("click", async () => {
  report.textContent = "Finding your location";
  try {
    weatherMode = "live";
    await loadWeather(await placeFromDevice());
  } catch {
    report.textContent = place
      ? `Location wasn’t shared. Showing ${place.name}.`
      : "Location wasn’t shared.";
    applyWeather();
  }
});
applyWeather();
applySeason();
startWeather();
setInterval(() => {
  if (place && !document.hidden) loadWeather(place).catch(() => {});
}, 15 * 60 * 1000);

/* Planting. */
const MAX_TREES = 24;
const plantMode = $<HTMLButtonElement>("#plant-mode");
function counted(n: number) {
  $("#tree-count").textContent = `${n} of ${MAX_TREES} trees`;
  if (n >= MAX_TREES) {
    plantMode.disabled = true;
    $<HTMLButtonElement>("#plant-one").disabled = true;
    setPlanting(false);
    announce("The garden is full. 24 trees planted.");
  } else announce(`Tree planted. ${n} of ${MAX_TREES}.`);
}
function setPlanting(on: boolean) {
  plantMode.setAttribute("aria-pressed", String(on));
  plantMode.textContent = on ? "Planting: click a terrace" : "Plant by clicking";
  root.classList.toggle("planting", on);
}
plantMode.addEventListener("click", () =>
  setPlanting(plantMode.getAttribute("aria-pressed") !== "true"),
);
$("#plant-one").addEventListener("click", () => {
  if (garden) counted(garden.plant());
});
$("#turn").addEventListener("click", () => garden?.rotate());
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && root.classList.contains("planting"))
    setPlanting(false);
});

/* Drag to turn the garden; click to plant while planting. */
const stageEl = $("#stage");
let drag: { x: number; y: number; last: number; moved: boolean } | null = null;
stageEl.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest(".hotspot")) return;
  drag = { x: e.clientX, y: e.clientY, last: e.clientX, moved: false };
});
stageEl.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) {
    drag.moved = true;
    stageEl.setPointerCapture(e.pointerId);
    root.classList.add("turning");
  }
  if (drag.moved) garden?.rotateBy((e.clientX - drag.last) * 0.008);
  drag.last = e.clientX;
});
stageEl.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const click = !drag.moved;
  drag = null;
  root.classList.remove("turning");
  if (click && garden && root.classList.contains("planting")) {
    const r = $("#scene").getBoundingClientRect();
    const n = garden.plantAt(e.clientX - r.left, e.clientY - r.top);
    if (n < 0) announce("That spot isn’t a terrace. Try a flat surface.");
    else counted(n);
  }
});
stageEl.addEventListener("pointercancel", () => {
  drag = null;
  root.classList.remove("turning");
});

/* The page's carbon footprint, on the side the whole way. It is an estimate,
   not a measurement: the bytes this page has loaded over the network (the
   browser's own resource timing; cached files count as nothing), times the
   Sustainable Web Design model v4. That is 0.194 kWh/GB operational plus
   0.106 kWh/GB embodied, at the global average grid of 494 gCO2e/kWh. */
const gramsPerByte = ((0.055 + 0.059 + 0.08 + 0.012 + 0.013 + 0.081) * 494) / 1e9;
let bytesLoaded = 0;
let timing = false;
try {
  const counter = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) bytesLoaded += (e as PerformanceResourceTiming).transferSize ?? 0;
  });
  counter.observe({ type: "navigation", buffered: true });
  counter.observe({ type: "resource", buffered: true });
  timing = PerformanceObserver.supportedEntryTypes?.includes("resource") ?? false;
} catch {
  // No resource timing: the card says so.
}
const carbons = new Set<{ figure: HTMLElement; source: HTMLElement }>();
carbons.add({
  figure: $("[data-carbon-figure]"),
  source: $("[data-carbon-source]"),
});
function drawCarbon() {
  let figure = "—";
  let source = "This browser does not report what the page has loaded.";
  if (timing) {
    const grams = bytesLoaded * gramsPerByte;
    const size =
      bytesLoaded >= 1e6 ? `${(bytesLoaded / 1e6).toFixed(1)} MB` : `${Math.round(bytesLoaded / 1e3)} kB`;
    figure = grams < 0.01 ? "Under 0.01 g CO₂e" : `${grams.toFixed(grams < 1 ? 2 : 1)} g CO₂e`;
    source = `${size} loaded · Sustainable Web Design model, world grid. Estimated, not measured.`;
  }
  for (const c of carbons) {
    if (c.figure.textContent !== figure) c.figure.textContent = figure;
    if (c.source.textContent !== source) c.source.textContent = source;
  }
}
drawCarbon();

/* Each building has a small widget, shown in its first note: the
   Whisperbook player and the Wattch meter. Bloom has Leave a note. */

/* Wattch: the cost to draw this page, a sparkline of the CPU time each frame
   takes to submit. It draws into every mounted meter. */
const meters = new Set<{ canvas: HTMLCanvasElement; readout: HTMLElement }>();
const samples: number[] = [];
function drawMeter() {
  if (!garden || !meters.size) return;
  const s = garden.stats();
  samples.push(s.ms);
  if (samples.length > 48) samples.shift();
  const css = getComputedStyle(root);
  const top = Math.max(2, ...samples) * 1.15;
  for (const { canvas, readout } of meters) {
    const c = canvas.getContext("2d")!;
    const w = canvas.width,
      h = canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = css.getPropertyValue("--hairline");
    c.fillRect(0, h - 2, w, 2);
    c.strokeStyle = css.getPropertyValue("--stage");
    c.lineWidth = 3;
    c.lineJoin = "round";
    c.beginPath();
    samples.forEach((v, i) => {
      const x = (i / 47) * w,
        y = h - 6 - (v / top) * (h - 14);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.stroke();
    readout.textContent = `${s.ms.toFixed(1)} ms of CPU per frame. ${s.triangles.toLocaleString("en")} triangles in ${s.calls} draw calls.`;
  }
}
setInterval(() => {
  if (document.hidden) return;
  drawMeter();
  drawCarbon();
}, 300);
function mountMeter(el: HTMLElement) {
  if (!garden) {
    el.innerHTML = `<p class="meter-readout">Rendering is off in this browser, so there is nothing to measure.</p>`;
    return () => {};
  }
  el.innerHTML = `<canvas class="spark" width="480" height="80" aria-hidden="true"></canvas>
    <p class="meter-readout">Measuring</p>
    <p class="widget-fine">Measured live in your browser, like the dial in the observatory.</p>`;
  const meter = {
    canvas: el.querySelector("canvas")!,
    readout: el.querySelector<HTMLElement>(".meter-readout")!,
  };
  meters.add(meter);
  drawMeter();
  return () => meters.delete(meter);
}

/* Whisperbook: two lines of Alice read aloud by the visitor's own device.
   Only on-device voices are used, never network ones. */
const excerpt = [
  {
    who: "Narrator",
    text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.",
  },
  {
    who: "Alice",
    text: "And what is the use of a book, without pictures or conversations?",
  },
];
function localVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const pick = () => {
    const local = speechSynthesis.getVoices().filter((v) => v.localService);
    const english = local.filter((v) => v.lang.toLowerCase().startsWith("en"));
    return english.length ? english : local;
  };
  if (speechSynthesis.getVoices().length) return Promise.resolve(pick());
  // Chrome fills the list late: wait for it once before deciding.
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(pick());
    };
    const timer = setTimeout(done, 1500);
    speechSynthesis.addEventListener("voiceschanged", done);
  });
}
function mountPlayer(el: HTMLElement) {
  el.innerHTML = `<div class="player">
      <button type="button" class="play" aria-label="Play" disabled><span aria-hidden="true">▶</span></button>
      <div class="player-text">
        <p class="player-line">${excerpt[0].text}</p>
        <p class="player-voice">Looking for a voice on this device</p>
      </div>
    </div>
    <p class="widget-fine player-note"></p>`;
  const button = el.querySelector<HTMLButtonElement>(".play")!;
  const line = el.querySelector<HTMLElement>(".player-line")!;
  const voiceLabel = el.querySelector<HTMLElement>(".player-voice")!;
  const note = el.querySelector<HTMLElement>(".player-note")!;
  let voices: SpeechSynthesisVoice[] = [];
  let playing = false;
  let mounted = true;
  // Each play is a run; events from a cancelled run are ignored.
  let run = 0;
  const show = (i: number) => {
    line.textContent = excerpt[i].text;
    const voice = voices[i] ?? voices[0];
    voiceLabel.textContent = voice ? `${excerpt[i].who} · ${voice.name}` : excerpt[i].who;
  };
  const setPlaying = (on: boolean) => {
    if (playing === on) return;
    playing = on;
    button.innerHTML = `<span aria-hidden="true">${on ? "■" : "▶"}</span>`;
    button.setAttribute("aria-label", on ? "Stop" : "Play");
    garden?.setNarrating(on);
  };
  const stop = () => {
    if (!playing) return;
    run++;
    setPlaying(false);
    speechSynthesis.cancel();
    show(0);
  };
  const play = () => {
    speechSynthesis.cancel();
    const id = ++run;
    setPlaying(true);
    const narrator = voices[0],
      alice = voices[1] ?? voices[0];
    excerpt.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.text);
      u.voice = i === 0 ? narrator : alice;
      u.lang = u.voice.lang;
      // With a single voice, Alice speaks higher than the narrator.
      if (i === 1 && alice === narrator) u.pitch = 1.5;
      u.onstart = () => id === run && show(i);
      u.onerror = () => id === run && stop();
      if (i === excerpt.length - 1) u.onend = () => id === run && stop();
      speechSynthesis.speak(u);
    });
  };
  button.addEventListener("click", () => (playing ? stop() : play()));
  const onHidden = () => {
    if (document.hidden) stop();
  };
  document.addEventListener("visibilitychange", onHidden);
  localVoices().then((found) => {
    if (!mounted) return;
    voices = found.slice(0, 2);
    if (!voices.length) {
      voiceLabel.textContent = "This browser has no on-device voice.";
      return;
    }
    button.disabled = false;
    show(0);
    note.textContent =
      voices.length === 1
        ? "One voice on this device. Read by your device. Nothing leaves this page."
        : "Read by your device. Nothing leaves this page.";
  });
  return () => {
    mounted = false;
    stop();
    document.removeEventListener("visibilitychange", onHidden);
  };
}

/* Contact: a note that becomes an email in the visitor's own mail app. */
function mountNote(el: HTMLElement) {
  el.innerHTML = `<h3>Leave a note</h3>
    <label class="note-label" for="note-text">Your note</label>
    <textarea id="note-text" maxlength="600" rows="4" aria-describedby="note-count"></textarea>
    <p class="note-count" id="note-count"><span>0</span> of 600 characters</p>
    <div class="widget-actions">
      <button type="button" class="chip" data-send disabled>Send by email</button>
      <button type="button" class="chip" data-copy>Copy address</button>
    </div>
    <p class="widget-fine">This opens your email app. Nothing is sent or stored by this page.</p>`;
  const text = el.querySelector("textarea")!;
  const send = el.querySelector<HTMLButtonElement>("[data-send]")!;
  const copy = el.querySelector<HTMLButtonElement>("[data-copy]")!;
  let copiedTimer = 0;
  text.addEventListener("input", () => {
    el.querySelector(".note-count span")!.textContent = String(text.value.length);
    const empty = !text.value.trim();
    send.disabled = empty;
    garden?.setPostbox(empty ? "idle" : "writing");
  });
  send.addEventListener("click", () => {
    if (!text.value.trim()) return;
    const link = document.createElement("a");
    link.href = `mailto:${email}?subject=From%20the%20garden&body=${encodeURIComponent(text.value)}`;
    link.click();
    garden?.setPostbox("sent");
  });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(email);
      copy.textContent = "Copied";
      clearTimeout(copiedTimer);
      copiedTimer = window.setTimeout(() => (copy.textContent = "Copy address"), 2000);
    } catch {
      // Select the address on the page so it can be copied by hand.
      const address = document.querySelector(".note-email a");
      if (address) getSelection()?.selectAllChildren(address);
    }
  });
  return () => {
    clearTimeout(copiedTimer);
    garden?.setPostbox("idle");
  };
}

function mountProjectWidget(spot: WidgetSpot, container: HTMLElement) {
  const cleanup = {
    whisperbook: mountPlayer,
    wattch: mountMeter,
    contact: mountNote,
  }[spot](container);
  return () => {
    cleanup();
    container.replaceChildren();
  };
}

document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-open]");
  if (t) goTo(spotBeat[t.dataset.open as Spot]);
});
narrow.addEventListener("change", () => {
  syncWidgets();
  measureFrames();
  syncStory();
});

measure();
measureFrames();
document.fonts?.ready.then(() => {
  schedule();
  measureFrames();
});

import("./scene")
  .then(({ createGarden }) => {
    garden = createGarden($("#scene"), hotspots);
    // A meter mounted before the garden arrived is mounted again, so it can
    // measure.
    if (beats[beat]?.widget === "wattch") mountNoteWidget();
    syncTheme();
    syncMotion();
    setHour(Number(hourInput.value));
    applyWeather();
    applySeason();
    measure();
    // The meter is taller once it can measure.
    slotsFor = 0;
    measureFrames();
    syncStory();
  })
  .catch((error) => {
    console.warn("The garden could not be drawn.", error);
    $(".scene-fallback").hidden = false;
    $("#scene").removeAttribute("role");
    $("#scene").removeAttribute("aria-label");
    $(".widget-garden").hidden = true;
  });

if (import.meta.hot) import.meta.hot.dispose(() => garden?.dispose());
