// Explore the garden (src/narrative/explore.ts), against a production preview
// (see tests/scene-lifecycle.test.mjs for the harness):
//   TEST_URL=http://127.0.0.1:<port> node --test --test-concurrency=1 tests/exploration.test.mjs
// Entering shows the toolbar and the labelled places and moves focus to Back
// to reading; Escape returns focus to the panel's Explore button and the
// reading hold sleeps again; the wheel zooms only while exploring; a place
// opens its chapter; the phone's dialog unlocks the page when it closes;
// reduced motion enters and leaves without easing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const desktop = { viewport: { width: 1440, height: 900 } };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

const ready = () => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live;
async function live(options, hash = '#whisperbook') {
  return setupPage(browser, options, async page => {
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    await page.goto(`${base}/${hash}`);
    await page.waitForFunction(ready, null, { timeout: 60000 });
  });
}
const frames = p => p.evaluate(() => window.__notebookStats().garden.frames);
/** Waits until the garden has drawn nothing for 500 ms. */
async function asleep(p, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const a = await frames(p);
    await p.waitForTimeout(500);
    if (await frames(p) === a) return;
  }
  throw new Error('the garden kept drawing');
}
const view = p => p.evaluate(() => window.__notebookScene.view());
async function enter(p) {
  // Leaving exploring reopens the panel (focus returns to its Explore button).
  if (!await p.evaluate(() => document.querySelector('.garden').open)) await p.locator('.garden > summary').click();
  await p.locator('[data-explore]').click();
  await p.waitForFunction(() => document.documentElement.dataset.explore === 'true');
}
/** What a visitor sees and can reach while exploring. */
const exploring = p => p.evaluate(() => {
  const bar = document.querySelector('[data-explore-bar]');
  const spots = [...document.querySelectorAll('.hotspot')];
  return {
    flag: document.documentElement.dataset.explore ?? null,
    state: window.__notebookScene.state().exploring,
    bar: !bar.hidden && bar.getBoundingClientRect().height > 0,
    spots: spots.filter(h => !h.hidden && h.tabIndex === 0 && h.getBoundingClientRect().width > 0).map(h => h.dataset.spot),
    focus: document.activeElement?.hasAttribute('data-explore-exit') ?? false,
    status: document.querySelector('[data-garden-status]').textContent,
    stagePointer: getComputedStyle(document.querySelector('.scene-stage')).pointerEvents,
  };
});

for (const [label, options] of [['desktop', desktop], ['phone', phone]]) {
  test(`${label}: Explore enters with its toolbar and places, Escape returns to reading and the hold sleeps`, async () => {
    const p = await live(options);
    try {
      await asleep(p);
      const start = await p.evaluate(() => ({ y: scrollY, chapter: window.__notebookScene.state().chapter, hash: location.hash }));
      await enter(p);
      const inside = await exploring(p);
      assert.deepEqual(inside, {
        flag: 'true', state: true, bar: true,
        spots: ['bplog', 'whisperbook', 'wattch', 'workshop', 'about'],
        focus: true, status: 'Exploring the garden. Escape returns to reading.', stagePointer: 'auto',
      });
      if (label === 'phone') {
        // The stage is in the full-viewport dialog, and the page behind it is locked.
        const dialog = await p.evaluate(() => {
          const host = document.querySelector('[data-scene-host="explore"]');
          return { role: host.getAttribute('role'), modal: host.getAttribute('aria-modal'), stage: !!host.querySelector('.scene-stage'), bar: !!host.querySelector('[data-explore-bar]'), overflow: getComputedStyle(document.documentElement).overflow, inert: !!document.querySelector('main').closest('[inert]') };
        });
        assert.deepEqual(dialog, { role: 'dialog', modal: 'true', stage: true, bar: true, overflow: 'hidden', inert: true });
      }
      // Tab order: the toolbar, then the places are reachable.
      const reached = [];
      for (let i = 0; i < 12; i++) {
        await p.keyboard.press('Tab');
        const spot = await p.evaluate(() => document.activeElement?.dataset.spot ?? null);
        if (spot) reached.push(spot);
      }
      assert.ok(reached.length >= 1, `a place is reachable with Tab: ${reached}`);
      await p.keyboard.press('Escape');
      const back = await p.evaluate(() => ({
        flag: document.documentElement.dataset.explore ?? null,
        state: window.__notebookScene.state().exploring,
        focus: document.activeElement?.hasAttribute('data-explore') ?? false,
        bar: document.querySelector('[data-explore-bar]').hidden,
        spots: [...document.querySelectorAll('.hotspot')].every(h => h.hidden),
        chapter: window.__notebookScene.state().chapter,
        y: scrollY, hash: location.hash,
        overflow: getComputedStyle(document.documentElement).overflow,
        inert: !!document.querySelector('main').closest('[inert]'),
        host: window.__notebookScene.state().host,
      }));
      assert.deepEqual(
        { ...back, y: Math.abs(back.y - start.y) <= 2 },
        { flag: null, state: false, focus: true, bar: true, spots: true, chapter: start.chapter, y: true, hash: start.hash, overflow: 'visible', inert: false, host: label === 'phone' ? start.chapter : 'rail' },
      );
      // The chapter's pose is held again: no recurring frames.
      await asleep(p);
      assert.deepEqual(p.errors, []);
    } finally { await p.context().close(); }
  });

  test(`${label}: the wheel scrolls the page while reading and zooms the garden only while exploring`, async () => {
    const p = await live(options, '#bplog');
    try {
      await asleep(p);
      const box = await p.locator('.scene-stage').boundingBox();
      const at = { x: box.x + box.width * 0.75, y: box.y + box.height * 0.5 };
      const before = { view: await view(p), y: await p.evaluate(() => scrollY) };
      await p.mouse.move(at.x, at.y);
      await p.mouse.wheel(0, 300);
      await p.waitForFunction(y => Math.abs(scrollY - y) > 50, before.y);
      assert.deepEqual(await view(p), before.view, 'reading: the garden keeps its zoom');
      await enter(p);
      const inside = await p.locator('.scene-stage').boundingBox();
      await p.mouse.move(inside.x + inside.width * 0.7, inside.y + inside.height * 0.45);
      const y = await p.evaluate(() => scrollY);
      await p.mouse.wheel(0, -400);
      await p.waitForFunction(zoom => window.__notebookScene.view().zoom > zoom, before.view.zoom);
      assert.equal(await p.evaluate(() => scrollY), y, 'exploring: the wheel does not scroll the page');
      // The toolbar's equivalents: zoom, turn, reset.
      const zoomed = (await view(p)).zoom;
      await p.locator('[data-explore-zoom="in"]').click();
      assert.ok((await view(p)).zoom > zoomed);
      const turned = (await view(p)).rotation;
      await p.locator('[data-explore-turn="right"]').click();
      assert.ok((await view(p)).rotation > turned);
      await p.locator('[data-explore-reset]').click();
      assert.equal((await view(p)).zoom, 1);
      // A drag turns the garden.
      const r0 = (await view(p)).rotation;
      await p.mouse.move(inside.x + inside.width * 0.6, inside.y + inside.height * 0.3);
      await p.mouse.down();
      await p.mouse.move(inside.x + inside.width * 0.6 + 120, inside.y + inside.height * 0.3, { steps: 6 });
      await p.mouse.up();
      assert.ok(Math.abs((await view(p)).rotation - r0 - 120 * 0.008) < 0.05, 'a 120 px drag turns about 0.96 rad');
      await p.locator('[data-explore-exit]').click();
      assert.equal((await view(p)).zoom, 1, 'back to reading: the chapter\'s framing');
      assert.equal(await p.evaluate(() => document.activeElement?.hasAttribute('data-explore')), true);
    } finally { await p.context().close(); }
  });

  test(`${label}: a place opens its chapter, focuses its heading and ends exploring`, async () => {
    const p = await live(options, '#bplog');
    try {
      await enter(p);
      // Tab to the observatory's label and press Enter.
      let spot = null;
      for (let i = 0; i < 14 && spot !== 'wattch'; i++) {
        await p.keyboard.press('Tab');
        spot = await p.evaluate(() => document.activeElement?.dataset.spot ?? null);
      }
      assert.equal(spot, 'wattch');
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => location.hash === '#energy-tools' && document.activeElement?.id === 'energy-tools-title');
      const after = await p.evaluate(() => ({ flag: document.documentElement.dataset.explore ?? null, state: window.__notebookScene.state().exploring, chapter: window.__notebookScene.state().chapter, overflow: getComputedStyle(document.documentElement).overflow }));
      assert.deepEqual(after, { flag: null, state: false, chapter: 'energy-tools', overflow: 'visible' });
      await asleep(p);
    } finally { await p.context().close(); }
  });
}

test('phone: the page scrolls again after exploring', async () => {
  const p = await live(phone, '#whisperbook');
  try {
    await enter(p);
    await p.locator('[data-explore-exit]').click();
    const y = await p.evaluate(() => scrollY);
    await p.evaluate(() => window.scrollBy(0, 400));
    await p.waitForFunction(start => scrollY > start + 100, y);
    assert.equal(await p.evaluate(() => getComputedStyle(document.body).overflow), 'visible');
  } finally { await p.context().close(); }
});

test('reduced motion: Explore asks for the live drawing, then enters and leaves without easing', async () => {
  const p = await setupPage(browser, { ...desktop, reducedMotion: 'reduce' }, async page => {
    await page.goto(`${base}/#mcq-scan`);
    await page.waitForFunction(() => document.documentElement.dataset.renderer === 'not-requested');
  });
  try {
    let sound = 0;
    await p.exposeFunction('__soundStarted', () => { sound++; });
    await p.evaluate(() => { const A = window.AudioContext; if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); window.__soundStarted(); } }; });
    await enter(p);
    await p.waitForFunction(() => window.__notebookScene.state().live);
    assert.equal(await p.evaluate(() => document.querySelector('.scene-stage').hasAttribute('data-instant')), true);
    // Still: exploring draws its pose once and then nothing (no ambient life).
    await asleep(p);
    const a = await frames(p);
    await p.locator('[data-explore-zoom="in"]').click();
    await asleep(p);
    assert.ok(await frames(p) - a <= 3, `a zoom is drawn at once, not eased: ${await frames(p) - a} frames`);
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => window.__notebookScene.state().pose.chapter), 'mcq-scan');
    const b = await frames(p);
    await asleep(p);
    assert.ok(await frames(p) - b <= 3, 'the chapter pose lands at once');
    assert.equal(sound, 0, 'exploring never starts sound');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.sound), 'false');
  } finally { await p.context().close(); }
});

test('desktop: pause stills exploring, a lost renderer or a layout change ends it cleanly', async () => {
  const p = await live(desktop, '#about');
  try {
    await enter(p);
    // The rail is exposed while its places are reachable, and hidden again after.
    assert.equal(await p.evaluate(() => document.querySelector('[data-scene-host="rail"]').getAttribute('aria-hidden')), null);
    // Ambient life runs while exploring; the visitor's pause stills it.
    const a = await frames(p);
    await p.waitForTimeout(800);
    assert.ok(await frames(p) > a, 'exploring: water, foliage and sky life move');
    await p.locator('[data-scene-remote="pause"]').evaluate(b => b.click());
    await asleep(p);
    assert.equal(await p.evaluate(() => window.__notebookScene.state().exploring), true, 'pausing does not end exploring');
    await p.locator('[data-scene-remote="pause"]').evaluate(b => b.click());
    // A lost renderer ends exploring, focus back on Explore.
    await p.evaluate(() => { window.__lose = document.querySelector('.scene-garden canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await p.waitForFunction(() => document.documentElement.dataset.renderer === 'context-lost');
    assert.deepEqual(await p.evaluate(() => ({ flag: document.documentElement.dataset.explore ?? null, focus: document.activeElement?.hasAttribute('data-explore'), rail: document.querySelector('[data-scene-host="rail"]').getAttribute('aria-hidden') })), { flag: null, focus: true, rail: 'true' });
    await p.evaluate(() => window.__lose.restoreContext());
    await p.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
    // Wide → stacked while exploring: exploring ends and the stage goes to its slot.
    await enter(p);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction(() => !window.__notebookScene.state().exploring && window.__notebookScene.state().host === 'about');
    assert.equal(await p.evaluate(() => document.querySelector('[data-explore-bar]').hidden), true);
    await asleep(p);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});
