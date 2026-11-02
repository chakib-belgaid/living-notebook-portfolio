/** The reading ruler (markup in src/render.ts `ruler()`): the previous
 * page's bottom bar, on wide layouts only. From the top: the chapter being
 * read, the chapter index (links the navigation module takes over like any
 * other), a scale from the opening to the end that scrolls the page when
 * dragged, with a dot where each chapter begins, then the four construction
 * phases (each a jump to the first chapter of that phase), the carbon tally,
 * and the sound and pause controls, which mirror the header's disclosure
 * (src/narrative/scene-controls.ts binds them). Stacked layouts keep only
 * the tally, a pill in the bottom corner, so the figure stays on screen
 * without a bar over the text.
 *
 * The tally is an odometer of the visit's estimated footprint: reported
 * transfer (src/transfer.ts, Resource Timing through co2.js) plus the
 * measured drawing time of the live scene (src/compute.ts), read from the
 * scene mount. Its panel holds the split, the sources and the method, opens
 * above the figure and closes on Escape or a press elsewhere. The same total
 * goes to the garden's own register on the observatory post. The figure is
 * redrawn on a timer, never while the tab is hidden, and the DOM is written
 * only when a text changes, so translation work and repaints stay rare. */
import { estimateCompute, type ComputeWork } from "../compute";
import { createTransferEstimate, formatGrams } from "../transfer";
import { chapter as chapterContent, chapters } from "./content";
import type { NarrativeController } from "./controller";
import { chapterIds, phases, type ChapterId, type Phase } from "./model";

/** What the ruler needs from the scene mount. */
export interface RulerScene {
  /** Drawing done so far by every renderer of this visit; null when none ran. */
  work(): ComputeWork | null;
  /** The visit's total, for the register drawn in the observatory. */
  setTally(grams: number | null): void;
}

export interface Ruler {
  destroy(): void;
}

/** How often the odometer is read. */
export const TALLY_INTERVAL_MS = 500;
/** The scale's resolution. */
const SCALE = 1000;

/** The chapter a phase button jumps to: the first chapter of that phase. */
export const phaseLanding = (phase: Phase): ChapterId => chapters.find(c => c.scene.phase === phase)!.id;

export function createRuler(controller: NarrativeController, scene: RulerScene, root: Document = document): Ruler | null {
  const dock = root.querySelector<HTMLElement>(".ruler-dock");
  if (!dock) return null;
  // The dock always carries its bar (render.ts); the markers inside it are optional.
  const bar = dock.querySelector<HTMLElement>(".ruler")!;
  const links = new Map(chapterIds.map(id => [id, bar.querySelector<HTMLAnchorElement>(`.chapter-index a[href="#${id}"]`)]));
  const dots = new Map(chapterIds.map(id => [id, bar.querySelector<HTMLElement>(`.ruler-dot[data-dot="${id}"]`)]));
  const sections = new Map(chapterIds.map(id => [id, root.getElementById(id)]));
  const name = bar.querySelector<HTMLElement>("[data-ruler-chapter]");
  const scrub = bar.querySelector<HTMLInputElement>(".ruler-scrub");
  const stageButtons = [...bar.querySelectorAll<HTMLButtonElement>("[data-go]")];
  const tally = bar.querySelector<HTMLDetailsElement>(".tally");
  const fields = {
    figure: bar.querySelector<HTMLElement>("[data-carbon-figure]"),
    transfer: bar.querySelector<HTMLElement>("[data-carbon-transfer]"),
    compute: bar.querySelector<HTMLElement>("[data-carbon-compute]"),
    transferSource: bar.querySelector<HTMLElement>("[data-carbon-source]"),
    computeSource: bar.querySelector<HTMLElement>("[data-compute-source]"),
  };

  // The last English written to each field. Localization rewrites the text
  // nodes, so the DOM cannot be compared with the next reading directly.
  const written = new WeakMap<HTMLElement, string>();
  const write = (el: HTMLElement | null, text: string) => {
    if (!el || written.get(el) === text) return;
    written.set(el, text);
    el.textContent = text;
  };

  /* ---------- The chapter being read ---------- */
  function mark(chapter: ChapterId) {
    const cue = chapterContent(chapter);
    for (const [id, link] of links) {
      if (id === chapter) link?.setAttribute("aria-current", "location");
      else link?.removeAttribute("aria-current");
      dots.get(id)?.toggleAttribute("data-current", id === chapter);
    }
    for (const button of stageButtons) {
      if (button.dataset.go === cue.scene.phase) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
    bar.dataset.phase = cue.scene.phase;
    write(name, cue.short);
    if (scrub && scrub.getAttribute("aria-valuetext") !== cue.short) scrub.setAttribute("aria-valuetext", cue.short);
  }
  const offChange = controller.onChapterChange(chapter => mark(chapter));
  mark(controller.activeChapter());

  /* ---------- The scale ---------- */
  // Where each chapter begins, as a share of the page's scroll; measured
  // again whenever the document's height changes (fonts, posters, locale).
  let measuredHeight = 0;
  const maxScroll = () => Math.max(1, root.documentElement.scrollHeight - innerHeight);
  function measure() {
    measuredHeight = root.documentElement.scrollHeight;
    const max = maxScroll();
    for (const [id, dot] of dots) {
      const section = sections.get(id);
      if (!dot || !section) continue;
      const at = Math.min(1, Math.max(0, (section.getBoundingClientRect().top + scrollY) / max));
      dot.style.setProperty("--at", at.toFixed(4));
    }
  }
  let frame = 0;
  function sync() {
    frame = 0;
    if (root.documentElement.scrollHeight !== measuredHeight) measure();
    // The visitor's own drag is not overwritten.
    if (scrub && root.activeElement !== scrub) scrub.value = String(Math.round((scrollY / maxScroll()) * SCALE));
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
  const onInput = () => { scrollTo({ top: (Number(scrub!.value) / SCALE) * maxScroll(), behavior: "instant" }); };
  const onResize = () => { measure(); schedule(); };
  scrub?.addEventListener("input", onInput);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", onResize);
  const onGo = (event: Event) => {
    const phase = (event.currentTarget as HTMLElement).dataset.go as Phase;
    if (!phases.includes(phase)) return;
    controller.visit(phaseLanding(phase), { push: true, focus: true, cause: "navigation" });
  };
  stageButtons.forEach(button => button.addEventListener("click", onGo));
  measure();
  sync();

  /* ---------- The tally ---------- */
  const transfer = createTransferEstimate();
  function draw() {
    const moved = transfer.read();
    const drawn = estimateCompute(scene.work());
    const parts = [moved.grams, drawn.grams].filter((g): g is number => g !== null);
    const total = parts.length ? parts.reduce((a, b) => a + b, 0) : null;
    write(fields.figure, total === null ? "Unavailable" : formatGrams(total));
    scene.setTally(total);
    write(fields.transfer, moved.figure);
    write(fields.compute, drawn.figure);
    write(fields.transferSource, `Transfer: ${moved.source}`);
    write(fields.computeSource, `Rendering: ${drawn.source}`);
  }
  draw();
  const timer = setInterval(() => { if (!root.hidden) draw(); }, TALLY_INTERVAL_MS);
  const onVisibility = () => { if (!root.hidden) draw(); };
  root.addEventListener("visibilitychange", onVisibility);

  // The panel closes like a popover: on Escape, or a press anywhere else.
  const onKey = (event: KeyboardEvent) => {
    if (!tally || event.key !== "Escape" || !tally.open) return;
    tally.open = false;
    tally.querySelector<HTMLElement>("summary")?.focus();
  };
  const onPress = (event: Event) => {
    if (tally?.open && !tally.contains(event.target as Node)) tally.open = false;
  };
  tally?.addEventListener("keydown", onKey);
  root.addEventListener("pointerdown", onPress);

  dock.hidden = false;

  return {
    destroy() {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      root.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointerdown", onPress);
      tally?.removeEventListener("keydown", onKey);
      scrub?.removeEventListener("input", onInput);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", onResize);
      stageButtons.forEach(button => button.removeEventListener("click", onGo));
      offChange();
      transfer.dispose();
      dock.hidden = true;
    },
  };
}
