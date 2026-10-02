import "./phone.css";
import { stops, type Stop, type StopName } from "./content";
import { lettered } from "./lettered";
import { createSheet } from "./sheet";

/* The garden journey on phones (docs/superpowers/specs/2026-10-02-phone-journey-design.md).
   It is laid over the reading page: each stop is one of its sections, shown
   as a short card over a still of the garden, and the stills wipe into one
   another as the visitor scrolls. Details open in a sheet. */
export type JourneyOptions = {
  /** The visitor reached a new stop. */
  onStop: (stop: Stop) => void;
  /** The header's pause button was pressed. */
  onTogglePause: () => void;
};
export type Journey = {
  readonly active: boolean;
  readonly stop: Stop;
  /** The fixed layer behind the cards; main.ts puts the live garden in it. */
  readonly layer: HTMLElement;
  setActive: (on: boolean) => void;
  /** A short message in the header for a few seconds. */
  notify: (text: string) => void;
  /** Shows the motion state on the header's pause button. */
  setMotion: (stopped: boolean, systemReduced: boolean) => void;
};

const details: Partial<Record<StopName, { key: string; title: string; text: string; label?: string }>> = {
  blueprint: { key: "about", title: "Background", text: "More", label: "More about my background" },
  whisperbook: { key: "whisperbook", title: "Whisperbook", text: "More", label: "More about Whisperbook" },
  wattch: { key: "wattch", title: "Wattch Core", text: "More", label: "More about Wattch Core" },
  bloom: { key: "contact", title: "Leave a note", text: "Leave a note" },
};
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v: number) => Math.min(1, Math.max(0, v));

// Outlined like the sketched clouds on the desktop sky.
const cloud = `<svg viewBox="0 0 120 50" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 44h94c9 0 13-7 10-13-2-5-8-7-13-5 0-10-9-16-18-13-4-9-15-13-24-9-7 3-11 10-10 17-6-3-15 0-17 7-8-1-14 4-13 10 1 4 5 6 11 6z"/></svg>`;

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
  bar.innerHTML = `<span class="journey-label"></span><span class="journey-toast" role="status"></span><button type="button" class="journey-pause" aria-pressed="false" aria-label="Pause motion" title="Pause motion"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-pause" d="M8 5.5v13M16 5.5v13"/><path class="icon-play" d="M8 5.5v13l10-6.5Z"/></svg></button>`;
  const label = bar.querySelector<HTMLElement>(".journey-label")!;
  const toast = bar.querySelector<HTMLElement>(".journey-toast")!;
  const pause = bar.querySelector<HTMLButtonElement>(".journey-pause")!;
  pause.addEventListener("click", () => options.onTogglePause());
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

  const sheet = createSheet();
  const moreButtons = stops.flatMap((s) => {
    const d = details[s.name];
    if (!d) return [];
    const button = document.createElement("button");
    button.type = "button";
    button.className = s.name === "bloom" ? "stop-more primary" : "stop-more";
    button.textContent = d.text;
    if (d.label) button.setAttribute("aria-label", d.label);
    button.addEventListener("click", () => sheet.open(d.key, d.title, button));
    return [{ stop: s.name, button }];
  });

  const portfolio = $("#portfolio"), about = $("#about"), work = $("#work"), contact = $("#contact");
  const title = $("#intro-title");
  const titleText = title.textContent!;
  const stopEls = stops.map((s) => $(`[data-stop="${s.name}"]`));
  let active = false;
  let current: Stop | undefined;
  let observer: IntersectionObserver | undefined;
  let toastTimer = 0;

  function load(i: number) {
    const img = stills[i];
    if (img && !img.getAttribute("src")) img.src = `/assets/stills/${stops[i].name}.webp`;
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
    stills.forEach((img, i) => {
      // A still wipes in while its stop rises from the bottom of the screen
      // to 40% from the top; with reduced motion it cuts at halfway.
      const raw = i === 0 ? 1 : clamp((h - tops[i]) / (h * 0.6));
      const wipe = reducedQuery.matches ? (raw >= 0.5 ? 1 : 0) : raw;
      if (wipe > 0 && wipe < 1) wiping = wipe;
      img.style.setProperty("--wipe", wipe.toFixed(3));
      // While its stop holds, the still drifts a little closer.
      const span = i < stops.length - 1 ? tops[i + 1] - tops[i] : h;
      img.style.setProperty("--drift", clamp(-tops[i] / Math.max(1, span)).toFixed(3));
    });
    layer.toggleAttribute("data-wiping", wiping >= 0);
    layer.style.setProperty("--edge", Math.max(wiping, 0).toFixed(3));
    const b = stops.findIndex((s) => s.name === "blueprint");
    timeline.style.setProperty("--fill", clamp((h - tops[b]) / Math.max(1, tops[b + 1] - tops[b])).toFixed(3));
    if (stops[at] !== current) {
      current = stops[at];
      layer.dataset.at = current.name;
      label.textContent = current.label;
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
      title.innerHTML = lettered(titleText);
      observer = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("seen"); }), { threshold: 0.15 });
      document.querySelectorAll(".stop-card").forEach((card) => observer!.observe(card));
      current = undefined;
      addEventListener("scroll", schedule, { passive: true });
      addEventListener("resize", schedule);
      // Measured on the next frame, once the page has scrolled to a deep link's stop.
      schedule();
    } else {
      sheet.close(true);
      delete root.dataset.journey;
      layer.remove();
      bar.remove();
      timeline.remove();
      moreButtons.forEach(({ button }) => button.remove());
      portfolio.insertBefore(about, contact);
      title.textContent = titleText;
      observer?.disconnect();
      document.querySelectorAll(".stop-card.seen").forEach((card) => card.classList.remove("seen"));
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    }
  }

  function notify(text: string) {
    toast.textContent = text;
    bar.classList.add("toasting");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { bar.classList.remove("toasting"); toast.textContent = ""; }, 5000);
  }

  return {
    get active() { return active; },
    get stop() { return current ?? stops[0]; },
    layer,
    setActive,
    notify,
    setMotion,
  };
}
