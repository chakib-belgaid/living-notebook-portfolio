// TEST_URL targets a production preview; the exported assertions also support
// request-intercepted production files when a sandbox cannot bind a port.
import { test, before, after } from 'node:test';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';
import { assertHeader, assertLanding, assertMobilePriorities, assertRuler, assertSceneIsolation } from './ux-regressions.mjs';
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());
async function open(locale, viewport) {
  return setupPage(browser, { viewport, reducedMotion: 'reduce' }, async page => {
    await page.goto(`${base}/?lang=${locale}`);
    await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  });
}
for (const locale of ['en', 'fr', 'ar']) {
  for (const width of [320, 390, 768, 900, 1440]) {
    test(`${locale} ${width}px: 200% text reflows controls and keeps focus landings clear`, async () => {
      const p = await open(locale, { width, height: 844 });
      try {
        await p.evaluate(() => document.documentElement.style.fontSize = '32px');
        await p.waitForTimeout(100);
        await assertHeader(p);
        await assertLanding(p, 'contact');
        await assertLanding(p, 'work');
      } finally { await p.context().close(); }
    });
  }
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
    test(`${locale} ${viewport.width}×${viewport.height}: Work choices and contact action precede the scene`, async () => {
      const p = await open(locale, viewport);
      try { await assertHeader(p); await assertMobilePriorities(p); await assertRuler(p, false); }
      finally { await p.context().close(); }
    });
  }
  for (const viewport of [{ width: 900, height: 700 }, { width: 1440, height: 900 }]) {
    test(`${locale} ${viewport.width}×${viewport.height}: the ruler sits beside the chapter card with the tally on screen`, async () => {
      const p = await open(locale, viewport);
      try { await assertLanding(p, 'about'); await assertRuler(p, true); }
      finally { await p.context().close(); }
    });
  }
}
for (const portrait of [false, true]) {
  test(`${portrait ? 'portrait' : 'wide'} capture excludes overlapping UI while preserving the stage`, async () => {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try { await assertSceneIsolation(p, portrait); } finally { await p.close(); }
  });
}
