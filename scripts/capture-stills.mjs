// Captures the chapter posters (public/assets/stills/<poster>.webp) from the
// live scene, posed by the scene adapter's cues (src/narrative/scene-adapter.ts).
// Run a server first, then `npm run stills`:
//   npm run dev -- --port 5198 --strictPort        (DEV_URL, default :5198)
// A production preview works too (DEV_URL=http://127.0.0.1:<port>): the script
// reads only window.__notebookScene, which both expose.
// Requires cwebp (brew install webp).
//
// Settings (ACCEPTANCE §6 asks for them to be recorded):
// - renderer: Playwright's bundled Chromium, headless (WebGL through
//   SwiftShader unless PLAYWRIGHT_CHANNEL picks an installed browser);
// - the production desktop look: 1440×900, deviceScaleFactor 2, quality
//   "auto" → full (the non-compact default), guided mode, normal motion;
// - hour 13, clear sky, summer: the release-1 defaults of src/scene.ts and
//   src/sky.ts, which the page never changes. Day only; no night variants.
// - each poster comes from the first chapter that shows it
//   (src/narrative/content.ts scene.poster), posed by its cue, and is taken
//   from the wide rail's stage. The rail is about 658×748 CSS px at 1440×900,
//   a portrait-leaning 0.88 aspect; the portrait slots (about 358×380 at
//   390×844) crop the same image with object-fit: cover, losing about 7% of
//   its height. The WebP is 780 px wide at that aspect (POSTER_SIZE in
//   src/narrative/model.ts), `cwebp -q 70` by default (STILL_QUALITY), and
//   must be ≤ 100 KB (ACCEPTANCE §4).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chapters } from '../src/narrative/content.ts';
import { POSTER_SIZE } from '../src/narrative/model.ts';
import { sceneCues } from '../src/narrative/scene-adapter.ts';

const base = process.env.DEV_URL || 'http://127.0.0.1:5198';
const out = new URL('../public/assets/stills/', import.meta.url).pathname;
const quality = process.env.STILL_QUALITY || '70';
const each = 100 * 1024;
await mkdir(out, { recursive: true });
const scratch = process.env.STILL_SCRATCH || await mkdtemp(join(tmpdir(), 'stills-'));

// One capture per poster key, from the first chapter that uses it.
const posters = new Map();
for (const c of chapters) if (!posters.has(c.scene.poster)) posters.set(c.scene.poster, c.id);

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// No sound, no stored preferences: a first visit.
await page.goto(base + '/');
await page.waitForFunction(() => window.__notebookScene?.state().live, null, { timeout: 120000 });
const setup = await page.evaluate(() => {
  const s = window.__notebookScene.state();
  const rail = document.querySelector('[data-scene-host="rail"]').getBoundingClientRect();
  return { renderer: s.renderer, quality: s.quality, motion: s.motion, mode: s.mode, host: s.host, rail: { width: Math.round(rail.width), height: Math.round(rail.height) } };
});
console.log('setup', JSON.stringify(setup), `hour 13, clear, summer; cwebp -q ${quality}`);
if (setup.quality !== 'full' || setup.host !== 'rail' || setup.motion !== 'normal') throw new Error('Not the production desktop scene: ' + JSON.stringify(setup));

const sizes = {};
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
  const png = join(scratch, `${poster}.png`);
  await page.locator('[data-scene-host="rail"] .scene-stage').screenshot({ path: png });
  const webp = join(out, `${poster}.webp`);
  execFileSync('cwebp', ['-quiet', '-q', quality, '-m', '6', '-resize', String(POSTER_SIZE.width), '0', png, '-o', webp]);
  sizes[poster] = (await stat(webp)).size;
  console.log(poster.padEnd(12), chapter.padEnd(13), `cue progress ${sceneCues[chapter].progress}`, `drawn ${pose?.progress}`, `${(sizes[poster] / 1024).toFixed(1)} KB`, png);
}
await browser.close();
const aspect = setup.rail.width / setup.rail.height;
const expected = POSTER_SIZE.width / POSTER_SIZE.height;
if (Math.abs(aspect - expected) > 0.01) console.warn(`The rail's aspect (${aspect.toFixed(3)}) differs from POSTER_SIZE (${expected.toFixed(3)}): update POSTER_SIZE to ${POSTER_SIZE.width}×${Math.round(POSTER_SIZE.width / aspect)}.`);
if (errors.length) console.error('Page errors:', errors);
const over = Object.entries(sizes).filter(([, v]) => v > each);
if (over.length) {
  console.error(`Over budget (${each / 1024} KB each): ${over.map(([k]) => k).join(', ')}. Re-run with STILL_QUALITY=60.`);
  process.exit(1);
}
