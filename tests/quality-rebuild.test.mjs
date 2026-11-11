// Drawing quality and the garden's detail tier (decision 48), against a
// production preview (see tests/scene-lifecycle.test.mjs for the harness):
//   TEST_URL=http://127.0.0.1:<port> node --test --test-concurrency=1 tests/quality-rebuild.test.mjs
// A phone under Auto builds the lighter garden; choosing Full rebuilds it at
// full detail, keeping the trees, the chapter, the stage and ambient motion;
// Light rebuilds the lighter one. On a desktop Full and Light share a tier,
// so nothing is rebuilt.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage, waitForSceneSettled } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

const ready = () => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live;
async function live(options, hash) {
  return setupPage(browser, options, async page => {
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    await page.goto(`${base}/${hash}`);
    await page.waitForFunction(ready, null, { timeout: 60000 });
  });
}
const facts = p => p.evaluate(() => {
  const s = window.__notebookScene.state();
  const box = document.querySelector('.scene-garden');
  return {
    rebuilds: window.__notebookStats().rebuilds, rebuilding: s.rebuilding, renderer: s.renderer, live: s.live,
    chapter: s.chapter, pose: s.pose.chapter, detail: box.dataset.detail, quality: box.dataset.quality,
    canvases: box.querySelectorAll('canvas').length, trees: document.querySelector('[data-tree-count]').textContent,
  };
});

test('phone: Full rebuilds the lighter garden at full detail with the trees and chapter kept; Light rebuilds it back', async () => {
  const p = await live(phone, '#whisperbook');
  try {
    // An observer records whether the stage ever stood empty during the rebuild.
    await p.evaluate(() => {
      window.__empty = 0;
      new MutationObserver(() => {
        const box = document.querySelector('.scene-garden');
        if (!box || !box.querySelector('canvas') || !document.querySelector('.scene-stage[data-live]')) window.__empty++;
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-live'] });
    });
    assert.deepEqual(await facts(p).then(f => [f.detail, f.quality, f.rebuilds]), ['low', 'light', 0]);
    await p.locator('.garden > summary').click();
    await p.locator('[data-plant-one]').click();
    await p.locator('[data-plant-one]').click();
    await p.waitForFunction(() => /^2 of 24 trees$/.test(document.querySelector('[data-tree-count]').textContent));
    const turned = await p.evaluate(() => window.__notebookScene.view().rotation);
    await p.locator('.garden-panel [data-quality="full"]').click();
    await p.waitForFunction(() => window.__notebookStats().rebuilds === 1 && !window.__notebookScene.state().rebuilding, null, { timeout: 90000 });
    await p.waitForFunction(ready);
    const full = await facts(p);
    assert.deepEqual(full, { rebuilds: 1, rebuilding: false, renderer: 'ready', live: true, chapter: 'whisperbook', pose: 'whisperbook', detail: 'full', quality: 'full', canvases: 1, trees: '2 of 24 trees' });
    assert.equal(await p.evaluate(() => window.__notebookScene.view().rotation), turned, 'the turn is kept');
    assert.equal(await p.evaluate(() => window.__empty), 0, 'the stage is never empty');
    // The rebuilt garden finishes its one-off actions.
    await waitForSceneSettled(p);
    await p.locator('.garden-panel [data-quality="light"]').click();
    await p.waitForFunction(() => window.__notebookStats().rebuilds === 2 && !window.__notebookScene.state().rebuilding, null, { timeout: 90000 });
    const light = await facts(p);
    assert.deepEqual([light.detail, light.quality, light.canvases, light.trees, light.chapter], ['low', 'light', 1, '2 of 24 trees', 'whisperbook']);
    await waitForSceneSettled(p);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('phone: a rebuild while exploring stays exploring with the same view', async () => {
  const p = await live(phone, '#bplog');
  try {
    await p.locator('.garden > summary').click();
    await p.locator('[data-explore]').click();
    await p.waitForFunction(() => document.documentElement.dataset.explore === 'true');
    await p.locator('[data-explore-zoom="in"]').click();
    const zoom = await p.evaluate(() => window.__notebookScene.view().zoom);
    // The panel is closed while exploring; the scene's own API changes the quality.
    await p.evaluate(() => document.querySelector('.garden-panel [data-quality="full"]').click());
    await p.waitForFunction(() => window.__notebookStats().rebuilds === 1 && !window.__notebookScene.state().rebuilding, null, { timeout: 90000 });
    const after = await p.evaluate(() => ({ exploring: window.__notebookScene.state().exploring, flag: document.documentElement.dataset.explore, zoom: window.__notebookScene.view().zoom, host: window.__notebookScene.state().host, detail: document.querySelector('.scene-garden').dataset.detail }));
    assert.deepEqual(after, { exploring: true, flag: 'true', zoom, host: 'explore', detail: 'full' });
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => window.__notebookScene.state().host), 'bplog');
    await waitForSceneSettled(p);
  } finally { await p.context().close(); }
});

test('desktop: Light keeps the full build, so nothing is rebuilt', async () => {
  const p = await live({ viewport: { width: 1440, height: 900 } }, '#about');
  try {
    await p.locator('.garden > summary').click();
    await p.locator('.garden-panel [data-quality="light"]').click();
    await p.waitForTimeout(1000);
    const f = await facts(p);
    assert.deepEqual([f.rebuilds, f.detail, f.quality, f.canvases], [0, 'full', 'light', 1]);
  } finally { await p.context().close(); }
});
