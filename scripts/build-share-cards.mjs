// Builds the self-hosted social share cards for the three case studies
// (product decision 66): public/assets/social/<slug>-<lang>.png, 1200×630,
// one per case page and language. The case pages point their og:image and
// twitter:image at these files.
//
//   npm run share-cards            render the six cards, then validate them
//   npm run share-cards -- --check validate the committed cards only
//
// The wording comes from the case pages themselves (the source of truth):
// the section label, the hero <h1> and the hero summary of
// public/work/<slug>/index.html and public/fr/work/<slug>/index.html, each
// card in its page's language. When the summary does not fit on two lines,
// the page's own meta description is tried, then the longest run of whole
// clauses (up to a comma) of the description, then of the summary, that
// fits, marked with an ellipsis.
//
// The visual identity is the current page's (decisions 63 and 64): the fixed
// navy paper, ink and muted tokens of src/style.css, Newsreader from
// fonts-src (the upstream files, since the served ones are trimmed to the
// page's own sizes; embedded as data URLs, no network), a system sans for the
// small label line as the page's controls use. Evidence images are the
// project's own screenshots, shown whole; MCQ Scan has none (internal client
// work), so its card sits on the site's own rendered night still. No
// generated imagery, no logos, no device frames.
//
// Validation (always runs; alone with --check): each PNG's IHDR must say
// 1200×630, the file must stay under the size budget, and a contact sheet of
// all six is written to .qa/share-cards/sheet.png for visual review. During
// rendering, every card also asserts that no text overflows its box, leaves
// the card, overlaps the author line or is set under 22 px.
import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/assets/social');
const qa = join(root, '.qa/share-cards');
const W = 1200;
const H = 630;
const BUDGET = 300 * 1024;
const checkOnly = process.argv.includes('--check');

// Tokens from src/style.css (:root) and src/narrative/style.css (--sans).
const T = {
  paper: '#0e2b48',
  ink: '#e6f0f8',
  muted: '#a9c2d8',
  accent: '#d8c6a6',
  hairline: 'rgba(230, 240, 248, 0.15)',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
};

const CASES = [
  {
    slug: 'whispbook',
    evidence: {
      kind: 'portrait',
      file: 'public/assets/projects/whisperbook/now-playing.webp',
      width: 941,
      height: 1672,
    },
  },
  {
    slug: 'wattch',
    evidence: {
      kind: 'wide',
      file: 'public/assets/projects/wattch/energy-tests.png',
      width: 1440,
      height: 900,
      caption: {
        en: 'Synthetic deterministic demo run',
        fr: 'Exécution de démonstration déterministe synthétique',
      },
    },
  },
  {
    slug: 'mcq-scan',
    evidence: {
      kind: 'backdrop',
      file: 'public/assets/stills/wide/build.webp',
      width: 1440,
      height: 900,
    },
  },
];
const LANGS = ['en', 'fr'];
const AUTHOR = 'Chakib Belgaid · chakib-belgaid.github.io';

const cards = CASES.flatMap((c) => LANGS.map((lang) => ({ ...c, lang })));
const cardPath = (c) => join(out, `${c.slug}-${c.lang}.png`);

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function pick(html, re, what, file) {
  const m = html.match(re);
  if (!m) throw new Error(`${file}: no ${what}`);
  return decode(m[1]);
}

async function pageContent(slug, lang) {
  const rel = `public/${lang === 'fr' ? 'fr/' : ''}work/${slug}/index.html`;
  const html = await readFile(join(root, rel), 'utf8');
  return {
    source: rel,
    label: pick(html, /class="portfolio-section-label">([^<]*)</, 'section label', rel),
    title: pick(html, /<h1[^>]*>(.*?)<\/h1>/s, 'h1', rel),
    summary: pick(html, /class="portfolio-case-hero__summary">(.*?)<\/p>/s, 'hero summary', rel),
    description: pick(html, /<meta name="description" content="([^"]*)"/, 'meta description', rel),
  };
}

async function dataUrl(rel, type) {
  const bytes = await readFile(join(root, rel));
  return `data:${type};base64,${bytes.toString('base64')}`;
}

const mime = (file) => (file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : 'image/jpeg');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function template({ fonts, content, card, image }) {
  const ev = card.evidence;
  const pad = 72;
  let evidenceHtml = '';
  let textRight = pad; // right edge of the text column, from the card's right
  if (ev.kind === 'portrait') {
    // The whole phone screenshot, letterboxed on the right.
    const h = H - 2 * 40;
    const w = Math.round((h * ev.width) / ev.height);
    evidenceHtml = `<img class="evidence" src="${image}" alt="" style="right:${pad}px;top:40px;width:${w}px;height:${h}px">`;
    textRight = pad + w + 64;
  } else if (ev.kind === 'wide') {
    // The whole screenshot on the right, with its provenance caption.
    const w = 476;
    const h = Math.round((w * ev.height) / ev.width);
    evidenceHtml = `<figure class="wide" style="right:${pad - 8}px;width:${w}px">
      <img class="evidence" src="${image}" alt="" style="position:static;width:${w}px;height:${h}px">
      <figcaption class="caption">${esc(ev.caption[card.lang])}</figcaption>
    </figure>`;
    textRight = pad - 8 + w + 56;
  } else {
    // The site's own night still as a quiet backdrop; the house sits right.
    const w = 1000;
    const h = Math.round((w * ev.height) / ev.width);
    evidenceHtml = `<img class="backdrop" src="${image}" alt="" style="left:${W - w + 20}px;top:-24px;width:${w}px;height:${h}px">`;
    textRight = 600;
  }
  return `<!doctype html><html lang="${card.lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:"Newsreader";font-style:normal;font-weight:200 800;src:url(${fonts.normal}) format("woff2")}
@font-face{font-family:"Newsreader";font-style:italic;font-weight:200 800;src:url(${fonts.italic}) format("woff2")}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${T.paper}}
body{position:relative;color:${T.ink};font-family:"Newsreader",Georgia,serif;font-optical-sizing:auto;-webkit-font-smoothing:antialiased}
.backdrop{position:absolute;opacity:.62;-webkit-mask-image:linear-gradient(to right,transparent 0,#000 34%),linear-gradient(to bottom,transparent 0,#000 14%,#000 70%,transparent 100%);-webkit-mask-composite:source-in;mask-composite:intersect}
.evidence{position:absolute;display:block;border-radius:10px;border:1px solid ${T.hairline}}
.wide{position:absolute;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:14px}
.caption{font-family:${T.sans};font-size:22px;line-height:1.3;color:${T.muted}}
.col{position:absolute;left:${pad}px;right:${textRight}px;top:56px;bottom:128px;display:flex;flex-direction:column;justify-content:center}
.label{font-family:${T.sans};font-size:22px;line-height:1.3;letter-spacing:.02em;color:${T.accent};margin-bottom:22px}
.title{font-weight:400;line-height:1.02;letter-spacing:-.01em;color:${T.ink};margin-bottom:24px;overflow-wrap:break-word}
.summary{font-style:italic;font-weight:400;line-height:1.3;color:${T.muted}}
.author{position:absolute;left:${pad}px;bottom:56px;font-size:24px;line-height:1.2;color:${T.muted};white-space:nowrap}
.rule{position:absolute;left:${pad}px;bottom:100px;width:56px;height:2px;background:${T.accent};opacity:.8}
</style></head><body>
${evidenceHtml}
<div class="col">
  <div class="label">${esc(content.label)}</div>
  <h1 class="title">${esc(content.title)}</h1>
  <p class="summary"></p>
</div>
<div class="rule"></div>
<div class="author">${esc(AUTHOR)}</div>
</body></html>`;
}

// Runs in the card page: sizes the title and the summary, then reports any
// overflow, clipping or text under 22 px.
function fitAndAudit({ summary, description }) {
  const lines = (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
  const fitsWidth = (el) => el.scrollWidth <= el.clientWidth + 1;
  const col = document.querySelector('.col');
  const title = document.querySelector('.title');
  const para = document.querySelector('.summary');

  // Title: as large as possible, one line preferred, never more than two.
  let titleSize = 0;
  for (const maxLines of [1, 2]) {
    for (let s = 112; s >= 64 && !titleSize; s -= 2) {
      title.style.fontSize = `${s}px`;
      if (lines(title) <= maxLines && fitsWidth(title)) titleSize = s;
    }
    if (titleSize) break;
  }
  if (!titleSize) title.style.fontSize = '64px';

  // Summary: two lines at most, at 24 px or more.
  const sizes = [30, 28, 26, 24];
  const tryText = (text) => {
    para.textContent = text;
    for (const s of sizes) {
      para.style.fontSize = `${s}px`;
      if (lines(para) <= 2) return s;
    }
    return 0;
  };
  let chosen = null;
  for (const [source, text] of [['summary', summary], ['description', description]]) {
    const s = tryText(text);
    if (s) {
      chosen = { source, text, size: s };
      break;
    }
  }
  if (!chosen) {
    // Cut at a clause (comma or semicolon): the description first (the page's
    // own short form), then the summary; the longest run of whole clauses
    // that fits, marked with an ellipsis. Cutting the description first keeps
    // a list such as "CLI, Python and VS Code" from being cut after its first
    // item.
    for (const [source, text] of [['description', description], ['summary', summary]]) {
      const clauses = [...text.matchAll(/[,;]/g)]
        .map((m) => `${text.slice(0, m.index).trim()}…`)
        .filter((t) => t.length >= 60)
        .sort((a, b) => b.length - a.length);
      for (const s of [26, 24]) {
        para.style.fontSize = `${s}px`;
        const fit = clauses.find((t) => {
          para.textContent = t;
          return lines(para) <= 2;
        });
        if (fit) {
          chosen = { source: `${source} (trimmed at a clause)`, text: fit, size: s };
          break;
        }
      }
      if (chosen) break;
    }
  }
  if (!chosen) {
    // Last resort: cut the summary at a word boundary.
    const words = summary.split(/\s+/);
    para.style.fontSize = '24px';
    let n = words.length;
    const at = (k) => `${words.slice(0, k).join(' ').replace(/[,;:·—-]+$/, '')}…`;
    while (n > 3) {
      para.textContent = at(n);
      if (lines(para) <= 2) break;
      n -= 1;
    }
    chosen = { source: 'summary (trimmed at a word)', text: at(n), size: 24 };
  }
  para.style.fontSize = `${chosen.size}px`;
  para.textContent = chosen.text;

  // Audit.
  const problems = [];
  const card = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const author = document.querySelector('.author').getBoundingClientRect();
  const texts = [...document.querySelectorAll('.label,.title,.summary,.author,.caption')];
  for (const el of texts) {
    const r = el.getBoundingClientRect();
    const name = el.className;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 22) problems.push(`${name}: ${size}px is under 22px`);
    if (!fitsWidth(el)) problems.push(`${name}: overflows its width`);
    if (r.left < card.left || r.top < card.top || r.right > card.right || r.bottom > card.bottom) {
      problems.push(`${name}: leaves the card`);
    }
    if (el.closest('.col') && r.bottom > author.top - 24) problems.push(`${name}: runs into the author line`);
  }
  const c = col.getBoundingClientRect();
  if (col.scrollHeight > col.clientHeight + 1) problems.push('text column overflows vertically');
  for (const el of col.children) {
    const r = el.getBoundingClientRect();
    if (r.top < c.top - 1 || r.bottom > c.bottom + 1) problems.push(`${el.className}: clipped by the column`);
  }
  for (const img of document.querySelectorAll('img')) {
    if (!img.complete || !img.naturalWidth) problems.push('an evidence image did not load');
    const r = img.getBoundingClientRect();
    if (!img.classList.contains('backdrop') && (r.left < 0 || r.top < 0 || r.right > card.right || r.bottom > card.bottom)) {
      problems.push('the evidence image is cropped by the card');
    }
  }
  if (lines(title) > 2) problems.push('title runs over two lines');
  if (lines(para) > 2) problems.push('summary runs over two lines');
  return {
    titleSize: parseFloat(title.style.fontSize),
    titleLines: lines(title),
    summary: chosen,
    summaryLines: lines(para),
    problems,
  };
}

function pngSize(bytes) {
  const sig = '89504e470d0a1a0a';
  if (bytes.subarray(0, 8).toString('hex') !== sig || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('not a PNG');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function render(browser) {
  await mkdir(out, { recursive: true });
  const fonts = {
    normal: await dataUrl('fonts-src/newsreader-normal.woff2', 'font/woff2'),
    italic: await dataUrl('fonts-src/newsreader-italic.woff2', 'font/woff2'),
  };
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const card of cards) {
    const content = await pageContent(card.slug, card.lang);
    const image = await dataUrl(card.evidence.file, mime(card.evidence.file));
    await page.setContent(template({ fonts, content, card, image }), { waitUntil: 'load' });
    await page.evaluate(async () => {
      // Load both faces explicitly: the italic is only used once the summary
      // is filled in, after this point.
      await Promise.all([document.fonts.load('400 40px Newsreader'), document.fonts.load('italic 400 40px Newsreader')]);
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode()));
    });
    const fontsOk = await page.evaluate(
      () => document.fonts.size === 2 && [...document.fonts].every((f) => f.status === 'loaded'),
    );
    const report = await page.evaluate(fitAndAudit, content);
    if (!fontsOk) report.problems.push('Newsreader did not load');
    if (report.problems.length) {
      await page.screenshot({ path: join(qa, `failed-${card.slug}-${card.lang}.png`) });
      throw new Error(`${card.slug}-${card.lang}: ${report.problems.join('; ')}`);
    }
    await page.screenshot({ path: cardPath(card), type: 'png' });
    console.log(
      `${card.slug}-${card.lang}: title ${report.titleSize}px/${report.titleLines} line(s); ` +
        `${report.summary.source} ${report.summary.size}px/${report.summaryLines} line(s) — from ${content.source}`,
    );
  }
  await context.close();
}

async function check(browser) {
  const failures = [];
  const images = [];
  for (const card of cards) {
    const file = cardPath(card);
    const bytes = await readFile(file).catch(() => null);
    const name = `${card.slug}-${card.lang}.png`;
    if (!bytes) {
      failures.push(`${name}: missing`);
      continue;
    }
    const { width, height } = pngSize(bytes);
    const { size } = await stat(file);
    const ok = width === W && height === H && size <= BUDGET;
    if (width !== W || height !== H) failures.push(`${name}: ${width}×${height}, expected ${W}×${H}`);
    if (size > BUDGET) failures.push(`${name}: ${(size / 1024).toFixed(1)} KB is over ${BUDGET / 1024} KB`);
    console.log(`${ok ? 'ok  ' : 'FAIL'} public/assets/social/${name}  ${width}×${height}  ${(size / 1024).toFixed(1)} KB`);
    images.push({ name, src: `data:image/png;base64,${bytes.toString('base64')}` });
  }

  // Contact sheet: two columns (en, fr) at half size, one row per case.
  await mkdir(qa, { recursive: true });
  const cell = W / 2;
  const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:#222;font:14px ${T.sans};color:#ddd}
.grid{display:grid;grid-template-columns:repeat(2,${cell}px);gap:16px}
figure{margin:0}img{display:block;width:${cell}px;height:${H / 2}px;outline:1px solid #555}
figcaption{padding:4px 0 0}
</style></head><body><div class="grid">${images
    .map((i) => `<figure><img src="${i.src}" alt=""><figcaption>${i.name}</figcaption></figure>`)
    .join('')}</div></body></html>`;
  const page = await browser.newPage({ viewport: { width: 2 * cell + 48, height: 600 }, deviceScaleFactor: 1 });
  await page.setContent(sheet, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
  const natural = await page.evaluate(() => [...document.images].map((img) => [img.naturalWidth, img.naturalHeight]));
  natural.forEach(([w, h], i) => {
    if (w !== W || h !== H) failures.push(`${images[i].name}: decodes as ${w}×${h}`);
  });
  await page.screenshot({ path: join(qa, 'sheet.png'), fullPage: true });
  await page.close();
  console.log(`contact sheet: ${join(qa, 'sheet.png')}`);
  if (failures.length) throw new Error(failures.join('\n'));
}

const browser = await chromium.launch();
try {
  await mkdir(qa, { recursive: true });
  if (!checkOnly) await render(browser);
  await check(browser);
} finally {
  await browser.close();
}
