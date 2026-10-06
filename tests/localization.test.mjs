import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolveLocale, translate } from '../src/i18n.ts';
import { translations } from '../src/translations.ts';
import { projects, beats } from '../src/content.ts';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => browser?.close());

async function page(viewport = { width: 1440, height: 900 }, locale = 'en-US') {
  const context = await browser.newContext({ viewport, locale });
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', error => p.errors.push(error.message));
  await p.route('**/*open-meteo.com/**', route => route.abort());
  return p;
}
async function ready(p, path) {
  await p.goto(base + '/' + path);
  await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
}
async function select(p, locale) {
  await p.locator('[data-language]').selectOption(locale);
  await p.waitForFunction(value => document.documentElement.lang === value, locale);
}

test('language precedence is URL, saved choice, supported browser language, then English', () => {
  assert.equal(resolveLocale(base + '/?lang=ar', 'fr', ['en-US']), 'ar');
  assert.equal(resolveLocale(base + '/?lang=unknown', 'fr', ['ar-DZ']), 'fr');
  assert.equal(resolveLocale(base, null, ['de-DE', 'fr-CA']), 'fr');
  assert.equal(resolveLocale(base, 'invalid', ['ar_DZ']), 'ar');
  assert.equal(resolveLocale(base, null, ['de-DE']), 'en');
});

test('both translations cover portfolio narratives and retain every message placeholder', () => {
  for (const locale of ['fr', 'ar']) {
    for (const p of Object.values(projects)) {
      for (const key of ['place', 'field', 'lede', 'intro', 'built', 'decision', 'alt', 'caption', 'summary', 'status', 'outcome', 'limits', 'availability', 'performance', 'releaseNote']) {
        assert.notEqual(translate(p[key], locale), p[key], `${locale}: ${p.title}.${key}`);
      }
    }
    for (const beat of beats) {
      for (const value of [beat.copy, beat.hint].filter(Boolean)) assert.notEqual(translate(value, locale), value);
    }
  }
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [source, values] of Object.entries(translations)) {
    values.forEach(value => assert.deepEqual(placeholders(value), placeholders(source), source));
  }
  assert.equal(translate('Ordinary English sentence.', 'ar'), 'Ordinary English sentence.');
  assert.equal(translate('Previewing winter.', 'ar'), 'معاينة: الشتاء.');
  assert.equal(translate('Build, note 8 of 16', 'fr'), 'Construction, note 8 sur 16');
});

test('switching in place keeps the contact link, link targets and history; the preference survives reload', async () => {
  const p = await page();
  try {
    await ready(p, '?view=read&lang=en#contact');
    const email = p.locator('#contact .note-email a');
    await email.evaluate(el => { window.emailNode = el; });
    await select(p, 'fr');
    assert.equal(await p.locator('.masthead a[href="#work"]').innerText(), 'Projets');
    assert.match(await p.title(), /Ingénieur produit/);
    await select(p, 'ar');
    assert.equal(await p.locator('html').getAttribute('dir'), 'rtl');
    assert.ok(await email.evaluate(el => el === window.emailNode), 'the link is translated in place');
    assert.match(await email.innerText(), /راسلني/);
    assert.equal(await email.getAttribute('href'), 'mailto:chakib.belgaid@gmail.com');
    assert.equal(await p.locator('#whisperbook .source-link').getAttribute('href'), projects.whisperbook.url);
    assert.match(await p.locator('.view-switch').getAttribute('href'), /lang=ar/);
    await p.goBack();
    assert.equal(await p.locator('html').getAttribute('lang'), 'fr');
    await ready(p, '?view=read');
    assert.equal(await p.locator('html').getAttribute('lang'), 'ar');
    await p.reload();
    assert.equal(await p.locator('[data-language]').inputValue(), 'ar');
    await select(p, 'en');
    assert.equal(await p.locator('.reading-lede').first().innerText(), beats[0].copy);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('a browser language works with blocked storage and history restores the initial language', async () => {
  const p = await page({ width: 390, height: 844 }, 'ar-DZ');
  try {
    await p.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    await ready(p, '?view=read');
    assert.equal(await p.locator('html').getAttribute('lang'), 'ar');
    await select(p, 'fr');
    await p.goBack();
    assert.equal(await p.locator('html').getAttribute('lang'), 'ar');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('the Arabic phone journey opens translated details and all languages reflow at 200% text', async () => {
  const p = await page({ width: 320, height: 568 });
  try {
    await ready(p, '?view=garden&lang=ar');
    assert.equal(await p.locator('html').getAttribute('data-journey'), 'true');
    await p.locator('#intro-title').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
    const letters = await p.locator('#intro-title .word').first().locator('.char').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
    assert.ok(letters.every((x, i) => i === 0 || x > letters[i - 1]), 'Latin name letters retain their order in RTL');
    await p.locator('.masthead a[href="#about"]').click();
    await p.getByRole('button', { name: 'عرض تفاصيل مساري المهني', exact: true }).click();
    assert.equal(await p.locator('#sheet-title').innerText(), 'المسيرة');
    assert.match(await p.locator('.sheet-body').innerText(), /مهندس ذكاء اصطناعي رئيسي/);
    await p.getByRole('button', { name: 'أغلق', exact: true }).click();
    await p.locator('dialog.sheet').waitFor({ state: 'hidden' });
    for (const locale of ['en', 'fr', 'ar']) {
      await select(p, locale);
      await p.addStyleTag({ content: ':root {font-size:200%;}' });
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), locale);
    }
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('Whisperbook reads translated text using a local voice in the selected language', async () => {
  const p = await page();
  try {
    await p.addInitScript(() => {
      window.spoken = [];
      window.cancelled = 0;
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [
          { name: 'English local', lang: 'en-US', localService: true },
          { name: 'French local', lang: 'fr-FR', localService: true },
          { name: 'Arabic local', lang: 'ar-SA', localService: true },
          { name: 'French network', lang: 'fr-FR', localService: false },
        ],
        cancel: () => { window.cancelled++; },
        speak: utterance => window.spoken.push({ text: utterance.text, lang: utterance.lang, voice: utterance.voice.name }),
        addEventListener() {}, removeEventListener() {},
      } });
    });
    await ready(p, '?view=read&lang=fr#whisperbook');
    await p.locator('[data-illustration="whisperbook"] summary').click();
    await p.getByRole('button', { name: 'Lire', exact: true }).click();
    assert.deepEqual(await p.evaluate(() => window.spoken.map(u => u.lang)), ['fr-FR', 'fr-FR']);
    assert.match(await p.evaluate(() => window.spoken[0].text), /Alice commençait/);
    assert.ok(await p.evaluate(() => window.spoken.every(u => u.voice === 'French local')));
    await select(p, 'ar');
    assert.ok(await p.evaluate(() => window.cancelled >= 2));
    await p.getByRole('button', { name: 'شغّل', exact: true }).click();
    const last = await p.evaluate(() => window.spoken.slice(-2));
    assert.ok(last.every(u => u.lang === 'ar-SA'));
    assert.match(last[0].text, /بدأت أليس/);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});
