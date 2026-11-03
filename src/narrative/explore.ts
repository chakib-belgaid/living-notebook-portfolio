/** Explore the garden (decisions 26–29, 43, 45, 46, 59, 60): an explicit
 * state of the reading page, loaded only when the visitor asks for it
 * (src/narrative/scene-mount.ts `GardenScene.explore`).
 *
 * Entering keeps the reading position: the mount (`begin`) poses the whole
 * garden complete with its ambient life on, and this module shows the
 * toolbar (markup in src/render.ts `exploreBar()`) and the labelled places
 * (`.hotspot`, positioned by the garden every frame), attaches the gestures
 * to the one live stage, and moves focus to "Back to reading".
 * - Wide layouts explore in place: the chapter card stays where it is and
 *   the stage behind it takes the pointer.
 * - Stacked layouts move the stage into a full-viewport dialog
 *   (`[data-scene-host="explore"]`) with the toolbar, make the rest of the
 *   page inert and lock its scrolling until exploring ends.
 * Gestures act only on the stage, only while exploring: a drag turns the
 * garden, the wheel (or a trackpad pinch) zooms about the pointer, two
 * fingers zoom and move it. Every gesture has a button. Under pause or
 * reduced motion each change is drawn at once (`Garden.snap`).
 *
 * Leaving (the button, Escape, a place's link, a layout change, a lost
 * renderer) detaches everything and the mount (`end`) puts the stage back
 * on the chapter's pose and hold. Focus returns to the panel's Explore
 * button, or to the chapter a place opened. Nothing here starts sound. */
import type { Garden } from "../scene";
import type { ChapterId } from "./model";

export type ExitReason = "escape" | "button" | "hotspot" | "layout" | "lost" | "navigation";

export interface ExploreDeps {
  garden(): Garden | null;
  stage(): HTMLElement | null;
  hotspots(): HTMLButtonElement[];
  kind(): "wide" | "portrait";
  /** Pause or reduced motion: changes are drawn at once. */
  still(): boolean;
  /** The mount enters: whole garden, ambient life, the stage into `host` (stacked layouts). */
  begin(host: HTMLElement | null): void;
  /** The mount leaves: the stage back on the chapter's pose and hold. */
  end(reason: ExitReason): void;
  /** The reading controller's explicit visit (push, focus). */
  visit(chapter: ChapterId): void;
}

export interface Explorer {
  enter(): void;
  exit(reason: ExitReason): void;
  active(): boolean;
}

/** One toolbar step: a twelfth of a turn, a quarter more or less zoom. */
const TURN = Math.PI / 6;
const ZOOM = 1.25;
/** Radians of turn per pixel dragged (the previous page's). */
const DRAG = 0.008;
const TEXT = { entered: "Exploring the garden. Escape returns to reading." } as const;

export function createExplorer(deps: ExploreDeps, root: Document = document): Explorer {
  const html = root.documentElement;
  const bar = root.querySelector<HTMLElement>("[data-explore-bar]")!;
  const exitButton = bar.querySelector<HTMLButtonElement>("[data-explore-exit]")!;
  const status = root.querySelector<HTMLElement>("[data-garden-status]");
  const barHome = { parent: bar.parentElement!, next: bar.nextSibling };
  let host: HTMLElement | null = null;
  let active = false;
  let stage: HTMLElement | null = null;
  let inerted: HTMLElement[] = [];

  function announce(text: string) {
    if (!status) return;
    status.textContent = "";
    status.textContent = text;
  }
  /** Draws a change at once when motion is still. */
  const settle = () => { if (deps.still()) deps.garden()?.snap(); };
  const act = (f: (g: Garden) => void) => { const g = deps.garden(); if (g) { f(g); settle(); } };

  /* ---------- The toolbar ---------- */
  function onBar(event: Event) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.hasAttribute("data-explore-exit")) exit("button");
    else if (button.hasAttribute("data-explore-reset")) act(g => g.resetView());
    else if (button.dataset.exploreTurn) act(g => g.rotateBy(button.dataset.exploreTurn === "left" ? -TURN : TURN));
    else if (button.dataset.exploreZoom) act(g => g.zoomBy(button.dataset.exploreZoom === "in" ? ZOOM : 1 / ZOOM));
  }
  /** Arrow keys inside the toolbar turn and zoom too. */
  function onBarKey(event: KeyboardEvent) {
    const step: Record<string, (g: Garden) => void> = {
      ArrowLeft: g => g.rotateBy(-TURN), ArrowRight: g => g.rotateBy(TURN),
      ArrowUp: g => g.zoomBy(ZOOM), ArrowDown: g => g.zoomBy(1 / ZOOM),
      "+": g => g.zoomBy(ZOOM), "=": g => g.zoomBy(ZOOM), "-": g => g.zoomBy(1 / ZOOM),
    };
    const f = step[event.key];
    if (!f || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    act(f);
  }
  bar.addEventListener("click", onBar);
  bar.addEventListener("keydown", onBarKey);

  /* ---------- The places ---------- */
  const spots = deps.hotspots();
  const hover = (spot: string | null) => deps.garden()?.hover(spot);
  for (const h of spots) {
    const on = () => { if (active) hover(h.dataset.spot!); };
    const off = () => requestAnimationFrame(() => { if (active && !spots.some(s => s.matches(":hover, :focus"))) hover(null); });
    h.addEventListener("pointerenter", on);
    h.addEventListener("focus", on);
    h.addEventListener("pointerleave", off);
    h.addEventListener("blur", off);
    h.addEventListener("click", () => {
      if (!active) return;
      exit("hotspot");
      deps.visit(h.dataset.chapter as ChapterId);
    });
  }

  /* ---------- Gestures: on the stage, only while exploring ---------- */
  const fingers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; last: number; y: number; moved: boolean } | null = null;
  let pinch: { distance: number; x: number; y: number } | null = null;
  /** The last press turned or zoomed: its click must not plant a tree. */
  let swallowClick = false;
  const local = (x: number, y: number) => {
    const r = stage!.getBoundingClientRect();
    return [x - r.left, y - r.top] as const;
  };
  function pinchNow() {
    const [a, b] = [...fingers.values()];
    return { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  function onDown(event: PointerEvent) {
    if ((event.target as HTMLElement).closest(".hotspot") || event.button > 0) return;
    swallowClick = false;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size === 2) {
      // A second finger turns the drag into a pinch.
      pinch = pinchNow();
      drag = null;
      swallowClick = true;
      return;
    }
    if (!pinch) drag = { x: event.clientX, y: event.clientY, last: event.clientX, moved: false };
  }
  function onMove(event: PointerEvent) {
    if (fingers.has(event.pointerId)) fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = deps.garden();
    if (!g) return;
    if (pinch && fingers.size === 2) {
      const now = pinchNow();
      g.zoomBy(now.distance / pinch.distance, ...local(now.x, now.y));
      g.panBy(now.x - pinch.x, now.y - pinch.y);
      pinch = now;
      settle();
      return;
    }
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) {
      drag.moved = true;
      swallowClick = true;
      try { stage!.setPointerCapture(event.pointerId); } catch { /* The pointer may already be gone. */ }
      html.classList.add("turning");
    }
    if (drag.moved) {
      g.rotateBy((event.clientX - drag.last) * DRAG);
      settle();
    }
    drag.last = event.clientX;
  }
  function onUp(event: PointerEvent) {
    fingers.delete(event.pointerId);
    if (fingers.size === 0) pinch = null;
    drag = null;
    html.classList.remove("turning");
  }
  function onClick(event: MouseEvent) {
    // A drag or a pinch ends in a click on the stage: it is not a planting.
    if (!swallowClick) return;
    swallowClick = false;
    event.stopImmediatePropagation();
    event.preventDefault();
  }
  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const g = deps.garden();
    if (!g) return;
    // Trackpad pinches arrive as a wheel with Ctrl.
    const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    g.zoomBy(Math.exp(-event.deltaY * lines * (event.ctrlKey ? 0.01 : 0.002)), ...local(event.clientX, event.clientY));
    settle();
  }
  // Safari zooms the page on its own gesture events, whatever touch-action says.
  const onGesture = (event: Event) => event.preventDefault();
  function attach(el: HTMLElement) {
    stage = el;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClick, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("gesturestart", onGesture, { passive: false });
    root.addEventListener("gesturechange", onGesture, { passive: false });
  }
  function detach() {
    const el = stage;
    if (el) {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("wheel", onWheel);
    }
    root.removeEventListener("gesturestart", onGesture);
    root.removeEventListener("gesturechange", onGesture);
    fingers.clear();
    drag = pinch = null;
    swallowClick = false;
    html.classList.remove("turning");
    stage = null;
  }

  /* ---------- Escape, from anywhere while exploring ---------- */
  function onKey(event: KeyboardEvent) {
    if (event.key !== "Escape" || !active) return;
    // Ours alone: the garden panel's own Escape would close it again.
    event.stopImmediatePropagation();
    event.preventDefault();
    exit("escape");
  }

  /* ---------- Stacked layouts: the exploration dialog ---------- */
  function dialog() {
    if (host) return host;
    host = root.createElement("div");
    host.className = "explore-host";
    host.dataset.sceneHost = "explore";
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-label", "Exploring the garden");
    host.setAttribute("aria-describedby", "explore-help");
    host.hidden = true;
    root.body.append(host);
    return host;
  }
  function openDialog() {
    const el = dialog();
    el.hidden = false;
    el.append(bar);
    // Only the dialog is reachable while it is open; the page keeps its place.
    inerted = [...root.body.children].filter((c): c is HTMLElement => c !== el && c instanceof HTMLElement && !c.inert && c.tagName !== "SCRIPT");
    inerted.forEach(c => { c.inert = true; });
    html.classList.add("explore-locked");
    return el;
  }
  function barBack() {
    barHome.parent.insertBefore(bar, barHome.next && barHome.next.parentNode === barHome.parent ? barHome.next : null);
  }
  function closeDialog() {
    inerted.forEach(c => { c.inert = false; });
    inerted = [];
    html.classList.remove("explore-locked");
  }

  function enter() {
    const el = deps.stage();
    if (active || !el || !deps.garden()) return;
    active = true;
    const dock = root.querySelector<HTMLDetailsElement>("details.garden");
    if (dock) dock.open = false;
    const into = deps.kind() === "portrait" ? openDialog() : null;
    deps.begin(into);
    // The toolbar goes just before the stage, so Tab leads from its buttons
    // to the places (wide: into the rail, exposed while exploring).
    if (!into) el.parentElement?.insertBefore(bar, el);
    bar.hidden = false;
    for (const h of spots) { h.hidden = false; h.tabIndex = 0; }
    attach(el);
    addEventListener("keydown", onKey, true);
    announce(TEXT.entered);
    exitButton.focus({ preventScroll: true });
  }

  function exit(reason: ExitReason) {
    if (!active) return;
    active = false;
    const focusWasOurs = !root.activeElement || root.activeElement === root.body || bar.contains(root.activeElement) || spots.includes(root.activeElement as HTMLButtonElement);
    detach();
    removeEventListener("keydown", onKey, true);
    hover(null);
    bar.hidden = true;
    for (const h of spots) h.hidden = true;
    const wasDialog = !!host && !host.hidden;
    barBack();
    if (wasDialog) closeDialog();
    deps.end(reason);
    if (wasDialog && host) host.hidden = true;
    // A place's link focuses its chapter (the controller's visit); otherwise
    // focus goes back where exploring was asked for.
    if (reason === "hotspot" || reason === "navigation") return;
    if (reason === "escape" || reason === "button" || focusWasOurs) {
      const dock = root.querySelector<HTMLDetailsElement>("details.garden");
      if (dock) dock.open = true;
      root.querySelector<HTMLButtonElement>("[data-explore]")?.focus({ preventScroll: true });
    }
  }

  return { enter, exit, active: () => active };
}
