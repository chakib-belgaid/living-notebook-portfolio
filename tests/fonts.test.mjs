// The served Newsreader files hold only part of each variable axis
// (scripts/trim-fonts.sh, declared in src/fonts.css). These tests fail when
// the pages and those ranges stop agreeing, or when the files grow back.
// TEST_URL targets a production preview, as in tests/ux-regressions.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

/** The largest text, in px, each trimmed file has its own cut for (scripts/trim-fonts.sh). */
const LARGEST = { normal: 72, italic: 18 };

test('the two served font files stay within 150 KB together', async () => {
  const sizes = await Promise.all(['normal', 'italic'].map(async face =>
    (await stat(new URL(`../public/fonts/newsreader-${face}.woff2`, import.meta.url))).size));
  assert.ok(sizes[0] + sizes[1] <= 150_000, `fonts are ${sizes.join(' + ')} bytes`);
});

for (const [name, path, options] of [
  ['English, wide', '/?lang=en', { viewport: { width: 1440, height: 900 } }],
  ['French, stacked', '/?lang=fr', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  test(`${name}: every serif text asks for a weight, style and size the served files hold`, async () => {
    const p = await setupPage(browser, options, async page => {
      await page.goto(base + path);
      await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
      await page.evaluate(() => document.fonts.ready.then(() => true));
    });
    try {
      const { faces, asked } = await p.evaluate(() => {
        const faces = [...document.fonts].filter(f => /Newsreader/.test(f.family)).map(f => {
          const [low, high = low] = f.weight.split(' ').map(Number);
          return { style: f.style, low, high };
        });
        const asked = new Map();
        for (const el of document.querySelectorAll('body *')) {
          if (![...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) continue;
          const s = getComputedStyle(el);
          if (!/^"?Newsreader/.test(s.fontFamily)) continue;
          const key = `${s.fontStyle} ${s.fontWeight} ${parseFloat(s.fontSize)}`;
          if (!asked.has(key)) asked.set(key, { style: s.fontStyle, weight: Number(s.fontWeight), px: parseFloat(s.fontSize), el: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : '') });
        }
        return { faces, asked: [...asked.values()] };
      });
      assert.deepEqual(faces.map(f => f.style).sort(), ['italic', 'normal']);
      assert.ok(asked.some(a => a.style === 'italic') && asked.some(a => a.style === 'normal'), 'the page sets both faces');
      const outside = asked.filter(a => {
        const face = faces.find(f => f.style === a.style);
        return !face || a.weight < face.low || a.weight > face.high || a.px > LARGEST[a.style];
      });
      assert.deepEqual(outside, [], 'widen the range in scripts/trim-fonts.sh and src/fonts.css, or change the style');
    } finally { await p.context().close(); }
  });
}
