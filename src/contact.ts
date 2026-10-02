import { email } from "./content";
import { translate } from "./i18n";
import type { Garden } from "./scene";

// The draft lives only in this document's memory, never browser storage.
let draft = "";
let sequence = 0;
export function mountContact(el: HTMLElement, getGarden: () => Garden | undefined) {
  const id = `note-${++sequence}`;
  el.innerHTML = `<label class="note-label" for="${id}">Your note</label>
    <textarea id="${id}" maxlength="600" rows="4" placeholder="Write a few lines…" aria-describedby="${id}-status"></textarea>
    <div class="widget-actions"><button type="button" class="chip" data-send>Send by email</button></div>
    <p class="widget-fine" id="${id}-status" role="status" data-status>Opens in your email app.</p>`;
  const text = el.querySelector("textarea")!;
  const send = el.querySelector<HTMLButtonElement>("[data-send]")!;
  const status = el.querySelector<HTMLElement>("[data-status]")!;
  const sync = () => {
    send.disabled = !text.value.trim();
    getGarden()?.setPostbox(send.disabled ? "idle" : "writing");
  };
  text.value = draft;
  sync();
  text.addEventListener("input", () => { draft = text.value; sync(); });
  send.addEventListener("click", () => {
    if (!draft.trim()) return;
    const link = document.createElement("a");
    link.href = `mailto:${email}?subject=${encodeURIComponent(translate("From the garden"))}&body=${encodeURIComponent(draft)}`;
    link.click();
    status.textContent = "Email draft opened. Send it from your email app.";
  });
  return () => { draft = text.value; getGarden()?.setPostbox("idle"); };
}
