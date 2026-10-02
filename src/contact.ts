import { email } from "./content";
import { translate } from "./i18n";
import type { Garden } from "./scene";

// The draft lives only in this document's memory, never browser storage.
let draft = "";
let sequence = 0;
export function mountContact(el: HTMLElement, getGarden: () => Garden | undefined) {
  const id = `note-${++sequence}`;
  el.innerHTML = `<h3>Leave a note</h3><label class="note-label" for="${id}">Your note</label>
    <textarea id="${id}" maxlength="600" rows="4" aria-describedby="${id}-count"></textarea>
    <p class="note-count" id="${id}-count"><span>0</span> of 600 characters</p>
    <div class="widget-actions"><button type="button" class="chip" data-send>Open email draft</button><button type="button" class="chip" data-copy>Copy address</button><button type="button" class="chip" data-copy-note>Copy note</button></div>
    <p class="contact-address">Email: <a href="mailto:${email}" data-no-translate>${email}</a></p><p class="widget-fine">This opens your email app. Nothing is sent by this page. Your draft stays here until you reload; it is never saved to storage.</p><p class="widget-fine" role="status" data-copy-status></p>`;
  const text = el.querySelector("textarea")!;
  const send = el.querySelector<HTMLButtonElement>("[data-send]")!;
  const copy = el.querySelector<HTMLButtonElement>("[data-copy]")!;
  const copyNote = el.querySelector<HTMLButtonElement>("[data-copy-note]")!;
  const status = el.querySelector<HTMLElement>("[data-copy-status]")!;
  let mounted = true;
  const sync = () => {
    el.querySelector(".note-count span")!.textContent = String(text.value.length);
    send.disabled = !text.value.trim();
    copyNote.disabled = send.disabled;
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
    status.textContent = "Email draft requested. Send it from your email app. If it did not open, copy your note and address.";
  });
  async function copyValue(note: boolean) {
    try {
      await navigator.clipboard.writeText(note ? text.value : email);
      if (!mounted) return;
      status.textContent = note ? "Note copied." : "Address copied.";
    } catch {
      if (!mounted) return;
      const target = note ? text : el.querySelector<HTMLElement>(".contact-address a")!;
      if (note) { text.focus(); text.select(); }
      else { target.focus(); getSelection()?.selectAllChildren(target); }
      status.textContent = note ? "Copy is unavailable. Your note is selected; copy it manually." : "Copy is unavailable. The email address is selected; copy it manually.";
    }
  }
  copy.addEventListener("click", () => void copyValue(false));
  copyNote.addEventListener("click", () => void copyValue(true));
  return () => { mounted = false; draft = text.value; getGarden()?.setPostbox("idle"); };
}
