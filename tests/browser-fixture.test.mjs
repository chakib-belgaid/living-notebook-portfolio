import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

test('failed fixture setup releases its browser context and preserves the error', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const failure = new Error('fixture could not become ready');
    await assert.rejects(setupPage(browser, {}, async p => {
      await p.setContent('<h1>Preparing</h1>');
      throw failure;
    }), error => error === failure);
    assert.equal(browser.contexts().length, 0, 'failed setup must not leave a renderer running');
    const p = await setupPage(browser, {}, p => p.setContent('<h1>Ready</h1>'));
    assert.equal(await p.getByRole('heading').innerText(), 'Ready');
    await p.context().close();
    assert.equal(browser.contexts().length, 0);
  } finally { await browser.close(); }
});
