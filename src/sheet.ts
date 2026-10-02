/* One bottom sheet for the phone journey. Opening it moves a section's
   [data-detail] nodes in, so live state (a draft, a playing voice) moves
   with them; closing puts each back where a marker kept its place. */
const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");

export type Sheet = {
  open: (key: string, title: string, opener: HTMLElement) => void;
  close: (immediate?: boolean) => void;
  readonly openKey: string | null;
};

export function createSheet(): Sheet {
  const dialog = document.createElement("dialog");
  dialog.className = "sheet";
  dialog.setAttribute("aria-labelledby", "sheet-title");
  dialog.innerHTML = `<div class="sheet-head"><span class="sheet-handle" aria-hidden="true"></span><h2 id="sheet-title" tabindex="-1"></h2><button type="button" class="sheet-close" aria-label="Close">×</button></div><div class="sheet-body"></div>`;
  document.body.append(dialog);
  const head = dialog.querySelector<HTMLElement>(".sheet-head")!;
  const title = dialog.querySelector<HTMLElement>("#sheet-title")!;
  const body = dialog.querySelector<HTMLElement>(".sheet-body")!;
  let openKey: string | null = null;
  let opener: HTMLElement | null = null;
  let moved: { node: Element; marker: Comment }[] = [];

  function restore() {
    moved.forEach(({ node, marker }) => marker.replaceWith(node));
    moved = [];
    openKey = null;
    if (opener?.isConnected && !opener.closest("[hidden]")) opener.focus({ preventScroll: true });
    opener = null;
  }
  // Only the sheet's own slide down ends a close; a child's animation bubbles here too.
  function slidDown(e: AnimationEvent) {
    if (e.target === dialog && e.animationName === "sheet-down") finish();
  }
  function settle() {
    dialog.removeEventListener("animationend", slidDown);
    dialog.classList.remove("closing");
    dialog.style.removeProperty("--drag");
  }
  function finish() {
    settle();
    if (dialog.open) dialog.close();
    restore();
  }
  function close(immediate = false) {
    if (!openKey) return;
    const still = immediate || reducedQuery.matches || document.documentElement.dataset.motionPaused === "true";
    if (still) return finish();
    dialog.classList.add("closing");
    dialog.addEventListener("animationend", slidDown);
    // In case the animation never runs (a hidden tab), close anyway.
    window.setTimeout(() => { if (openKey && dialog.classList.contains("closing")) finish(); }, 400);
  }
  function open(key: string, heading: string, from: HTMLElement) {
    if (openKey) close(true);
    openKey = key;
    opener = from;
    title.textContent = heading;
    moved = [...document.querySelectorAll(`[data-detail="${key}"]`)].map((node) => {
      const marker = document.createComment(`detail ${key}`);
      node.before(marker);
      body.append(node);
      return { node, marker };
    });
    body.scrollTop = 0;
    dialog.showModal();
    title.focus({ preventScroll: true });
  }

  // Escape: close with the animation. If the browser closes it outright, still put the details back.
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  // A second Escape (or a back gesture) can close it outright, mid-slide.
  dialog.addEventListener("close", () => { settle(); if (openKey) restore(); });
  dialog.querySelector(".sheet-close")!.addEventListener("click", () => close());
  // A tap on the backdrop, outside the sheet's box.
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) close();
  });
  // Drag the head down: past a quarter of the sheet, or a quick flick, closes it.
  let drag: { y: number; t: number; dy: number } | null = null;
  head.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest("button")) return;
    drag = { y: e.clientY, t: performance.now(), dy: 0 };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    dialog.style.setProperty("--drag", `${drag.dy}px`);
  });
  const release = () => {
    if (!drag) return;
    const { dy, t } = drag;
    drag = null;
    const flick = dy > 24 && dy / Math.max(1, performance.now() - t) > 0.6;
    if (dy > dialog.offsetHeight * 0.25 || flick) close();
    else dialog.style.removeProperty("--drag");
  };
  head.addEventListener("pointerup", release);
  head.addEventListener("pointercancel", release);

  return { open, close, get openKey() { return openKey; } };
}
