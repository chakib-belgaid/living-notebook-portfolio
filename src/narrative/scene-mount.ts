/** The one live scene: renderer lifecycle, host handoff, poster handoff and
 * the reading holds, driven by the reading controller (./controller.ts)
 * through P1's adapter (./scene-adapter.ts).
 *
 * State, tracked independently (model.ts `ReadingState`):
 * - chapter + transition: the chapter the scene is posed for, and 0 while it
 *   moves toward that pose, 1 once settled;
 * - mode: guided | stills (exploration is release 2);
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
 * Reading holds. After a passive transition settles, the adapter's hold()
 * stops ambient life and the sky is paused: no recurring garden or sky
 * frames until something changes. Pause and system-reduced motion keep
 * everything still (poses snap). A hidden tab draws nothing (the garden and
 * sky check document.hidden); on return the latest chapter is posed before
 * the first frame. Offscreen, the garden stops (its IntersectionObserver)
 * and so does the sky (ours).
 *
 * Reduced motion, stills (`?view=read|stills`) and save-data load no scene
 * until the visitor turns off "Still images". Sound starts only from its
 * control; pause and system-reduced silence it without changing consent. */
import { getLocale, onLocaleChange } from "../i18n";
import type { Garden } from "../scene";
import type { Sky } from "../sky";
import type { Soundscape } from "../soundscape";
import { chapter as chapterContent } from "./content";
import type { ChangeCause, NarrativeController } from "./controller";
import { chapterIds, posterSrc, resolveFragment, WIDE_LAYOUT_QUERY, type ChapterId, type MotionPreference, type RendererLifecycle } from "./model";
import {
  COMPACT_QUERY, LIVE_KEY, PAUSE_KEY, QUALITY_KEY, REDUCED_MOTION_QUERY,
  detailFor, liveByDefault, motionPreference, qualityChoice, qualityFor, read, saveDataOn, viewMode, write,
  type Quality, type ViewMode,
} from "./preferences";
import type { HostKind, SceneAdapter } from "./scene-adapter";
import { createSceneControls, type ControlName } from "./scene-controls";

export interface SceneState {
  chapter: ChapterId;
  transition: number;
  /** Exploration (the model's third mode) is release 2. */
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
/** How far ahead of the reading line the scene starts its next transition. */
const LEAD: Record<HostKind, number> = { wide: 0.25, portrait: 0.35 };

const statusText = {
  reduced: "Reduced motion is on in your system settings.",
  saveData: "Data saver is on, so still images are shown.",
  failed: "The live drawing can’t be shown here. Still images are shown instead.",
  lost: "The live drawing stopped. A still image is shown instead.",
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
  const choice = qualityChoice(href(), read(local, QUALITY_KEY));

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
  let adapter: SceneAdapter | null = null;
  let loading: Promise<void> | null = null;
  /** Bumped when a scene is torn down, so a late load or reveal is ignored. */
  let generation = 0;
  let held = false;
  /** Settle events so far: rapid scrolling must end in one, not one per chapter passed. */
  let settles = 0;
  let stageOnScreen = true;
  let stageObserver: IntersectionObserver | null = null;
  let offSettled: (() => void) | null = null;

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
    rail.querySelector<HTMLImageElement>(".scene-poster")!.src = posterSrc(poster);
  }
  const preloaded = new Set<string>();
  /** Stills on a wide layout: the next chapter's poster is fetched ahead. */
  function preloadNext(id: ChapterId) {
    if (hostKind() !== "wide" || stage) return;
    const next = chapterIds[chapterIds.indexOf(id) + 1];
    if (!next) return;
    const src = posterSrc(chapterContent(next).scene.poster);
    if (preloaded.has(src)) return;
    preloaded.add(src);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }

  /* ---------- Publishing state ---------- */
  const controls = createSceneControls(toggle);
  function status(): string {
    if (state.renderer === "failed") return statusText.failed;
    if (state.renderer === "context-lost") return statusText.lost;
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

  /* ---------- Pose ---------- */
  /** Sky: still unless something is moving on screen. */
  let skyStill: boolean | null = null;
  function syncSky() {
    const still = state.motion !== "normal" || held || !stageOnScreen || document.hidden;
    // Only a change is passed on: setting the same value redraws the sky once.
    if (!sky || still === skyStill) return;
    skyStill = still;
    sky.setMotion(still);
  }
  function pose(id: ChapterId, how: "ease" | "snap") {
    const changed = id !== state.chapter;
    state.chapter = id;
    showRailPoster(id);
    preloadNext(id);
    if (!adapter || !garden) { publish(); return; }
    const snap = how === "snap" || state.motion !== "normal";
    if (!snap && changed) {
      // A passive transition: life may move while the house changes.
      held = false;
      adapter.release();
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
    if (from && from !== rail && to !== rail && state.live) keepPose(from);
    // Moving keeps the canvas, the geometry and the drawing; a host of
    // another size is redrawn in the same frame by the garden's resize.
    to.append(stage);
    state.host = hostName(to);
    to.querySelector(".scene-snapshot")?.remove();
    dropFarSnapshots(to);
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
  document.fonts?.addEventListener?.("loadingdone", invalidate);
  const offLocale = onLocaleChange(() => { state.locale = getLocale(); invalidate(); publish(); });

  const onLayout = () => {
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
    // Back in view: pose the latest chapter before the first frame, at once.
    if (!document.hidden && adapter) {
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
    // Still: settled poses are held; a moving one lands at once.
    if (adapter && state.motion !== "normal") { held = true; adapter.go(state.chapter, { immediate: true }); state.transition = 1; }
    if (adapter && state.motion === "normal") { held = true; adapter.hold(); }
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
    // What was built stays; only how it is drawn follows the screen.
    garden?.setQuality(state.quality);
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
      const box = document.createElement("div");
      box.className = "scene-garden";
      const front = document.createElement("canvas");
      front.className = "scene-sky scene-sky-front";
      el.append(back, box, front);
      stage = el;
      gardenBox = box;
      hostFor(target).append(el);
      state.host = hostName(hostFor(target));
      const built = await createGarden(box, [], detailFor(state.quality, compactQuery.matches, href()), state.quality);
      if (mine !== generation) { built.dispose(); return; }
      garden = built;
      // Warm-paper ink set (P1): the release-1 look on the ivory page.
      garden.setTheme(false);
      sky = createSky(back, front);
      sky.refresh(false);
      adapter = createSceneAdapter(garden, hostKind());
      adapter.setMotionPreference(state.motion);
      // Every landing shows its pose complete at once, the opening sketch
      // included: a poster has already painted, and the stage must replace
      // it with the matching pose, never with a half-drawn (at first, empty)
      // page. The pencil draw-in is not used on the release-1 page.
      garden.skipDrawIn();
      held = true;
      adapter.hold();
      adapter.go(target, { immediate: true });
      sky.setGrowth(chapterContent(target).scene.progress, true);
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
    if (state.mode === "guided" && adapter && !held) {
      held = true;
      adapter.hold();
    }
    syncSky();
    publish();
  }

  function lost() {
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
    held = true;
    adapter.hold();
    adapter.go(target, { immediate: true });
    sky?.setGrowth(chapterContent(target).scene.progress, true);
    publish();
    void reveal(generation);
  }

  function teardown() {
    generation++;
    // A load still on its way belongs to the scene torn down: forget it, so
    // asking for the live drawing again starts a new one.
    loading = null;
    offSettled?.();
    offSettled = null;
    stageObserver?.disconnect();
    stageObserver = null;
    gardenBox?.removeEventListener("garden-context-lost", lost);
    gardenBox?.removeEventListener("garden-context-restored", restored);
    garden?.dispose();
    sky?.dispose();
    stage?.remove();
    document.querySelectorAll(".scene-snapshot").forEach(copy => copy.remove());
    garden = null;
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
      void syncSound();
      publish();
    }
  }

  /* ---------- Sound: only its own control starts it ---------- */
  let soundscape: Soundscape | null = null;
  let soundLoading: Promise<void> | null = null;
  async function syncSound() {
    // Paused by the visitor or hidden: silent, consent kept. Reduced motion
    // does not silence (it is not a wish for silence).
    const audible = state.sound && !document.hidden && state.motion !== "user-paused";
    if (!soundscape && audible) {
      soundLoading ??= import("../soundscape").then(({ createSoundscape, soundSupported }) => {
        if (!soundSupported()) return;
        soundscape = createSoundscape(() => {
          const scene = chapterContent(state.chapter).scene;
          return {
            growth: adapter?.state().progress ?? scene.progress,
            hour: 13,
            night: 0,
            weather: { kind: "clear", cloud: 0.04, precip: 0, wind: 8 },
            season: "summer",
            spot: scene.focus,
            narrating: false,
          };
        });
      });
      await soundLoading;
    }
    soundscape?.setAudible(state.sound && !document.hidden && state.motion !== "user-paused");
  }

  /* ---------- Hooks for tests and tools ---------- */
  // tests/performance.mjs and tests/scene-lifecycle.test.mjs read the drawing totals.
  Object.assign(window, {
    __notebookStats: () => ({ garden: garden?.stats() ?? null, sky: sky?.stats() ?? null }),
    __notebookScene: {
      state: () => ({ ...state, held, settles, settled: adapter?.isSettled() ?? null, pose: adapter?.state() ?? null }),
    },
  });
  // scripts/capture-stills.mjs drives the scene through this, in development only.
  if (import.meta.env.DEV) Object.assign(window, { __notebook: { get garden() { return garden; }, get adapter() { return adapter; }, get sky() { return sky; } } });

  showRailPoster(state.chapter);
  update("layout");
  applyMotion();
  if (wantLive()) void load();
  else publish();

  return {
    state: () => ({ ...state }),
    destroy() {
      teardown();
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
