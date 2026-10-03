import "./phone.css";
import { stageProgress, stops, type Stop, type StopName } from "./content";
import { lettered } from "./lettered";
import { createSheet } from "./sheet";

/* The garden journey on phones (docs/superpowers/specs/2026-10-02-phone-journey-design.md).
   It is laid over the reading page: each stop is one of its sections, shown
   as a short card over the garden. As on the desktop, the live garden grows
   with the scroll; its stills stand in while it loads, or when it is off.
   Only the current stop's card shows, and none while the garden moves
   between stops. Details open in a sheet. At the last stop the visitor
   can explore the finished garden, turning it with a finger. */
export type JourneyOptions = {
  /** The visitor reached a new stop. */
  onStop: (stop: Stop) => void;
  /** The garden's growth followed the scroll (0–1, see stageProgress). */
  onGrowth: (growth: number) => void;
  /** The header's pause button was pressed. */
  onTogglePause: () => void;
  /** The header's sound button was pressed. */
  onToggleSound: () => void;
  /** The sky and garden controls opened in the sheet, or closed. */
  onControls: (open: boolean) => void;
  /** The visitor started or stopped exploring the garden. Resolves false
      when the live garden can't be drawn to explore. */
  onExplore: (on: boolean) => Promise<boolean> | void;
  /** A zoom button or key while exploring: zoom the garden by `factor`. */
  onZoom: (factor: number) => void;
};
export type Journey = {
  readonly active: boolean;
  readonly stop: Stop;
  /** The garden's growth at the current scroll. */
  readonly growth: number;
  /** The visitor is exploring the garden full screen. */
  readonly exploring: boolean;
  /** The sky and garden controls are open: the screen's height above them, or 0. */
  readonly controlsTop: number;
  /** The fixed layer behind the cards; main.ts puts the live garden in it. */
  readonly layer: HTMLElement;
  setActive: (on: boolean) => void;
  /** A short message in the header for a few seconds. It is only shown;
      main.ts announces it on the page's live region. */
  notify: (text: string) => void;
  /** Shows the stills of the garden by night or by day. */
  setNight: (night: boolean) => void;
  /** Shows the motion state on the header's pause button. */
  setMotion: (stopped: boolean, systemReduced: boolean) => void;
  /** Shows whether the visitor asked for sound; null hides the button. */
  setSound: (on: boolean | null) => void;
  /** The live garden is drawing in the layer: stills no longer load. */
  setLive: (on: boolean) => void;
};

const details: Partial<Record<StopName, { key: string; title: string; text: string; label?: string }>> = {
  blueprint: { key: "about", title: "Background", text: "View background", label: "View details about my background" },
  whisperbook: { key: "whisperbook", title: "Whisperbook", text: "View project", label: "View details about Whisperbook" },
  wattch: { key: "wattch", title: "Wattch Core", text: "View project", label: "View details about Wattch Core" },
};
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

// Outlined like the sketched clouds on the desktop sky.
const cloud = `<svg viewBox="0 0 120 50" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 44h94c9 0 13-7 10-13-2-5-8-7-13-5 0-10-9-16-18-13-4-9-15-13-24-9-7 3-11 10-10 17-6-3-15 0-17 7-8-1-14 4-13 10 1 4 5 6 11 6z"/></svg>`;

// A speaker: waves while the garden plays, a cross while it is quiet.
export const speaker = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path class="icon-speaker" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path class="icon-waves" d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path class="icon-waves" d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/><path class="icon-mute" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;

// Two sliders: the time, weather and season of the garden.
const sliders = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/></svg>`;

export function createPhoneJourney(options: JourneyOptions): Journey {
  const root = document.documentElement;
  const $ = <E extends HTMLElement>(s: string) => document.querySelector<E>(s)!;

  const layer = document.createElement("div");
  layer.className = "journey";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `${stops.map((s) => `<img class="journey-still" data-still="${s.name}" alt="" decoding="async" />`).join("")}<span class="journey-edge"></span>
    <div class="journey-clouds">${cloud}${cloud}</div>
    <div class="journey-leaves">${Array.from({ length: 10 }, (_, i) => `<i style="--n:${i}"></i>`).join("")}</div>`;
  const stills = [...layer.querySelectorAll<HTMLImageElement>(".journey-still")];

  const bar = document.createElement("div");
  bar.className = "journey-bar";
  bar.innerHTML = `<span class="journey-label"></span><span class="journey-toast" aria-hidden="true"></span><button type="button" class="journey-controls" aria-haspopup="dialog" aria-label="Garden controls" title="Garden controls">${sliders}</button><button type="button" class="journey-sound" aria-pressed="false" aria-label="Play garden sounds" title="Play garden sounds">${speaker}</button><button type="button" class="journey-pause" aria-pressed="false" aria-label="Pause motion" title="Pause motion"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-pause" d="M8 5.5v13M16 5.5v13"/><path class="icon-play" d="M8 5.5v13l10-6.5Z"/></svg></button>`;
  const label = bar.querySelector<HTMLElement>(".journey-label")!;
  const toast = bar.querySelector<HTMLElement>(".journey-toast")!;
  const pause = bar.querySelector<HTMLButtonElement>(".journey-pause")!;
  pause.addEventListener("click", () => options.onTogglePause());
  const sound = bar.querySelector<HTMLButtonElement>(".journey-sound")!;
  sound.addEventListener("click", () => options.onToggleSound());
  function setSound(on: boolean | null) {
    sound.hidden = on === null;
    const name = on ? "Stop garden sounds" : "Play garden sounds";
    sound.setAttribute("aria-pressed", String(!!on));
    sound.setAttribute("aria-label", name);
    sound.title = name;
  }
  function setMotion(stopped: boolean, systemReduced: boolean) {
    const name = systemReduced ? "Motion paused by your system preference" : stopped ? "Resume motion" : "Pause motion";
    pause.setAttribute("aria-pressed", String(stopped));
    pause.setAttribute("aria-label", name);
    pause.title = name;
    pause.disabled = systemReduced;
  }

  // Blueprint's card carries the career as a timeline that fills with scroll.
  const years = [...document.querySelectorAll(".career-list .eyebrow")].map((e) => e.textContent!.slice(0, 4)).reverse();
  const timeline = document.createElement("div");
  timeline.className = "mini-timeline";
  timeline.setAttribute("aria-hidden", "true");
  timeline.innerHTML = `<span class="mini-line"></span>${[...years, "now"].map((y) => `<span class="mini-year">${y}</span>`).join("")}`;

  let controlsOpen = false;
  const sheet = createSheet((key) => {
    if ((key === "controls") === controlsOpen) return;
    controlsOpen = !controlsOpen;
    options.onControls(controlsOpen);
  });
  // The desktop's dock opens in the sheet, over the garden it changes.
  const controls = bar.querySelector<HTMLButtonElement>(".journey-controls")!;
  // Like the desktop's dock, the controls wait for Bloom.
  controls.hidden = true;
  controls.addEventListener("click", () => sheet.open("controls", "Garden controls", controls));
  const moreButtons = stops.flatMap((s) => {
    const d = details[s.name];
    if (!d) return [];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stop-more";
    button.textContent = d.text;
    if (d.label) button.setAttribute("aria-label", d.label);
    button.addEventListener("click", () => sheet.open(d.key, d.title, button));
    return [{ stop: s.name, button }];
  });

  // Bloom's card opens the finished garden; Done, or Escape, closes it.
  const explore = document.createElement("button");
  explore.type = "button";
  explore.className = "stop-more stop-explore";
  explore.textContent = "Explore the garden";
  const exploreBar = document.createElement("div");
  exploreBar.className = "explore-bar";
  const zoomIcon = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  exploreBar.innerHTML = `<p class="explore-hint">Drag to turn the garden. Pinch to zoom.</p>
    <div class="explore-controls"><button type="button" class="explore-zoom" data-zoom="out" aria-label="Zoom out" title="Zoom out">${zoomIcon("M6 12h12")}</button><button type="button" class="explore-done">Done</button><button type="button" class="explore-zoom" data-zoom="in" aria-label="Zoom in" title="Zoom in">${zoomIcon("M6 12h12M12 6v12")}</button></div>`;
  const done = exploreBar.querySelector<HTMLButtonElement>(".explore-done")!;
  exploreBar.querySelectorAll<HTMLButtonElement>("[data-zoom]").forEach((b) =>
    b.addEventListener("click", () => options.onZoom(b.dataset.zoom === "in" ? 1.4 : 1 / 1.4)));
  let exploring = false;
  async function setExploring(on: boolean) {
    if (on === exploring) return;
    exploring = on;
    if (on) {
      root.dataset.exploring = "true";
      for (const el of [portfolio, $(".masthead")]) el.inert = true;
      document.body.append(exploreBar);
      done.focus();
      if ((await options.onExplore(true)) === false && exploring) void setExploring(false);
    } else {
      delete root.dataset.exploring;
      for (const el of [portfolio, $(".masthead")]) el.inert = false;
      exploreBar.remove();
      void options.onExplore(false);
      if (active) explore.focus({ preventScroll: true });
    }
  }
  explore.addEventListener("click", () => void setExploring(true));
  done.addEventListener("click", () => void setExploring(false));
  addEventListener("keydown", (e) => {
    if (!exploring) return;
    if (e.key === "Escape") void setExploring(false);
    // The browser's own zoom keys zoom the garden instead of the page.
    else if (["+", "=", "-"].includes(e.key) && !e.altKey) {
      e.preventDefault();
      options.onZoom(e.key === "-" ? 1 / 1.4 : 1.4);
    }
  });

  const portfolio = $("#portfolio"), about = $("#about"), work = $("#work"), contact = $("#contact");
  const title = $("#intro-title");
  const titleText = title.textContent!;
  const stopEls = stops.map((s) => $(`[data-stop="${s.name}"]`));
  let active = false;
  let current: Stop | undefined;
  let growth = 0;
  let live = false;
  let toastTimer = 0;
  let night = false;

  function load(i: number) {
    const img = stills[i];
    if (live) return;
    if (img && !img.getAttribute("src")) img.src = `/assets/stills/${stops[i].name}${night ? "-night" : ""}.webp`;
  }
  function setNight(on: boolean) {
    if (on === night) return;
    night = on;
    // The stills in view load again in their new light; the rest when reached.
    stills.forEach((img) => img.removeAttribute("src"));
    schedule();
  }

  function measure() {
    if (!active) return;
    const h = innerHeight;
    const tops = stopEls.map((el) => el.getBoundingClientRect().top);
    // The current stop is the last one whose top has passed the middle of the screen.
    let at = 0;
    tops.forEach((top, i) => { if (top <= h * 0.5) at = i; });
    // Its own still, the next one, and the one before for scrolling back up.
    load(at - 1);
    load(at);
    load(at + 1);
    let wiping = -1;
    let moving = false;
    let grown = stageProgress[stops[0].stage];
    stills.forEach((img, i) => {
      // A still wipes in while its stop rises from the bottom of the screen
      // to 40% from the top; with reduced motion it cuts at halfway. The
      // garden grows into the stop's stage over the same stretch.
      const raw = i === 0 ? 1 : clamp((h - tops[i]) / (h * 0.6));
      const wipe = reducedQuery.matches ? (raw >= 0.5 ? 1 : 0) : raw;
      if (wipe > 0 && wipe < 1) wiping = wipe;
      if (i > 0 && raw > 0) {
        const from = stageProgress[stops[i - 1].stage], to = stageProgress[stops[i].stage];
        grown = from + (to - from) * smoothstep(wipe);
        // A card leaves as the next stop starts to rise, and the next card
        // sets in once its stop has taken over.
        if (i === at + 1 && raw > 0.04) moving = true;
      }
      img.style.setProperty("--wipe", wipe.toFixed(3));
      // While its stop holds, the still drifts a little closer.
      const span = i < stops.length - 1 ? tops[i + 1] - tops[i] : h;
      img.style.setProperty("--drift", clamp(-tops[i] / Math.max(1, span)).toFixed(3));
    });
    layer.toggleAttribute("data-wiping", wiping >= 0);
    layer.style.setProperty("--edge", Math.max(wiping, 0).toFixed(3));
    const b = stops.findIndex((s) => s.name === "blueprint");
    timeline.style.setProperty("--fill", clamp((h - tops[b]) / Math.max(1, tops[b + 1] - tops[b])).toFixed(3));
    stopEls.forEach((el, i) => el.querySelector(".stop-card")!.classList.toggle("current", i === at && !moving));
    if (grown !== growth) {
      growth = grown;
      options.onGrowth(growth);
    }
    if (stops[at] !== current) {
      current = stops[at];
      layer.dataset.at = current.name;
      label.textContent = current.label;
      controls.hidden = current.name !== "bloom";
      options.onStop(current);
    }
  }
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; measure(); });
  }

  function setActive(on: boolean) {
    // index.html marks a likely journey as pending before the page is laid out.
    if (!on && root.dataset.journey === "pending") delete root.dataset.journey;
    if (on === active) return;
    active = on;
    if (on) {
      root.dataset.journey = "true";
      document.body.prepend(layer);
      $(".masthead .read-ruler").before(bar);
      // The journey runs Sketch, Blueprint, Build, Bloom: the background comes
      // before the work, in the tab order as well as on screen.
      portfolio.insertBefore(about, work);
      $('[data-stop="blueprint"] .stop-card').append(timeline);
      for (const { stop, button } of moreButtons) $(`[data-stop="${stop}"] .stop-card`).append(button);
      $('[data-stop="bloom"] .stop-card').append(explore);
      title.innerHTML = lettered(titleText);
      current = undefined;
      growth = -1;
      addEventListener("scroll", schedule, { passive: true });
      addEventListener("resize", schedule);
      // Measured on the next frame, once the page has scrolled to a deep link's stop.
      schedule();
    } else {
      sheet.close(true);
      // Focus on a card's More (the sheet gives it back there), on the
      // explore controls or in the header would go with them, so it moves
      // to that stop's heading.
      const focused = document.activeElement;
      const stranded = moreButtons.find(({ button }) => button === focused)?.stop
        ?? (focused === explore || exploreBar.contains(focused) ? "bloom" : bar.contains(focused) ? current?.name : undefined);
      void setExploring(false);
      delete root.dataset.journey;
      layer.remove();
      bar.remove();
      timeline.remove();
      moreButtons.forEach(({ button }) => button.remove());
      explore.remove();
      portfolio.insertBefore(about, contact);
      title.textContent = titleText;
      document.querySelectorAll(".stop-card.current").forEach((card) => card.classList.remove("current"));
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      if (stranded) $(`[data-stop="${stranded}"]`).querySelector<HTMLElement>("h1, h2, h3")!.focus({ preventScroll: true });
    }
  }

  // An empty message takes the current one down.
  function notify(text: string) {
    if (!text) {
      clearTimeout(toastTimer);
      bar.classList.remove("toasting");
      toast.textContent = "";
      return;
    }
    toast.textContent = text;
    bar.classList.add("toasting");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { bar.classList.remove("toasting"); toast.textContent = ""; }, 5000);
  }

  return {
    get active() { return active; },
    get stop() { return current ?? stops[0]; },
    get growth() { return Math.max(0, growth); },
    get exploring() { return exploring; },
    get controlsTop() {
      const d = document.querySelector<HTMLElement>("dialog.sheet");
      return controlsOpen && d ? innerHeight - d.offsetHeight : 0;
    },
    layer,
    setActive,
    notify,
    setMotion,
    setSound,
    setNight,
    setLive(on: boolean) {
      if (on === live) return;
      live = on;
      layer.toggleAttribute("data-live", on);
      // Back to stills: the ones around the current stop load again.
      if (!on) schedule();
    },
  };
}
