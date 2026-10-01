import { projects } from "./content";
export function initEvidence() {
  const dialog = document.createElement("dialog");
  dialog.className = "evidence-dialog";
  dialog.setAttribute("aria-labelledby", "evidence-title");
  dialog.innerHTML = `<header><h2 id="evidence-title"></h2><div class="evidence-actions"><button type="button" class="chip" data-size aria-pressed="false">Actual size</button><button type="button" class="chip" data-close>Close</button></div></header><div class="evidence-viewport"><img alt="" /></div><p id="evidence-caption"></p><a data-source target="_blank" rel="noopener noreferrer">Read the source on GitHub ↗</a>`;
  document.body.append(dialog);
  let opener: HTMLElement | null = null;
  const size = dialog.querySelector<HTMLButtonElement>("[data-size]")!;
  dialog.querySelector("[data-close]")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (opener?.isConnected && !opener.closest("[hidden]")) opener.focus({preventScroll:true}); });
  size.addEventListener("click", () => {
    const actual = dialog.classList.toggle("actual-size");
    size.setAttribute("aria-pressed", String(actual));
    size.textContent = actual ? "Fit image" : "Actual size";
  });
  document.addEventListener("click", e => {
    const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-evidence]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || typeof dialog.showModal !== "function") return;
    const p = projects[a.dataset.evidence as keyof typeof projects];
    if (!p) return;
    e.preventDefault();
    opener = a;
    dialog.classList.remove("actual-size");
    size.textContent = "Actual size";
    size.setAttribute("aria-pressed", "false");
    dialog.querySelector("h2")!.textContent = `${p.title} — product screenshot`;
    const image = dialog.querySelector("img")!;
    image.src = p.image; image.alt = p.alt;
    dialog.querySelector("#evidence-caption")!.textContent = p.caption;
    dialog.querySelector<HTMLAnchorElement>("[data-source]")!.href = p.url;
    dialog.showModal();
  });
}
