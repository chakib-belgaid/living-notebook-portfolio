// Captures the chapter posters (public/assets/stills/<host>/<poster>.webp)
// from the live scene, posed by the scene adapter's cues
// (src/narrative/scene-adapter.ts), one set per host. Run a server first,
// then `npm run stills`:
//   npm run dev -- --port 5198 --strictPort        (DEV_URL, default :5198)
// A production preview works too (DEV_URL=http://127.0.0.1:<port>): the script
// reads only window.__notebookScene, which both expose.
// Requires cwebp (brew install webp).
//
// Settings (ACCEPTANCE §6 asks for them to be recorded):
// - renderer: Playwright's bundled Chromium, headless (WebGL through
//   SwiftShader unless PLAYWRIGHT_CHANNEL picks an installed browser);
// - the wide set: the production desktop look at 1440×900, deviceScaleFactor
//   2, quality "auto" → full, guided mode, normal motion; the scene fills
//   the viewport (the fixed rail), so the poster is the viewport at 1x
//   (POSTER_SIZES.wide in src/narrative/model.ts);
// - the portrait set: a phone at 390×844, deviceScaleFactor 2, mobile and
//   touch, quality "auto" → light; the poster is the chapter's own slot
//   (about 358×380 CSS px) at 2x, POSTER_SIZES.portrait;
// - hour 22 (NIGHT_HOUR in src/narrative/scene-mount.ts), clear sky, summer:
//   the navy night the page always shows (the user's G2 decision);
// - each poster comes from the first chapter that shows it
//   (src/narrative/content.ts scene.poster), posed by its cue;
//   `cwebp -q 70` by default (STILL_QUALITY), ≤ 100 KB each (ACCEPTANCE §4).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chapters } from '../src/narrative/content.ts';
import { POSTER_SIZES } from '../src/narrative/model.ts';
import { sceneCues } from '../src/narrative/scene-adapter.ts';

const base = process.env.DEV_URL || 'http://127.0.0.1:5198';
const root = new URL('../public/assets/stills/', import.meta.url).pathname;
const quality = process.env.STILL_QUALITY || '70';
const each = 100 * 1024;
const scratch = process.env.STILL_SCRATCH || await mkdtemp(join(tmpdir(), 'stills-'));
const only = process.env.STILL_HOST; // "wide" or "portrait" to capture one set

// One capture per poster key, from the first chapter that uses it.
const posters = new Map();
for (const c of chapters) if (!posters.has(c.scene.poster)) posters.set(c.scene.poster, c.id);

const hosts = {
  wide: { page: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, host: 'rail', quality: 'full', stage: () => '[data-scene-host="rail"] .scene-stage', resize: POSTER_SIZES.wide.width },
  portrait: { page: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, host: 'slot', quality: 'light', stage: id => `[data-scene-host="${id}"] .scene-stage`, resize: 0 },
};

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const sizes = {};
const errors = [];
let failed = false;
for (const [name, h] of Object.entries(hosts)) {
  if (only && only !== name) continue;
  const out = join(root, name);
  await mkdir(out, { recursive: true });
  const page = await browser.newPage(h.page);
  page.on('pageerror', e => errors.push(`${name}: ${e}`));
  // No sound, no stored preferences: a first visit.
  await page.goto(base + '/');
  await page.waitForFunction(() => window.__notebookScene?.state().live, null, { timeout: 120000 });
  const setup = await page.evaluate(() => {
    const s = window.__notebookScene.state();
    const stage = document.querySelector('.scene-stage').getBoundingClientRect();
    return { renderer: s.renderer, quality: s.quality, motion: s.motion, mode: s.mode, host: s.host, stage: { width: Math.round(stage.width), height: Math.round(stage.height) } };
  });
  console.log(name, 'setup', JSON.stringify(setup), `hour 22, clear, summer; cwebp -q ${quality}`);
  const hostOk = name === 'wide' ? setup.host === 'rail' : setup.host !== 'rail';
  if (setup.quality !== h.quality || !hostOk || setup.motion !== 'normal') throw new Error(`Not the production ${name} scene: ` + JSON.stringify(setup));
  for (const [poster, chapter] of posters) {
    // An explicit jump, through the page's own link handling.
    await page.evaluate(id => {
      if (id === 'intro') { scrollTo(0, 0); return; }
      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = id;
      document.querySelector('main').append(a);
      a.click();
      a.remove();
    }, chapter);
    await page.waitForFunction(id => {
      const s = window.__notebookScene.state();
      return s.live && s.chapter === id && s.transition === 1 && s.settled;
    }, chapter, { timeout: 120000 });
    // The stage's fade and any last sky frame.
    await page.waitForTimeout(800);
    const pose = await page.evaluate(() => window.__notebookScene.state().pose);
    const png = join(scratch, `${name}-${poster}.png`);
    await page.locator(h.stage(chapter)).screenshot({ path: png });
    const webp = join(out, `${poster}.webp`);
    execFileSync('cwebp', ['-quiet', '-q', quality, '-m', '6', ...(h.resize ? ['-resize', String(h.resize), '0'] : []), png, '-o', webp]);
    sizes[`${name}/${poster}`] = (await stat(webp)).size;
    console.log(name.padEnd(9), poster.padEnd(12), chapter.padEnd(13), `cue progress ${sceneCues[chapter].progress}`, `drawn ${pose?.progress}`, `${(sizes[`${name}/${poster}`] / 1024).toFixed(1)} KB`, png);
  }
  const expected = POSTER_SIZES[name];
  const scale = name === 'wide' ? 1 : h.page.deviceScaleFactor;
  if (Math.abs(setup.stage.width * scale - expected.width) > 2 || Math.abs(setup.stage.height * scale - expected.height) > 2) {
    console.warn(`The ${name} stage (${setup.stage.width}×${setup.stage.height} CSS px, ×${scale}) differs from POSTER_SIZES.${name} (${expected.width}×${expected.height}): update it to ${setup.stage.width * scale}×${setup.stage.height * scale}.`);
    failed = true;
  }
  await page.close();
}
await browser.close();
if (errors.length) console.error('Page errors:', errors);
const over = Object.entries(sizes).filter(([, v]) => v > each);
if (over.length) {
  console.error(`Over budget (${each / 1024} KB each): ${over.map(([k]) => k).join(', ')}. Re-run with STILL_QUALITY=60.`);
  failed = true;
}
if (failed) process.exit(1);
