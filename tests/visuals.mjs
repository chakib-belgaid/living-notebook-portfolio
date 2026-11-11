/* Review captures of the current page's still states (product decision 73),
   against a production preview:
     npx vite build --outDir <dir> && npx vite preview --outDir <dir> --host 127.0.0.1 --port <port> --strictPort
     TEST_URL=http://127.0.0.1:<port> node tests/visuals.mjs
   Writes .qa/visuals/ (git-ignored): every chapter's resting pose, loaded by
   its deep link and captured once the camera and construction have settled, at 1440×900 and 390×844; exploring with the places shown on both
   layouts (the phone's in its dialog); the garden panel open; the carbon
   tally with the rendering meter open; and the Whisperbook case page with
   its enlargement dialog open. A review aid, not a test: the only checks are
   that each capture happened and, where the page has a scene, that the live
   scene was ready. captures.json lists the state behind each capture; the
   run exits non-zero if a capture could not be made. Live weather
   (Open-Meteo) is blocked so the garden shows its default sky. */
import { chromium } from 'playwright';
import { waitForSceneSettled } from './browser-fixture.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const out = fileURLToPath(new URL('../.qa/visuals/', import.meta.url));
const chapters = ['intro', 'work', 'bplog', 'whisperbook', 'energy-tools', 'mcq-scan', 'about', 'contact'];
const layouts = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const READY_TIMEOUT = 90000;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const captures = [];

async function context(layout) {
  const ctx = await browser.newContext(layouts[layout]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.route('**/*open-meteo.com/**', r => r.abort());
  return page;
}
const ready = p => p.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: READY_TIMEOUT });
const settledOn = (p, chapter) => p.waitForFunction(c => {
  const s = window.__notebookScene.state();
  return s.live && s.chapter === c && s.transition === 1 && s.settled;
}, chapter, { timeout: READY_TIMEOUT });

async function load(p, path) {
  await p.goto('about:blank');
  await p.goto(base + path);
  await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
}
async function enterExploring(p) {
  if (!await p.evaluate(() => document.querySelector('.garden').open)) await p.locator('.garden > summary').click();
  await p.locator('[data-explore]').click();
  await p.waitForFunction(() => document.documentElement.dataset.explore === 'true');
  await p.waitForFunction(() => [...document.querySelectorAll('.hotspot')].some(h => !h.hidden && h.getBoundingClientRect().width > 0));
}
/** One capture: `prepare` brings the page to its state; a scene page must be live. */
async function capture(layout, name, prepare, { scene = true } = {}) {
  const p = await context(layout);
  const file = `${layout}-${name}.png`;
  try {
    await prepare(p);
    await p.evaluate(() => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const state = await p.evaluate(() => {
      const s = window.__notebookScene?.state();
      return {
        url: location.pathname + location.search + location.hash,
        scrollY: Math.round(scrollY),
        renderer: document.documentElement.dataset.renderer ?? null,
        live: s?.live ?? null, chapter: s?.chapter ?? null, host: s?.host ?? null, exploring: s?.exploring ?? null,
        quality: s?.quality ?? null, motion: s?.motion ?? null,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    if (scene && !(state.renderer === 'ready' && state.live)) throw new Error(`the live scene was not ready: ${JSON.stringify(state)}`);
    await p.screenshot({ path: out + file });
    captures.push({ layout, name, file, ok: true, ...state, errors: p.errors });
    console.log(`${file.padEnd(40)} ${JSON.stringify(state)}`);
  } catch (e) {
    captures.push({ layout, name, file, ok: false, error: e.message.split('\n')[0], errors: p.errors });
    console.error(`${file.padEnd(40)} FAILED: ${e.message.split('\n')[0]}`);
  } finally { await p.context().close(); }
}

try {
  for (const layout of Object.keys(layouts)) {
    // Each chapter's resting pose, from its deep link.
    for (const chapter of chapters) {
      await capture(layout, `hold-${chapter}`, async p => {
        await load(p, `/#${chapter}`);
        await ready(p);
        await settledOn(p, chapter);
        await waitForSceneSettled(p);
      });
    }
    // Exploring, with the places shown.
    await capture(layout, 'exploring', async p => {
      await load(p, '/#whisperbook');
      await ready(p);
      await waitForSceneSettled(p);
      await enterExploring(p);
      await p.waitForTimeout(1500);
    });
    // The garden panel open.
    await capture(layout, 'garden-panel', async p => {
      await load(p, '/#about');
      await ready(p);
      await waitForSceneSettled(p);
      await p.locator('.garden > summary').click();
      await p.waitForFunction(() => document.querySelector('.garden').open);
      await p.waitForTimeout(300);
    });
    // The carbon tally with the rendering meter open.
    await capture(layout, 'tally-meter', async p => {
      await load(p, '/#about');
      await ready(p);
      await p.waitForSelector('.ruler-dock:not([hidden]) .tally > summary');
      await p.locator('.tally > summary').click();
      await p.locator('[data-meter-open]').click();
      await p.waitForFunction(() => /ms/.test(document.querySelector('[data-meter-readout]')?.textContent ?? ''), null, { timeout: 20000 });
      await p.waitForTimeout(800);
    });
    // The Whisperbook case page with its enlargement dialog.
    await capture(layout, 'case-whisperbook-enlarged', async p => {
      await p.goto(base + '/work/whispbook/', { waitUntil: 'load' });
      await p.locator('a[data-case-zoom]').first().click();
      await p.waitForSelector('dialog.case-lightbox[open]');
      await p.waitForFunction(() => [...document.querySelectorAll('dialog.case-lightbox[open] img')].every(i => i.complete && i.naturalWidth > 0));
      await p.waitForTimeout(300);
    }, { scene: false });
  }
} finally { await browser.close(); }

await writeFile(out + 'captures.json', JSON.stringify({ date: new Date().toISOString(), url: base, captures }, null, 2));
const failed = captures.filter(c => !c.ok);
console.log(`\n${captures.length - failed.length} of ${captures.length} captures in ${out}${failed.length ? `; failed: ${failed.map(c => c.file).join(', ')}` : ''}`);
if (failed.length) process.exitCode = 1;
