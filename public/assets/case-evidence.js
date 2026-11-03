// Case-study evidence (Whisperbook and Wattch case pages). Progressive
// enhancement over static HTML that reads fine without it:
// - figures: each image is a plain link to its file; here it opens a modal
//   <dialog> at fit size, with Actual size / Fit image / Close and Escape;
// - Inside Whisperbook: the four-step list becomes a step-through (Back,
//   Next, Close, a polite count); with reduced motion all steps show at once;
// - Listen: two lines read by the visitor's own on-device voice in the page
//   language. Nothing auto-plays; leaving or hiding the page stops it.
// One script serves both languages: labels follow <html lang>.
(() => {
  "use strict";
  const lang = (document.documentElement.lang || "en").toLowerCase().split("-")[0] === "fr" ? "fr" : "en";
  const T = {
    en: {
      actual: "Actual size", fit: "Fit image", close: "Close",
      start: "Step inside", back: "Back", next: "Next",
      count: (n, total, title) => `Step ${n} of ${total}: ${title}`,
      listen: "Listen", stop: "Stop",
      looking: "Looking for a voice on this device…",
      noSynth: "This browser does not offer speech synthesis, so the excerpt cannot be played here.",
      noVoice: "This browser has no on-device English voice, so the excerpt cannot be played here.",
      voice: (who, name) => `${who} · ${name}`,
      ready: n => n === 1 ? "One voice on this device. Read by your device. Nothing leaves this page." : "Read by your device. Nothing leaves this page.",
    },
    fr: {
      actual: "Taille réelle", fit: "Adapter l’image", close: "Fermer",
      start: "Entrer", back: "Précédent", next: "Suivant",
      count: (n, total, title) => `Étape ${n} sur ${total} : ${title}`,
      listen: "Écouter", stop: "Arrêter",
      looking: "Recherche d’une voix sur cet appareil…",
      noSynth: "Ce navigateur ne propose pas la synthèse vocale : l’extrait ne peut pas être lu ici.",
      noVoice: "Ce navigateur ne dispose d’aucune voix locale en français : l’extrait ne peut pas être lu ici.",
      voice: (who, name) => `${who} · ${name}`,
      ready: n => n === 1 ? "Une voix disponible sur cet appareil. Lecture locale. Rien ne quitte cette page." : "Lecture par votre appareil. Rien ne quitte cette page.",
    },
  }[lang];
  const reducedMotion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const host = () => document.querySelector(".portfolio-site") || document.body;
  const button = (label, className) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `case-button ${className}`;
    b.textContent = label;
    return b;
  };

  /* Enlargement ------------------------------------------------------- */
  function setupZoom() {
    const links = [...document.querySelectorAll("a[data-case-zoom]")];
    if (!links.length || typeof HTMLDialogElement !== "function") return;
    const dialog = document.createElement("dialog");
    dialog.className = "case-lightbox";
    dialog.dataset.size = "fit";
    dialog.setAttribute("aria-labelledby", "case-lightbox-caption");
    const bar = document.createElement("div");
    bar.className = "case-lightbox__bar";
    const size = button(T.actual, "case-lightbox__size");
    const close = button(T.close, "case-lightbox__close");
    bar.append(size, close);
    const frame = document.createElement("div");
    frame.className = "case-lightbox__frame";
    frame.tabIndex = 0;
    frame.setAttribute("role", "group");
    const img = document.createElement("img");
    img.decoding = "async";
    frame.append(img);
    const caption = document.createElement("p");
    caption.className = "case-lightbox__caption";
    caption.id = "case-lightbox-caption";
    dialog.append(bar, frame, caption);
    host().append(dialog);
    let opener = null;

    const setSize = mode => {
      dialog.dataset.size = mode;
      size.textContent = mode === "actual" ? T.fit : T.actual;
      frame.scrollTo(0, 0);
    };
    const open = link => {
      const source = link.querySelector("img");
      opener = link;
      img.src = link.getAttribute("href");
      img.alt = source?.alt ?? "";
      if (source?.getAttribute("width")) img.width = Number(source.getAttribute("width"));
      if (source?.getAttribute("height")) img.height = Number(source.getAttribute("height"));
      frame.setAttribute("aria-label", img.alt);
      caption.textContent = link.closest("figure")?.querySelector("figcaption")?.textContent.trim() || img.alt;
      setSize("fit");
      dialog.showModal();
      close.focus();
    };
    links.forEach(link => {
      link.setAttribute("aria-haspopup", "dialog");
      link.addEventListener("click", e => {
        // Modified clicks keep the link's own behaviour (open the file).
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(link);
      });
    });
    size.addEventListener("click", () => setSize(dialog.dataset.size === "actual" ? "fit" : "actual"));
    close.addEventListener("click", () => dialog.close());
    // A click on the backdrop (the dialog box itself, outside its content) closes.
    dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
    // Escape fires `cancel` then `close`; every way out returns focus to the opener.
    dialog.addEventListener("close", () => {
      img.removeAttribute("src");
      const back = opener;
      opener = null;
      back?.focus();
    });
  }

  /* Inside Whisperbook -------------------------------------------------- */
  function setupInside() {
    document.querySelectorAll("[data-case-inside]").forEach(box => {
      const list = box.querySelector("ol");
      if (!list) return;
      const items = [...list.children];
      const start = button(T.start, "case-inside__start");
      start.setAttribute("aria-expanded", "false");
      start.setAttribute("aria-controls", list.id);
      const controls = document.createElement("div");
      controls.className = "case-inside__controls";
      const back = button(T.back, "case-inside__back");
      const count = document.createElement("span");
      count.className = "case-inside__count";
      count.setAttribute("aria-live", "polite");
      const next = button(T.next, "case-inside__next");
      const close = button(T.close, "case-inside__close");
      controls.append(back, count, next, close);
      list.before(start);
      list.after(controls);
      let step = null;
      const last = items.length - 1;

      const show = (to, focus) => {
        step = to;
        const open = step !== null;
        const all = open && reducedMotion.matches;
        box.dataset.state = open ? (all ? "all" : "stepping") : "closed";
        start.hidden = open;
        start.setAttribute("aria-expanded", String(open));
        list.hidden = !open;
        controls.hidden = !open;
        items.forEach((li, i) => {
          li.hidden = open && !all && i !== step;
          if (open && !all && i === step) li.setAttribute("aria-current", "step");
          else li.removeAttribute("aria-current");
        });
        back.hidden = all;
        back.disabled = step === 0;
        next.hidden = all || step === last;
        const title = open && !all ? items[step].querySelector("strong")?.textContent ?? "" : "";
        count.textContent = open && !all ? T.count(step + 1, items.length, title) : "";
        if (!focus) return;
        const target = !open ? start : all || step === last ? close : next.disabled ? close : next;
        target.focus({ preventScroll: true });
      };
      start.addEventListener("click", () => show(0, true));
      next.addEventListener("click", () => show(Math.min(last, (step ?? 0) + 1), true));
      back.addEventListener("click", () => {
        show(Math.max(0, (step ?? 0) - 1), false);
        (step === 0 ? next : back).focus({ preventScroll: true });
      });
      close.addEventListener("click", () => show(null, true));
      box.addEventListener("keydown", e => {
        if (e.key === "Escape" && step !== null) { e.preventDefault(); show(null, true); }
      });
      show(null, false);
    });
  }

  /* Listen ---------------------------------------------------------------- */
  function localVoices(synth) {
    const pick = () => synth.getVoices().filter(v => v.localService && v.lang.toLowerCase().split(/[-_]/)[0] === lang);
    if (synth.getVoices().length) return Promise.resolve(pick());
    // Chrome fills the list late: wait for it once before deciding.
    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer);
        synth.removeEventListener?.("voiceschanged", done);
        resolve(pick());
      };
      const timer = setTimeout(done, 1500);
      synth.addEventListener?.("voiceschanged", done);
    });
  }
  function setupListen() {
    const box = document.querySelector("[data-case-listen]");
    if (!box) return;
    const play = box.querySelector(".case-listen__play");
    const icon = box.querySelector(".case-listen__icon");
    const text = box.querySelector(".case-listen__text");
    const status = box.querySelector(".case-listen__voice");
    const lines = [...box.querySelectorAll(".case-listen__lines li")];
    const synth = "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null;
    play.disabled = true;
    if (!synth) {
      box.dataset.state = "unavailable";
      status.textContent = T.noSynth;
      return;
    }
    box.dataset.state = "searching";
    status.textContent = T.looking;
    let voices = [];
    let playing = false;
    let run = 0; // events from a cancelled run are ignored
    const lineText = li => (li.querySelector("q") ?? li).textContent.trim();
    const show = i => {
      lines.forEach((li, j) => li.toggleAttribute("data-speaking", playing && j === i));
      const voice = voices[i] ?? voices[0];
      if (voice) status.textContent = T.voice(lines[i].dataset.who, voice.name);
    };
    const setPlaying = on => {
      playing = on;
      box.dataset.state = on ? "playing" : "ready";
      icon.textContent = on ? "■" : "▶";
      text.textContent = on ? T.stop : T.listen;
      play.setAttribute("aria-label", on ? T.stop : T.listen);
    };
    const stop = () => {
      synth.cancel();
      if (!playing) return;
      run++;
      setPlaying(false);
      show(0);
    };
    const start = () => {
      synth.cancel();
      const id = ++run;
      setPlaying(true);
      const narrator = voices[0];
      const second = voices[1] ?? voices[0];
      lines.forEach((li, i) => {
        const u = new SpeechSynthesisUtterance(lineText(li));
        u.voice = i === 0 ? narrator : second;
        u.lang = u.voice.lang;
        // With a single voice, Alice speaks higher than the narrator.
        if (i > 0 && second === narrator) u.pitch = 1.5;
        u.onstart = () => { if (id === run) show(i); };
        u.onerror = () => { if (id === run) stop(); };
        if (i === lines.length - 1) u.onend = () => { if (id === run) stop(); };
        synth.speak(u);
      });
      show(0);
    };
    play.addEventListener("click", () => (playing ? stop() : start()));
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
    window.addEventListener("pagehide", stop);
    // A link that leaves this page stops the excerpt at once.
    document.addEventListener("click", e => {
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!link || link.hasAttribute("data-case-zoom")) return;
      const to = new URL(link.href, location.href);
      if (to.origin === location.origin && to.pathname === location.pathname && to.search === location.search && to.hash) return;
      stop();
    }, true);
    localVoices(synth).then(found => {
      voices = found.slice(0, 2);
      if (!voices.length) {
        box.dataset.state = "unavailable";
        status.textContent = T.noVoice;
        return;
      }
      play.disabled = false;
      setPlaying(false);
      show(0);
      status.textContent = `${status.textContent}. ${T.ready(voices.length)}`;
    });
  }

  setupZoom();
  setupInside();
  setupListen();
})();
