// Save a postcard (src/narrative/postcard.ts), against a production preview
// (see tests/scene-lifecycle.test.mjs for the harness):
//   TEST_URL=http://127.0.0.1:<port> node --test --test-concurrency=1 tests/postcard.test.mjs
// The panel's button downloads the live garden as a PNG and says so; it is
// disabled while no live garden is shown (stills).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

for (const [label, options] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  test(`${label}: Save a postcard downloads the live garden as a PNG`, async () => {
    const p = await setupPage(browser, { ...options, acceptDownloads: true }, async page => {
      await page.goto(`${base}/#whisperbook`);
      await page.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
    });
    try {
      const requests = [];
      p.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });
      await p.locator('.garden > summary').click();
      const button = p.locator('[data-postcard]');
      assert.equal(await button.isDisabled(), false);
      const [download] = await Promise.all([p.waitForEvent('download'), button.click()]);
      assert.equal(download.suggestedFilename(), 'living-notebook-garden.png');
      const file = await readFile(await download.path());
      assert.deepEqual([...file.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG');
      // The card is the stage's size at up to 2x, plus its caption band.
      const width = file.readUInt32BE(16), height = file.readUInt32BE(20);
      assert.ok(width > 300 && height > width * 0.3, `${width}×${height}`);
      await p.waitForFunction(() => document.querySelector('[data-garden-status]').textContent === 'Your garden postcard is saved.');
      assert.equal(await button.isDisabled(), false, 'ready for another card');
      assert.deepEqual(requests, [], 'nothing is sent anywhere');
    } finally { await p.context().close(); }
  });
}

test('stills: the postcard button is disabled while no live garden is shown', async () => {
  const p = await setupPage(browser, { viewport: { width: 1440, height: 900 } }, async page => {
    await page.goto(`${base}/?view=stills#bplog`);
    await page.waitForFunction(() => document.documentElement.dataset.sceneMode === 'stills');
  });
  try {
    await p.locator('.garden > summary').click();
    assert.equal(await p.locator('[data-postcard]').isDisabled(), true);
    // Exploring stays offered: it asks for the live drawing itself.
    assert.equal(await p.locator('[data-explore]').isDisabled(), false);
    // Nothing of the postcard's code is fetched until it is asked for.
    const fetched = await p.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/(postcard|explore)-[\w-]+\.js$/.test(n)));
    assert.deepEqual(fetched, []);
  } finally { await p.context().close(); }
});
