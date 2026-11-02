// Captures the chapter posters (public/assets/stills/<poster>.webp) from the
// live scene, posed by the scene adapter's cues, in the dev server. Not run in
// P4: the stills on disk are still the old blue-paper crops; P7 re-captures.
// Run `npm run dev -- --port 5198 --strictPort` first, then `npm run stills`.
// Requires cwebp (brew install webp). Each poster is taken from the first
// chapter that shows it (src/narrative/content.ts), in the wide rail at
// 1440×900 (the portrait slots crop the same image with object-fit: cover).
// If the captured aspect differs from POSTER_SIZE (src/narrative/model.ts),
// update POSTER_SIZE to match.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chapters } from '../src/narrative/content.ts';
import { sceneCues } from '../src/narrative/scene-adapter.ts';

const base = process.env.DEV_URL || 'http://127.0.0.1:5198';
const out = new URL('../public/assets/stills/', import.meta.url).pathname;
const each = 100 * 1024;
await mkdir(out, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), 'stills-'));

// One capture per poster key, from the first chapter that uses it.
const posters = new Map();
for (const c of chapters) if (!posters.has(c.scene.poster)) posters.set(c.scene.poster, c.id);

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(base + '/?view=garden');
await page.waitForFunction(() => window.__notebook?.adapter && window.__notebookScene.state().live, null, { timeout: 60000 });
const sizes = {};
for (const [poster, chapter] of posters) {
  await page.evaluate(id => { location.hash = id; }, chapter);
  await page.waitForFunction(id => {
    const s = window.__notebookScene.state();
    return s.chapter === id && s.settled;
  }, chapter, { timeout: 60000 });
  await page.waitForTimeout(300);
  const png = join(scratch, `${poster}.png`);
  await page.locator('[data-scene-host="rail"] .scene-stage').screenshot({ path: png });
  const webp = join(out, `${poster}.webp`);
  execFileSync('cwebp', ['-quiet', '-q', process.env.STILL_QUALITY || '72', '-resize', '780', '0', png, '-o', webp]);
  sizes[poster] = (await stat(webp)).size;
  console.log(poster.padEnd(12), chapter.padEnd(13), `progress ${sceneCues[chapter].progress}`, `${Math.round(sizes[poster] / 1024)} KB`);
}
await browser.close();
const over = Object.entries(sizes).filter(([, v]) => v > each);
if (over.length) {
  console.error(`Over budget (${each / 1024} KB each): ${over.map(([k]) => k).join(', ')}. Re-run with STILL_QUALITY=60.`);
  process.exit(1);
}
