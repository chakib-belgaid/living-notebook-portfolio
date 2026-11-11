/** The one live scene: renderer lifecycle, host handoff, poster handoff and
 * ambient animation, driven by the reading controller (./controller.ts)
 * through P1's adapter (./scene-adapter.ts).
 *
 * State, tracked independently (model.ts `ReadingState`):
 * - chapter + transition: the chapter the scene is posed for, and 0 while it
 *   moves toward that pose, 1 once settled;
 * - mode: guided | stills, and exploring (./explore.ts) on top of guided;
 * - motion: normal | user-paused | system-reduced;
 * - renderer: not-requested → loading → ready | failed, ready ⇄ context-lost;
 * - sound: false until its own control turns it on;
 * - locale and quality tier.
 *
 * One renderer, one canvas. A single stage element (sky behind, garden,
 * sky in front) is created once and moved between the wide rail
 * `[data-scene-host="rail"]` and the portrait slot `[data-scene-host="<id>"]`
 * of the chapter being shown. Moving it never rebuilds geometry: the garden
 * observes its own container, so its size and visibility observers follow
 * the stage. The host's poster stays visible underneath until the stage has
 * drawn the matching pose (`Garden.nextFrame`), then the stage fades in.
 *
 * Which chapter is shown. The controller reads at a line 30% down the view.
 * The scene leads it by a short interval (25% of the view on wide layouts,
 * 35% on portrait): a passive transition starts as the next chapter comes
 * up, eases to its cue (only the latest destination, nothing queued) and
 * settles while the visitor finishes the previous chapter. On portrait the
 * stage moves to the leading chapter's slot only when that slot is at least
 * as visible as the one it is in (visibility hysteresis), so a slot on
 * screen is never emptied for one off screen; the move usually happens with
 * both slots off screen, and the garden, which does not draw off screen,
 * plays the transition as the new slot comes into view. Explicit navigation,
 * history and deep links snap the scene to the destination at once and pin
 * it there until the visitor scrolls away.
 *
 * Ambient life continues after chapter transitions settle, including on
 * initial landings and after exploring. Pause and system-reduced motion
 * keep everything still (poses snap). A hidden tab draws nothing (both loops
 * check document.hidden); on return the latest chapter is posed before
 * the first frame. Offscreen, the garden stops (its IntersectionObserver)
 * and so does the sky (ours).
 *
 * Reduced motion, stills (`?view=read|stills`) and save-data load no scene
 * until the visitor turns off "Still images". Sound starts only from its
 * control; pause and system-reduced silence it without changing consent.
 *
 * The garden panel (src/narrative/garden-panel.ts) sets the atmosphere (the
 * hour, the weather, the season), the drawing quality and the visitor's
 * trees through `garden` below. The mount keeps that state, so a scene built
 * later (stills turned off, a lost context) opens as the visitor left it,
 * trees included, and the soundscape hears the same weather. */
import type { ComputeWork } from "../compute";
import { getLocale, onLocaleChange } from "../i18n";
import type { Garden, GardenSnapshot, Season } from "../scene";
import { presets, type Weather, type WeatherKind } from "../weather";
import type { Sky } from "../sky";
import type { Soundscape } from "../soundscape";
import { chapter as chapterContent } from "./content";
import type { ChangeCause, NarrativeController } from "./controller";
import { chapterIds, exploreSpots, posterSrc, READING_FRAME_RATE, resolveFragment, WIDE_LAYOUT_QUERY, type ChapterId, type MotionPreference, type RendererLifecycle } from "./model";
import {
  COMPACT_QUERY, LIVE_KEY, PAUSE_KEY, QUALITY_KEY, REDUCED_MOTION_QUERY,
  detailFor, liveByDefault, motionPreference, qualityChoice, qualityFor, read, saveDataOn, viewMode, write,
  type Detail, type Quality, type QualityChoice, type ViewMode,
} from "./preferences";
import type { HostKind, SceneAdapter } from "./scene-adapter";
import { createSceneControls, type ControlName } from "./scene-controls";
import type { ExitReason, Explorer } from "./explore";

export interface SceneState {
  chapter: ChapterId;
  transition: number;
  /** Guided or stills; exploring is tracked apart (`exploring` in the test hook). */
  mode: ViewMode;
  motion: MotionPreference;
  renderer: RendererLifecycle;
  sound: boolean;
  locale: string;
  quality: Quality;
  /** The host the stage is in: "rail" or a chapter id; null before a stage exists. */
  host: string | null;
  /** The stage is drawn over the poster. */
  live: boolean;
}

/** The controller's reading line (controller.ts READING_LINE). */
const READING_LINE = 0.3;
/** The page's time of day: the navy night of the previous page (G2), with
 * the moon and stars up and the house's lamps lit. */
const NIGHT_HOUR = 22;
/** How far ahead of the reading line the scene starts its next transition. */
const LEAD: Record<HostKind, number> = { wide: 0.25, portrait: 0.35 };
/** 0–1 mist over the garden for each kind of weather. */
const fogByKind: Record<WeatherKind, number> = {
  clear: 0, partly: 0, cloudy: 0.1, fog: 1, drizzle: 0.3, rain: 0.35, snow: 0.4, storm: 0.45,
};
/** 0 by day, 1 by night, for the hour (the garden's own curve). */
function nightOf(hour: number) {
  const step = (a: number, b: number, v: number) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  return Math.min(1, step(19.2, 21.5, hour) + (1 - step(5, 6.6, hour)));
}

/** The atmosphere the visitor has chosen in the garden panel. */
export interface Atmosphere {
  /** Local hour, 5–23. */
  hour: number;
  weather: Weather;
  season: Season;
}

/** What the garden panel (src/narrative/garden-panel.ts) drives. */
export interface GardenScene {
  atmosphere(): Atmosphere;
  setHour(hour: number): void;
  setWeather(weather: Weather): void;
  setSeason(season: Season): void;
  quality(): QualityChoice;
  setQuality(choice: QualityChoice): void;
  /** A live garden is on screen: planting and turning can act. */
  live(): boolean;
  /** The visitor's trees, kept across rebuilt gardens. */
  trees(): number;
  /** Plants a tree on the front terrace; null without a live garden. */
  plant(): number | null;
  /** Planting by clicking the garden: on, the stage takes clicks. */
  setPlanting(on: boolean): void;
  rotate(): void;
  /** A click planted a tree (the new count) or missed a terrace (-1). */
  onPlanted(listener: (count: number) => void): () => void;
  /** The scene's state was published (renderer, live, quality, …). */
  onState(listener: () => void): () => void;
  /** Explore the garden (src/narrative/explore.ts, loaded on the first
   * call). Without a live scene it asks for one, as turning "Still images"
   * off does, and enters once it is ready; where the renderer failed it
   * resolves without entering. */
  explore(): Promise<void>;
  exitExplore(reason?: "escape" | "button" | "hotspot" | "layout"): void;
  exploring(): boolean;
  /** Exploring began (true) or ended (false). Returns an unsubscribe. */
  onExplore(listener: (on: boolean) => void): () => void;
  /** The visitor's own view of the live garden (drawn at once under a still preference). */
  rotateBy(radians: number): void;
  zoomBy(factor: number, x?: number, y?: number): void;
  panBy(dx: number, dy: number): void;
  resetView(): void;
}

const statusText = {
  reduced: "Reduced motion is on in your system settings.",
  saveData: "Data saver is on, so still images are shown.",
  failed: "The live drawing can’t be shown here. Still images are shown instead.",
  lost: "The live drawing stopped. A still image is shown instead.",
  soundFailed: "Sound couldn’t start here. Press Sound to try again.",
} as const;

export function createSceneMount(controller: NarrativeController) {
  const root = document.documentElement;
  const href = () => location.href;
  const wideQuery = matchMedia(WIDE_LAYOUT_QUERY);
  const reducedQuery = matchMedia(REDUCED_MOTION_QUERY);
  const compactQuery = matchMedia(COMPACT_QUERY);
  const session = () => sessionStorage;
  const local = () => localStorage;

  const rail = document.querySelector<HTMLElement>('[data-scene-host="rail"]')!;
  const slots = new Map(chapterIds.map(id => [id, document.querySelector<HTMLElement>(`[data-scene-host="${id}"]`)!]));
  const sections = chapterIds.map(id => document.getElementById(id)!);
  const masthead = document.querySelector<HTMLElement>(".masthead");
  const hostKind = (): HostKind => (wideQuery.matches ? "wide" : "portrait");
  const hostFor = (id: ChapterId) => (hostKind() === "wide" ? rail : slots.get(id)!);
  const hostName = (el: HTMLElement) => el.dataset.sceneHost!;

  const saveData = saveDataOn();
  let userPaused = read(session, PAUSE_KEY) === "paused";
  let asked = read(session, LIVE_KEY) === "1";
  let choice = qualityChoice(href(), read(local, QUALITY_KEY));
  /* The navy night (the user's G2 decision) until the visitor plays with
     the sky: the moon and stars up and the house's lamps lit. */
  const atmosphere: Atmosphere = { hour: NIGHT_HOUR, weather: presets.clear, season: "summer" };
  /** The visitor's trees and view (turn, zoom, pan), carried into the next garden built. */
  let kept: GardenSnapshot | null = null;
  let planting = false;
  const plantedListeners = new Set<(count: number) => void>();
  const stateListeners = new Set<() => void>();

  /* The landing chapter. A fragment names it outright while the document has
     not been scrolled yet: on a reload or a history traversal the browser
     restores the scroll position after this module runs, and the scroll-based
     chapter would be the opening, downgrading the rail poster the inline
     script set (F16). */
  const fragment = resolveFragment(location.hash);
  const landing: ChapterId = fragment && location.hash.length > 1 && scrollY <= 1 ? fragment.chapter : controller.activeChapter();

  const state: SceneState = {
    chapter: landing,
    transition: 1,
    mode: viewMode(href()),
    motion: motionPreference(reducedQuery.matches, userPaused),
    renderer: "not-requested",
    sound: false,
    locale: getLocale(),
    quality: qualityFor(choice, compactQuery.matches),
    host: null,
    live: false,
  };

  // The live scene, once requested.
  let stage: HTMLElement | null = null;
  let gardenBox: HTMLElement | null = null;
  let garden: Garden | null = null;
  let sky: Sky | null = null;
  /* Drawing done by renderers already torn down (a lost context, stills
     turned on), so the visit's footprint keeps counting across them. */
  const retired = { cpuMs: 0, gpuMs: 0, any: false };
  let adapter: SceneAdapter | null = null;
  let loading: Promise<void> | null = null;
  /** Bumped when a scene is torn down, so a late load or reveal is ignored. */
  let generation = 0;
  /** Settle events so far: rapid scrolling must end in one, not one per chapter passed. */
  let settles = 0;
  let stageOnScreen = true;
  let stageObserver: IntersectionObserver | null = null;
  let offSettled: (() => void) | null = null;
  /** The detail the live garden was built with (preferences.ts detailFor). */
  let builtDetail: Detail | null = null;
  /** Gardens rebuilt for a new detail tier this visit (a test hook). */
  let rebuilds = 0;
  let rebuilding: Promise<void> | null = null;
  /** The garden a rebuild replaces, kept on screen until its successor has drawn. */
  let retiring: Garden | null = null;
  /** The visit's carbon so far, carried into a rebuilt garden's register. */
  let tallyGrams: number | null = null;
  /* Explore the garden (./explore.ts, loaded on request). The labelled
     places are made once and moved into each stage built; the garden
     positions them every frame, and they are shown only while exploring. */
  let explorer: Explorer | null = null;
  let explorerLoading: Promise<typeof import("./explore")> | null = null;
  let exploring = false;
  let exploreFrom: { y: number; chapter: ChapterId } | null = null;
  const exploreListeners = new Set<(on: boolean) => void>();
  let spotLayer: HTMLElement | null = null;
  const hotspots: HTMLButtonElement[] = [];
  function hotspotLayer() {
    if (spotLayer) return spotLayer;
    spotLayer = document.createElement("div");
    spotLayer.className = "scene-hotspots";
    for (const { spot, chapter: id } of exploreSpots) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      button.dataset.spot = spot;
      button.dataset.chapter = id;
      button.hidden = true;
      button.textContent = chapterContent(id).title.replace(/\.$/, "");
      hotspots.push(button);
      spotLayer.append(button);
    }
    return spotLayer;
  }

  /* ---------- Geometry: read in one batch, cached until layout changes ---------- */
  type Geometry = { tops: number[]; slotTops: number[]; slotHeights: number[]; header: number; viewport: number; maxScroll: number };
  let geometry: Geometry | null = null;
  function measure(): Geometry {
    const y = scrollY;
    const tops: number[] = [], slotTops: number[] = [], slotHeights: number[] = [];
    for (let i = 0; i < sections.length; i++) {
      tops[i] = sections[i].getBoundingClientRect().top + y;
      // A slot's place in the flow: just below its chapter's lead.
      const slot = slots.get(chapterIds[i])!;
      const lead = slot.previousElementSibling as HTMLElement | null;
      const box = slot.getBoundingClientRect();
      slotTops[i] = (lead ? lead.getBoundingClientRect().bottom : box.top) + y;
      slotHeights[i] = box.height;
    }
    const header = masthead && getComputedStyle(masthead).position === "sticky" ? masthead.getBoundingClientRect().height : 0;
    return { tops, slotTops, slotHeights, header, viewport: innerHeight, maxScroll: Math.max(0, root.scrollHeight - innerHeight) };
  }
  const geo = () => (geometry ??= measure());
  const invalidate = () => { geometry = null; };

  /** The chapter the scene should show at this scroll position (with hysteresis). */
  function leadChapter(current: ChapterId): ChapterId {
    const g = geo();
    const y = scrollY;
    if (y <= 1) return "intro";
    if (y >= g.maxScroll - 2) return "contact";
    const line = y + g.header + (g.viewport - g.header) * (READING_LINE + LEAD[hostKind()]);
    const indexAt = (at: number) => { let i = g.tops.length - 1; while (i > 0 && g.tops[i] > at) i--; return i; };
    const now = chapterIds.indexOf(current);
    const band = Math.min(48, g.viewport * 0.05);
    const ahead = indexAt(line - band);
    if (ahead > now) return chapterIds[ahead];
    const behind = indexAt(line + band);
    if (behind < now) return chapterIds[behind];
    return current;
  }
  /** How many pixels of a chapter's portrait slot are visible below the header. */
  function slotVisible(id: ChapterId) {
    const g = geo();
    const i = chapterIds.indexOf(id);
    const top = g.slotTops[i] - scrollY;
    return Math.max(0, Math.min(top + g.slotHeights[i], g.viewport) - Math.max(top, g.header));
  }

  /* ---------- Posters ---------- */
  function showRailPoster(id: ChapterId) {
    const { poster, phase } = chapterContent(id).scene;
    if (rail.dataset.poster === poster) return;
    rail.dataset.poster = poster;
    rail.dataset.phase = phase;
    rail.querySelector<HTMLImageElement>(".scene-poster")!.src = posterSrc(poster, "wide");
  }
  const preloaded = new Set<string>();
  /** Stills on a wide layout: the next chapter's poster is fetched ahead. */
  function preloadNext(id: ChapterId) {
    if (hostKind() !== "wide" || stage) return;
    const next = chapterIds[chapterIds.indexOf(id) + 1];
    if (!next) return;
    const src = posterSrc(chapterContent(next).scene.poster, "wide");
    if (preloaded.has(src)) return;
    preloaded.add(src);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }

  /* ---------- Publishing state ---------- */
  const controls = createSceneControls(toggle);
  /** The sound control was pressed and sound could not start. */
  let soundFailed = false;
  function status(): string {
    if (state.renderer === "failed") return statusText.failed;
    if (state.renderer === "context-lost") return statusText.lost;
    if (soundFailed) return statusText.soundFailed;
    if (state.motion === "system-reduced") return statusText.reduced;
    if (saveData && state.mode === "guided" && !stage && !asked) return statusText.saveData;
    return "";
  }
  /** Stills are what the visitor sees whenever no live stage is requested. */
  const showingStills = () => state.mode === "stills" || !wantLive();
  function publish() {
    root.dataset.renderer = state.renderer;
    root.dataset.sceneMode = state.mode;
    root.dataset.motion = state.motion;
    root.dataset.sound = String(state.sound);
    root.dataset.sceneChapter = state.chapter;
    root.dataset.weather = atmosphere.weather.kind;
    root.dataset.season = atmosphere.season;
    stateListeners.forEach(listener => listener());
    controls?.show({
      paused: state.motion !== "normal",
      systemReduced: state.motion === "system-reduced",
      stills: showingStills() || state.renderer === "failed",
      stillsLocked: state.renderer === "failed",
      sound: state.sound,
      soundSupported: typeof AudioContext !== "undefined",
      status: status(),
    });
  }

  /* ---------- Atmosphere ---------- */
  /** The hour, weather and season, on the garden and the sky. The garden
   * draws the change in its next frame; the mist
   * takes the page's paper colour. */
  function applyAtmosphere() {
    const w = atmosphere.weather;
    if (garden) {
      garden.setHour(atmosphere.hour);
      garden.setWeather(w.cloud, w.precip, w.kind === "snow");
      garden.setSeason(atmosphere.season);
      const paper = getComputedStyle(root).getPropertyValue("--paper").trim();
      garden.setFog(fogByKind[w.kind], parseInt(paper.slice(1), 16) || 0x0e2b48);
    }
    if (sky) {
      sky.setHour(atmosphere.hour);
      sky.setWeather(w);
    }
  }
  /** Planting by clicking: the stage takes the click and a tree is planted
   * where it meets a terrace. */
  function onStageClick(event: MouseEvent) {
    if (!planting || !garden || !gardenBox) return;
    if ((event.target as HTMLElement).closest?.(".hotspot")) return;
    const box = gardenBox.getBoundingClientRect();
    const count = garden.plantAt(event.clientX - box.left, event.clientY - box.top);
    if (count > 0) soundscape?.planted();
    plantedListeners.forEach(listener => listener(count));
  }

  /* ---------- Pose ---------- */
  /** Sky motion follows the visitor's preference and the stage's visibility. */
  let skyStill: boolean | null = null;
  function syncSky() {
    const still = state.motion !== "normal" || !stageOnScreen || document.hidden;
    // Only a change is passed on: setting the same value redraws the sky once.
    if (!sky || still === skyStill) return;
    skyStill = still;
    sky.setMotion(still);
  }
  /** Ambient life alone draws at the reading rate; exploring lifts the cap. */
  function syncFrameCap() {
    const cap = exploring ? null : READING_FRAME_RATE;
    garden?.setFrameCap(cap);
    sky?.setFrameCap(cap);
  }
  function pose(id: ChapterId, how: "ease" | "snap") {
    const changed = id !== state.chapter;
    state.chapter = id;
    showRailPoster(id);
    preloadNext(id);
    if (!adapter || !garden) { publish(); return; }
    const snap = how === "snap" || state.motion !== "normal";
    if (!snap && changed) {
      state.transition = 0;
    }
    syncSky();
    sky?.setGrowth(chapterContent(id).scene.progress, snap);
    if (changed || snap) adapter.go(id, { immediate: snap });
    publish();
  }

  /* ---------- Host handoff ---------- */
  function moveStage(to: HTMLElement) {
    if (!stage || stage.parentElement === to) return;
    const from = stage.parentElement as HTMLElement | null;
    // The exploration dialog keeps no copy; the slot it was opened from does.
    const dialog = (el: HTMLElement | null) => el?.dataset.sceneHost === "explore";
    if (from && from !== rail && to !== rail && !dialog(from) && state.live) keepPose(from);
    // Moving keeps the canvas, the geometry and the drawing; a host of
    // another size is redrawn in the same frame by the garden's resize.
    to.append(stage);
    state.host = hostName(to);
    to.querySelector(".scene-snapshot")?.remove();
    if (!dialog(to)) dropFarSnapshots(to);
  }
  /** A portrait slot the stage leaves keeps a copy of the pose it showed
   * (sky and house, on paper), so a slot still on screen, or scrolled back
   * to, is not left with a stale poster of another style. */
  function keepPose(host: HTMLElement) {
    if (!garden || !stage) return;
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    const scale = Math.min(devicePixelRatio || 1, 2);
    let copy = host.querySelector<HTMLCanvasElement>(".scene-snapshot");
    if (!copy) {
      copy = document.createElement("canvas");
      copy.className = "scene-snapshot";
      copy.setAttribute("aria-hidden", "true");
      host.append(copy);
    }
    copy.width = Math.round(width * scale);
    copy.height = Math.round(height * scale);
    const ctx = copy.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = getComputedStyle(stage).backgroundColor;
    ctx.fillRect(0, 0, copy.width, copy.height);
    const [back, , front] = stage.children as unknown as [HTMLCanvasElement, HTMLElement, HTMLCanvasElement];
    ctx.drawImage(back, 0, 0, copy.width, copy.height);
    garden.drawInto(ctx, 0, 0, copy.width, copy.height);
    ctx.drawImage(front, 0, 0, copy.width, copy.height);
  }
  /** Copies are kept only for the slots next to the one being shown. */
  function dropFarSnapshots(current: HTMLElement) {
    const at = chapterIds.indexOf(current.dataset.sceneHost as ChapterId);
    document.querySelectorAll<HTMLCanvasElement>(".scene-snapshot").forEach(copy => {
      const id = (copy.parentElement as HTMLElement).dataset.sceneHost as ChapterId;
      if (at < 0 || Math.abs(chapterIds.indexOf(id) - at) > 1) copy.remove();
    });
  }

  /* ---------- Reading → scene ---------- */
  /** An explicit destination the scene stays on until the visitor scrolls away. */
  let pin: { chapter: ChapterId; y: number; armedAt: number | null } | null = null;
  // A fragment landing (deep link, reload, Return) is explicit.
  if (location.hash.length > 1 && fragment) pin = { chapter: landing, y: scrollY, armedAt: null };
  // A landing taken from the fragment before any scroll: if the page is
  // still at the top once loaded (no scroll was restored), the opening is
  // what the visitor sees, so the reading position decides again.
  if (pin && pin.y <= 1 && landing !== "intro") {
    const recheck = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (pin && pin.y <= 1 && scrollY <= 1) { pin = null; update("layout"); }
    }));
    if (document.readyState === "complete") recheck();
    else addEventListener("load", recheck, { once: true });
  }

  function update(cause: "scroll" | "layout" | "visibility") {
    // Exploring holds the scene where the visitor put it; the reading
    // position is kept and resumed when exploring ends (decision 28).
    if (exploring) return;
    if (pin) {
      const moved = Math.abs(scrollY - pin.y);
      const g = geo();
      if ((pin.armedAt !== null && Math.abs(scrollY - pin.armedAt) > 2) || moved > g.viewport * 0.5) pin = null;
    }
    const target = pin ? pin.chapter : leadChapter(state.chapter);
    if (hostKind() === "portrait" && stage) {
      const current = stage.parentElement as HTMLElement;
      const desired = slots.get(target)!;
      if (current !== desired) {
        const shown = current === rail ? 0 : slotVisible(current.dataset.sceneHost as ChapterId);
        // Visibility hysteresis: never empty a slot on screen for a less visible one.
        if (pin || shown === 0 || slotVisible(target) >= shown) moveStage(desired);
        else return;
      }
    }
    if (target !== state.chapter) pose(target, cause === "scroll" && !pin ? "ease" : "snap");
  }

  const offPosition = controller.onPosition(() => update("scroll"));
  const offChange = controller.onChapterChange((_chapter, _previous, cause: ChangeCause) => {
    // The controller saw the visitor read on into another chapter: any
    // explicit destination is behind them.
    if (cause === "scroll" && pin && pin.chapter !== _chapter) pin = null;
  });
  const offVisit = controller.onVisit((id) => {
    // A jump from the header (or history) while exploring ends it there.
    if (exploring) leaveExplore("navigation");
    pin = { chapter: id, y: scrollY, armedAt: null };
    if (stage) moveStage(hostFor(id));
    pose(id, "snap");
  });
  // The visitor's own input arms the pin: the next real scroll releases it.
  const arm = () => { if (pin && pin.armedAt === null) pin.armedAt = scrollY; };
  const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  inputs.forEach(type => addEventListener(type, arm, { passive: true, capture: true }));

  const onResize = () => { invalidate(); requestAnimationFrame(() => update("layout")); };
  addEventListener("resize", onResize);
  const main = document.getElementById("portfolio");
  const layoutObserver = main && typeof ResizeObserver === "function" ? new ResizeObserver(invalidate) : null;
  if (layoutObserver && main) layoutObserver.observe(main);
  if (layoutObserver && masthead) layoutObserver.observe(masthead);
  document.fonts?.addEventListener?.("loadingdone", invalidate);
  const offLocale = onLocaleChange(() => { state.locale = getLocale(); invalidate(); publish(); });

  const onLayout = () => {
    // Wide ⇄ stacked: exploring ends, so the stage is never left in a host
    // of the other layout.
    if (exploring) leaveExplore("layout");
    invalidate();
    if (stage && adapter) {
      moveStage(hostFor(state.chapter));
      adapter.setHost(hostKind());
    }
    update("layout");
  };
  wideQuery.addEventListener("change", onLayout);

  const onVisibility = () => {
    syncSky();
    syncSound();
    // Back in view: pose the latest chapter before the first frame, at once
    // (while exploring, the garden stays as the visitor left it).
    if (!document.hidden && adapter && !exploring) {
      invalidate();
      const target = pin ? pin.chapter : leadChapter(state.chapter);
      if (hostKind() === "portrait") moveStage(slots.get(target)!);
      if (target !== state.chapter || !adapter.isSettled()) pose(target, "snap");
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  /* ---------- Motion preference ---------- */
  function applyMotion() {
    state.motion = motionPreference(reducedQuery.matches, userPaused);
    adapter?.setMotionPreference(state.motion);
    if (stage) stage.toggleAttribute("data-instant", state.motion !== "normal");
    // A still preference lands at once; resuming restores ambient motion.
    if (adapter && state.motion !== "normal") {
      if (exploring) garden?.snap();
      else { adapter.go(state.chapter, { immediate: true }); state.transition = 1; }
    }
    syncSky();
    syncSound();
    publish();
  }
  const onReduced = () => {
    applyMotion();
    if (wantLive()) void load();
  };
  reducedQuery.addEventListener("change", onReduced);
  const onCompact = () => {
    state.quality = qualityFor(choice, compactQuery.matches);
    // How it is drawn follows the screen; growing out of compact rebuilds
    // the lighter garden at full detail (decision 48).
    garden?.setQuality(state.quality);
    rebuildIfNeeded(true);
    publish();
  };
  compactQuery.addEventListener("change", onCompact);

  /* ---------- Renderer lifecycle ---------- */
  function wantLive() {
    return liveByDefault({ mode: state.mode, systemReduced: state.motion === "system-reduced", saveData, asked });
  }

  async function load() {
    if (loading || garden || state.renderer === "failed") return loading ?? undefined;
    const mine = ++generation;
    state.renderer = "loading";
    publish();
    const attempt: Promise<void> = (async () => {
      // Let the semantic page paint before any scene work starts.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (mine !== generation) return;
      performance.mark("notebook:scene-request");
      const [{ createGarden }, { createSky }, { createSceneAdapter }] = await Promise.all([
        import("../scene"), import("../sky"), import("./scene-adapter"),
      ]);
      if (mine !== generation) return;
      // The stage goes into the host it will be shown in, so the garden is
      // built at that size; it stays invisible until its first pose is drawn.
      const target = pin ? pin.chapter : leadChapter(state.chapter);
      state.chapter = target;
      showRailPoster(target);
      const el = document.createElement("div");
      el.className = "scene-stage";
      el.setAttribute("aria-hidden", "true");
      el.toggleAttribute("data-instant", true);
      const back = document.createElement("canvas");
      back.className = "scene-sky";
      back.setAttribute("aria-hidden", "true");
      const box = document.createElement("div");
      box.className = "scene-garden";
      const front = document.createElement("canvas");
      front.className = "scene-sky scene-sky-front";
      front.setAttribute("aria-hidden", "true");
      // The labelled places, above the sky; hidden unless exploring.
      el.append(back, box, front, hotspotLayer());
      el.addEventListener("click", onStageClick);
      stage = el;
      gardenBox = box;
      hostFor(target).append(el);
      state.host = hostName(hostFor(target));
      const detail = detailFor(state.quality, compactQuery.matches, href());
      const built = await createGarden(box, hotspots, detail, state.quality);
      if (mine !== generation) { built.dispose(); return; }
      // The build yields between batches, so the visitor may have jumped or
      // read on meanwhile: those visits moved the stage and the poster but
      // had no garden to pose. The first pose is for where they are now.
      const destination = pin ? pin.chapter : leadChapter(state.chapter);
      state.chapter = destination;
      showRailPoster(destination);
      moveStage(hostFor(destination));
      garden = built;
      builtDetail = detail;
      if (tallyGrams !== null) garden.setTally(tallyGrams);
      // The navy night (the user's G2 decision): the garden's dark ink set
      // and a night sky, as the previous page drew them, unless the visitor
      // has set another hour or weather in the garden panel.
      garden.setTheme(true);
      sky = createSky(back, front);
      sky.refresh(true);
      syncFrameCap();
      applyAtmosphere();
      // The trees and the turn of the garden this one replaces: a visitor who
      // only turned it, planting nothing, keeps that turn too.
      if (kept) garden.restore(kept);
      adapter = createSceneAdapter(garden, hostKind());
      adapter.setMotionPreference(state.motion);
      // Every landing shows its pose complete at once, the opening sketch
      // included: a poster has already painted, and the stage must replace
      // it with the matching pose, never with a half-drawn (at first, empty)
      // page. The pencil draw-in is not used on the release-1 page.
      garden.skipDrawIn();
      adapter.go(destination, { immediate: true });
      sky.setGrowth(chapterContent(destination).scene.progress, true);
      offSettled = adapter.onSettled(settled);
      box.addEventListener("garden-context-lost", lost);
      box.addEventListener("garden-context-restored", restored);
      stageObserver = new IntersectionObserver(entries => {
        stageOnScreen = entries[entries.length - 1].isIntersecting;
        syncSky();
      }, { rootMargin: "80px" });
      stageObserver.observe(el);
      state.renderer = "ready";
      syncSky();
      publish();
      await reveal(mine);
    })().catch(error => {
      if (mine !== generation) return;
      console.warn("The live drawing could not be shown.", error);
      teardown();
      state.renderer = "failed";
      publish();
    }).finally(() => { if (loading === attempt) loading = null; });
    loading = attempt;
    return attempt;
  }

  /** Fades the stage in over the poster once the current pose is drawn. */
  async function reveal(mine: number) {
    if (!garden || !stage) return;
    await garden.nextFrame();
    if (mine !== generation || !stage || state.renderer !== "ready") return;
    // The first reveal fades unless motion is still; the instant flag is
    // lifted after it so later hides (context loss) are immediate again.
    stage.toggleAttribute("data-instant", state.motion !== "normal");
    stage.toggleAttribute("data-live", true);
    state.live = true;
    publish();
  }

  function settled() {
    settles++;
    state.transition = 1;
    syncSky();
    publish();
  }

  function lost() {
    if (exploring) leaveExplore("lost");
    state.renderer = "context-lost";
    state.live = false;
    if (stage) {
      stage.toggleAttribute("data-instant", true);
      stage.removeAttribute("data-live");
    }
    syncSound();
    publish();
  }
  function restored() {
    if (!adapter || !garden) return;
    state.renderer = "ready";
    // The latest chapter, drawn at once: a recovered renderer never shows
    // the sketch (or any earlier pose) while the visitor reads Contact.
    const target = pin ? pin.chapter : leadChapter(state.chapter);
    if (stage) moveStage(hostFor(target));
    state.chapter = target;
    showRailPoster(target);
    adapter.go(target, { immediate: true });
    sky?.setGrowth(chapterContent(target).scene.progress, true);
    publish();
    void reveal(generation);
  }

  function teardown() {
    if (exploring) leaveExplore("lost");
    generation++;
    rebuilding = null;
    if (retiring) {
      const r = retiring.stats();
      retired.cpuMs += r.cpuMs;
      retired.gpuMs += r.gpuMs ?? 0;
      retired.any = true;
      retiring.dispose();
      retiring = null;
    }
    // A load still on its way belongs to the scene torn down: forget it, so
    // asking for the live drawing again starts a new one.
    loading = null;
    offSettled?.();
    offSettled = null;
    stageObserver?.disconnect();
    stageObserver = null;
    gardenBox?.removeEventListener("garden-context-lost", lost);
    gardenBox?.removeEventListener("garden-context-restored", restored);
    if (garden || sky) {
      const g = garden?.stats();
      const s = sky?.stats();
      retired.cpuMs += (g?.cpuMs ?? 0) + (s?.cpuMs ?? 0);
      retired.gpuMs += g?.gpuMs ?? 0;
      retired.any = true;
    }
    if (garden) kept = garden.snapshot();
    garden?.dispose();
    sky?.dispose();
    stage?.remove();
    document.querySelectorAll(".scene-snapshot").forEach(copy => copy.remove());
    garden = null;
    builtDetail = null;
    sky = null;
    adapter = null;
    stage = null;
    gardenBox = null;
    state.host = null;
    state.live = false;
    stageOnScreen = true;
    skyStill = null;
    if (state.renderer !== "failed") state.renderer = "not-requested";
  }

  /* ---------- Quality: a new detail tier is a rebuilt garden (decision 48) ---------- */
  /** Light on a compact screen (or `?quality=low`) builds the lighter
   * garden; any other choice the full one. When the tier the live garden was
   * built with no longer matches, a new garden is built into the same box,
   * its canvas laid over the old one's (transparent until it draws). The old
   * garden stays on screen, held, until the new one has drawn its first
   * frame with the visitor's trees, turn, zoom and pan, the atmosphere, the
   * tally and the chapter's pose (or the exploration view); then it is
   * disposed. So the stage is never empty. A build that fails falls back to
   * the stills, as a failed first build does.
   * `upgradeOnly`: a window that becomes compact keeps the full garden it
   * has (drawn light); one that grows out of compact gets the full build. */
  function rebuildIfNeeded(upgradeOnly = false) {
    if (!garden || !gardenBox || state.renderer !== "ready" || rebuilding) return;
    const want = detailFor(state.quality, compactQuery.matches, href());
    if (want === builtDetail || (upgradeOnly && want !== "full")) return;
    const mine = generation;
    const attempt: Promise<void> = rebuild(want, mine).finally(() => {
      if (rebuilding !== attempt) return;
      rebuilding = null;
      // The choice may have changed again while this one was built.
      if (mine === generation) rebuildIfNeeded(upgradeOnly);
    });
    rebuilding = attempt;
  }
  async function rebuild(detail: Detail, mine: number) {
    const old = garden!, box = gardenBox!;
    let built: Garden;
    let createAdapter: typeof import("./scene-adapter").createSceneAdapter;
    try {
      const [{ createGarden }, { createSceneAdapter }] = await Promise.all([import("../scene"), import("./scene-adapter")]);
      createAdapter = createSceneAdapter;
      if (mine !== generation) return;
      built = await createGarden(box, hotspots, detail, state.quality);
    } catch (error) {
      if (mine !== generation) return;
      console.warn("The garden could not be rebuilt.", error);
      teardown();
      state.renderer = "failed";
      publish();
      return;
    }
    // Torn down, replaced or lost while building: this garden is not needed.
    if (mine !== generation || garden !== old || state.renderer !== "ready") { built.dispose(); return; }
    // The old garden stops its own life and stays on screen underneath.
    old.setAmbient(false);
    retiring = old;
    const view = old.snapshot();
    garden = built;
    builtDetail = detail;
    syncFrameCap();
    built.setTheme(true);
    applyAtmosphere();
    if (tallyGrams !== null) built.setTally(tallyGrams);
    built.skipDrawIn();
    built.restore(view);
    const next = createAdapter(built, hostKind());
    next.setMotionPreference(state.motion);
    offSettled?.();
    adapter = next;
    if (exploring) poseExplore(next, true);
    else {
      next.go(state.chapter, { immediate: true });
      sky?.setGrowth(chapterContent(state.chapter).scene.progress, true);
      state.transition = 1;
      syncSky();
    }
    offSettled = next.onSettled(settled);
    // The box carries the context events of whichever garden is in it.
    box.removeEventListener("garden-context-lost", lost);
    box.removeEventListener("garden-context-restored", restored);
    box.addEventListener("garden-context-lost", lost);
    box.addEventListener("garden-context-restored", restored);
    rebuilds++;
    publish();
    await built.nextFrame();
    if (retiring !== old) return;
    const s = old.stats();
    retired.cpuMs += s.cpuMs;
    retired.gpuMs += s.gpuMs ?? 0;
    retired.any = true;
    old.dispose();
    retiring = null;
    publish();
  }

  /* ---------- Explore the garden (./explore.ts) ---------- */
  /** The whole garden complete, its life on (decision 46). */
  function poseExplore(a: SceneAdapter, immediate: boolean) {
    a.setPhase(1);
    a.focus(null);
    // The dialog's toolbar covers the foot of the screen: the garden is
    // framed in the band above it.
    if (state.host === "explore") a.frame(0.04, 0.8);
    const snap = immediate || state.motion !== "normal";
    if (snap) garden?.snap();
    sky?.setGrowth(1, snap);
    syncSky();
  }
  /** The explorer has shown its toolbar: the stage takes the pointer (CSS
   * on `data-explore`), its places are exposed, and on stacked layouts it
   * moves into the exploration dialog. */
  function beginExplore(host: HTMLElement | null) {
    if (!stage || !adapter || !garden) return;
    exploring = true;
    syncFrameCap();
    exploreFrom = { y: scrollY, chapter: state.chapter };
    root.dataset.explore = "true";
    stage.removeAttribute("aria-hidden");
    if (stage.parentElement === rail) rail.removeAttribute("aria-hidden");
    if (host) moveStage(host);
    poseExplore(adapter, false);
    publish();
    exploreListeners.forEach(listener => listener(true));
  }
  /** Back to reading: the stage in its reading host, the reading position
   * as it was (unless a link is taking the visitor elsewhere), the chapter's
   * pose drawn at once with ambient life continuing. The visitor's turn stays, as
   * the panel's Turn keeps it; their zoom and pan give way to the framing. */
  function endExplore(reason: ExitReason) {
    if (!exploring) return;
    exploring = false;
    syncFrameCap();
    delete root.dataset.explore;
    stage?.setAttribute("aria-hidden", "true");
    rail.setAttribute("aria-hidden", "true");
    const from = exploreFrom ?? { y: scrollY, chapter: state.chapter };
    exploreFrom = null;
    const navigating = reason === "hotspot" || reason === "navigation";
    // The controller restores the chapter after a width change; the old
    // layout's pixel position would move the reader to a different chapter.
    if (!navigating && reason !== "layout" && Math.abs(scrollY - from.y) > 1) scrollTo({ top: from.y, left: scrollX, behavior: "instant" });
    invalidate();
    if (stage && (stage.parentElement as HTMLElement | null)?.dataset.sceneHost === "explore") moveStage(hostFor(from.chapter));
    if (garden && adapter) {
      garden.resetView();
      adapter.frame(0, 1);
      garden.snap();
      state.chapter = from.chapter;
      showRailPoster(from.chapter);
      adapter.go(from.chapter, { immediate: true });
      sky?.setGrowth(chapterContent(from.chapter).scene.progress, true);
      state.transition = 1;
    }
    syncSky();
    publish();
    exploreListeners.forEach(listener => listener(false));
    if (!navigating) update("layout");
  }
  function leaveExplore(reason: ExitReason) {
    if (explorer?.active()) explorer.exit(reason);
    else endExplore(reason);
  }
  /** Resolves true once a live garden is ready, false if none will be. */
  function whenReady(): Promise<boolean> {
    return new Promise(resolve => {
      const check = () => {
        let result: boolean | null = null;
        if (garden && state.renderer === "ready") result = true;
        else if (state.renderer === "failed" || state.renderer === "context-lost" || (!loading && !garden)) result = false;
        if (result === null) return;
        stateListeners.delete(check);
        resolve(result);
      };
      stateListeners.add(check);
      check();
    });
  }
  async function startExplore() {
    if (exploring || state.renderer === "failed" || state.renderer === "context-lost") return;
    try {
      const module = explorerLoading ??= import("./explore");
      if (!garden) {
        // Asked for explicitly: the live drawing, as "Still images" off asks for it.
        if (showingStills()) {
          asked = true;
          write(session, LIVE_KEY, "1");
          setView("guided");
          publish();
        }
        void load();
      }
      const [{ createExplorer }, ok] = await Promise.all([module, whenReady()]);
      if (!ok || exploring || !garden || !stage) return;
      explorer ??= createExplorer({
        garden: () => garden,
        stage: () => stage,
        hotspots: () => hotspots,
        kind: hostKind,
        still: () => state.motion !== "normal",
        begin: beginExplore,
        end: endExplore,
        visit: id => { controller.visit(id, { push: true, focus: true, cause: "navigation" }); },
      });
      explorer.enter();
    } catch (error) {
      // The module did not load (offline): the panel says so.
      explorerLoading = null;
      console.warn("The garden could not be explored.", error);
    }
  }
  /** The visitor's own view; drawn at once under a still preference. */
  function view(f: (g: Garden) => void) {
    if (!garden) return;
    f(garden);
    if (state.motion !== "normal") garden.snap();
  }

  /* ---------- Controls ---------- */
  function setView(mode: ViewMode) {
    state.mode = mode;
    const url = new URL(href());
    const view = url.searchParams.get("view");
    if (mode === "stills" && view !== "stills") url.searchParams.set("view", "stills");
    if (mode === "guided" && (view === "stills" || view === "read")) url.searchParams.set("view", "garden");
    if (url.href !== href()) {
      try { history.replaceState(history.state, "", url); } catch { /* The address is a convenience. */ }
    }
  }
  function toggle(name: ControlName) {
    if (name === "pause") {
      if (state.motion === "system-reduced") return;
      userPaused = !userPaused;
      write(session, PAUSE_KEY, userPaused ? "paused" : null);
      applyMotion();
    } else if (name === "stills") {
      if (showingStills()) {
        // The visitor asks for the live drawing.
        asked = true;
        write(session, LIVE_KEY, "1");
        setView("guided");
        publish();
        void load();
      } else {
        setView("stills");
        teardown();
        publish();
      }
    } else if (name === "sound") {
      state.sound = !state.sound;
      soundFailed = false;
      // WebKit lets a context play only if it is created, or resumed, inside
      // the click itself: once the soundscape module has loaded, the gesture
      // is over. So the context is made here, synchronously, and nowhere else.
      // Resuming here too lets a later, gesture-free resume (after a pause or
      // a hidden tab) succeed.
      if (state.sound && typeof AudioContext !== "undefined") {
        try {
          soundContext ??= new AudioContext();
          soundContext.resume().catch(() => {});
        } catch (error) {
          console.warn("Sound could not start.", error);
        }
      } else if (!soundscape) soundContext?.suspend().catch(() => {});
      void syncSound();
      publish();
    }
  }

  /* ---------- Sound: only its own control starts it ---------- */
  let soundscape: Soundscape | null = null;
  let soundLoading: Promise<void> | null = null;
  /** Made only by the sound control's own click (see toggle). */
  let soundContext: AudioContext | null = null;
  async function syncSound() {
    // Paused by the visitor or hidden: silent, consent kept. Reduced motion
    // does not silence (it is not a wish for silence).
    const audible = state.sound && !document.hidden && state.motion !== "user-paused";
    if (!soundscape && audible) {
      const pending = soundLoading ??= import("../soundscape").then(({ createSoundscape }) => {
        if (!soundContext) throw new Error("No audio context was created by the sound control.");
        soundscape = createSoundscape(soundContext, () => {
          const scene = chapterContent(state.chapter).scene;
          return {
            growth: adapter?.state().progress ?? scene.progress,
            hour: atmosphere.hour,
            night: nightOf(atmosphere.hour),
            weather: atmosphere.weather,
            season: atmosphere.season,
            spot: scene.focus,
            narrating: false,
          };
        });
      });
      try {
        await pending;
      } catch (error) {
        // The module did not load (offline, blocked) or no context could be
        // made: sound is off again, the button unpressed, and the status says
        // so. A later click on the control tries again from the start.
        if (soundLoading === pending) soundLoading = null;
        if (!soundscape) {
          console.warn("Sound could not start.", error);
          void soundContext?.close().catch(() => {});
          soundContext = null;
          state.sound = false;
          soundFailed = true;
          publish();
        }
        return;
      }
    }
    soundscape?.setAudible(state.sound && !document.hidden && state.motion !== "user-paused");
  }

  /* ---------- Hooks for tests and tools ---------- */
  // tests/performance.mjs and tests/scene-lifecycle.test.mjs read the drawing totals.
  Object.assign(window, {
    __notebookStats: () => ({ garden: garden?.stats() ?? null, sky: sky?.stats() ?? null, rebuilds }),
    __notebookScene: {
      state: () => ({ ...state, held: adapter?.state().held ?? false, settles, settled: adapter?.isSettled() ?? null, pose: adapter?.state() ?? null, exploring, rebuilds, rebuilding: !!rebuilding || !!retiring, detail: builtDetail }),
      /** The visitor's own view of the live garden (goals): zoom 1–4, rotation in radians. */
      view: () => { const s = garden?.snapshot(); return s ? { zoom: s.zoom, rotation: s.rotation, pan: s.pan } : null; },
    },
  });
  // scripts/capture-stills.mjs drives the scene through this, in development only.
  if (import.meta.env.DEV) Object.assign(window, { __notebook: { get garden() { return garden; }, get adapter() { return adapter; }, get sky() { return sky; } } });

  showRailPoster(state.chapter);
  update("layout");
  applyMotion();
  if (wantLive()) void load();
  else publish();

  /** All the drawing of this visit: the garden's frames on the CPU and GPU,
   * the sky's canvases on the CPU, and whatever earlier renderers drew.
   * Null while nothing has ever been drawn. `gpuMs` is null where the
   * browser exposes no GPU timers. */
  function work(): ComputeWork | null {
    if (!garden && !sky && !retired.any) return null;
    const g = garden?.stats();
    const s = sky?.stats();
    const gpu = g ? g.gpuMs : retired.gpuMs > 0 ? 0 : null;
    return {
      cpuMs: (g?.cpuMs ?? 0) + (s?.cpuMs ?? 0) + retired.cpuMs,
      gpuMs: gpu === null ? null : gpu + retired.gpuMs,
    };
  }

  const gardenScene: GardenScene = {
    atmosphere: () => ({ ...atmosphere }),
    setHour(hour) { atmosphere.hour = hour; applyAtmosphere(); },
    setWeather(weather) { atmosphere.weather = weather; applyAtmosphere(); publish(); },
    setSeason(season) { atmosphere.season = season; applyAtmosphere(); publish(); },
    quality: () => choice,
    setQuality(value) {
      choice = value;
      write(local, QUALITY_KEY, value === "auto" ? null : value);
      state.quality = qualityFor(choice, compactQuery.matches);
      garden?.setQuality(state.quality);
      rebuildIfNeeded();
      publish();
    },
    live: () => state.renderer === "ready" && !!garden,
    trees: () => garden?.trees() ?? kept?.trees.length ?? 0,
    plant() {
      if (!garden || state.renderer !== "ready") return null;
      const count = garden.plant();
      soundscape?.planted();
      return count;
    },
    setPlanting(on) {
      planting = on;
      root.classList.toggle("planting", on);
    },
    rotate() { garden?.rotate(); },
    onPlanted(listener) { plantedListeners.add(listener); return () => { plantedListeners.delete(listener); }; },
    onState(listener) { stateListeners.add(listener); return () => { stateListeners.delete(listener); }; },
    explore: startExplore,
    exitExplore(reason = "button") { if (exploring) leaveExplore(reason); },
    exploring: () => exploring,
    onExplore(listener) { exploreListeners.add(listener); return () => { exploreListeners.delete(listener); }; },
    rotateBy(radians) { view(g => g.rotateBy(radians)); },
    zoomBy(factor, x, y) { view(g => g.zoomBy(factor, x, y)); },
    panBy(dx, dy) { view(g => g.panBy(dx, dy)); },
    resetView() { view(g => g.resetView()); },
  };

  return {
    state: () => ({ ...state }),
    work,
    /** The visit's total, drawn on the register in the observatory. */
    setTally(grams: number | null) { tallyGrams = grams; garden?.setTally(grams); },
    /** The live garden's per-frame figures (src/scene.ts `stats`), for the
     * optional rendering-cost view (src/narrative/render-meter.ts): null
     * while no garden is live. Not a Wattch hardware measurement. */
    frameStats: () => (state.renderer === "ready" && garden ? garden.stats() : null),
    garden: gardenScene,
    destroy() {
      gardenScene.setPlanting(false);
      plantedListeners.clear();
      stateListeners.clear();
      teardown();
      exploreListeners.clear();
      soundscape?.dispose();
      offPosition();
      offChange();
      offVisit();
      offLocale();
      controls?.destroy();
      inputs.forEach(type => removeEventListener(type, arm, { capture: true }));
      removeEventListener("resize", onResize);
      layoutObserver?.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", invalidate);
      wideQuery.removeEventListener("change", onLayout);
      reducedQuery.removeEventListener("change", onReduced);
      compactQuery.removeEventListener("change", onCompact);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
