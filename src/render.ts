import { beats, projects, email } from "./content";

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Used by Vite's HTML hook in development and production, without a browser. */
export function renderPortfolio() {
  const e = escapeHtml;
  const career = beats.filter(b => b.stage === 1 && b.path !== undefined).reverse();
  return `
    <a class="skip-link" href="#intro">Skip to portfolio</a>
    <header class="masthead">
      <a class="owner" href="#intro">Chakib Belgaid</a>
      <nav aria-label="Sections"><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
      <a class="view-switch script-only" href="?view=read" data-view="read">Read portfolio</a>
    </header>
    <main id="portfolio" class="portfolio">
      <section id="intro" class="reading-intro" aria-labelledby="intro-title">
        <div class="intro-copy"><p class="eyebrow">A living notebook</p>
          <h1 id="intro-title" tabindex="-1">Chakib Belgaid</h1>
          <p class="reading-lede">${e(beats[0].copy)}</p>
          <div class="entry-actions"><a class="primary-action" href="#work">Selected work</a><a class="script-only" href="?view=garden" data-view="garden">Explore the garden</a></div>
          <p class="project-shortcuts"><a href="#whisperbook">Whisperbook</a> · <a href="#wattch">Wattch Core</a></p>
        </div>
        <div class="garden-preview" id="garden-preview">
          <div class="preview-frame" id="preview-frame"><img class="static-garden" src="/assets/garden-preview.png" width="1440" height="900" alt="The notebook garden in autumn, with a reading pavilion, energy observatory, atelier, and greenhouse." fetchpriority="low" /></div>
          <p class="preview-caption">An idea, drawn and brought to life.</p>
          <div id="preview-tools"></div>
        </div>
      </section>
      <section id="work" class="reading-section" aria-labelledby="work-title">
        <p class="eyebrow">Selected work</p><h2 id="work-title" tabindex="-1">The boundaries matter</h2>
        <p>${e(beats.find(b => b.stage === 2 && !b.spot)!.copy)}</p>
        <nav class="project-shortcuts" aria-label="Selected projects"><a href="#whisperbook">Whisperbook</a><a href="#wattch">Wattch Core</a></nav>
        ${Object.entries(projects).map(([id, p]) => `
          <article class="reading-project" id="${id}" aria-labelledby="${id}-title">
            <div class="project-copy"><p class="eyebrow">${e(p.field)}</p><h3 id="${id}-title" tabindex="-1">${e(p.title)}</h3>
              <p class="reading-lede">${e(p.lede)}</p><p>${e(p.intro)}</p>
              <h4>What I built</h4><p>${e(p.built)}</p><h4>The decision that shaped it</h4><p>${e(p.decision)}</p>
              <p class="project-tech">${e(p.tech.join(" · "))}</p><a class="source-link" href="${p.url}" target="_blank" rel="noopener noreferrer">Read ${e(p.title)} on GitHub ↗</a>
              <details class="reading-illustration script-only" data-illustration="${id}"><summary>A small browser illustration</summary><p>${e(id === "whisperbook" ? "Hear an excerpt in your browser’s local voice. Whisperbook uses its own on-device narration on Android." : "Watch what drawing this page costs your device: CPU and GPU time, and the estimated carbon of that work. Enable the garden preview to measure it.")}</p><div data-reading-widget="${id}"></div></details>
            </div>
            <figure class="reading-proof proof-${id}"><a href="${p.image}" data-evidence="${id}" aria-label="View full screenshot of ${e(p.title)}"><img src="${p.image}" width="${p.size[0]}" height="${p.size[1]}" alt="${e(p.alt)}" loading="lazy" decoding="async" /></a>
              <figcaption>${e(p.caption)} <a href="${p.image}" data-evidence="${id}">View full screenshot</a></figcaption>
            </figure>
          </article>`).join("")}
      </section>
      <section class="reading-section" id="about" aria-labelledby="about-title"><p class="eyebrow">Current work and background</p><h2 id="about-title" tabindex="-1">${e(beats[1].title)}</h2><p>${e(beats[1].copy)}</p>
        <ol class="career-list">${career.map(b => `<li><p class="eyebrow">${e(b.label!)}</p><h3>${e(b.title)}</h3><p>${e(b.copy)}</p></li>`).join("")}</ol>
      </section>
      <section class="reading-section reading-contact" id="contact" aria-labelledby="contact-title"><p class="eyebrow">Write to me</p><h2 id="contact-title" tabindex="-1">I’d like to hear what you’re building.</h2>
        <p class="note-email"><a href="mailto:${email}">${email}</a></p><div class="note-widget script-only" data-contact-read></div>
        <p class="note-links"><a href="https://github.com/chakib-belgaid" target="_blank" rel="noopener noreferrer">GitHub</a> · <a href="https://www.linkedin.com/in/chakib-belgaid" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>
      </section>
    </main>`;
}
