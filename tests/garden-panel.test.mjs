// The garden panel on a live scene, against a production preview (see
// tests/scene-lifecycle.test.mjs for the harness): planting, the weather,
// the season, the hour and the quality reach the animated garden.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage, waitForSceneSettled } from './browser-fixture.mjs';

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

for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  test(`${label}: the panel plants, turns and sets the sky of the live garden while ambient motion continues`, async () => {
    const p = await live(viewport);
    try {
      await waitForSceneSettled(p);
      await p.locator('.garden > summary').click();
      assert.equal(await p.evaluate(() => document.querySelector('.garden').open), true);
      // Planting draws the tree springing up alongside ambient motion.
      await p.locator('[data-plant-one]').click();
      await p.waitForFunction(() => /^1 of 24 trees$/.test(document.querySelector('[data-tree-count]').textContent));
      await p.locator('[data-plant-one]').click();
      await p.waitForFunction(() => /^2 of 24 trees$/.test(document.querySelector('[data-tree-count]').textContent));
      assert.equal(await p.evaluate(() => document.querySelector('[data-garden-status]').textContent), 'Tree planted. 2 of 24.');
      await waitForSceneSettled(p);
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
      await waitForSceneSettled(p);
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

test('the sky note shows the weather where the visitor is, and brings that sky to the garden and back', async () => {
  const requests = [];
  const p = await setupPage(browser, { viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Paris' }, async page => {
    page.on('request', r => { if (/open-meteo/.test(r.url())) requests.push(new URL(r.url()).hostname); });
    await page.goto(`${base}/#intro`);
    await page.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
  });
  try {
    const note = p.locator('[data-sky-note]');
    await note.waitFor({ state: 'visible' });
    // One lookup per visit: the place the time zone names, then its weather.
    assert.deepEqual(requests, ['geocoding-api.open-meteo.com', 'api.open-meteo.com']);
    const shown = () => p.evaluate(() => ({
      figure: document.querySelector('[data-sky-note-figure]').textContent,
      caption: document.querySelector('[data-sky-note-caption]').textContent,
      label: document.querySelector('[data-sky-note]').getAttribute('aria-label'),
      pressed: document.querySelector('[data-sky-note]').getAttribute('aria-pressed'),
      weather: document.documentElement.dataset.weather,
      hour: document.querySelector('[data-hour]').value,
    }));
    // Shown, not applied: the garden keeps its 22:00 clear night until pressed.
    assert.deepEqual(await shown(), { figure: '12°C', caption: 'Paris now', label: 'Show the sky in Paris now: Light rain, 12°C', pressed: 'false', weather: 'clear', hour: '22' });
    await note.click();
    const on = await shown();
    assert.equal(on.pressed, 'true');
    assert.equal(on.weather, 'rain');
    assert.equal(await p.evaluate(() => document.querySelector('[data-garden-status]').textContent), 'The garden shows Paris now: Light rain, 12°C.');
    // The panel agrees, and Live needs no second request.
    await p.locator('.garden > summary').click();
    assert.equal(await p.locator('.garden-panel [data-weather="live"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await p.locator('[data-sky-report]').textContent(), 'Light rain, 12°C in Paris.');
    await p.keyboard.press('Escape');
    // Pressed again: back to what was shown before.
    await note.click();
    assert.deepEqual(await shown(), { ...on, pressed: 'false', weather: 'clear', hour: '22' });
    // Setting the sky in the panel releases the note.
    await note.click();
    await p.locator('.garden > summary').click();
    await p.locator('.garden-panel [data-weather="snow"]').click();
    assert.equal(await note.getAttribute('aria-pressed'), 'false');
    assert.equal(requests.length, 2);
  } finally { await p.context().close(); }
});

test('without weather, the sky note offers the visitor\'s own hour', async () => {
  const p = await setupPage(browser, { viewport: { width: 1440, height: 900 } }, async page => {
    await page.route('**/*open-meteo.com/**', r => r.abort());
    await page.goto(`${base}/#intro`);
    await page.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
  });
  try {
    const note = p.locator('[data-sky-note]');
    await note.waitFor({ state: 'visible' });
    assert.equal(await p.locator('[data-sky-note-caption]').textContent(), 'your time');
    await note.click();
    assert.match(await p.evaluate(() => document.querySelector('[data-garden-status]').textContent), /^Light set to /);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.weather), 'clear');
  } finally { await p.context().close(); }
});

test('at Contact, the closing invitation turns sound on, explores, and takes focus back', async () => {
  const p = await live({ width: 1440, height: 900 }, '#contact');
  try {
    const invite = p.locator('[data-garden-invite] button');
    await invite.waitFor({ state: 'visible' });
    // Nowhere earlier in the story.
    assert.equal(await p.locator('[data-garden-invite]').count(), 1);
    assert.equal(await p.evaluate(() => document.querySelector('[data-garden-invite]').closest('section').id), 'contact');
    assert.equal(await invite.textContent(), 'Turn the sound on and walk around the garden');
    await invite.click();
    await p.waitForFunction(() => document.documentElement.dataset.explore === 'true' && document.documentElement.dataset.sound === 'true', null, { timeout: 20000 });
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.documentElement.dataset.explore);
    assert.equal(await p.evaluate(() => document.activeElement?.closest('[data-garden-invite]') !== null), true);
    // Sound stays on; the invitation now offers only the walk.
    assert.equal(await invite.textContent(), 'Walk around the garden');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.sound), 'true');
  } finally { await p.context().close(); }
});
