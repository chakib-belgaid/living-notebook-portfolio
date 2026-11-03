// The optional rendering-cost detail in the carbon tally's panel, against a
// production preview (see tests/garden-panel.test.mjs for the harness): it
// loads on the first press, samples only while open, and stops when closed
// by its own button or by closing the tally. Run:
//   TEST_URL=http://127.0.0.1:5199 node --test tests/render-meter.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

/** Counts the live 300 ms timers, which only the meter starts. */
const countTimers = () => {
  const live = new Set();
  const set = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...rest) => { const id = set(fn, ms, ...rest); if (ms === 300) live.add(id); return id; };
  window.clearInterval = id => { live.delete(id); clear(id); };
  window.__meterTimers = () => live.size;
};

async function page(hash = '#about', query = '') {
  return setupPage(browser, { viewport: { width: 1440, height: 900 } }, async p => {
    await p.addInitScript(countTimers);
    await p.goto(`${base}/${query}${hash}`);
    await p.waitForSelector('.ruler-dock:not([hidden]) .tally > summary');
  });
}
const live = async (hash) => {
  const p = await page(hash);
  await p.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
  return p;
};
const timers = p => p.evaluate(() => window.__meterTimers());
const state = p => p.evaluate(() => ({
  expanded: document.querySelector('[data-meter-open]').getAttribute('aria-expanded'),
  label: document.querySelector('[data-meter-open]').textContent,
  hidden: document.querySelector('[data-render-meter]').hidden,
}));

test('desktop: the detail opens with a sparkline and readout, then stops sampling when closed', async () => {
  const p = await live();
  try {
    assert.equal(await timers(p), 0, 'no meter timer before it is opened');
    await p.locator('.tally > summary').click();
    assert.deepEqual(await state(p), { expanded: 'false', label: 'Show rendering detail', hidden: true });
    await p.locator('[data-meter-open]').click();
    await p.waitForFunction(() => {
      const t = document.querySelector('[data-meter-readout]')?.textContent ?? '';
      return /ms/.test(t) && /triangles/.test(t);
    }, null, { timeout: 20000 });
    assert.ok(await p.locator('[data-render-meter] canvas').isVisible());
    assert.deepEqual(await state(p), { expanded: 'true', label: 'Hide rendering detail', hidden: false });
    assert.equal(await timers(p), 1);
    assert.match(await p.locator('[data-render-meter]').innerText(), /not a Wattch hardware measurement/i);
    assert.match(await p.locator('[data-meter-total]').innerText(), /^Drawing the garden this visit: .+\.$/);

    await p.locator('[data-meter-open]').click();
    assert.deepEqual(await state(p), { expanded: 'false', label: 'Show rendering detail', hidden: true });
    assert.equal(await timers(p), 0, 'closing clears the timer');
    // Opening again mounts a fresh meter.
    await p.locator('[data-meter-open]').click();
    await p.waitForFunction(() => /triangles/.test(document.querySelector('[data-meter-readout]')?.textContent ?? ''), null, { timeout: 20000 });
    assert.equal(await timers(p), 1);
  } finally { await p.context().close(); }
});

test('desktop: closing the tally stops the meter', async () => {
  const p = await live();
  try {
    await p.locator('.tally > summary').click();
    await p.locator('[data-meter-open]').click();
    await p.waitForFunction(() => /triangles/.test(document.querySelector('[data-meter-readout]')?.textContent ?? ''), null, { timeout: 20000 });
    assert.equal(await timers(p), 1);
    await p.keyboard.press('Escape'); // the panel closes like a popover
    await p.waitForFunction(() => !document.querySelector('.tally').open);
    await p.waitForFunction(() => window.__meterTimers() === 0, null, { timeout: 5000 });
    assert.deepEqual(await state(p), { expanded: 'false', label: 'Show rendering detail', hidden: true });
    // No sampling: the (detached) readout is empty and nothing re-arms.
    await p.waitForTimeout(1000);
    assert.equal(await timers(p), 0);
    assert.equal(await p.locator('[data-render-meter] canvas').count(), 0);
  } finally { await p.context().close(); }
});

test('stills: the detail says there is nothing to measure', async () => {
  const p = await page('#about', '?view=stills');
  try {
    await p.locator('.tally > summary').click();
    await p.locator('[data-meter-open]').click();
    await p.waitForFunction(() => /nothing to measure/.test(document.querySelector('[data-meter-readout]')?.textContent ?? ''), null, { timeout: 20000 });
    assert.equal(await p.locator('[data-meter-readout]').innerText(), 'The live drawing is off, so there is nothing to measure.');
    assert.equal(await p.locator('[data-render-meter] canvas').isVisible(), false);
  } finally { await p.context().close(); }
});
