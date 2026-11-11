/* P1 motion study (development only, served at /dev/motion-study.html).
   The real garden in two hosts: a sticky rail beside flowing text (wide) and
   a ~45vh slot between a chapter's motivation and its decision (portrait),
   sticky at the top only while a transition runs. Document scrolling and the
   chapter buttons drive the scene adapter. Not part of the production build. */
import { createGarden } from "../scene";
import { chapterIds as chapterOrder, type ChapterId, type MotionPreference } from "./model";
import { createSceneAdapter, type HostKind } from "./scene-adapter";

type LogEntry = {
  t: number;
  type: "go" | "settled";
  chapter: ChapterId | null;
  immediate?: boolean;
  frames: number;
  /** For "settled": ms since the last go. */
  ms?: number;
};

const params = new URLSearchParams(location.search);
const host: HostKind =
  params.get("host") === "portrait" || params.get("host") === "wide"
    ? (params.get("host") as HostKind)
    : innerWidth < 700
      ? "portrait"
      : "wide";
document.documentElement.dataset.host = host;

const $ = <E extends Element = HTMLElement>(s: string) => document.querySelector<E>(s)!;
const sceneEl = $("#scene");
const sections = [...document.querySelectorAll<HTMLElement>("[data-chapter]")];
const sectionOf = (id: ChapterId) => sections.find((s) => s.dataset.chapter === id)!;
const slotOf = (id: ChapterId) => sectionOf(id).querySelector<HTMLElement>("[data-slot]")!;
const readout = $("#readout");
const bar = $(".bar");

// Phones build the light garden, as the live page does (detailFor in main.ts).
const detail = (params.get("detail") as "full" | "low" | null) ?? (host === "portrait" ? "low" : "full");
if (host === "portrait") slotOf("intro").append(sceneEl);

const garden = await createGarden(sceneEl, [], detail, detail === "low" ? "light" : "full");
// Warm paper: the light ink set (scene.ts setTheme), on the page's ivory.
garden.setTheme(false);
const adapter = createSceneAdapter(garden, host);
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const motionSelect = $<HTMLSelectElement>("#motion");
const preference = (): MotionPreference =>
  reducedQuery.matches && motionSelect.value === "normal" ? "system-reduced" : (motionSelect.value as MotionPreference);
adapter.setMotionPreference(preference());
if (reducedQuery.matches) motionSelect.value = "system-reduced";
motionSelect.addEventListener("change", () => adapter.setMotionPreference(preference()));
// Guided reading: ambient life stays off; only transitions draw.
if (params.get("ambient") !== "on") adapter.hold();

const log: LogEntry[] = [];
let active: ChapterId | null = null;
let goAt = 0;
let transitSlot: HTMLElement | null = null;

function showReadout() {
  const s = adapter.state();
  readout.textContent = `${s.chapter} · p ${Number(sceneEl.dataset.progress ?? 0).toFixed(2)} · frames ${garden.stats().frames} · ${adapter.isSettled() ? "settled" : "moving"}${s.held ? " · held" : ""}`;
}

/** Releases a stuck portrait slot into flow, sliding from where it was stuck. */
function releaseSlot() {
  const slot = transitSlot;
  if (!slot) return;
  transitSlot = null;
  const before = slot.getBoundingClientRect().top;
  slot.classList.remove("transit");
  const after = slot.getBoundingClientRect().top;
  if (Math.abs(before - after) < 1 || preference() !== "normal") return;
  slot.style.transform = `translateY(${before - after}px)`;
  void slot.offsetHeight;
  slot.classList.add("releasing");
  slot.style.transform = "";
  slot.addEventListener("transitionend", () => slot.classList.remove("releasing"), { once: true });
}

function activate(id: ChapterId, immediate: boolean) {
  active = id;
  document.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((b) => b.setAttribute("aria-current", String(b.dataset.go === id)));
  if (host === "portrait") {
    const slot = slotOf(id);
    if (sceneEl.parentElement !== slot) {
      if (transitSlot && transitSlot !== slot) {
        transitSlot.classList.remove("transit");
        transitSlot = null;
      }
      slot.append(sceneEl);
    }
    if (!immediate && preference() === "normal") {
      slot.classList.add("transit");
      transitSlot = slot;
    }
  }
  goAt = performance.now();
  adapter.go(id, { immediate });
  log.push({ t: goAt, type: "go", chapter: id, immediate, frames: garden.stats().frames });
  showReadout();
}

adapter.onSettled(() => {
  const t = performance.now();
  log.push({ t, type: "settled", chapter: active, frames: garden.stats().frames, ms: Math.round(t - goAt) });
  releaseSlot();
  showReadout();
});

/* The active chapter follows reading: wide, the section crossing 45% of the
   view; portrait, the last section whose slot has come 70% of the way up. */
function chapterAtScroll(): ChapterId {
  let id: ChapterId = "intro";
  for (const s of sections) {
    const top =
      host === "portrait"
        ? s.querySelector<HTMLElement>("[data-slot]")!.getBoundingClientRect().top
        : s.getBoundingClientRect().top;
    if (top < innerHeight * (host === "portrait" ? 0.7 : 0.45)) id = s.dataset.chapter as ChapterId;
  }
  return id;
}
let scrollQueued = false;
addEventListener(
  "scroll",
  () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      const id = chapterAtScroll();
      // Only the latest destination: skipped chapters queue nothing.
      if (id !== active) activate(id, false);
    });
  },
  { passive: true },
);

/** Explicit navigation: the document and the scene jump straight to the chapter. */
function jump(id: ChapterId) {
  const section = sectionOf(id);
  active = id;
  window.scrollTo({ top: section.offsetTop - bar.offsetHeight, behavior: "instant" });
  activate(id, true);
}
const buttons = $("#chapters");
for (const id of chapterOrder) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.go = id;
  b.textContent = id;
  b.addEventListener("click", () => jump(id));
  buttons.append(b);
}

const start = (location.hash.slice(1) as ChapterId) || null;
if (start && chapterOrder.includes(start)) jump(start);
else activate(chapterAtScroll(), true);

declare global {
  interface Window {
    __study: {
      adapter: typeof adapter;
      garden: typeof garden;
      host: HostKind;
      log: LogEntry[];
      jump: (id: ChapterId) => void;
      scene: HTMLElement;
    };
  }
}
window.__study = { adapter, garden, host, log, jump, scene: sceneEl };
document.documentElement.dataset.studyReady = "true";
