/** The reading controller: which chapter the visitor is reading, and the one
 * place that moves the page to a chapter.
 *
 * It owns chapter geometry (read in one batch, cached until a resize, font
 * load or locale change), the active chapter (from a reading line below the
 * sticky header, with hysteresis at boundaries), `aria-current` on the
 * primary navigation, the passive fragment (replaceState, focus untouched)
 * and `visit()`, which src/navigation.ts calls for explicit jumps, history
 * arrivals and the case-page return.
 *
 * Navigation contract
 * - Explicit (`push: true, focus: true`): one history entry, an immediate
 *   jump (no glide; the same under reduced motion), then the destination
 *   heading is focused with preventScroll, so there is no second scroll.
 * - History (`push: false, focus: false, scroll: "if-needed"`): no entry is
 *   pushed; the browser's own scroll restoration is kept when it already shows
 *   the destination chapter, otherwise the page jumps to it.
 * - Passive scroll: the fragment is replaced when the active chapter changes,
 *   never pushed, and focus does not move.
 * - Every visit increments a token: a newer visit (or the visitor's own
 *   wheel/touch/key/pointer input) cancels the previous one's pending
 *   re-anchoring, so a late font or poster never pulls the page back to an
 *   earlier destination.
 * - After a visit the active chapter is held at the destination until the
 *   page is scrolled away from where the visit left it; a short chapter at
 *   the end of the page cannot flip the URL to its neighbour.
 *
 * The scene mount (src/narrative/scene-mount.ts) subscribes with
 * `onChapterChange`, `onPosition` (once per animation frame while the reading
 * position changes) and `onVisit` (every landed visit, so an explicit jump
 * snaps the scene to its destination even when the chapter did not change).
 */
import { onLocaleChange } from "../i18n";
import { activeNavHref, chapterIds, resolveFragment, type ChapterId } from "./model.ts";
import { takeRestore } from "./return-state.ts";

export type ChangeCause = "load" | "scroll" | "navigation" | "history" | "layout";

export interface ReadingPosition {
  chapter: ChapterId;
  /** Where the reading line sits within the chapter: 0 at its top, 1 at its end. */
  offset: number;
}

export interface VisitOptions {
  /** Add a history entry for the destination (explicit actions only). */
  push: boolean;
  /** Focus the destination heading (explicit actions only). */
  focus: boolean;
  /** Land at this relative offset in the destination chapter instead of its top. */
  offset?: number;
  /** "if-needed" keeps the current scroll when it already shows the destination chapter. */
  scroll?: "always" | "if-needed";
  cause?: ChangeCause;
}

export interface NarrativeController {
  activeChapter(): ChapterId;
  /** The current reading position (chapter + relative offset). */
  position(): ReadingPosition;
  /** Called when the active chapter changes. Returns an unsubscribe. */
  onChapterChange(callback: (chapter: ChapterId, previous: ChapterId, cause: ChangeCause) => void): () => void;
  /** Called at most once per animation frame while the reading position changes. */
  onPosition(callback: (position: ReadingPosition) => void): () => void;
  /** Called after every visit has landed (explicit, history, load or Return),
   * even when the destination is already the active chapter. Returns an unsubscribe. */
  onVisit(callback: (chapter: ChapterId, cause: ChangeCause) => void): () => void;
  /** Move to a chapter id or fragment ("#wattch", "workshop", …). False if it names no destination. */
  visit(target: string, options: VisitOptions): boolean;
  /** Forget measured geometry (call after a layout change the controller cannot observe). */
  invalidate(): void;
  destroy(): void;
}

/** The reading line: this far down the visible area below the header. */
const READING_LINE = 0.3;
/** How long a fresh destination is kept in place against late layout. */
const SETTLE_MS = 3000;

export function createController(root: Document = document): NarrativeController {
  const sections = chapterIds.map(id => root.getElementById(id) as HTMLElement);
  const masthead = root.querySelector<HTMLElement>(".masthead");
  const navLinks = [...root.querySelectorAll<HTMLAnchorElement>(".primary-nav a[href^='#']")];
  const main = root.getElementById("portfolio");

  // Geometry, in document coordinates.
  const tops: number[] = [];
  const heights: number[] = [];
  let header = 0;
  let viewport = 0;
  let maxScroll = 0;
  let measured = false;
  let width = innerWidth;

  let active = 0;
  /** While set, the active chapter is held at the last visit's destination. */
  let hold: number | null = null;
  let token = 0;
  let pending: { token: number; land: () => void } | null = null;
  let frame = 0;
  let lastPosition: ReadingPosition = { chapter: "intro", offset: 0 };
  /** Pending `load` re-anchors, removed when they expire or on destroy. */
  const loadListeners = new Set<() => void>();

  const chapterListeners = new Set<(chapter: ChapterId, previous: ChapterId, cause: ChangeCause) => void>();
  const positionListeners = new Set<(position: ReadingPosition) => void>();
  const visitListeners = new Set<(chapter: ChapterId, cause: ChangeCause) => void>();

  function measure() {
    const y = scrollY;
    // One batch of reads, no writes in between.
    for (let i = 0; i < sections.length; i++) {
      const box = sections[i].getBoundingClientRect();
      tops[i] = box.top + y;
      heights[i] = Math.max(1, box.height);
    }
    header = masthead && getComputedStyle(masthead).position === "sticky" ? masthead.getBoundingClientRect().height : 0;
    viewport = innerHeight;
    maxScroll = Math.max(0, root.documentElement.scrollHeight - viewport);
    measured = true;
  }
  const geometry = () => { if (!measured) measure(); };
  const lineAt = (y: number) => y + header + (viewport - header) * READING_LINE;
  const indexAt = (line: number) => {
    let i = sections.length - 1;
    while (i > 0 && tops[i] > line) i--;
    return i;
  };
  const positionAt = (y: number): ReadingPosition => {
    const line = lineAt(y);
    const i = indexAt(line);
    return { chapter: chapterIds[i], offset: Math.min(1, Math.max(0, (line - tops[i]) / heights[i])) };
  };
  const scrollFor = (i: number, offset: number) =>
    Math.min(maxScroll, Math.max(0, tops[i] + offset * heights[i] - header - (viewport - header) * READING_LINE));

  /** The chapter the visitor is reading, with hysteresis at boundaries. */
  function chapterFromScroll(): number {
    const y = scrollY;
    if (y <= 1) return 0;
    if (y >= maxScroll - 2) return sections.length - 1;
    const line = lineAt(y);
    const band = Math.min(48, viewport * 0.05);
    const ahead = indexAt(line - band);
    if (ahead > active) return ahead;
    const behind = indexAt(line + band);
    if (behind < active) return behind;
    return active;
  }

  function markNav(chapter: ChapterId) {
    const href = activeNavHref(chapter);
    for (const link of navLinks) {
      if (link.getAttribute("href") === href) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

  function setActive(i: number, cause: ChangeCause) {
    if (i === active) return;
    const previous = chapterIds[active];
    active = i;
    const chapter = chapterIds[i];
    markNav(chapter);
    if (cause === "scroll" || cause === "layout") replaceFragment(chapter);
    chapterListeners.forEach(listener => listener(chapter, previous, cause));
  }

  /** Passive: the fragment follows the reading, without a history entry.
   * A fragment that already resolves to the chapter (an alias such as
   * #wattch, or #workshop inside About) is left as it is. */
  function replaceFragment(chapter: ChapterId) {
    if (resolveFragment(location.hash)?.chapter === chapter) return;
    const url = new URL(location.href);
    url.hash = chapter === "intro" ? "" : chapter;
    try { history.replaceState(history.state, "", url); } catch { /* Rate-limited: the next change retries. */ }
  }

  function update() {
    frame = 0;
    geometry();
    if (hold !== null && Math.abs(scrollY - hold) > 2) hold = null;
    if (hold === null) setActive(chapterFromScroll(), "scroll");
    const position = hold === null ? positionAt(scrollY) : { chapter: chapterIds[active], offset: positionAt(scrollY).offset };
    if (position.chapter !== lastPosition.chapter || Math.abs(position.offset - lastPosition.offset) > 0.0005) {
      lastPosition = position;
      positionListeners.forEach(listener => listener(position));
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

  /** Keeps a fresh destination in place while late layout settles: the next
   * two frames, the font swap and the load event (until which the browser's
   * own fragment anchoring may also move the page), for at most SETTLE_MS.
   * A newer visit or the visitor's own input ends it at once. */
  function settle(mine: number, land: () => void) {
    pending = { token: mine, land };
    const again = () => {
      if (pending?.token !== mine) return;
      measure();
      land();
      hold = scrollY;
    };
    const end = () => {
      if (pending?.token === mine) pending = null;
      removeEventListener("load", loaded);
      loadListeners.delete(loaded);
    };
    const loaded = () => { again(); requestAnimationFrame(again); };
    requestAnimationFrame(() => { again(); requestAnimationFrame(again); });
    root.fonts?.ready.then(again);
    if (root.readyState !== "complete") {
      addEventListener("load", loaded, { once: true });
      loadListeners.add(loaded);
    }
    setTimeout(end, SETTLE_MS);
  }
  const cancel = () => { token++; pending = null; };

  function headingFor(target: HTMLElement, chapter: ChapterId): HTMLElement | null {
    if (target.matches("h1, h2, h3")) return target;
    return target.querySelector<HTMLElement>("h1[id], h2[id], h3[id]")
      ?? root.getElementById(`${chapter}-title`);
  }

  function visit(ref: string, options: VisitOptions): boolean {
    const destination = resolveFragment(ref.startsWith("#") ? ref : `#${ref}`);
    if (!destination) return false;
    const target = root.getElementById(destination.target);
    if (!target) return false;
    const mine = ++token;
    pending = null;
    const index = chapterIds.indexOf(destination.chapter);
    const cause = options.cause ?? (options.push ? "navigation" : "history");

    if (options.push) {
      const url = new URL(location.href);
      url.hash = destination.target === "intro" ? "" : destination.target;
      if (url.href !== location.href) history.pushState(null, "", url);
    }

    measure();
    const land = options.offset !== undefined
      ? () => { measure(); scrollTo({ top: scrollFor(index, options.offset!), behavior: "instant" }); }
      : () => target.scrollIntoView({ block: "start", behavior: "instant" });
    const shown = options.scroll === "if-needed" && chapterFromScrollIgnoringHold() === index;
    if (!shown) land();

    setActive(index, cause);
    hold = scrollY;
    const landed = positionAt(scrollY);
    lastPosition = { chapter: destination.chapter, offset: landed.chapter === destination.chapter ? landed.offset : 0 };

    if (options.focus) headingFor(target, destination.chapter)?.focus({ preventScroll: true });
    // Keep the destination in place while late layout settles, unless a newer
    // navigation or the visitor's own input wins. The jump is immediate in
    // every motion preference, so reduced motion needs no separate path.
    if (!shown) settle(mine, land);
    visitListeners.forEach(listener => listener(destination.chapter, cause));
    schedule();
    return true;
  }
  // History arrival compares the restored scroll with the destination,
  // without the hold of the visit it is replacing.
  function chapterFromScrollIgnoringHold() {
    const line = lineAt(scrollY);
    if (scrollY <= 1) return 0;
    if (scrollY >= maxScroll - 2) return sections.length - 1;
    return indexAt(line);
  }

  // The visitor's own input ends any pending re-anchoring at once.
  const input = () => { if (pending) cancel(); };
  const inputEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  inputEvents.forEach(type => addEventListener(type, input, { passive: true, capture: true }));

  addEventListener("scroll", schedule, { passive: true });
  /** Width changes (rotation, wide ↔ stacked) keep the chapter and relative
   * offset rather than a stale pixel position; height-only changes (mobile
   * toolbars) just re-measure. */
  const resized = () => {
    const before = lastPosition;
    measured = false;
    if (innerWidth !== width) {
      width = innerWidth;
      measure();
      if (!pending) {
        scrollTo({ top: scrollFor(chapterIds.indexOf(before.chapter), before.offset), behavior: "instant" });
        hold = scrollY;
        setActive(chapterIds.indexOf(before.chapter), "layout");
      }
    }
    schedule();
  };
  addEventListener("resize", resized);
  const observer = typeof ResizeObserver === "function" && main ? new ResizeObserver(() => { measured = false; schedule(); }) : null;
  if (observer && main) observer.observe(main);
  if (observer && masthead) observer.observe(masthead);
  const fontsLoaded = () => { measured = false; schedule(); };
  root.fonts?.addEventListener?.("loadingdone", fontsLoaded);
  /** A new language reflows every chapter: keep the reader's place. */
  const stopLocale = onLocaleChange(() => {
    const before = lastPosition;
    measure();
    if (pending) return;
    scrollTo({ top: scrollFor(chapterIds.indexOf(before.chapter), before.offset), behavior: "instant" });
    hold = scrollY;
    schedule();
  });

  // Landing. A Return from a case page restores its chapter and offset; a
  // fresh fragment landing is kept in place through the font swap; reloads
  // and history traversals keep the browser's own scroll restoration.
  measure();
  const restore = takeRestore();
  const landing = resolveFragment(location.hash);
  const navigation = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  active = chapterFromScrollIgnoringHold();
  markNav(chapterIds[active]);
  lastPosition = positionAt(scrollY);
  if (landing && restore && restore.chapter === landing.chapter) {
    visit(landing.target, { push: false, focus: false, offset: restore.offset, cause: "load" });
  } else if (landing && location.hash && (navigation?.type ?? "navigate") === "navigate") {
    visit(landing.target, { push: false, focus: false, cause: "load" });
  } else {
    schedule();
  }

  return {
    activeChapter: () => chapterIds[active],
    position: () => { geometry(); return hold === null ? positionAt(scrollY) : lastPosition; },
    onChapterChange(callback) { chapterListeners.add(callback); return () => { chapterListeners.delete(callback); }; },
    onPosition(callback) { positionListeners.add(callback); return () => { positionListeners.delete(callback); }; },
    onVisit(callback) { visitListeners.add(callback); return () => { visitListeners.delete(callback); }; },
    visit,
    invalidate() { measured = false; schedule(); },
    destroy() {
      cancel();
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", resized);
      inputEvents.forEach(type => removeEventListener(type, input, { capture: true }));
      observer?.disconnect();
      root.fonts?.removeEventListener?.("loadingdone", fontsLoaded);
      loadListeners.forEach(listener => removeEventListener("load", listener));
      loadListeners.clear();
      stopLocale();
    },
  };
}
