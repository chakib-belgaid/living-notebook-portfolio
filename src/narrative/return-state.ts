/** The case-page return record: where the reader was on the homepage when
 * they left for a retained case, so the case page's explicit "Return to the
 * portfolio" link can bring them back to the same chapter and reading
 * position. Shared, by format, with public/assets/case-return.js (a plain
 * script copied verbatim to the case pages); keep the two in step.
 *
 * sessionStorage only (one tab, one session). A record holds one chapter id,
 * a relative offset within that chapter and the homepage's query string. It
 * is never a history and never a URL: the case page always rebuilds a
 * same-origin "/" path from it. Every storage access is guarded, so a denied
 * or full storage only loses the reading position, never the navigation.
 *
 * Keys
 * - `notebook:return:<case path>` (e.g. `notebook:return:/fr/work/whispbook/`):
 *   written when a case link is followed; keyed by page and locale through
 *   the path.
 * - `notebook:return:last`: the latest position, written with the above and
 *   on pagehide; the case page's fallback when it has no record of its own
 *   (reached by URL or through its language switch).
 * - `notebook:restore`: written by the case page when its Return link is
 *   followed; consumed once by the controller on the homepage's next load.
 *
 * Record (JSON): `{ "v": 1, "chapter": ChapterId, "offset": 0…1, "query": "" | "?…" }`
 * Restore (JSON): `{ "v": 1, "chapter": ChapterId, "offset": 0…1, "t": epoch ms }`
 */
import { isChapterId, type ChapterId } from "./model.ts";

export const RETURN_KEY_PREFIX = "notebook:return:";
export const RETURN_LAST_KEY = `${RETURN_KEY_PREFIX}last`;
export const RESTORE_KEY = "notebook:restore";
/** A restore older than this is ignored (it was not followed by a load). */
export const RESTORE_TTL_MS = 30_000;
const MAX_QUERY = 512;

export interface ReturnRecord {
  v: 1;
  chapter: ChapterId;
  /** Reading-line position within the chapter, 0 (its top) … 1 (its end). */
  offset: number;
  /** The homepage's query string ("" or "?…"): lang, view, quality and any
   * unrelated parameters, preserved as they were. */
  query: string;
}
export interface RestoreRecord {
  v: 1;
  chapter: ChapterId;
  offset: number;
  t: number;
}

/** Retained case pages: /work/<slug>/ and /fr/work/<slug>/. */
export const CASE_PATH = /^\/(?:fr\/)?work\/[a-z0-9-]+\/?$/;
export const caseKey = (pathname: string) => RETURN_KEY_PREFIX + (pathname.endsWith("/") ? pathname : `${pathname}/`);

const validOffset = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const validQuery = (value: unknown): value is string =>
  typeof value === "string" && value.length <= MAX_QUERY && (value === "" || value.startsWith("?"));

export function parseReturnRecord(raw: string | null): ReturnRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw);
    if (r && r.v === 1 && isChapterId(r.chapter) && validOffset(r.offset) && validQuery(r.query)) {
      return { v: 1, chapter: r.chapter, offset: r.offset, query: r.query };
    }
  } catch { /* A malformed record is no record. */ }
  return null;
}

export function parseRestoreRecord(raw: string | null, now: number): RestoreRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw);
    if (r && r.v === 1 && isChapterId(r.chapter) && validOffset(r.offset) && typeof r.t === "number" && now - r.t >= 0 && now - r.t <= RESTORE_TTL_MS) {
      return { v: 1, chapter: r.chapter, offset: r.offset, t: r.t };
    }
  } catch { /* Ignore. */ }
  return null;
}

/** The query to carry back, bounded; an oversized query is dropped whole. */
export const returnQuery = (search: string) => (search.length > 1 && search.length <= MAX_QUERY ? search : "");

function storage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

/** Writes the record under the case's key and as the latest position. */
export function saveReturn(record: ReturnRecord, casePath?: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const json = JSON.stringify(record);
    if (casePath) store.setItem(caseKey(casePath), json);
    store.setItem(RETURN_LAST_KEY, json);
    return true;
  } catch { return false; }
}

/** Reads and removes the one-shot restore left by a case page's Return link. */
export function takeRestore(now = Date.now()): RestoreRecord | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(RESTORE_KEY);
    if (raw !== null) store.removeItem(RESTORE_KEY);
    return parseRestoreRecord(raw, now);
  } catch { return null; }
}
