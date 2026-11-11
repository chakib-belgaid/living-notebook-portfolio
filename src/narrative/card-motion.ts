/** Card motion: how the chapter text arrives, stops and leaves as the page
 * scrolls. Enhancement only, and never under reduced motion: without this
 * module every chapter is laid out and fully visible.
 *
 * - The landmark stop (wide layouts): every card but the closing one lingers
 *   for an extra stretch of scroll (`--dwell` in src/narrative/style.css)
 *   before the next one arrives. A card that fits the viewport lingers where
 *   it lands; a taller one is read through and lingers once its last line is
 *   on screen. The stretch is sticky positioning over a taller chapter, not
 *   a change to the wheel: the page scrolls at the visitor's own speed.
 * - The glide: the stop is never a dead one. Through the stretch the card
 *   keeps drifting up at about a tenth of the scroll's speed; it slows into
 *   that drift on the way in and picks speed up again on the way out, along
 *   one curve whose speed never jumps (`glide` below).
 * - The fade: a card fades in as it comes up from the foot of the viewport
 *   and fades out as it picks up speed to leave. On stacked layouts only
 *   each chapter's lead (label, heading, opening text) fades in; the scene
 *   slot and the body are never dimmed.
 *
 * Geometry is read in one batch per frame and written afterwards; nothing
 * runs while the page is not scrolling. A card that holds keyboard focus is
 * always fully shown (the rule in style.css). */
import { onLocaleChange } from "../i18n.ts";
import { WIDE_LAYOUT_QUERY } from "./model.ts";
import { REDUCED_MOTION_QUERY } from "./preferences.ts";

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
/** Cubic Hermite from p0 to p1 over t in 0–1, with end slopes m0 and m1 (per unit t). */
const hermite = (t: number, p0: number, m0: number, p1: number, m1: number) => {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
};

/** Where a lingering card is drawn, as an offset in px below where sticky
 * layout puts it. `s` is the scroll since the card reached its stop (negative
 * before), `travel` the length of the linger, `drift` how far the card moves
 * during it, `lead` the scroll over which it slows in, `tail` the scroll over
 * which it speeds out, and `start` its offset when the linger begins (half
 * the drift, so the linger is centred on the stop; 0 for the opening card,
 * which must sit where the static page put it). Before `-lead` and after
 * `travel + tail` the offset is 0: the card is exactly where layout has it.
 * The drawn speed is continuous throughout: the scroll's own outside, the
 * drift's inside, a smooth change between. */
export function glide(s: number, travel: number, drift: number, lead: number, tail: number, start: number) {
  const rate = drift / travel;
  if (s <= -lead) return 0;
  // Slowing in. Layout moves the card one for one: it is -s below its stop.
  if (s < 0) return hermite((s + lead) / lead, lead, -lead, start, -rate * lead) + s;
  // The linger. Layout holds the card at its stop.
  if (s <= travel) return start - rate * s;
  // Speeding out. Layout carries the card off one for one again.
  const out = s - travel;
  if (out >= tail) return 0;
  return hermite(out / tail, start - drift, -rate * tail, -tail, -tail) + out;
}

export function initCardMotion(root: Document = document) {
  const html = root.documentElement;
  const chapters = [...root.querySelectorAll<HTMLElement>(".chapter")];
  const cards = chapters.map(c => c.querySelector<HTMLElement>(".chapter-card"));
  const leads = chapters.map(c => c.querySelector<HTMLElement>(".chapter-lead"));
  if (!chapters.length || cards.some(c => !c) || leads.some(l => !l) || typeof matchMedia !== "function") return () => {};
  const masthead = root.querySelector<HTMLElement>(".masthead");
  const wide = matchMedia(WIDE_LAYOUT_QUERY);
  const reduced = matchMedia(REDUCED_MOTION_QUERY);

  let on = false;
  let frame = 0;
  /** Per chapter, for a lingering card: its sticky stop (px from the viewport
   * top), where it sits in its chapter, its height and how long it lingers. */
  type Stop = { stop: number; padTop: number; height: number; travel: number };
  let stops: (Stop | null)[] = chapters.map(() => null);
  /** The rise currently applied to each target, so a reading can discount it. */
  const rises = new WeakMap<HTMLElement, number>();

  function show(el: HTMLElement, opacity: number, rise: number) {
    const o = Math.round(opacity * 100) / 100;
    const r = Math.round(rise);
    el.style.opacity = o >= 1 ? "" : String(o);
    el.style.transform = r ? `translateY(${r}px)` : "";
    rises.set(el, r);
  }
  const clear = (el: HTMLElement) => show(el, 1, 0);

  /** Which cards stop, measured in one batch and then written. */
  function layout() {
    on = !reduced.matches;
    html.classList.toggle("card-motion", on);
    if (!on) {
      chapters.forEach(c => { c.removeAttribute("data-dwell"); c.style.removeProperty("--card-h"); });
      cards.forEach(c => clear(c!));
      leads.forEach(l => clear(l!));
      stops = chapters.map(() => null);
      return;
    }
    const heights = cards.map(c => c!.offsetHeight);
    const last = chapters.length - 1;
    chapters.forEach((chapter, i) => {
      chapter.style.setProperty("--card-h", `${heights[i]}px`);
      chapter.toggleAttribute("data-dwell", wide.matches && i < last);
    });
    stops = chapters.map((chapter, i) => {
      if (!chapter.hasAttribute("data-dwell")) return null;
      const style = getComputedStyle(chapter);
      const padTop = parseFloat(style.paddingTop), padBottom = parseFloat(style.paddingBottom);
      const travel = chapter.getBoundingClientRect().height - padTop - padBottom - heights[i];
      return travel > 1 ? { stop: parseFloat(getComputedStyle(cards[i]!).top), padTop, height: heights[i], travel } : null;
    });
    // The layout that is not in use keeps no leftover fade.
    (wide.matches ? leads : cards).forEach(el => clear(el!));
    paint();
  }

  function paint() {
    frame = 0;
    if (!on) return;
    const vh = innerHeight;
    const header = masthead && getComputedStyle(masthead).position === "sticky" ? masthead.getBoundingClientRect().bottom : 0;
    if (wide.matches) {
      // Chapters are not moved by this module, so their boxes need no discount.
      const sections = chapters.map(c => c.getBoundingClientRect());
      const boxes = cards.map((c, i) => stops[i] ? null : c!.getBoundingClientRect());
      cards.forEach((card, i) => {
        const at = stops[i];
        if (!at) {
          // The closing card: it rises in, and fades only if scrolled past.
          const top = boxes[i]!.top - (rises.get(card!) ?? 0);
          const arriving = i === 0 ? 1 : ease(clamp((vh - top) / (vh * 0.42)));
          const leaving = ease(clamp((top + boxes[i]!.height - header) / (vh * 0.3)));
          show(card!, Math.min(arriving, leaving), (1 - arriving) * 28);
          return;
        }
        // Scroll since the card reached its stop, from where layout alone would have it.
        const s = at.stop - (sections[i].top + at.padTop);
        const tail = Math.min(at.height * 0.5, vh * 0.45);
        const offset = glide(s, at.travel, vh * 0.07, vh * 0.45, tail, i === 0 ? 0 : vh * 0.035);
        const drawn = Math.max(at.stop, at.stop - s) + (s > at.travel ? at.travel - s : 0) + offset;
        // Arriving from the foot of the viewport; the opening card is there from the start.
        const arriving = i === 0 ? 1 : ease(clamp((vh - drawn) / (vh * 0.42)));
        // Fading as it picks up speed to leave.
        const leaving = 1 - ease(clamp((s - at.travel) / tail));
        show(card!, Math.min(arriving, leaving), offset);
      });
    } else {
      const boxes = leads.map(l => l!.getBoundingClientRect());
      leads.forEach((lead, i) => {
        const top = boxes[i].top - (rises.get(lead!) ?? 0);
        const arriving = i === 0 ? 1 : ease(clamp((vh - top) / (vh * 0.22)));
        show(lead!, arriving, (1 - arriving) * 18);
      });
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(layout) : null;
  cards.forEach(c => observer?.observe(c!));
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", layout);
  wide.addEventListener("change", layout);
  reduced.addEventListener("change", layout);
  // Before the controller's own listener (main.ts starts this module first),
  // so it re-measures chapters that already have their new heights.
  const stopLocale = onLocaleChange(layout);
  layout();

  return () => {
    observer?.disconnect();
    removeEventListener("scroll", schedule);
    removeEventListener("resize", layout);
    wide.removeEventListener("change", layout);
    reduced.removeEventListener("change", layout);
    stopLocale();
    if (frame) cancelAnimationFrame(frame);
    html.classList.remove("card-motion");
  };
}
