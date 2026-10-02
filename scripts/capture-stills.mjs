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
// The moon's phase follows the date: a fixed one, with a crescent that reads as a moon.
await page.clock.setFixedTime(new Date(2026, 9, 15, 13));
await page.goto(base + '/');
await page.waitForFunction(() => window.__notebook?.garden);
await page.addStyleTag({ content: '.masthead, .chapters, .chapters *, .ruler, .dock, .mist, .hotspot, .skip-link, #portfolio { visibility: hidden !important; }' });
// Fixed conditions, so a re-run matches: autumn and a clear sky, at 1 pm for
// the day stills and 10 pm for the night ones (src/phone.ts picks by the clock).
await page.evaluate(() => {
  document.querySelector('button[data-season="autumn"]').click();
  document.querySelector('button[data-weather="clear"]').click();
});

const sizes = {};
for (const [suffix, hour] of [['', 13], ['-night', 22]]) {
  await page.evaluate(hour => {
    const input = document.querySelector('#hour');
    input.value = String(hour);
    input.dispatchEvent(new Event('input'));
  }, hour);
  for (const stop of stops) {
    await page.evaluate(([progress, spot]) => {
      const garden = window.__notebook.garden;
      garden.setProgress(progress, true);
      garden.focus(spot, 0, 0);
      garden.frame(0.06, 0.58);
    }, [stageProgress[stop.stage], stop.spot]);
    await page.waitForTimeout(3500); // the camera eases to its spot
    const name = stop.name + suffix;
    const png = join(scratch, `${name}.png`);
    await page.screenshot({ path: png });
    const webp = join(out, `${name}.webp`);
    execFileSync('cwebp', ['-quiet', '-q', process.env.STILL_QUALITY || '70', '-resize', '780', '1688', png, '-o', webp]);
    sizes[name] = (await stat(webp)).size;
  }
}
await browser.close();

console.table(Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, `${Math.round(v / 1024)} KB`])));
// A visitor loads one set, day or night, so each set keeps the budget.
const sum = night => Object.entries(sizes).filter(([k]) => k.endsWith('-night') === night).reduce((a, [, v]) => a + v, 0);
console.log(`day ${Math.round(sum(false) / 1024)} KB, night ${Math.round(sum(true) / 1024)} KB`);
const over = Object.entries(sizes).filter(([, v]) => v > each);
if (over.length || sum(false) > total || sum(true) > total) {
  console.error(`Over budget (${each / 1024} KB each, ${total / 1024} KB a set). Re-run with STILL_QUALITY=60.`);
  process.exit(1);
}
