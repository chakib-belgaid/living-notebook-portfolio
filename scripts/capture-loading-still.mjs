// Captures the still shown while the garden loads, from the real garden in the dev server.
// Run `npm run dev -- --port 5198 --strictPort` first, then `npm run still:loading`.
// Re-run whenever the garden changes. Requires cwebp (brew install webp).
// main.ts places it as the camera frames the garden (src/framing.ts), so it is
// captured with the frame the whole view and the camera's look point at its centre.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.DEV_URL || 'http://127.0.0.1:5198';
const out = new URL('../public/assets/garden-loading.webp', import.meta.url).pathname;
const scratch = await mkdtemp(join(tmpdir(), 'loading-still-'));

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
// The size of `loadingStill` in src/framing.ts.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/*open-meteo.com/**', route => route.abort());
await page.clock.setFixedTime(new Date(2026, 9, 15, 13));
await page.goto(base + '/?view=garden');
await page.waitForFunction(() => window.__notebook?.garden);
// Only the garden: the live sky draws itself around the still, so it is left transparent.
await page.addStyleTag({ content: `
  .masthead, .chapters, .chapters *, .ruler, .dock, .mist, .hotspot, .skip-link, #portfolio, .sky, .garden-loading { visibility: hidden !important; }
  html, body, #app, #experience, .stage { background: transparent !important; }` });
await page.evaluate(() => {
  document.querySelector('button[data-season="autumn"]').click();
  document.querySelector('button[data-weather="clear"]').click();
  const input = document.querySelector('#hour');
  input.value = '13';
  input.dispatchEvent(new Event('input'));
  const garden = window.__notebook.garden;
  garden.setProgress(1, true);
  garden.focus(null, 0, 0);
  garden.frame(0, 1);
});
await page.waitForTimeout(3500); // the camera eases to its frame
const png = join(scratch, 'garden-loading.png');
await page.screenshot({ path: png, omitBackground: true });
await browser.close();
execFileSync('cwebp', ['-quiet', '-q', process.env.STILL_QUALITY || '80', '-alpha_q', '90', png, '-o', out]);
console.log(`garden-loading.webp ${Math.round((await stat(out)).size / 1024)} KB`);
