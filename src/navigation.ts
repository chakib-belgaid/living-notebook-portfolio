/** In-page navigation: which link activations and history events become
 * controller visits, and the return record left when a case link is followed.
 *
 * Destinations come from the model (chapter ids and the explicit aliases in
 * `fragmentAliases`): a destination is content (chapter + landing element);
 * the scene phase is the chapter's own cue, never derived from the URL.
 * Only same-document links whose fragment resolves are taken over; every
 * other link, and any activation with a modifier key, another button, a
 * target or a download attribute, is left to the browser. Query parameters
 * (?lang, ?view, ?quality and unrelated ones) are never rewritten.
 *
 * Without JavaScript the same links land natively: chapters and alias
 * anchors are real elements with scroll-margin for the sticky header.
 */
import type { NarrativeController } from "./narrative/controller.ts";
import { resolveFragment, type ChapterId } from "./narrative/model.ts";
import { CASE_PATH, returnQuery, saveReturn } from "./narrative/return-state.ts";

/** The URL for landing on `target` from `current`: the fragment changes,
 * nothing else does. The opening has no fragment. */
export function hrefForTarget(current: string, target: string): string {
  const url = new URL(current);
  url.hash = target === "intro" ? "" : target;
  return url.href;
}

/** The destination of a link within this document, or null when the link
 * leaves the document or names no chapter or alias. */
export function inPageDestination(link: string, current: string): { chapter: ChapterId; target: string } | null {
  const to = new URL(link, current);
  const here = new URL(current);
  if (to.origin !== here.origin || to.pathname !== here.pathname || to.search !== here.search || !to.hash) return null;
  return resolveFragment(to.hash);
}

/** True for a same-origin retained case page (/work/<slug>/, /fr/work/<slug>/). */
export const isCaseLink = (link: string, current: string) => {
  const to = new URL(link, current);
  return to.origin === new URL(current).origin && CASE_PATH.test(to.pathname);
};

/** A plain primary activation the page may take over. */
export const isPlainActivation = (event: MouseEvent, link: HTMLAnchorElement) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
  && (!link.target || link.target === "_self") && !link.hasAttribute("download");

export function createNavigation(controller: NarrativeController) {
  const record = (casePath?: string) => {
    const { chapter, offset } = controller.position();
    saveReturn({ v: 1, chapter, offset, query: returnQuery(location.search) }, casePath);
  };

  function activate(event: MouseEvent) {
    const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
    if (!link) return;
    // Any way of following a case link (including a new tab) records the
    // reading position for that case's Return link.
    if (isCaseLink(link.href, location.href)) {
      record(new URL(link.href).pathname);
      return;
    }
    if (event.type !== "click" || !isPlainActivation(event, link)) return;
    const destination = inPageDestination(link.href, location.href);
    if (!destination) return;
    event.preventDefault();
    explicit++;
    controller.visit(destination.target, { push: true, focus: true, cause: "navigation" });
  }

  // popstate and hashchange can both fire for one traversal; arrive once,
  // after the browser's own scroll restoration for the entry, unless an
  // explicit navigation has happened in the meantime (it wins).
  let explicit = 0;
  let queued = false;
  function arrive() {
    if (queued) return;
    queued = true;
    const at = explicit;
    requestAnimationFrame(() => {
      queued = false;
      if (at !== explicit) return;
      controller.visit(location.hash || "#intro", { push: false, focus: false, scroll: "if-needed", cause: "history" });
    });
  }
  const leave = () => record();

  document.addEventListener("click", activate);
  document.addEventListener("auxclick", activate);
  addEventListener("popstate", arrive);
  addEventListener("hashchange", arrive);
  addEventListener("pagehide", leave);
  return () => {
    document.removeEventListener("click", activate);
    document.removeEventListener("auxclick", activate);
    removeEventListener("popstate", arrive);
    removeEventListener("hashchange", arrive);
    removeEventListener("pagehide", leave);
  };
}
