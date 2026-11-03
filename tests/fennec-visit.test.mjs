// A fennec visits a newly planted tree (decision 42), against a production
// preview (see tests/scene-lifecycle.test.mjs for the harness): deliberate
// planting brings one short visit when motion is allowed, a held garden draws
// that visit to its end and then sleeps again, and a paused garden brings none.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

async function live(viewport, hash) {
  return setupPage(browser, { viewport }, async page => {
    page.errors = [];
    page.on('pageerror', error => page.errors.push(error.message));
    await page.goto(`${base}/${hash}`);
    await page.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
  });
}
const garden = p => p.evaluate(() => window.__notebookStats().garden);
const frames = async p => (await garden(p)).frames;
/** Waits until the garden has drawn nothing for 500 ms. */
async function asleep(p, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const a = await frames(p);
    await p.waitForTimeout(500);
    if (await frames(p) === a) return;
  }
  throw new Error('the garden kept drawing');
}
/* The garden opens at night (the navy night set), when the fennecs are not
   out: they fade with the daylight, and an unseen fennec makes no visit. The
   panel's hour slider brings the day back, as a visitor would; then the held
   garden sleeps again before anything is planted. */
async function daytime(p) {
  await p.locator('[data-hour]').evaluate(input => { input.value = '13'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await asleep(p);
}
// SwiftShader draws slowly and the scene's step is capped at 50 ms a frame,
// so a visit of about ten simulated seconds can take minutes of wall time.
const VISIT_TIMEOUT = 240000;
const DESKTOP = { width: 1440, height: 900 };
const ambientClock = p => p.evaluate(() => document.querySelector('[data-animation-time]').dataset.animationTime);

test('desktop: planting brings a fennec to the new tree, then the held garden sleeps again', { timeout: 420000 }, async () => {
  const p = await live(DESKTOP, '#contact');
  try {
    await asleep(p);
    assert.equal((await garden(p)).visiting, false, 'no visit before planting');
    await p.locator('.garden > summary').click();
    await daytime(p);
    const clock = await ambientClock(p);
    await p.locator('[data-plant-one]').click();
    await p.waitForFunction(() => window.__notebookStats().garden.visiting === true, null, { timeout: 20000 });
    assert.equal(await p.evaluate(() => window.__notebookScene.state().settled), false, 'a visit is not settled');
    await p.waitForFunction(() => window.__notebookStats().garden.visiting === false, null, { timeout: VISIT_TIMEOUT });
    // Held, only the visitor moved: the ambient clock stood still throughout.
    assert.equal(await ambientClock(p), clock, 'ambient life stayed held during the visit');
    // The visit is not repeated on its own: the garden sleeps and stays asleep.
    await asleep(p);
    const settled = await p.evaluate(() => window.__notebookScene.state().settled);
    assert.equal(settled, true, 'the garden reports settled once the visit is over');
    const a = await frames(p);
    await p.waitForTimeout(3000);
    assert.equal(await frames(p), a, 'no frames drawn after the visit');
    assert.equal((await garden(p)).visiting, false);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('desktop: with motion paused, planting brings no visit', { timeout: 240000 }, async () => {
  const p = await live(DESKTOP, '#contact');
  try {
    await asleep(p);
    await p.locator('[data-scene-remote="pause"]').click();
    await p.waitForFunction(() => window.__notebookScene.state().motion === 'user-paused');
    await p.locator('.garden > summary').click();
    await daytime(p);
    await p.locator('[data-plant-one]').click();
    await p.waitForFunction(() => /^1 of 24 trees$/.test(document.querySelector('[data-tree-count]').textContent));
    for (let i = 0; i < 6; i++) {
      assert.equal((await garden(p)).visiting, false, 'no visit while paused');
      await p.waitForTimeout(500);
    }
    await asleep(p);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('desktop: pausing mid-visit ends the visit where the fennec stands, and the garden sleeps', { timeout: 240000 }, async () => {
  const p = await live(DESKTOP, '#contact');
  try {
    await asleep(p);
    await p.locator('.garden > summary').click();
    await daytime(p);
    await p.locator('[data-plant-one]').click();
    await p.waitForFunction(() => window.__notebookStats().garden.visiting === true, null, { timeout: 20000 });
    await p.locator('[data-scene-remote="pause"]').click();
    await p.waitForFunction(() => window.__notebookStats().garden.visiting === false, null, { timeout: 20000 });
    await asleep(p);
    assert.equal(await p.evaluate(() => window.__notebookScene.state().settled), true);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});
