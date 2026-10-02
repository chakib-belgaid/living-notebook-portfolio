// Captures the phone journey's stills from the real garden in the dev server.
// Run `npm run dev -- --port 5198 --strictPort` first, then `npm run stills`.
// Re-run whenever the garden changes. Requires cwebp (brew install webp).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stops, stageProgress } from '../src/content.ts';

const base = process.env.DEV_URL || 'http://127.0.0.1:5198';
const out = new URL('../public/assets/stills/', import.meta.url).pathname;
const each = 100 * 1024, total = 600 * 1024;
await mkdir(out, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), 'stills-'));

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
// 900 px wide is the narrowest garden view; the height gives a phone's portrait ratio (390 × 844).
const page = await browser.newPage({ viewport: { width: 900, height: 1948 }, deviceScaleFactor: 1 });
await page.route('**/*open-meteo.com/**', route => route.abort());
await page.goto(base + '/');
await page.waitForFunction(() => window.__notebook?.garden);
await page.addStyleTag({ content: '.masthead, .chapters, .chapters *, .ruler, .dock, .mist, .hotspot, .skip-link, #portfolio { visibility: hidden !important; }' });
// Fixed conditions, so a re-run matches: 1 pm, autumn, a clear sky.
await page.evaluate(() => {
  const hour = document.querySelector('#hour');
  hour.value = '13';
  hour.dispatchEvent(new Event('input'));
  document.querySelector('button[data-season="autumn"]').click();
  document.querySelector('button[data-weather="clear"]').click();
});

const sizes = {};
for (const stop of stops) {
  await page.evaluate(([progress, spot]) => {
    const garden = window.__notebook.garden;
    garden.setProgress(progress, true);
    garden.focus(spot, 0, 0);
    garden.frame(0.06, 0.58);
  }, [stageProgress[stop.stage], stop.spot]);
  await page.waitForTimeout(3500); // the camera eases to its spot
  const png = join(scratch, `${stop.name}.png`);
  await page.screenshot({ path: png });
  const webp = join(out, `${stop.name}.webp`);
  execFileSync('cwebp', ['-quiet', '-q', process.env.STILL_QUALITY || '70', '-resize', '780', '1688', png, '-o', webp]);
  sizes[stop.name] = (await stat(webp)).size;
}
await browser.close();

const sum = Object.values(sizes).reduce((a, b) => a + b, 0);
console.table(Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, `${Math.round(v / 1024)} KB`])));
console.log(`total ${Math.round(sum / 1024)} KB`);
const over = Object.entries(sizes).filter(([, v]) => v > each);
if (over.length || sum > total) {
  console.error(`Over budget (${each / 1024} KB each, ${total / 1024} KB total). Re-run with STILL_QUALITY=60.`);
  process.exit(1);
}
