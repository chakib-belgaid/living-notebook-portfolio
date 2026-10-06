import { beats, projects, contactMarkup, scrollCue, insideMarkup } from "./content";

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Used by Vite's HTML hook in development and production, without a browser. */
export function renderPortfolio() {
  const e = escapeHtml;
  const career = beats.filter(b => b.stage === 1 && b.path !== undefined).reverse();
  // "Role, Organisation": the organisation reads as a second, quieter line.
  const role = (title: string) => {
    const [name, org] = title.split(/, (.+)/);
    return org ? `${e(name)}<span class="career-comma">, </span><span class="career-org">${e(org)}</span>` : e(title);
  };
  const workCopy = beats.find(b => b.stage === 2 && !b.spot)!.copy;
  return `
    <a class="skip-link" href="#intro">Skip to portfolio</a>
    <header class="masthead">
      <a class="owner" href="#intro">Chakib Belgaid</a>
      <nav aria-label="Sections"><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
      <a class="view-switch script-only" href="?view=read" data-view="read">Read portfolio</a>
      <label class="language-picker script-only"><span class="sr-only">Language</span><select data-language aria-label="Language"><option value="en" lang="en" data-no-translate>EN</option><option value="fr" lang="fr" data-no-translate>FR</option><option value="ar" lang="ar" data-no-translate>العربية</option></select></label>
      <div class="read-ruler script-only" aria-hidden="true"><span class="read-fill"></span>${["intro", "work", "about", "contact"].map(id => `<i data-at="${id}"></i>`).join("")}</div>
    </header>
    <main id="portfolio" class="portfolio">
      <section id="intro" class="reading-intro" data-stop="sketch" aria-labelledby="intro-title">
        <div class="intro-copy stop-card"><p class="eyebrow">A living notebook</p>
          <h1 id="intro-title" tabindex="-1">Chakib Belgaid</h1>
          <p class="reading-lede">${e(beats[0].copy)}</p>
          <p class="stop-line">Product engineer, Ph.D. AI products, developer tools, and how we measure the energy software uses.</p>
          <div class="entry-actions"><a class="primary-action" href="#work">Selected work</a><a class="script-only journey-hidden" href="?view=garden" data-view="garden">Explore the garden</a><a class="script-only journey-only" href="?view=read" data-view="read">Read as a page</a></div>
          <p class="journey-only journey-hint scroll-cue">${scrollCue}<span>Scroll to explore the garden and projects.</span></p>
          <p class="project-shortcuts"><a href="#whisperbook">Whisperbook</a> · <a href="#wattch">Wattch Core</a></p>
        </div>
        <div class="garden-preview" id="garden-preview">
          <div class="preview-frame" id="preview-frame"><img class="static-garden" src="/assets/garden-preview.webp" width="1440" height="900" alt="The notebook garden in autumn, with a reading pavilion, energy observatory, atelier, and greenhouse." loading="lazy" fetchpriority="low" /></div>
          <p class="preview-caption">An idea, drawn and brought to life.</p>
          <div id="preview-tools"></div>
        </div>
      </section>
      <section id="work" class="reading-section" aria-labelledby="work-title">
        <div class="work-opener" data-stop="build">
          <div class="stop-card"><p class="eyebrow">Selected work</p><h2 id="work-title" tabindex="-1">The boundaries matter</h2>
            <p class="work-copy">${e(workCopy)}</p>
            <p class="stop-line">${e(workCopy.split(". ").slice(0, 2).join(". "))}.</p>
          </div>
          <nav class="project-shortcuts project-index" aria-label="Selected projects">${Object.entries(projects).map(([id, p], i) => `<a href="#${id}"><span class="index-number">0${i + 1}</span><span class="index-title">${e(p.title)}</span><span class="index-field">${e(p.field)}</span></a>`).join("")}</nav>
        </div>
        ${Object.entries(projects).map(([id, p]) => `
          <article class="reading-project" id="${id}" data-stop="${id}" aria-labelledby="${id}-title">
            <div class="project-copy">
              <div class="stop-card"><p class="eyebrow">${e(p.field)}</p><h3 id="${id}-title" tabindex="-1">${e(p.title)}</h3>
                <p class="reading-lede">${e(p.lede)}</p></div>
              <div class="stop-detail" data-detail="${id}"><p>${e(p.intro)}</p>
                <h4>Project status</h4><p>${e(p.status)}</p><h4>Outcome</h4><p>${e(p.outcome)}</p><h4>Scope and limits</h4><p>${e(p.limits)}</p>
                <h4>What I built</h4><p>${e(p.built)}</p>${id === "whisperbook" ? insideMarkup("page", "h4", false) : ""}<h4>The decision that shaped it</h4><p>${e(p.decision)}</p>
                <p class="project-tech">${e(p.tech.join(" · "))}</p><a class="source-link" href="${p.url}" target="_blank" rel="noopener noreferrer">Read ${e(p.title)} on GitHub ↗</a>
                <details class="reading-illustration script-only" data-illustration="${id}"><summary>${id === "whisperbook" ? "Hear a passage in your browser" : "Measure what drawing this page costs"}</summary><p>${e(id === "whisperbook" ? "Hear an excerpt in your browser’s local voice. Whisperbook uses its own on-device narration on Android." : "Watch what drawing this page costs your device: CPU and GPU time, and the estimated carbon of that work. Enable the garden preview to measure it.")}</p><div data-reading-widget="${id}"></div></details>
              </div>
            </div>
            <figure class="reading-proof proof-${id}" data-detail="${id}"><a href="${p.image}" data-evidence="${id}" aria-label="View full screenshot of ${e(p.title)}"><img src="${p.image}" width="${p.size[0]}" height="${p.size[1]}" alt="${e(p.alt)}" loading="lazy" decoding="async" /></a>
              <figcaption>${e(p.caption)} <a href="${p.image}" data-evidence="${id}">View full screenshot</a></figcaption>
            </figure>
          </article>`).join("")}
      </section>
      <section class="reading-section" id="about" data-stop="blueprint" aria-labelledby="about-title">
        <div class="stop-card"><p class="eyebrow">Current work and background</p><h2 id="about-title" tabindex="-1">${e(beats[1].title)}</h2></div>
        <div class="stop-detail" data-detail="about"><p>${e(beats[1].copy)}</p>
          <ol class="career-list">${career.map(b => `<li><p class="eyebrow">${e(b.label!)}</p><h3>${role(b.title)}</h3><p>${e(b.copy)}</p></li>`).join("")}</ol>
        </div>
      </section>
      <section class="reading-section reading-contact" id="contact" data-stop="bloom" aria-labelledby="contact-title">
        <div class="stop-card"><p class="eyebrow">Write to me</p><h2 id="contact-title" tabindex="-1">I’d like to hear what you’re building.</h2>
          ${contactMarkup}
        </div>
        <p class="sign-off"><a href="#intro">Back to the top ↑</a></p>
      </section>
    </main>`;
}
