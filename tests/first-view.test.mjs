// What the first view downloads: the still of the layout in use, never the
// other layout's, and on a deep link the chapter's own, not the opening one.
// TEST_URL targets a production preview, as in tests/ux-regressions.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

const wide = { viewport: { width: 1440, height: 900 } };
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

/** The stills requested by the time the page is enhanced and its poster shown, in order. */
async function stills(options, path) {
  const requested = [];
  const warnings = [];
  const p = await setupPage(browser, options, async page => {
    page.on('request', r => { const m = /\/assets\/stills\/(.+)$/.exec(new URL(r.url()).pathname); if (m) requested.push(m[1]); });
    page.on('console', m => { if (/preload/i.test(m.text())) warnings.push(m.text()); });
    await page.goto(base + path, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    // The poster in view has loaded: nothing here waits on the live scene.
    await page.waitForFunction(() => [...document.querySelectorAll('.scene-poster')].some(img => img.getClientRects().length && img.complete && img.naturalWidth > 0));
    // Long enough for the browser to report a preload nothing used.
    await page.waitForTimeout(3500);
  });
  await p.context().close();
  return { requested: [...new Set(requested)], warnings };
}

test('wide: the landing fetches the rail’s opening still and no portrait one', async () => {
  const { requested, warnings } = await stills(wide, '/');
  assert.deepEqual(requested, ['wide/sketch.webp']);
  assert.deepEqual(warnings, []);
});

test('wide: a deep link fetches its own chapter’s still, not the opening sketch', async () => {
  const { requested, warnings } = await stills(wide, '/#contact');
  assert.deepEqual(requested, ['wide/bloom.webp']);
  assert.deepEqual(warnings, []);
});

// How many of the following chapters' stills come with it is the browser's own
// lazy-loading distance (one in Chrome 157, three in the bundled headless
// shell), so only their kind is checked.
test('stacked: the landing fetches the opening still first and no wide one', async () => {
  const { requested, warnings } = await stills(phone, '/');
  assert.equal(requested[0], 'portrait/sketch.webp');
  assert.ok(requested.every(name => name.startsWith('portrait/')), JSON.stringify(requested));
  assert.deepEqual(warnings, []);
});
