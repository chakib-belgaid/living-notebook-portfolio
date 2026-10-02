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
    <div class="widget-actions"><button type="button" class="chip" data-send>Send by email</button><button type="button" class="chip" data-copy>Copy address</button></div>
    <p class="widget-fine">This opens your email app. Nothing is sent by this page. Your draft stays here until you reload; it is never saved to storage.</p><p class="widget-fine" role="status" data-copy-status></p>`;
  const text = el.querySelector("textarea")!;
  const send = el.querySelector<HTMLButtonElement>("[data-send]")!;
  const copy = el.querySelector<HTMLButtonElement>("[data-copy]")!;
  let timer = 0;
  let mounted = true;
  const sync = () => {
    el.querySelector(".note-count span")!.textContent = String(text.value.length);
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
    getGarden()?.setPostbox("sent");
  });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(email);
      if (!mounted) return;
      copy.textContent = "Copied";
      clearTimeout(timer);
      timer = window.setTimeout(() => copy.textContent = "Copy address", 2000);
    } catch {
      if (!mounted) return;
      const address = el.closest("section")?.querySelector(".note-email a");
      if (address) getSelection()?.selectAllChildren(address);
      el.querySelector("[data-copy-status]")!.textContent = `Copy isn’t available. Select the address above: ${email}`;
    }
  });
  return () => { mounted = false; draft = text.value; clearTimeout(timer); getGarden()?.setPostbox("idle"); };
}
