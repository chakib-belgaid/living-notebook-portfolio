// Case-study evidence: restored figures, enlargement dialog, Inside
// Whisperbook and the browser Listen illustration, against a production
// preview of the static case pages:
//   npx vite build --outDir <dir> && npx vite preview --outDir <dir> --host 127.0.0.1 --port <port> --strictPort
//   TEST_URL=http://127.0.0.1:<port> node --test tests/case-evidence.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const origin = new URL(base).origin;
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => browser?.close());

const pages = {
  '/work/whispbook/': { lang: 'en', hero: '/assets/projects/whisperbook/now-playing.webp', gallery: ['read-along', 'voice-cast', 'library'], inside: true },
  '/fr/work/whispbook/': { lang: 'fr', hero: '/assets/projects/whisperbook/now-playing.webp', gallery: ['read-along', 'voice-cast', 'library'], inside: true },
  '/work/wattch/': { lang: 'en', hero: '/assets/projects/wattch/deterministic-trace.png', gallery: ['energy-tests'] },
  '/fr/work/wattch/': { lang: 'fr', hero: '/assets/projects/wattch/deterministic-trace.png', gallery: ['energy-tests'] },
};
const L = {
  en: { actual: 'Actual size', fit: 'Fit image', close: 'Close', start: 'Step inside', next: 'Next', back: 'Back', step: /^Step (\d) of 4: /, listen: 'Listen', stop: 'Stop', hint: 'View full size',
    illustration: 'A browser illustration using your device’s voices. It is not the Android app’s narration engine.', nojs: /needs JavaScript/, unavailable: /cannot be played here/ },
  fr: { actual: 'Taille réelle', fit: 'Adapter l’image', close: 'Fermer', start: 'Entrer', next: 'Suivant', back: 'Précédent', step: /^Étape (\d) sur 4 : /, listen: 'Écouter', stop: 'Arrêter', hint: 'Voir en grand',
    illustration: 'Une illustration dans le navigateur, avec les voix de votre appareil. Ce n’est pas le moteur de narration de l’application Android.', nojs: /nécessite JavaScript/, unavailable: /ne peut pas être lu ici/ },
};

/** A page with errors and every request recorded; `init` runs before the page's scripts. */
async function open(path, { viewport = desktop, javaScriptEnabled = true, reducedMotion = 'no-preference', init } = {}) {
  return setupPage(browser, { viewport, javaScriptEnabled, reducedMotion }, async p => {
    p.errors = [];
    p.requests = [];
    p.on('pageerror', e => p.errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
    p.on('request', r => p.requests.push(r.url()));
    if (init) await p.addInitScript(init);
    await p.goto(base + path, { waitUntil: 'load' });
  });
}
const close = p => p.context().close();
const offOrigin = p => p.requests.filter(u => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin);
const active = p => p.evaluate(() => {
  const el = document.activeElement;
  return el ? `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''}${el.getAttribute('href') ? `[href=${el.getAttribute('href')}]` : ''}` : null;
});

/** A stand-in speech engine: one remote and two local voices, recording every call. */
function fakeSpeech() {
  const calls = { speak: 0, cancel: 0, texts: [] };
  window.__speech = calls;
  const voices = [
    { name: 'Remote English', lang: 'en-US', localService: false },
    { name: 'Local English', lang: 'en-GB', localService: true },
    { name: 'Local French', lang: 'fr-FR', localService: true },
    { name: 'Local German', lang: 'de-DE', localService: true },
  ];
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices,
    speak(u) { calls.speak++; calls.texts.push(u.text); calls.last = u; },
    cancel() { calls.cancel++; },
    addEventListener() {}, removeEventListener() {},
  } });
}
/** Counts real speak() calls without stopping the browser's own engine. */
function countSpeech() {
  window.__spoken = 0;
  if (!('speechSynthesis' in window)) return;
  const speak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = u => { window.__spoken++; return speak(u); };
}

for (const [path, info] of Object.entries(pages)) {
  const t = L[info.lang];
  test(`${path}: figures restored, sized, decoded, hero eager and preloaded, gallery lazy`, async () => {
    const p = await open(path);
    try {
      const figures = await p.$$eval('figure.case-figure', fs => fs.map(f => {
        const img = f.querySelector('img');
        return { src: img.getAttribute('src'), w: img.getAttribute('width'), h: img.getAttribute('height'), loading: img.getAttribute('loading'), decoding: img.getAttribute('decoding'),
          link: f.querySelector('a.case-figure__open')?.getAttribute('href'), caption: f.querySelector('figcaption')?.textContent.trim(), alt: img.alt, hero: f.classList.contains('case-figure--hero') };
      }));
      assert.equal(figures.length, 1 + info.gallery.length);
      const [hero, ...gallery] = figures;
      assert.ok(hero.hero && hero.src === info.hero && hero.loading === 'eager', JSON.stringify(hero));
      assert.equal(await p.locator(`link[rel="preload"][as="image"][href="${info.hero}"]`).count(), 1, 'hero preload');
      assert.deepEqual(gallery.map(g => g.src.split('/').pop().replace(/\.\w+$/, '')), info.gallery);
      for (const f of figures) {
        assert.ok(/^\d+$/.test(f.w) && /^\d+$/.test(f.h), `${f.src} reserves its size`);
        assert.equal(f.decoding, 'async');
        assert.equal(f.link, f.src, 'no-JS fallback links to the file');
        assert.ok(f.caption.length > 40 && f.alt.length > 20, `${f.src} caption and alt`);
      }
      assert.ok(gallery.every(g => g.loading === 'lazy'), 'gallery is lazy');
      if (path.includes('whispbook')) assert.ok(figures.every(f => f.w === '941' && f.h === '1672'));
      else assert.deepEqual(figures.map(f => `${f.w}x${f.h}`), ['1600x1000', '1440x900']);
      // Provenance wording survives: synthetic/deterministic evidence is labelled as such.
      if (path.includes('wattch')) assert.match(gallery[0].caption, /synth/);
      // Every image decodes once in view, and its box keeps the file's proportions.
      for (const img of await p.locator('figure.case-figure img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(i => i.complete && i.naturalWidth ? true : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 5000); }));
        const m = await img.evaluate(i => ({ nw: i.naturalWidth, w: i.clientWidth, h: i.clientHeight, aw: +i.getAttribute('width'), ah: +i.getAttribute('height') }));
        assert.ok(m.nw > 0, 'decoded');
        assert.ok(Math.abs(m.w / m.h - m.aw / m.ah) < 0.02, `uncropped box ${JSON.stringify(m)}`);
      }
      assert.deepEqual(offOrigin(p), []);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });

  test(`${path}: the enlargement dialog opens, toggles actual size, closes on Escape and returns focus`, async () => {
    const p = await open(path);
    try {
      const link = p.locator('figure.case-figure a.case-figure__open').last();
      assert.equal(await link.getAttribute('aria-haspopup'), 'dialog');
      assert.match(await link.innerText(), new RegExp(t.hint));
      await link.click();
      const dialog = p.locator('dialog.case-lightbox');
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.evaluate(d => d.open && d.matches(':modal')), true);
      const caption = await p.locator('figure.case-figure').last().locator('figcaption').innerText();
      assert.equal(await dialog.evaluate(d => document.getElementById(d.getAttribute('aria-labelledby')).textContent), caption, 'labelled by the caption');
      const img = dialog.locator('img');
      await img.evaluate(i => i.complete && i.naturalWidth ? true : new Promise(r => i.addEventListener('load', r, { once: true })));
      const fit = await img.evaluate(i => ({ w: i.clientWidth, nw: i.naturalWidth }));
      assert.ok(fit.w <= desktop.width && fit.w < fit.nw + 1, 'fits');
      const size = dialog.locator('.case-lightbox__size');
      assert.equal(await size.innerText(), t.actual);
      await size.click();
      assert.equal(await dialog.getAttribute('data-size'), 'actual');
      assert.equal(await size.innerText(), t.fit);
      const actual = await img.evaluate(i => i.clientWidth);
      assert.equal(actual, fit.nw, 'actual size is the natural width');
      await size.click();
      assert.equal(await dialog.getAttribute('data-size'), 'fit');
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.querySelector('dialog.case-lightbox').open);
      assert.equal(await p.evaluate(() => document.activeElement === [...document.querySelectorAll('a.case-figure__open')].at(-1)), true, 'focus returns to the control');
      // Transitions are off for reduced motion (there are none at all).
      assert.equal(await dialog.evaluate(d => getComputedStyle(d).transitionDuration), '0s');
      assert.deepEqual(offOrigin(p), []);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });

  test(`${path}: keyboard alone at 390×844 opens, sizes and closes the dialog`, async () => {
    const p = await open(path, { viewport: phone });
    try {
      const link = p.locator('a.case-figure__open').first();
      await link.focus();
      await p.keyboard.press('Enter');
      await p.locator('dialog.case-lightbox[open]').waitFor();
      assert.equal(await active(p), 'button.case-button.case-lightbox__close');
      await p.keyboard.press('Shift+Tab');
      assert.equal(await active(p), 'button.case-button.case-lightbox__size');
      await p.keyboard.press('Enter');
      assert.equal(await p.locator('dialog.case-lightbox').getAttribute('data-size'), 'actual');
      // The image frame scrolls by keyboard at actual size.
      await p.keyboard.press('Tab');
      await p.keyboard.press('Tab');
      assert.equal(await active(p), 'div.case-lightbox__frame');
      await p.keyboard.press('ArrowDown');
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.querySelector('dialog.case-lightbox').open);
      assert.equal(await p.evaluate(() => document.activeElement === document.querySelector('a.case-figure__open')), true);
      // Each control is at least 44px tall and the page has no horizontal scroll.
      await link.click();
      for (const b of await p.locator('dialog.case-lightbox button').all()) assert.ok((await b.boundingBox()).height >= 44);
      await p.locator('dialog.case-lightbox .case-lightbox__close').click();
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });

  test(`${path}: readable without JavaScript`, async () => {
    const p = await open(path, { javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
    try {
      assert.equal(await p.locator('figure.case-figure a[href^="/assets/projects/"] img').count(), 1 + info.gallery.length);
      assert.equal(await p.locator('dialog').count(), 0);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll at 320px');
      if (info.inside) {
        const steps = p.locator('[data-case-inside] ol > li');
        assert.equal(await steps.count(), 4);
        for (const s of await steps.all()) assert.ok(await s.isVisible());
        assert.equal(await p.locator('.case-inside__start').count(), 0);
        assert.equal(await p.locator('.case-listen__play').isDisabled(), true);
        assert.match(await p.locator('.case-listen__voice').innerText(), t.nojs);
        assert.equal(await p.locator('.case-listen__label').innerText(), t.illustration);
        assert.equal(await p.locator('.case-listen__lines li').count(), 2);
      }
      assert.deepEqual(offOrigin(p), []);
    } finally { await close(p); }
  });
}

for (const lang of ['en', 'fr']) {
  const path = lang === 'fr' ? '/fr/work/whispbook/' : '/work/whispbook/';
  const t = L[lang];
  test(`${path}: Inside Whisperbook steps through by keyboard at 390×844`, async () => {
    const p = await open(path, { viewport: phone });
    try {
      const box = p.locator('[data-case-inside]');
      const start = box.locator('.case-inside__start');
      assert.equal(await start.innerText(), t.start);
      assert.equal(await start.getAttribute('aria-expanded'), 'false');
      assert.equal(await box.locator('ol').isHidden(), true);
      await start.focus();
      await p.keyboard.press('Enter');
      assert.equal(await start.getAttribute('aria-expanded'), 'true');
      const count = box.locator('.case-inside__count');
      assert.equal(await count.getAttribute('aria-live'), 'polite');
      for (let n = 1; n <= 4; n++) {
        assert.match(await count.innerText(), t.step);
        assert.equal((await count.innerText()).match(t.step)[1], String(n));
        assert.equal(await box.locator('li[aria-current="step"]').getAttribute('value'), String(n));
        assert.equal(await box.locator('li:visible').count(), 1);
        if (n < 4) {
          assert.equal(await active(p), 'button.case-button.case-inside__next');
          await p.keyboard.press('Enter');
        }
      }
      assert.equal(await box.locator('.case-inside__next').isHidden(), true, 'no Next on the last step');
      assert.equal(await active(p), 'button.case-button.case-inside__close');
      // Back by keyboard.
      await box.locator('.case-inside__back').focus();
      await p.keyboard.press('Enter');
      assert.equal(await box.locator('li[aria-current="step"]').getAttribute('value'), '3');
      // Escape closes and returns focus to Step inside.
      await p.keyboard.press('Escape');
      assert.equal(await start.getAttribute('aria-expanded'), 'false');
      assert.equal(await box.locator('ol').isHidden(), true);
      assert.equal(await active(p), 'button.case-button.case-inside__start');
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });

  test(`${path}: with reduced motion, Step inside shows all four steps together`, async () => {
    const p = await open(path, { reducedMotion: 'reduce' });
    try {
      const box = p.locator('[data-case-inside]');
      await box.locator('.case-inside__start').click();
      assert.equal(await box.locator('li:visible').count(), 4);
      assert.equal(await box.locator('li[aria-current]').count(), 0);
      assert.equal(await box.locator('.case-inside__next').isHidden(), true);
      assert.equal(await box.locator('.case-inside__back').isHidden(), true);
      assert.equal(await active(p), 'button.case-button.case-inside__close');
      await p.keyboard.press('Enter');
      assert.equal(await box.locator('ol').isHidden(), true);
    } finally { await close(p); }
  });

  test(`${path}: Listen never auto-plays; the real browser reports a voice or explains why not`, async () => {
    const p = await open(path, { init: countSpeech });
    try {
      const box = p.locator('[data-case-listen]');
      await p.waitForFunction(() => document.querySelector('[data-case-listen]').dataset.state !== 'searching', null, { timeout: 4000 });
      const state = await box.getAttribute('data-state');
      const status = await box.locator('.case-listen__voice').innerText();
      const play = box.locator('.case-listen__play');
      if (state === 'unavailable') {
        assert.equal(await play.isDisabled(), true);
        assert.match(status, t.unavailable);
      } else {
        assert.equal(state, 'ready');
        assert.equal(await play.isDisabled(), false);
        assert.match(status, / · /, 'names the voice');
        assert.equal(await play.getAttribute('aria-label'), t.listen);
      }
      assert.equal(await box.locator('.case-listen__label').innerText(), t.illustration);
      await p.waitForTimeout(500);
      assert.equal(await p.evaluate(() => window.__spoken), 0, 'nothing spoken automatically');
      assert.deepEqual(offOrigin(p), []);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });

  test(`${path}: Listen uses only a local voice in the page language and stops on Stop, hide, pagehide and leaving links`, async () => {
    const p = await open(path, { init: fakeSpeech });
    try {
      const box = p.locator('[data-case-listen]');
      const play = box.locator('.case-listen__play');
      await p.waitForFunction(() => document.querySelector('[data-case-listen]').dataset.state === 'ready');
      const voice = lang === 'fr' ? 'Local French' : 'Local English';
      assert.match(await box.locator('.case-listen__voice').innerText(), new RegExp(voice));
      assert.equal(await p.evaluate(() => window.__speech.speak), 0, 'not before the click');
      const calls = () => p.evaluate(() => ({ speak: window.__speech.speak, cancel: window.__speech.cancel, voice: window.__speech.last?.voice?.name, lang: window.__speech.last?.lang, texts: window.__speech.texts }));
      // Play by keyboard, then Stop.
      await play.focus();
      await p.keyboard.press('Enter');
      let c = await calls();
      assert.equal(c.speak, 2);
      assert.equal(c.voice, voice);
      assert.match(c.lang, new RegExp(`^${lang}`));
      assert.equal(c.texts[0], await box.locator('.case-listen__lines li q').first().innerText(), 'speaks the page’s own text');
      assert.equal(await play.getAttribute('aria-label'), t.stop);
      const cancelled = c.cancel;
      await p.keyboard.press('Enter');
      assert.equal(await play.getAttribute('aria-label'), t.listen);
      assert.ok((await calls()).cancel > cancelled, 'Stop cancels');
      // Hidden page.
      await play.click();
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await play.getAttribute('aria-label'), t.listen);
      await p.evaluate(() => { delete document.hidden; });
      // pagehide.
      await play.click();
      await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      assert.equal(await play.getAttribute('aria-label'), t.listen);
      // A link that leaves the page (navigation held back here).
      await play.click();
      await p.evaluate(() => window.addEventListener('click', e => e.preventDefault(), { capture: true, once: true }));
      const before = (await calls()).cancel;
      await p.locator('a[data-return]').first().click();
      assert.equal(await play.getAttribute('aria-label'), t.listen);
      assert.ok((await calls()).cancel > before);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });

  test(`${path}: Listen is disabled with an explanation when no speech engine exists`, async () => {
    const p = await open(path, { init: () => { delete window.speechSynthesis; delete Window.prototype.speechSynthesis; } });
    try {
      const box = p.locator('[data-case-listen]');
      assert.equal(await p.evaluate(() => 'speechSynthesis' in window), false);
      assert.equal(await box.getAttribute('data-state'), 'unavailable');
      assert.equal(await box.locator('.case-listen__play').isDisabled(), true);
      assert.match(await box.locator('.case-listen__voice').innerText(), t.unavailable);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });
}

test('MCQ Scan pages carry their own social card and no case images', async () => {
  for (const [path, lang] of [['/work/mcq-scan/', 'en'], ['/fr/work/mcq-scan/', 'fr']]) {
    const p = await open(path);
    try {
      assert.equal(await p.locator('meta[property="og:image"]').getAttribute('content'), `https://chakib-belgaid.github.io/assets/social/mcq-scan-${lang}.png`);
      assert.equal(await p.locator('img').count(), 0);
      assert.deepEqual(offOrigin(p), []);
    } finally { await close(p); }
  }
});

test('case pages point og/twitter images at their self-hosted 1200×630 cards', async () => {
  for (const [path, lang] of [['/work/whispbook/', 'en'], ['/fr/work/whispbook/', 'fr'], ['/work/wattch/', 'en'], ['/fr/work/wattch/', 'fr']]) {
    const p = await open(path, { javaScriptEnabled: false });
    try {
      const slug = path.split('/').at(-2);
      const card = `https://chakib-belgaid.github.io/assets/social/${slug}-${lang}.png`;
      const meta = sel => p.locator(sel).getAttribute('content');
      assert.equal(await meta('meta[property="og:image"]'), card);
      assert.equal(await meta('meta[name="twitter:image"]'), card);
      assert.equal(await meta('meta[property="og:image:type"]'), 'image/png');
      assert.equal(await meta('meta[property="og:image:width"]'), '1200');
      assert.equal(await meta('meta[property="og:image:height"]'), '630');
    } finally { await close(p); }
  }
});
