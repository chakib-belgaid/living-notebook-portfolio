/** What the visitor (or their system) asked of the scene: the view, motion,
 * data saving and drawing quality. Pure helpers plus guarded storage, so the
 * rules can be tested without a browser (tests/narrative-model.test.mjs).
 *
 * - View: bare `/`, `?view=garden` and any unknown value are the guided
 *   narrative; `?view=read` and `?view=stills` show the phase stills and load
 *   no live scene until the visitor asks for it.
 * - Motion: the system's reduced-motion setting and the visitor's own pause
 *   are kept apart (model.ts `MotionPreference`); neither touches sound.
 * - Save-data and reduced motion prefer the stills until the visitor asks
 *   for the live drawing; that request lasts for the session.
 * - Quality: `?quality=low|light|full`, else the saved `notebook:quality`,
 *   else auto (light on compact screens). `?quality=low` also asks for the
 *   lighter build on any screen. */
import type { MotionPreference } from "./model.ts";

export type ViewMode = "guided" | "stills";
export type QualityChoice = "auto" | "full" | "light";
export type Quality = "full" | "light";
export type Detail = "full" | "low";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Phones and small windows draw the garden light under auto quality. */
export const COMPACT_QUERY = "(max-width: 899px), (max-height: 599px)";
export const QUALITY_KEY = "notebook:quality";
/** sessionStorage: "1" once the visitor asked for the live drawing over stills. */
export const LIVE_KEY = "notebook:live";
/** sessionStorage: "paused" while the visitor's own pause is on. */
export const PAUSE_KEY = "notebook:motion";

export function viewMode(href: string): ViewMode {
  const view = new URL(href).searchParams.get("view");
  return view === "read" || view === "stills" ? "stills" : "guided";
}

export function motionPreference(systemReduced: boolean, userPaused: boolean): MotionPreference {
  return systemReduced ? "system-reduced" : userPaused ? "user-paused" : "normal";
}

/** Whether the live scene may load without the visitor asking for it. */
export function liveByDefault(options: { mode: ViewMode; systemReduced: boolean; saveData: boolean; asked: boolean }) {
  if (options.mode === "stills") return false;
  return options.asked || (!options.systemReduced && !options.saveData);
}

export function qualityChoice(href: string, saved: string | null): QualityChoice {
  const param = new URL(href).searchParams.get("quality");
  if (param === "low" || param === "light") return "light";
  if (param === "full") return "full";
  return saved === "full" || saved === "light" ? saved : "auto";
}
export const qualityFor = (choice: QualityChoice, compact: boolean): Quality =>
  choice === "auto" ? (compact ? "light" : "full") : choice;
/** The build is fixed once made: phones (and `?quality=low`) build the lighter garden. */
export function detailFor(quality: Quality, compact: boolean, href: string): Detail {
  const low = new URL(href).searchParams.get("quality") === "low";
  return quality === "light" && (compact || low) ? "low" : "full";
}

export const saveDataOn = () =>
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

/** Storage is a convenience: every access may throw (private modes, blocked storage). */
export function read(storage: () => Storage, key: string): string | null {
  try { return storage().getItem(key); } catch { return null; }
}
export function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch { /* Remembering is optional. */ }
}
