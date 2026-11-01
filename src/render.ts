import { chapters, chapter, cv, email, identity, notebook, posterAlt, timeline } from "./narrative/content.ts";
import { nextChapterId, phaseLabels, phases, posterSrc, POSTER_SIZE, primaryNav, type Action, type Chapter, type ChapterId } from "./narrative/model.ts";

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const e = escapeHtml;

const external = (href: string) => /^https?:/.test(href);
const icon = (glyph: string) => `<span class="action-icon" aria-hidden="true">${glyph}</span>`;
/** Locale-dependent destinations keep the English href for no-JS and
 * Arabic; src/narrative/localized-links.ts swaps in data-href-fr for French. */
const localized = (a: { href: string; hrefFr?: string }) =>
  a.hrefFr ? ` hreflang="en" data-href-en="${e(a.href)}" data-href-fr="${e(a.hrefFr)}"` : "";

export function renderAction(a: Action, className = "action") {
  const classes = `${className} action-${a.type}${a.primary ? " action-primary" : ""}`;
  if (external(a.href)) {
    return `<a class="${classes}" href="${e(a.href)}" target="_blank" rel="noopener">${e(a.label)}${icon("↗")}<span class="sr-only"> (opens in a new tab)</span></a>`;
  }
  const glyph = a.type === "section" ? "↓" : a.type === "download" ? "↓" : a.type === "case" ? "→" : "";
  const pdf = a.type === "download" ? ` type="application/pdf"` : "";
  return `<a class="${classes}" href="${e(a.href)}"${localized(a)}${pdf}>${e(a.label)}${glyph ? icon(glyph) : ""}</a>`;
}
const actions = (list: Action[]) => list.length ? `<div class="chapter-actions">${list.map(a => renderAction(a)).join("")}</div>` : "";

/** A poster is described once, by the first chapter that shows it; later
 * chapters with the same still (BP Log, MCQ Scan and About share Build) mark
 * it decorative, so their own text is what a screen reader hears. */
const describedBy = (c: Chapter) => chapters.find(other => other.scene.poster === c.scene.poster)!.id === c.id;

function sceneHost(c: Chapter) {
  const { poster } = c.scene;
  const lazy = c.id === "intro" ? "" : ` loading="lazy"`;
  const alt = describedBy(c) ? e(posterAlt[poster]) : "";
  return `<div class="scene-host" data-scene-host="${c.id}" data-phase="${c.scene.phase}" data-poster="${poster}">
        <img class="scene-poster" src="${posterSrc(poster)}" width="${POSTER_SIZE.width}" height="${POSTER_SIZE.height}" alt="${alt}"${lazy} decoding="async" />
      </div>`;
}

/** Wide layouts (WIDE_LAYOUT_QUERY): one sticky rail beside the whole run of
 * chapters, the single mount point for the live scene. Decorative: the
 * chapter text is the content, and each chapter's own host (hidden on wide
 * layouts) carries the described poster. Without JS it shows the opening
 * sketch; P4 switches its poster and pose by chapter. */
function sceneRail() {
  const poster = chapter("intro").scene.poster;
  return `<aside class="scene-rail" data-scene-host="rail" data-phase="${chapter("intro").scene.phase}" data-poster="${poster}" aria-hidden="true">
        <img class="scene-poster" src="${posterSrc(poster)}" width="${POSTER_SIZE.width}" height="${POSTER_SIZE.height}" alt="" decoding="async" />
      </aside>`;
}

function chapterFoot(c: Chapter) {
  const next = nextChapterId(c.id);
  const link = next
    ? `<a class="next-link" href="#${next}">${e(chapter(next).short)}<span class="action-icon" aria-hidden="true">↓</span></a>`
    : `<a class="next-link" href="#intro">Back to the top<span class="action-icon" aria-hidden="true">↑</span></a>`;
  const steps = phases.map(p => `<li${p === c.scene.phase ? ` aria-current="step"` : ""}>${phaseLabels[p]}</li>`).join("");
  return `<footer class="chapter-foot"><ol class="phase-indicator" aria-label="Construction phase">${steps}</ol>${link}</footer>`;
}

function workIndex() {
  const entries = chapters.filter(c => c.index);
  const item = (c: Chapter) => `<li${c.index!.professional ? ` class="index-professional"` : ""}><a href="#${c.id}"><span class="index-title">${e(c.index!.title)}</span><span class="index-summary">${e(c.index!.summary)}</span></a></li>`;
  return `<nav class="work-index" aria-label="Selected work"><ul>${entries.map(item).join("")}</ul></nav>`;
}

function aboutExtras() {
  const years = timeline.map(t => `<li><p class="timeline-years">${e(t.years)}</p><h3>${e(t.place)}</h3><p>${e(t.text)}</p></li>`).join("");
  const notes = notebook.entries.map(n => `<li><h4>${e(n.title)}</h4><p>${e(n.text)}</p><a href="${e(n.href)}" target="_blank" rel="noopener">${e(n.label)}${icon("↗")}<span class="sr-only"> (opens in a new tab)</span></a></li>`).join("");
  return {
    timeline: `<ol class="timeline" aria-label="Career">${years}</ol>`,
    notebook: `<aside class="notebook" id="workshop" aria-labelledby="workshop-title"><h3 id="workshop-title" tabindex="-1">${e(notebook.heading)}</h3><ul>${notes}</ul></aside>`,
  };
}

/** Which motivation paragraphs precede the scene slot on narrow screens. */
const leadParagraphs: Partial<Record<ChapterId, number>> = { work: 0, about: 1 };

function renderChapter(c: Chapter) {
  const heading = c.id === "intro"
    ? `<h1 id="intro-title" tabindex="-1">${e(c.title)}</h1>`
    : `<h2 id="${c.id}-title" tabindex="-1">${e(c.title)}</h2>`;
  const paragraphs = c.motivation ?? [];
  const split = leadParagraphs[c.id] ?? paragraphs.length;
  const para = (text: string) => `<p class="chapter-motivation">${e(text)}</p>`;
  const lead = [
    c.label ? `<p class="chapter-label">${e(c.label)}</p>` : "",
    heading,
    c.subtitle ? `<p class="chapter-subtitle">${e(c.subtitle)}</p>` : "",
    ...paragraphs.slice(0, split).map(para),
    c.id === "intro" ? actions(c.actions) : "",
  ].join("");
  let body = paragraphs.slice(split).map(para).join("");
  if (c.decision) body += `<div class="chapter-decision"><h3>${e(c.decision.heading)}</h3><p>${e(c.decision.text)}</p></div>`;
  if (c.id === "work") body += workIndex();
  if (c.id === "about") {
    const extras = aboutExtras();
    body += extras.timeline + actions(c.actions) + extras.notebook;
  } else if (c.id !== "intro") {
    body += actions(c.actions);
  }
  if (c.evidence) body += `<p class="evidence-note" data-evidence-kind="${c.evidence.kinds.join(" ")}">${e(c.evidence.text)}</p>`;
  if (c.id === "contact") body += `<p class="contact-email" data-no-translate>${e(email)}</p>`;
  // The #wattch alias lands on this chapter without JavaScript.
  const alias = c.id === "energy-tools" ? `<span class="fragment-alias" id="wattch"></span>` : "";
  return `
    <section id="${c.id}" class="chapter chapter-${c.id}" data-chapter="${c.id}" data-phase="${c.scene.phase}" aria-labelledby="${c.id}-title">${alias}
      <div class="chapter-lead">${lead}</div>
      ${sceneHost(c)}
      <div class="chapter-body">${body}${chapterFoot(c)}</div>
    </section>`;
}

/** Used by Vite's HTML hook in development and production, without a browser. */
export function renderPortfolio() {
  const nav = primaryNav.map(item => `<a href="${item.href}">${e(item.label)}</a>`).join("");
  return `
    <a class="skip-link" href="#intro">Skip to portfolio</a>
    <header class="masthead">
      <a class="owner" href="#intro">${e(identity.name)}</a>
      <nav class="primary-nav" aria-label="Sections"><div class="nav-sections">${nav}</div><a class="cv-link" href="${cv.en}" type="application/pdf" hreflang="en" data-href-en="${cv.en}" data-href-fr="${cv.fr}">CV</a></nav>
      <label class="language-picker"><span class="sr-only">Language</span><select data-language aria-label="Language"><option value="en" lang="en" data-no-translate>EN</option><option value="fr" lang="fr" data-no-translate>FR</option><option value="ar" lang="ar" data-no-translate>AR</option></select></label>
    </header>
    <main id="portfolio" class="narrative">${chapters.map(renderChapter).join("")}
      ${sceneRail()}
    </main>`;
}
