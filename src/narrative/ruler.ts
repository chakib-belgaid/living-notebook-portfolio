/** The reading ruler (markup in src/render.ts `ruler()`): where the visitor
 * is in the page, and what the visit has cost so far.
 *
 * On wide layouts it is a bar at the foot of the scene, right of the chapter
 * card: the chapter being read and its construction phase, a dot for each
 * chapter (a link the navigation module takes over like any other), a line
 * that fills as the page is read, and the carbon tally. On stacked layouts
 * the stylesheet keeps only the tally, a small pill in the bottom corner,
 * so the figure stays on screen without a bar over the text.
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
import { chapter as chapterContent } from "./content";
import type { NarrativeController } from "./controller";
import { chapterIds, chapterOrder, phaseLabels, type ChapterId } from "./model";

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

export function createRuler(controller: NarrativeController, scene: RulerScene, root: Document = document): Ruler | null {
  const dock = root.querySelector<HTMLElement>(".ruler-dock");
  if (!dock) return null;
  // The dock always carries its bar (render.ts); the markers inside it are optional.
  const bar = dock.querySelector<HTMLElement>(".ruler")!;
  const dots = new Map(chapterIds.map(id => [id, bar.querySelector<HTMLAnchorElement>(`.ruler-dot[href="#${id}"]`)]));
  const name = bar.querySelector<HTMLElement>("[data-ruler-chapter]");
  const phase = bar.querySelector<HTMLElement>("[data-ruler-phase]");
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

  /* ---------- Position ---------- */
  function mark(chapter: ChapterId) {
    const order = chapterOrder(chapter);
    for (const [id, dot] of dots) {
      if (!dot) continue;
      if (id === chapter) dot.setAttribute("aria-current", "location");
      else dot.removeAttribute("aria-current");
      dot.toggleAttribute("data-passed", chapterOrder(id) < order);
    }
    const cue = chapterContent(chapter);
    bar.dataset.phase = cue.scene.phase;
    write(name, cue.short);
    write(phase, phaseLabels[cue.scene.phase]);
  }
  function fill(chapter: ChapterId, offset: number) {
    const read = Math.min(1, Math.max(0, (chapterOrder(chapter) + offset) / (chapterIds.length - 1)));
    bar.style.setProperty("--read", read.toFixed(4));
  }
  // A visit lands without a position notification (the controller records
  // the landing itself), so every chapter change and visit refills from the
  // controller's own reading of where the page is.
  const refill = () => { const { chapter, offset } = controller.position(); fill(chapter, offset); };
  const offChange = controller.onChapterChange(chapter => { mark(chapter); refill(); });
  const offPosition = controller.onPosition(({ chapter, offset }) => fill(chapter, offset));
  const offVisit = controller.onVisit(refill);
  mark(controller.activeChapter());
  refill();

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
      root.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointerdown", onPress);
      tally?.removeEventListener("keydown", onKey);
      offChange();
      offPosition();
      offVisit();
      transfer.dispose();
      dock.hidden = true;
    },
  };
}
