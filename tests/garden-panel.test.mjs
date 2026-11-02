// The garden panel on a live scene, against a production preview (see
// tests/scene-lifecycle.test.mjs for the harness): planting, the weather,
// the season, the hour and the quality reach the garden, and a held garden
// goes back to sleep once the tree has grown.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

async function live(viewport, hash = '#about') {
  return setupPage(browser, { viewport }, async page => {
    await page.goto(`${base}/${hash}`);
    await page.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
  });
}
const frames = p => p.evaluate(() => window.__notebookStats().garden.frames);
/** Waits until the garden has drawn nothing for 500 ms. */
async function asleep(p, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const a = await frames(p);
    await p.waitForTimeout(500);
    if (await frames(p) === a) return;
  }
  throw new Error('the garden kept drawing');
}

for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  test(`${label}: the panel plants, turns and sets the sky of the live garden, which then sleeps again`, async () => {
    const p = await live(viewport);
    try {
      await asleep(p);
      await p.locator('.garden > summary').click();
      assert.equal(await p.evaluate(() => document.querySelector('.garden').open), true);
      // Planting draws the tree springing up, then the held garden sleeps.
      await p.locator('[data-plant-one]').click();
      await p.waitForFunction(() => /^1 of 24 trees$/.test(document.querySelector('[data-tree-count]').textContent));
      await p.locator('[data-plant-one]').click();
      await p.waitForFunction(() => /^2 of 24 trees$/.test(document.querySelector('[data-tree-count]').textContent));
      assert.equal(await p.evaluate(() => document.querySelector('[data-garden-status]').textContent), 'Tree planted. 2 of 24.');
      await asleep(p);
      // The weather and the season reach the page and the garden.
      await p.locator('.garden-panel [data-weather="rain"]').click();
      await p.locator('.garden-panel [data-season="winter"]').click();
      const state = await p.evaluate(() => ({
        weather: document.documentElement.dataset.weather, season: document.documentElement.dataset.season,
        // Scoped to the panel: the root carries the same attribute for the stylesheet.
        rainPressed: document.querySelector('.garden-panel [data-weather="rain"]').getAttribute('aria-pressed'),
        clearPressed: document.querySelector('.garden-panel [data-weather="clear"]').getAttribute('aria-pressed'),
        skyReport: document.querySelector('[data-sky-report]').textContent, seasonReport: document.querySelector('[data-season-report]').textContent,
      }));
      assert.deepEqual(state, { weather: 'rain', season: 'winter', rainPressed: 'true', clearPressed: 'false', skyReport: 'Previewing rain.', seasonReport: 'Previewing winter.' });
      // The hour: the slider's value text and readout follow it.
      await p.locator('[data-hour]').evaluate(input => { input.value = '13'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      const hour = await p.evaluate(() => ({ text: document.querySelector('[data-hour]').getAttribute('aria-valuetext'), readout: document.querySelector('[data-hour-readout]').textContent }));
      assert.ok(hour.text && hour.text === hour.readout && /1/.test(hour.text), JSON.stringify(hour));
      // Quality: the choice is pressed and remembered.
      await p.locator('.garden-panel [data-quality="light"]').click();
      assert.equal(await p.evaluate(() => ({ pressed: document.querySelector('.garden-panel [data-quality="light"]').getAttribute('aria-pressed'), saved: localStorage.getItem('notebook:quality') })).then(JSON.stringify), JSON.stringify({ pressed: 'true', saved: 'light' }));
      await p.locator('[data-turn]').click();
      await asleep(p);
      // Planting by clicking takes the stage's clicks only while it is on.
      await p.locator('[data-plant-mode]').click();
      assert.equal(await p.evaluate(() => document.documentElement.classList.contains('planting') && getComputedStyle(document.querySelector('.scene-stage')).pointerEvents), 'auto');
      await p.keyboard.press('Escape');
      assert.equal(await p.evaluate(() => ({ planting: document.documentElement.classList.contains('planting'), open: document.querySelector('.garden').open })).then(JSON.stringify), JSON.stringify({ planting: false, open: false }));
      // The trees survive a rebuilt garden (stills on, then off again).
      await p.locator('.scene-toggle').click();
      await p.locator('[data-scene-control="stills"]').click();
      await p.waitForFunction(() => !document.querySelector('.scene-stage'));
      await p.locator('[data-scene-control="stills"]').click();
      await p.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
      await p.waitForFunction(() => /^2 of 24 trees$/.test(document.querySelector('[data-tree-count]').textContent));
      assert.equal(await p.evaluate(() => document.documentElement.dataset.weather), 'rain');
    } finally { await p.context().close(); }
  });
}

test('no weather request is made until Live is pressed', async () => {
  const p = await live({ width: 1440, height: 900 });
  try {
    const requests = [];
    p.on('request', r => { if (/open-meteo/.test(r.url())) requests.push(r.url()); });
    await p.locator('.garden > summary').click();
    await p.locator('.garden-panel [data-weather="snow"]').click();
    await p.waitForTimeout(300);
    assert.deepEqual(requests, []);
  } finally { await p.context().close(); }
});
