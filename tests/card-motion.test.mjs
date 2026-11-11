// Card motion (src/narrative/card-motion.ts): the landmark stop, its glide and
// the fade. The curve itself is checked without a browser, on `glide`.
// TEST_URL targets a production preview, as in tests/ux-regressions.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';
import { glide } from '../src/narrative/card-motion.ts';
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

const open = (options, path = '/') => setupPage(browser, options, async page => {
  await page.goto(base + path);
  await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
});
/** A chapter card's place on screen and its fade, after the frame that follows a scroll. */
const card = (page, id) => page.evaluate(async id => {
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  const el = document.querySelector(`#${id} .chapter-card`);
  const box = el.getBoundingClientRect();
  return { top: box.top, bottom: box.bottom, opacity: Number(el.style.opacity || 1) };
}, id);
const scrollBy = (page, dy) => page.evaluate(dy => window.scrollBy({ top: dy, behavior: 'instant' }), dy);

test('glide: the drawn speed never jumps, and the card is where layout has it outside the stop', () => {
  const travel = 675, drift = 63, lead = 405, tail = 300, start = 31.5;
  // Where the card is drawn below its stop: layout's own place plus the offset.
  const drawn = s => (s < 0 ? -s : s <= travel ? 0 : travel - s) + glide(s, travel, drift, lead, tail, start);
  assert.equal(glide(-lead - 1, travel, drift, lead, tail, start), 0);
  assert.equal(glide(travel + tail + 1, travel, drift, lead, tail, start), 0);
  let previous = null, slowest = Infinity;
  for (let s = -lead - 40; s <= travel + tail + 40; s += 2) {
    const speed = (drawn(s) - drawn(s + 2)) / 2; // upward px per px of scroll
    assert.ok(speed > 0, `the card never moves back (s=${s}, speed=${speed})`);
    if (previous !== null) assert.ok(Math.abs(speed - previous) < 0.03, `no jump in speed at s=${s}: ${previous} → ${speed}`);
    previous = speed;
    if (s > 0 && s < travel) slowest = Math.min(slowest, speed);
  }
  // Through the stop it drifts at about a tenth of the scroll: slow, not still.
  assert.ok(slowest > 0.05 && slowest < 0.15, String(slowest));
});

test('wide: a card lingers at its stop, drifting slowly, then fades as its chapter ends', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } }, '/#work');
  try {
    assert.deepEqual(
      await p.evaluate(() => [...document.querySelectorAll('.chapter')].map(c => c.hasAttribute('data-dwell'))),
      [true, true, true, true, true, true, true, false], 'every card but the closing one stops');
    const landed = await card(p, 'work');
    assert.equal(landed.opacity, 1);
    // Through the stop, 300px of scroll moves the card by about a tenth of that.
    await scrollBy(p, 60);
    const stopped = await card(p, 'work');
    await scrollBy(p, 300);
    const held = await card(p, 'work');
    const moved = stopped.top - held.top;
    assert.ok(moved > 5 && moved < 60, JSON.stringify({ stopped, held }));
    assert.equal(held.opacity, 1);
    // Past the stop the chapter's end carries it away, fading.
    await scrollBy(p, 700);
    const leaving = await card(p, 'work');
    assert.ok(leaving.top < landed.top - 50 && leaving.opacity < 1, JSON.stringify({ landed, leaving }));
    // The next card rises from the foot of the viewport, fading in.
    const next = await card(p, 'bplog');
    assert.ok(next.top < 900, JSON.stringify(next));
    await scrollBy(p, 600);
    assert.equal((await card(p, 'bplog')).opacity, 1);
  } finally { await p.context().close(); }
});

test('wide: a card taller than the viewport stops once its last line is on screen', async () => {
  const p = await open({ viewport: { width: 1440, height: 700 } }, '/#mcq-scan');
  try {
    const landed = await card(p, 'mcq-scan');
    assert.ok(landed.bottom > 700, 'the card is taller than the viewport');
    await scrollBy(p, landed.bottom - 700 + 80);
    const stopped = await card(p, 'mcq-scan');
    assert.ok(stopped.bottom <= 700 && stopped.bottom > 600, JSON.stringify(stopped));
    await scrollBy(p, 200);
    const held = await card(p, 'mcq-scan');
    const moved = stopped.bottom - held.bottom;
    assert.ok(moved > 3 && moved < 40 && held.opacity === 1, JSON.stringify({ stopped, held }));
  } finally { await p.context().close(); }
});

test('reduced motion: no stop and no fade; the page is laid out as without the module', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    await scrollBy(p, 700);
    await card(p, 'intro');
    assert.deepEqual(await p.evaluate(() => ({
      motion: document.documentElement.classList.contains('card-motion'),
      stops: document.querySelectorAll('[data-dwell]').length,
      faded: [...document.querySelectorAll('.chapter-card, .chapter-lead')].filter(el => el.style.opacity || el.style.transform).length,
    })), { motion: false, stops: 0, faded: 0 });
  } finally { await p.context().close(); }
});

test('stacked: only a chapter’s lead fades in; no card stops and the page does not widen', async () => {
  const p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await scrollBy(p, 1300);
    await card(p, 'intro');
    const state = await p.evaluate(() => ({
      stops: document.querySelectorAll('[data-dwell]').length,
      cards: [...document.querySelectorAll('.chapter-card')].filter(el => el.style.opacity || el.style.transform).length,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    assert.deepEqual(state, { stops: 0, cards: 0, overflow: 0 });
  } finally { await p.context().close(); }
});

test('a card holding keyboard focus is fully shown even at the viewport’s foot', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  try {
    await scrollBy(p, 800);
    const rising = await card(p, 'work');
    assert.ok(rising.opacity < 1, JSON.stringify(rising));
    await p.keyboard.press('Tab');
    await p.evaluate(() => document.querySelector('#work .work-index a').focus({ preventScroll: true }));
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('#work .chapter-card')).opacity), '1');
  } finally { await p.context().close(); }
});
