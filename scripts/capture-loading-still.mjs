// Captures public/assets/garden-loading.webp: the finished house, whole world,
// on a transparent background, from the live scene in the dev server (the
// Contact cue of src/narrative/scene-adapter.ts). Not run in P4, and nothing
// on the release-1 page references this asset any more (the posters in
// public/assets/stills are the loading content); P7 decides whether to keep it.
// Run `npm run dev -- --port 5198 --strictPort` first, then `npm run still:loading`.
// Requires cwebp (brew install webp).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sceneCues } from '../src/narrative/scene-adapter.ts';

const base = process.env.DEV_URL || 'http://127.0.0.1:5198';
const out = new URL('../public/assets/garden-loading.webp', import.meta.url).pathname;
const scratch = await mkdtemp(join(tmpdir(), 'loading-still-'));

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(base + '/?view=garden#contact');
await page.waitForFunction(() => window.__notebook?.adapter && window.__notebookScene.state().live, null, { timeout: 60000 });
// Only the house: no sky, no paper.
await page.addStyleTag({ content: '.scene-stage { background: transparent !important; } .scene-sky { visibility: hidden !important; }' });
await page.evaluate(progress => window.__notebook.adapter.snapTo({ progress, focus: null }), sceneCues.contact.progress);
await page.waitForFunction(() => window.__notebookScene.state().settled, null, { timeout: 60000 });
const png = join(scratch, 'garden-loading.png');
await page.locator('[data-scene-host="rail"] .scene-stage').screenshot({ path: png, omitBackground: true });
await browser.close();
execFileSync('cwebp', ['-quiet', '-q', process.env.STILL_QUALITY || '80', '-alpha_q', '90', png, '-o', out]);
console.log(`garden-loading.webp ${Math.round((await stat(out)).size / 1024)} KB`);
