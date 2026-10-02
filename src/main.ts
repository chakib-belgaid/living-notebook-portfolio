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

import { beats, stages, stageStart, stageProgress, spotOrder, spotNames, spotBeat, projects, email, type Spot, type WidgetSpot, type Stop } from "./content";
import { createNavigation, type SectionId } from "./navigation";
import { mountContact } from "./contact";
import { widgetLifecycle } from "./widgets";
import { createTransferEstimate, formatGrams } from "./transfer";
import { CPU_WATTS, GPU_WATTS, GRID_INTENSITY, estimateCompute, type ComputeWork } from "./compute";
import { initEvidence } from "./evidence";
import { lettered } from "./lettered";
import { createPhoneJourney } from "./phone";
import { initLocalization, getLocale, onLocaleChange, translate } from "./i18n";

const disposeLocalization = initLocalization();

const sunIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>`;
const moonIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.8A8 8 0 0 1 9.2 4.5a8 8 0 1 0 10.3 10.3Z"/></svg>`;

document.querySelector<HTMLDivElement>("#app")!.insertAdjacentHTML("beforeend", `
  <div id="experience">
  <div class="stage" id="stage">
    <canvas class="sky sky-back" aria-hidden="true"></canvas>
    <div id="scene" role="img" aria-label="A garden of stone terraces, pavilions, and water. It is drawn first as pencil lines, then as a blue engineering drawing, then built and planted."></div>
    <div class="scene-fallback"><img src="/assets/garden-preview.png" width="1440" height="900" loading="lazy" alt="The notebook garden, with a reading pavilion and energy observatory." /><p data-fallback-message>Preparing the garden. The portfolio is ready to read.</p></div>
    <canvas class="sky sky-front" aria-hidden="true"></canvas>
    ${spotOrder.map((s) => `<div class="hotspot" data-spot="${s}"><a href="#${s}" class="hotspot-title" tabindex="-1">${spotNames[s]}</a></div>`).join("")}
  </div>

  <main class="chapters">
    ${beats
      .map(
        (b, i) => `${i > 0 && b.stage !== beats[i - 1].stage ? `
      <div class="move" data-move="${i}" aria-hidden="true"></div>` : ""}
      <section class="chapter" data-chapter="${i}" aria-label="${b.title}" inert>
        <div class="note">
          <p class="note-stage">${stages[b.stage]}${b.label ? ` · ${b.label}` : ""}</p>
          ${i === 0 ? `<h1 id="chapter-${i}" tabindex="-1">${lettered(b.title)}</h1>` : `<h2 id="chapter-${i}" tabindex="-1">${b.title}</h2>`}
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
      </div>
      <div class="stage-buttons" role="group" aria-label="Garden stages">${stages.map((s, i) => `<button type="button" data-go="${i}" aria-label="Go to ${s}">${s}</button>`).join("")}</div>
    </div>
    <details class="tally">
      <summary aria-describedby="carbon-label"><span class="tally-figure" aria-live="off" data-carbon-figure>—</span><span class="tally-note">this visit</span></summary>
      <section class="tally-panel" aria-labelledby="carbon-label">
        <p class="carbon-label" id="carbon-label">Estimated impact of this visit so far</p>
        <dl class="carbon-split">
          <div><dt>Data transfer</dt><dd data-carbon-transfer>—</dd></div>
          <div><dt>Rendering</dt><dd data-carbon-compute>—</dd></div>
        </dl>
        <p class="widget-fine carbon-source" data-carbon-source></p>
        <p class="widget-fine carbon-source" data-compute-source></p><details class="carbon-details"><summary>Details</summary><p class="widget-fine">Data transfer: reported bytes × 0.3 kWh/GB × 494 g CO₂e/kWh, computed with co2.js using the Sustainable Web Design Model v4, which includes operational and embodied estimates for data centres, networks, and devices. Unknown sizes are excluded, and cached resources add no reported network bytes.</p><p class="widget-fine">Rendering and animation: the main-thread time spent updating and drawing the garden and sky at an assumed ${CPU_WATTS} W, plus the GPU time of each garden frame at an assumed ${GPU_WATTS} W, × ${Math.round(GRID_INTENSITY)} g CO₂e/kWh, co2.js’s world average grid intensity. GPU time is counted only where the browser exposes GPU timers; elsewhere this part is a CPU-only lower bound. Browsers report time, not power, so the wattages are assumptions, and the model’s device share of transfer may overlap a little with this measured rendering.</p><a class="widget-fine" href="https://sustainablewebdesign.org/estimating-digital-emissions/" target="_blank" rel="noopener noreferrer">Read the transfer methodology ↗</a> <a class="widget-fine" href="https://developers.thegreenwebfoundation.org/co2js/overview/" target="_blank" rel="noopener noreferrer">About co2.js ↗</a></details>
      </section>
    </details>
    <button type="button" class="ruler-motion" id="motion-toggle" aria-pressed="false" aria-label="Pause motion" title="Pause motion"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path class="icon-pause" d="M8 5.5v13M16 5.5v13"/><path class="icon-play" d="M8 5.5v13l10-6.5Z"/></svg></button>
  </div>

  <details class="dock"><summary>Garden controls</summary><div class="dock-body">
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
  </div></details>

  <div class="mist" aria-hidden="true"></div>
  </div>
  <p id="announce" class="sr-only" role="status"></p>
`);

const root = document.documentElement;
const $ = <E extends HTMLElement>(s: string) => document.querySelector<E>(s)!;
const $$ = <E extends HTMLElement>(s: string) => [
  ...document.querySelectorAll<E>(s),
];
let garden: Garden | undefined;
// 0–1 mist over the garden and the page, set by the weather.
let fog = 0;
let sky: ReturnType<typeof createSky> | undefined;
const compact = matchMedia("(max-width: 899px), (max-height: 599px)");
let reading = true;
let previewEnabled = false;
let requestedView = new URL(location.href).searchParams.get("view");
// On a phone, whether the visitor chose the reading page over the journey.
// The live garden then opens over the page, and closing it returns there.
let overPage = requestedView === "read";
let gardenLoading: Promise<void> | undefined;
const readingContact = widgetLifecycle();
const illustration = widgetLifecycle();
let activeIllustration: HTMLDetailsElement | undefined;
const announce = (text: string) => ($("#announce").textContent = text);
/* Phones in portrait get the garden journey over the reading page. Printing
   tears it down, so the printout is the reading page in its own order. */
const phoneQuery = matchMedia("screen and (max-width: 899px) and (min-height: 500px)");
const journey = createPhoneJourney({
  onStop: (stop) => { if (previewEnabled) driveLive(stop); },
  // The journey's own button stands in for the ruler's, which phones don't show.
  onTogglePause: () => motionButton.click(),
});

/* The notebook is always drawn on blueprint paper. */
function syncTheme() {
  garden?.setTheme(true);
  sky?.refresh(true);
  applyFog();
}
syncTheme();

/* Motion. */
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduced = reducedQuery.matches;
let paused = reduced;
const motionButton = $<HTMLButtonElement>("#motion-toggle");
function syncMotion() {
  const stopped = paused || reduced;
  motionButton.setAttribute("aria-pressed", String(stopped));
  root.dataset.motionPaused = String(stopped);
  motionButton.disabled = reduced;
  motionButton.title = reduced ? "Motion paused by your system preference" : paused ? "Resume motion" : "Pause motion";
  motionButton.setAttribute("aria-label", motionButton.title);
  journey.setMotion(stopped, reduced);
  garden?.setMotion(stopped || (reading && !previewEnabled));
  sky?.setMotion(stopped || (reading && !previewEnabled));
}
motionButton.addEventListener("click", () => {
  paused = !paused;
  syncMotion();
  if (reading) garden?.setProgress(Number(scrub.value) / 1000, reduced || paused);
  else measure();
});
reducedQuery.addEventListener("change", (e) => {
  reduced = e.matches;
  paused = reduced;
  syncMotion();
  if (reading) garden?.setProgress(Number(scrub.value) / 1000, reduced || paused);
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
const narrow = compact;
function syncStory() {
  const b = beats[beat];
  garden?.highlightPath(b?.path ?? null);
  if (b?.spot)
    garden?.focus(b.spot, narrow.matches ? 0 : 0.16, narrow.matches ? 0 : 0.04);
  // The whole garden sits right of centre, in the space the note leaves.
  else garden?.focus(null, narrow.matches ? 0 : 0.12);
}

/* The dock's widgets come out with the stage. The carbon counter is on the
   ruler, so it is there at every stage. */
function syncWidgets() {
  widgets.forEach((w) => {
    const show = reading ? previewEnabled : stage >= Number(w.dataset.from);
    w.classList.toggle("shown", show);
    w.inert = !show;
  });
}

/* Compact layouts keep the garden in a separate, predictable frame. */
function measureFrames() {
  root.style.setProperty("--header-clearance", `${$(".masthead").getBoundingClientRect().height}px`);
  frameGarden();
}
new ResizeObserver(() => measureFrames()).observe($(".masthead"));
function frameGarden() {
  // In the journey the garden sits where the stills have it, above the cards.
  if (journey.active) garden?.frame(0.06, 0.58);
  else garden?.frame(reading ? 0.04 : 0.08, reading ? 0.96 : 0.95);
}
/* In the journey the live garden shows each stop as its still does. */
function driveLive(stop: Stop) {
  const growth = stageProgress[stop.stage];
  scrub.value = String(Math.round(growth * 1000));
  garden?.setProgress(growth, reduced || paused);
  sky?.setGrowth(growth);
  garden?.focus(stop.spot, 0, 0);
}

/* One widget is mounted at a time, in the active note. */
const noteWidget = widgetLifecycle();
function mountNoteWidget() {
  noteWidget.replace();
  if (reading) return;
  const b = beats[beat];
  const slot = chapterEls[beat]?.querySelector<HTMLElement>("[data-widget]");
  if (b?.widget && slot) noteWidget.replace(() => mountProjectWidget(b.widget!, slot));
}

/* Links scroll the story to a beat; once there, focus moves to its heading. */
let focusTo = -1;
function focusHeading(i: number) {
  chapterEls[i].querySelector<HTMLElement>("h1, h2")!.focus({ preventScroll: true });
}
function goTo(i: number) {
  setPlanting(false);
  scrollTo({ top: holdAt(i), behavior: reduced || paused ? "instant" : "smooth" });
  if (beat === i) focusHeading(i);
  else focusTo = i;
}

function measure() {
  if (reading) {
    const sections: SectionId[] = ["intro", "work", "whisperbook", "wattch", "about", "contact"];
    // The section whose top most recently passed the threshold, whatever the DOM order.
    let current: SectionId = "intro";
    let best = -Infinity;
    for (const id of sections) {
      const section = $("#" + id);
      const threshold = Math.max(innerHeight * 0.35, parseFloat(getComputedStyle(section).scrollMarginTop) || 0);
      const top = section.getBoundingClientRect().top;
      if (top <= threshold + 1 && top > best) { best = top; current = id; }
    }
    navigation.passive(current);
    root.style.setProperty("--grow", "1");
    measureReadingRuler(current);
    return;
  }
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
    performance.mark(`notebook:stage:${stages[s]}`);
    stage = s;
    root.dataset.stage = String(s);
    sky?.refresh(true);
    $$<HTMLButtonElement>("[data-go]").forEach((b, i) =>
      { b.classList.toggle("current", i === s); if (i === s) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); },
    );
    syncWidgets();
    frameGarden();
  }
  if (now.beat !== beat) {
    beat = now.beat;
    chapterEls.forEach((c, i) => {
      const active = i === beat;
      c.classList.toggle("active", active);
      c.inert = !active;
      c.setAttribute("aria-hidden", String(!active));
    });
    $$<HTMLElement>("[data-dot]").forEach((d, i) =>
      d.classList.toggle("current", i === beat),
    );
    mountNoteWidget();
    syncStory();
    if (beat >= 0) navigation.passive(sectionForBeat(beat));
    if (beat >= 0 && beat === focusTo) {
      focusTo = -1;
      focusHeading(beat);
    }
  }
  const live = growth > 0.86 && !!garden;
  hotspots.forEach((h) => {
    h.classList.toggle("visible", live);
    h.querySelector<HTMLAnchorElement>("a")!.tabIndex = live ? 0 : -1;
    h.inert = !live;
  });
  garden?.setProgress(growth, reduced || paused);
  sky?.setGrowth(growth);
}

/* The reading ruler along the masthead's lower edge: how far down the page
   the visitor is, with a mark where each section starts. The masthead link
   for the current section is marked too. */
const readingRuler = $(".read-ruler");
const sectionLinks = $$<HTMLAnchorElement>(".masthead nav a");
function measureReadingRuler(current: SectionId) {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const clearance = $(".masthead").getBoundingClientRect().height;
  readingRuler.style.setProperty("--read", Math.min(1, scrollY / max).toFixed(4));
  $$<HTMLElement>(".read-ruler i").forEach(tick => {
    const top = $("#" + tick.dataset.at).getBoundingClientRect().top + scrollY - clearance;
    const at = Math.min(1, Math.max(0, top / max));
    tick.style.setProperty("--at", at.toFixed(4));
    tick.classList.toggle("passed", scrollY / max >= at - 0.001);
  });
  const group = current === "whisperbook" || current === "wattch" ? "work" : current;
  sectionLinks.forEach(a => {
    if (a.hash === "#" + group) a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
  });
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
let resizedFrom = innerWidth;
addEventListener("resize", () => {
  const section = navigation.section;
  const wider = innerWidth !== resizedFrom;
  resizedFrom = innerWidth;
  const changed = reading !== (compact.matches || requestedView === "read");
  if (changed) syncPresentation();
  measureFrames();
  // A phone's URL bar showing or hiding changes only the height: the reader stays put.
  if (reading && !wider && !changed) return;
  navigation.go(section, false, false);
});
// A link's scroll that ends short of its beat (the visitor took over) drops
// the focus it would have moved.
addEventListener("scrollend", () => {
  measure();
  focusTo = -1;
  navigation.settled();
});

scrub.addEventListener("input", () => {
  if (reading) {
    const growth = Number(scrub.value) / 1000;
    garden?.setProgress(growth, reduced || paused); sky?.setGrowth(growth);
    scrub.setAttribute("aria-valuetext", `${Math.round(growth * 100)}% garden growth`);
  } else scrollTo({top: (Number(scrub.value) / 1000) * maxScroll(), behavior: "instant"});
});
$$<HTMLButtonElement>("[data-go]").forEach((button) => button.addEventListener("click", () => {
  const s = Number(button.dataset.go);
  if (reading) {
    garden?.setProgress(stageProgress[s], reduced || paused);
    sky?.setGrowth(stageProgress[s]);
    scrub.value = String(stageProgress[s] * 1000);
    scrub.setAttribute("aria-valuetext", stages[s]);
    $$<HTMLButtonElement>("[data-go]").forEach((b, i) => { if (i === s) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
  } else navigation.go(sectionForBeat(stageStart[s]));
}));

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
  return new Intl.DateTimeFormat(getLocale(), { hour: "numeric", minute: "2-digit" })
    .format(new Date(2000, 0, 1, hh, mm));
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
  sky?.refresh(true);
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
    journey.setNight(isNight);
  }
  garden?.setHour(h);
  sky?.setHour(h);
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
  sky?.setWeather(w);
  garden?.setWeather(w.cloud, w.precip);
  root.dataset.weather = w.kind;
  $$<HTMLButtonElement>("button[data-weather]").forEach((b) =>
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
  $$<HTMLButtonElement>("button[data-season]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.season === seasonMode)),
  );
}
$$<HTMLButtonElement>("button[data-season]").forEach((b) =>
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
$$<HTMLButtonElement>("button[data-weather]").forEach((b) =>
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

/* The carbon counter's slip closes like a popover: on Escape, or a press
   anywhere else. */
const tally = $<HTMLDetailsElement>(".tally");
tally.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !tally.open) return;
  tally.open = false;
  tally.querySelector("summary")!.focus();
});
addEventListener("pointerdown", (e) => {
  if (tally.open && !tally.contains(e.target as Node)) tally.open = false;
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

const transfer = createTransferEstimate();
/* All the drawing done so far: the garden's frames on the CPU and GPU, and
   the sky's canvas on the CPU. Null when neither is running. */
function renderWork(): ComputeWork | null {
  if (!garden && !sky) return null;
  const g = garden?.stats();
  const s = sky?.stats();
  return {
    cpuMs: (g?.cpuMs ?? 0) + (s?.cpuMs ?? 0),
    gpuMs: g ? g.gpuMs : null,
  };
}
function drawCarbon() {
  const moved = transfer.read();
  const drawn = estimateCompute(renderWork());
  const parts = [moved.grams, drawn.grams].filter((g): g is number => g !== null);
  const total = parts.length ? parts.reduce((a, b) => a + b, 0) : null;
  $("[data-carbon-figure]").textContent = total === null ? "Unavailable" : formatGrams(total);
  garden?.setTally(total);
  $("[data-carbon-transfer]").textContent = moved.figure;
  $("[data-carbon-compute]").textContent = drawn.figure;
  $("[data-carbon-source]").textContent = `Transfer: ${moved.source}`;
  $("[data-compute-source]").textContent = `Rendering: ${drawn.source}`;
}
drawCarbon();

/* Each building has a small widget, shown in its first note: the
   Whisperbook player and the Wattch meter. Bloom has Leave a note. */

/* Wattch: the cost to draw this page, a sparkline of the CPU time each frame
   takes to submit (solid) and, where the browser exposes GPU timers, the GPU
   time to draw it (dashed), with the visit's running rendering footprint.
   It draws into every mounted meter. */
const meters = new Set<{ canvas: HTMLCanvasElement; readout: HTMLElement; total: HTMLElement }>();
const samples: number[] = [];
const gpuSamples: number[] = [];
function drawMeter() {
  if (!garden || !meters.size) return;
  const s = garden.stats();
  samples.push(s.ms);
  if (samples.length > 48) samples.shift();
  if (s.gpuFrameMs !== null) {
    gpuSamples.push(s.gpuFrameMs);
    if (gpuSamples.length > 48) gpuSamples.shift();
  }
  const css = getComputedStyle(root);
  const top = Math.max(2, ...samples, ...gpuSamples) * 1.15;
  const drawn = estimateCompute(renderWork());
  const line = (c: CanvasRenderingContext2D, values: number[], w: number, h: number) => {
    c.beginPath();
    values.forEach((v, i) => {
      const x = (i / 47) * w,
        y = h - 6 - (v / top) * (h - 14);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.stroke();
  };
  for (const { canvas, readout, total } of meters) {
    const c = canvas.getContext("2d")!;
    const w = canvas.width,
      h = canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = css.getPropertyValue("--hairline");
    c.fillRect(0, h - 2, w, 2);
    c.lineJoin = "round";
    if (gpuSamples.length) {
      c.strokeStyle = css.getPropertyValue("--muted");
      c.lineWidth = 2;
      c.setLineDash([6, 5]);
      line(c, gpuSamples, w, h);
      c.setLineDash([]);
    }
    c.strokeStyle = css.getPropertyValue("--stage");
    c.lineWidth = 3;
    line(c, samples, w, h);
    const gpu = s.gpuFrameMs === null ? "" : `, ${s.gpuFrameMs.toFixed(1)} ms of GPU`;
    readout.textContent = `${s.ms.toFixed(1)} ms of CPU${gpu} per frame. ${s.triangles.toLocaleString("en")} triangles in ${s.calls} draw calls.`;
    total.textContent = `Drawing the garden this visit: ${drawn.figure}. ${drawn.source}`;
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
    <p class="meter-readout" data-meter-total></p>
    <p class="widget-fine">Measured live in your browser, like the dial in the observatory. Energy uses assumed CPU and GPU wattages and co2.js grid data.</p>`;
  const meter = {
    canvas: el.querySelector("canvas")!,
    readout: el.querySelector<HTMLElement>(".meter-readout")!,
    total: el.querySelector<HTMLElement>("[data-meter-total]")!,
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
    return local.filter((v) => v.lang.toLowerCase().split(/[-_]/)[0] === getLocale());
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
    button.dataset.playing = String(on);
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
      const u = new SpeechSynthesisUtterance(translate(part.text));
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
  const findVoices = async () => {
    const language = getLocale();
    const found = await localVoices();
    if (language !== getLocale()) return;
    if (!mounted) return;
    voices = found.slice(0, 2);
    if (!voices.length) {
      button.disabled = true;
      voiceLabel.textContent = "This browser has no on-device voice.";
      return;
    }
    button.disabled = false;
    show(0);
    note.textContent =
      voices.length === 1
        ? "One voice on this device. Read by your device. Nothing leaves this page."
        : "Read by your device. Nothing leaves this page.";
  };
  void findVoices();
  const offLocale = onLocaleChange(() => { stop(); show(0); note.textContent = ""; button.disabled = true; void findVoices(); });
  return () => {
    mounted = false;
    offLocale();
    stop();
    document.removeEventListener("visibilitychange", onHidden);
  };
}

const mountNote = (el: HTMLElement) => mountContact(el, () => garden);

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

function sectionForBeat(i: number): SectionId {
  if (i >= spotBeat.contact) return "contact";
  if (i >= spotBeat.wattch) return "wattch";
  if (i >= spotBeat.whisperbook) return "whisperbook";
  if (i >= stageStart[2]) return "work";
  if (i >= stageStart[1]) return "about";
  return "intro";
}
const sectionBeat: Record<SectionId, number> = { intro: 0, work: stageStart[2], ...spotBeat };
const navigation = createNavigation((section, focus) => {
  setPlanting(false);
  if (reading) {
    const target = $("#" + section);
    const behavior = !focus || reduced || paused ? "instant" : "smooth";
    if (section === "intro") scrollTo({top: 0, behavior});
    else target.scrollIntoView({ behavior, block: "start" });
    if (focus) target.querySelector<HTMLElement>("h1,h2,h3")?.focus({preventScroll:true});
  } else {
    if (focus) goTo(sectionBeat[section]);
    else { scrollTo({top:holdAt(sectionBeat[section]), behavior:"instant"}); measure(); }
  }
}, () => {
  requestedView = new URL(location.href).searchParams.get("view");
  previewEnabled = requestedView === "garden";
  syncPresentation();
  if (!reading || previewEnabled) void loadGarden();
});

function syncPresentation() {
  const previous = reading;
  reading = compact.matches || requestedView === "read";
  root.dataset.view = reading ? "read" : "garden";
  // The garden view keeps whichever the visitor opened it from.
  if (requestedView !== "garden") overPage = requestedView === "read";
  // Found before the journey is torn down: the live garden may be in its layer.
  const stageElement = $("#stage");
  const journeyOn = reading && phoneQuery.matches && !overPage;
  journey.setActive(journeyOn);
  root.dataset.preview = String(previewEnabled);
  $("#portfolio").hidden = !reading;
  $(".chapters").hidden = reading;
  $(".chapters").inert = reading;
  $(".mist").hidden = reading;
  (journeyOn ? journey.layer : reading ? $("#preview-frame") : $("#experience")).prepend(stageElement);
  stageElement.hidden = reading && !previewEnabled;
  for (const element of [$<HTMLElement>(".ruler"), $<HTMLElement>(".dock")]) {
    (reading ? $("#preview-tools") : $("#experience")).append(element);
    element.hidden = reading && !previewEnabled;
  }
  $(".static-garden").hidden = reading && previewEnabled;
  const toggle = $<HTMLAnchorElement>(".view-switch");
  toggle.dataset.view = reading ? "garden" : "read";
  const viewUrl = new URL(location.href);
  viewUrl.searchParams.set("view", toggle.dataset.view);
  viewUrl.searchParams.set("lang", getLocale());
  toggle.href = viewUrl.search + viewUrl.hash;
  toggle.textContent = reading ? (previewEnabled && compact.matches ? "Close garden" : "Explore garden") : "Read portfolio";
  // On phones the switch shows only an icon, so its name is kept explicit.
  toggle.setAttribute("aria-label", toggle.textContent);
  if (previous !== reading) {
    noteWidget.dispose();
    illustration.dispose();
    if (activeIllustration) activeIllustration.open = false;
    activeIllustration = undefined;
    readingContact.replace(reading ? () => mountNote($("[data-contact-read]")) : undefined);
    if (!reading) { beat = -1; stage = -1; rulerFor = ""; }
  }
  syncMotion();
  syncWidgets();
  measureFrames();
  if (reading && previewEnabled && journeyOn) driveLive(journey.stop);
  else if (reading && previewEnabled) {
    garden?.setProgress(1, reduced || paused); garden?.focus(null); sky?.setGrowth(1);
    scrub.value = "1000";
    scrub.setAttribute("aria-valuetext", "Bloom");
    $$<HTMLButtonElement>("[data-go]").forEach((b, i) => { if (i === 3) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
  }
}

$$<HTMLAnchorElement>("[data-view]").forEach(a => a.addEventListener("click", e => {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const section = navigation.section;
  const closingInJourney = journey.active && previewEnabled && a.classList.contains("view-switch");
  requestedView = a.dataset.view!;
  previewEnabled = compact.matches && previewEnabled && a.classList.contains("view-switch") ? false : requestedView === "garden";
  // On a compact screen, closing the garden returns to the journey there,
  // otherwise to the reading page.
  if (compact.matches && !previewEnabled) requestedView = closingInJourney ? null : "read";
  const url = new URL(location.href);
  if (requestedView) url.searchParams.set("view", requestedView);
  else url.searchParams.delete("view");
  history.pushState(null, "", url);
  syncPresentation();
  if (!reading || previewEnabled) void loadGarden();
  navigation.go(section, false);
}));
compact.addEventListener("change", () => {
  const section = navigation.section;
  syncPresentation();
  navigation.go(section, false, false);
  if (!reading || previewEnabled) void loadGarden();
});
phoneQuery.addEventListener("change", () => {
  const section = navigation.section;
  syncPresentation();
  navigation.go(section, false, false);
});

$$<HTMLDetailsElement>("[data-illustration]").forEach(details => details.addEventListener("toggle", () => {
  if (!reading) return;
  if (details.open) {
    if (activeIllustration && activeIllustration !== details) activeIllustration.open = false;
    activeIllustration = details;
    illustration.replace(() => mountProjectWidget(details.dataset.illustration as WidgetSpot, details.querySelector<HTMLElement>("[data-reading-widget]")!));
  } else if (activeIllustration === details) { illustration.dispose(); activeIllustration = undefined; }
}));

/* In the journey, a live garden that can't be drawn gives way to the stills,
   and the address no longer asks for it. */
function leaveLiveGarden(message: string) {
  previewEnabled = false;
  requestedView = null;
  const url = new URL(location.href);
  url.searchParams.delete("view");
  history.replaceState(null, "", url);
  syncPresentation();
  journey.notify(message);
  announce(message);
}

async function loadGarden() {
  if (gardenLoading) return gardenLoading;
  performance.mark("notebook:scene-request");
  gardenLoading = (async () => {
    // Two animation frames let the semantic page paint before scene work starts.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    sky = createSky($(".sky-back"), $(".sky-front"));
    syncMotion();
    const { createGarden } = await import("./scene");
    const quality = compact.matches || new URL(location.href).searchParams.get("quality") === "low" ? "low" : "full";
    garden = await createGarden($("#scene"), hotspots, quality);
    $(".scene-fallback").hidden = true;
    $("#scene").addEventListener("garden-context-lost", () => {
      $(".scene-fallback").hidden = false;
      $("[data-fallback-message]").textContent = "The garden’s graphics connection was lost. The portfolio and links still work.";
      if (journey.active) leaveLiveGarden("The live garden’s graphics were lost.");
      else announce("Garden graphics unavailable. Portfolio navigation remains available.");
    });
    $("#scene").addEventListener("garden-context-restored", () => $(".scene-fallback").hidden = true);
    syncTheme(); syncMotion(); setHour(Number(hourInput.value)); applyWeather(); applySeason();
    if (journey.active) driveLive(journey.stop);
    else if (reading) { garden.setProgress(1, reduced || paused); sky.setGrowth(1); }
    else {
      // The meter needs a renderer; contact and speech already work while loading.
      if (beats[beat]?.widget === "wattch") mountNoteWidget();
      measure(); syncStory();
    }
    if (activeIllustration?.open && activeIllustration.dataset.illustration === "wattch") {
      illustration.replace(() => mountProjectWidget("wattch", activeIllustration!.querySelector<HTMLElement>("[data-reading-widget]")!));
    }
    const draftField = document.querySelector<HTMLTextAreaElement>(reading ? "[data-contact-read] textarea" : ".chapter.active textarea");
    garden.setPostbox(draftField?.value.trim() ? "writing" : "idle");
    garden.setNarrating(!!document.querySelector('.play[data-playing="true"]'));
    measureFrames();
    void startWeather();
  })().catch(error => {
    console.warn("The garden could not be drawn.", error);
    const message = "The garden can’t be drawn in this browser. The portfolio and links still work.";
    $(".scene-fallback").hidden = false;
    $("[data-fallback-message]").textContent = message;
    $("#scene").removeAttribute("role");
    $("#scene").removeAttribute("aria-label");
    $(".widget-garden").hidden = true;
    sky?.setMotion(true);
    if (journey.active) leaveLiveGarden("The live garden can’t be drawn in this browser.");
    else announce(message);
  });
  return gardenLoading;
}
// scripts/capture-stills.mjs drives the garden through this, in development only.
if (import.meta.env.DEV) Object.assign(window, { __notebook: { get garden() { return garden; } } });

// Commit enhancement only after the controllers have initialized.
initEvidence();
root.classList.add("enhanced");
readingContact.replace(() => mountNote($("[data-contact-read]")));
syncPresentation();
navigation.go(navigation.section, false, false);
measure();
if (!reading || requestedView === "garden") { previewEnabled = reading; syncPresentation(); void loadGarden(); }
document.fonts?.ready.then(schedule);
const offLocale = onLocaleChange(() => {
  setHour(Number(hourInput.value));
  measureFrames();
  schedule();
});

if (import.meta.hot) import.meta.hot.dispose(() => { offLocale(); disposeLocalization(); garden?.dispose(); sky?.dispose(); transfer.dispose(); noteWidget.dispose(); readingContact.dispose(); illustration.dispose(); });
