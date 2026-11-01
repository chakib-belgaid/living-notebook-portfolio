// P3 navigation, return and layout checks against a production preview:
//   npm run build && npx vite preview --host 127.0.0.1 --port <port> --strictPort
//   TEST_URL=http://127.0.0.1:<port> node --test tests/navigation.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => browser?.close());

/** A page with page errors collected; `blockStorage` makes sessionStorage throw. */
async function open(path, { viewport = desktop, blockStorage = false, javaScriptEnabled = true } = {}) {
  const page = await setupPage(browser, { viewport, javaScriptEnabled }, async p => {
    p.errors = [];
    p.on('pageerror', e => p.errors.push(e.message));
    if (blockStorage) await p.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Storage denied', 'SecurityError'); } });
    });
    await p.goto(base + path);
    // Case pages are static documents; only the homepage is enhanced.
    if (javaScriptEnabled && !/\/work\//.test(path)) await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    await p.evaluate(() => document.fonts.ready.then(() => true));
  });
  return page;
}
const close = p => p.context().close();
const settle = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const hash = p => p.evaluate(() => location.hash);
const historyLength = p => p.evaluate(() => history.length);
const focusedId = p => p.evaluate(() => document.activeElement?.id ?? null);
/** The element's top is below the sticky header and it starts in the upper half of the viewport. */
async function clearOfHeader(p, selector) {
  return p.evaluate(sel => {
    const el = document.querySelector(sel);
    const header = document.querySelector('.masthead').getBoundingClientRect();
    const sticky = getComputedStyle(document.querySelector('.masthead')).position === 'sticky';
    const box = el.getBoundingClientRect();
    return { ok: box.top >= (sticky ? header.bottom : 0) - 1 && box.top < innerHeight * 0.6 && box.bottom <= innerHeight, top: Math.round(box.top), header: Math.round(header.bottom) };
  }, selector);
}
const currentNav = p => p.evaluate(() => [...document.querySelectorAll('.primary-nav a[aria-current="page"]')].map(a => a.getAttribute('href')));

for (const [label, viewport] of [['desktop', desktop], ['phone', phone]]) {
  test(`${label}: explicit jumps push one entry, land at once and focus the heading`, async () => {
    const p = await open('/?utm_source=test', { viewport });
    try {
      const start = await historyLength(p);
      // The jump is immediate: the scroll position is final within the click's own task.
      const atClick = await p.evaluate(() => { document.querySelector('.nav-sections a[href="#work"]').click(); return scrollY; });
      await p.waitForTimeout(400);
      assert.equal(await p.evaluate(() => scrollY), atClick, 'no glide or second scroll');
      assert.equal(await hash(p), '#work');
      assert.equal(await p.evaluate(() => location.search), '?utm_source=test', 'query kept');
      assert.equal(await historyLength(p), start + 1);
      assert.equal(await focusedId(p), 'work-title');
      assert.ok((await clearOfHeader(p, '#work-title')).ok, 'work heading clear of the header');
      assert.deepEqual(await currentNav(p), ['#work']);

      await p.locator('.work-index a[href="#whisperbook"]').click();
      await settle(p);
      assert.equal(await hash(p), '#whisperbook');
      assert.equal(await historyLength(p), start + 2);
      assert.equal(await focusedId(p), 'whisperbook-title');
      const clear = await clearOfHeader(p, '#whisperbook .chapter-label');
      assert.ok(clear.ok, JSON.stringify(clear));

      await p.locator('#whisperbook .next-link').click();
      await settle(p);
      assert.equal(await hash(p), '#energy-tools');
      assert.equal(await focusedId(p), 'energy-tools-title');
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });
}

test('modifier and new-tab activations are left to the browser', async () => {
  const p = await open('/');
  try {
    const prevented = await p.evaluate(() => {
      const link = document.querySelector('.nav-sections a[href="#about"]');
      const results = [];
      for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
        const event = new MouseEvent(init.button === 1 ? 'auxclick' : 'click', { bubbles: true, cancelable: true, ...init });
        link.addEventListener(event.type, e => { results.push(e.defaultPrevented); e.preventDefault(); }, { once: true });
        link.dispatchEvent(event);
      }
      return results;
    });
    assert.deepEqual(prevented, [false, false, false, false]);
    assert.equal(await hash(p), '');
  } finally { await close(p); }
});

test('passive scrolling replaces the fragment and leaves focus where it was', async () => {
  const p = await open('/');
  try {
    await p.locator('.nav-sections a[href="#work"]').click();
    const length = await historyLength(p);
    assert.equal(await focusedId(p), 'work-title');
    const seen = new Set();
    for (let i = 0; i < 12 && !seen.has('#whisperbook'); i++) {
      await p.mouse.move(300, 500);
      await p.mouse.wheel(0, 400);
      await p.waitForTimeout(120);
      seen.add(await hash(p));
    }
    assert.ok(seen.has('#bplog'), [...seen].join(','));
    assert.ok(seen.has('#whisperbook'), [...seen].join(','));
    assert.equal(await historyLength(p), length, 'replaced, not pushed');
    assert.equal(await focusedId(p), 'work-title', 'focus not moved by scrolling');
    assert.deepEqual(await currentNav(p), ['#work']);
    // Back to the top: the opening has no fragment.
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForFunction(() => location.hash === '');
    assert.deepEqual(await currentNav(p), []);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('Back and Forward restore the entries without pushing', async () => {
  const p = await open('/');
  try {
    await p.locator('.nav-sections a[href="#about"]').click();
    await p.locator('.nav-sections a[href="#contact"]').click();
    const length = await historyLength(p);
    await p.goBack();
    await p.waitForFunction(() => location.hash === '#about');
    await settle(p); await settle(p);
    assert.equal(await historyLength(p), length);
    assert.ok((await clearOfHeader(p, '#about-title')).ok, 'About shown after Back');
    assert.deepEqual(await currentNav(p), ['#about']);
    await p.goBack();
    await p.waitForFunction(() => location.hash === '');
    await settle(p); await settle(p);
    assert.equal(await p.evaluate(() => scrollY), 0);
    await p.goForward();
    await p.waitForFunction(() => location.hash === '#about');
    await p.goForward();
    await p.waitForFunction(() => location.hash === '#contact');
    await settle(p); await settle(p);
    assert.equal(await historyLength(p), length);
    assert.ok(await p.locator('#contact-title').isVisible());
    assert.ok((await p.locator('#contact-title').boundingBox()).y < 900);
    assert.deepEqual(await currentNav(p), ['#contact']);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

for (const javaScriptEnabled of [true, false]) {
  test(`legacy and canonical fragments land on their chapters (${javaScriptEnabled ? 'JS' : 'no JS'})`, async () => {
    const cases = [
      ['#wattch', '#energy-tools .chapter-label', 'energy-tools'],
      ['#workshop', '#workshop-title', 'about'],
      ['#mcq-scan', '#mcq-scan .chapter-label', 'mcq-scan'],
      ['#contact', '#contact-title', 'contact'],
      ['#intro', 'h1', 'intro'],
    ];
    for (const viewport of [desktop, phone]) {
      for (const [fragment, firstLine, chapter] of cases) {
        const p = await open('/' + fragment, { viewport, javaScriptEnabled });
        try {
          await p.waitForTimeout(150);
          const clear = await clearOfHeader(p, firstLine);
          assert.ok(clear.ok, `${fragment} at ${viewport.width}: ${JSON.stringify(clear)}`);
          if (javaScriptEnabled) {
            assert.equal(await hash(p), fragment, 'the alias stays in the URL');
            const expected = { intro: [], contact: ['#contact'], about: ['#about'] }[chapter] ?? ['#work'];
            assert.deepEqual(await currentNav(p), expected, fragment);
          }
          assert.deepEqual(p.errors, []);
        } finally { await close(p); }
      }
    }
  });
}

test('a newer navigation cancels the pending one; arriving at Contact stays at Contact', async () => {
  const p = await open('/');
  try {
    // A direct hash change queues a history arrival; the explicit click wins.
    await p.evaluate(() => { location.hash = 'about'; document.querySelector('.nav-sections a[href="#contact"]').click(); });
    await p.waitForTimeout(800);
    assert.equal(await hash(p), '#contact');
    assert.equal(await focusedId(p), 'contact-title');
    // Two explicit jumps in a row: only the last one is focused and kept.
    await p.evaluate(() => {
      document.querySelector('.nav-sections a[href="#work"]').click();
      document.querySelector('.nav-sections a[href="#about"]').click();
    });
    await p.waitForTimeout(800);
    assert.equal(await hash(p), '#about');
    assert.equal(await focusedId(p), 'about-title');
    assert.ok((await clearOfHeader(p, '#about-title')).ok);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

/** Homepage → Whisperbook chapter → Android case → Return. */
async function caseRoundTrip(p, { viewport, expectCase, expectReturn }) {
  await p.locator('.nav-sections a[href="#work"]').click();
  await p.locator('.work-index a[href="#whisperbook"]').click();
  // Read a little into the chapter so there is a reading position to keep.
  await p.mouse.move(200, 500);
  await p.mouse.wheel(0, 160);
  await p.waitForTimeout(200);
  // On a phone the case link is further down the chapter: the reading
  // position to come back to is where the link is followed.
  await p.locator('#whisperbook a.action-case').scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  const before = await p.evaluate(() => ({ y: scrollY, hash: location.hash }));
  assert.equal(before.hash, '#whisperbook');
  await Promise.all([p.waitForURL(u => u.pathname === expectCase), p.locator('#whisperbook a.action-case').click()]);
  await p.waitForLoadState('load');
  assert.equal(await p.locator('h1').innerText(), 'Whisperbook');
  assert.match(await p.locator('.portfolio-case-hero').innerText(), /Android/);
  const returns = await p.$$eval('a[data-return]', as => as.map(a => a.getAttribute('href')));
  assert.equal(returns.length, 2, 'Return near the top and the bottom');
  for (const href of returns) assert.equal(href, expectReturn);
  assert.equal(await p.locator('img').count(), 0, 'text-first case');
  await Promise.all([p.waitForURL(u => u.pathname === '/'), p.locator('a[data-return]').first().click()]);
  await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  await p.evaluate(() => document.fonts.ready.then(() => true));
  await settle(p); await settle(p);
  return before;
}

test('slice, desktop: case → Return restores #whisperbook and the reading position', async () => {
  const p = await open('/');
  try {
    const before = await caseRoundTrip(p, { viewport: desktop, expectCase: '/work/whispbook/', expectReturn: '/#whisperbook' });
    assert.equal(await hash(p), '#whisperbook');
    const y = await p.evaluate(() => scrollY);
    assert.ok(Math.abs(y - before.y) <= 4, `restored ${y}, left at ${before.y}`);
    assert.deepEqual(await currentNav(p), ['#work']);
    // Continue to Contact.
    await p.locator('.nav-sections a[href="#contact"]').click();
    assert.equal(await focusedId(p), 'contact-title');
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('slice, phone: case → Return restores #whisperbook and the reading position', async () => {
  const p = await open('/', { viewport: phone });
  try {
    const before = await caseRoundTrip(p, { viewport: phone, expectCase: '/work/whispbook/', expectReturn: '/#whisperbook' });
    assert.equal(await hash(p), '#whisperbook');
    const y = await p.evaluate(() => scrollY);
    assert.ok(Math.abs(y - before.y) <= 4, `restored ${y}, left at ${before.y}`);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('Return without sessionStorage falls back to the chapter anchor', async () => {
  const p = await open('/', { blockStorage: true });
  try {
    assert.equal(await p.evaluate(() => { try { sessionStorage; return 'available'; } catch { return 'blocked'; } }), 'blocked');
    await caseRoundTrip(p, { viewport: desktop, expectCase: '/work/whispbook/', expectReturn: '/#whisperbook' });
    assert.equal(await hash(p), '#whisperbook');
    assert.ok((await clearOfHeader(p, '#whisperbook .chapter-label')).ok, 'chapter top, clear of the header');
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('Return keeps French: /fr/work/whispbook/ → /?lang=fr#whisperbook', async () => {
  const p = await open('/?lang=fr');
  try {
    await caseRoundTrip(p, { viewport: desktop, expectCase: '/fr/work/whispbook/', expectReturn: '/?lang=fr#whisperbook' });
    assert.equal(await p.evaluate(() => location.search), '?lang=fr');
    assert.equal(await hash(p), '#whisperbook');
    assert.equal(await p.locator('html').getAttribute('lang'), 'fr');
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
  // The French page's own fallback without a record or script.
  const nojs = await open('/fr/work/whispbook/', { javaScriptEnabled: false });
  try {
    assert.deepEqual(await nojs.$$eval('a[data-return]', as => as.map(a => a.getAttribute('href'))), ['/?lang=fr#whisperbook', '/?lang=fr#whisperbook']);
    assert.equal(await nojs.locator('a[data-return]').first().innerText(), 'Retour au portfolio');
  } finally { await close(nojs); }
});

test('Return from a guided visit keeps ?view=garden and never forces view=read', async () => {
  const p = await open('/?view=garden');
  try {
    await caseRoundTrip(p, { viewport: desktop, expectCase: '/work/whispbook/', expectReturn: '/?view=garden#whisperbook' });
    const url = new URL(p.url());
    assert.equal(url.searchParams.get('view'), 'garden');
    assert.equal(url.hash, '#whisperbook');
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
  // A bare guided visit returns without any view parameter.
  const q = await open('/');
  try {
    await caseRoundTrip(q, { viewport: desktop, expectCase: '/work/whispbook/', expectReturn: '/#whisperbook' });
    assert.equal(new URL(q.url()).searchParams.has('view'), false);
  } finally { await close(q); }
});

test('browser Back from the case finds #whisperbook', async () => {
  const p = await open('/');
  try {
    await p.locator('.nav-sections a[href="#work"]').click();
    await p.locator('.work-index a[href="#whisperbook"]').click();
    await Promise.all([p.waitForURL(u => u.pathname === '/work/whispbook/'), p.locator('#whisperbook a.action-case').click()]);
    await p.goBack();
    await p.waitForFunction(() => location.pathname === '/' && location.hash === '#whisperbook');
    await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    await settle(p);
    const box = await p.locator('#whisperbook-title').boundingBox();
    assert.ok(box && box.y > 0 && box.y < 900, JSON.stringify(box));
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('Wattch and MCQ Scan cases return to their chapters', async () => {
  for (const [path, chapter] of [['/work/wattch/', 'energy-tools'], ['/fr/work/wattch/', 'energy-tools'], ['/work/mcq-scan/', 'mcq-scan'], ['/fr/work/mcq-scan/', 'mcq-scan']]) {
    const p = await open(path);
    try {
      const expected = path.startsWith('/fr/') ? `/?lang=fr#${chapter}` : `/#${chapter}`;
      assert.deepEqual(await p.$$eval('a[data-return]', as => as.map(a => a.getAttribute('href'))), [expected, expected], path);
      await Promise.all([p.waitForURL(u => u.pathname === '/'), p.locator('a[data-return]').last().click()]);
      await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
      await p.evaluate(() => document.fonts.ready.then(() => true));
      await settle(p);
      assert.equal(await hash(p), `#${chapter}`);
      assert.ok((await clearOfHeader(p, `#${chapter} .chapter-label`)).ok, path);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  }
});

test('390×844 first viewport: role line, promise and CV link, CV inside the Sections landmark', async () => {
  for (const lang of ['en', 'fr', 'ar']) {
    const p = await open(`/?lang=${lang}`, { viewport: phone });
    try {
      for (const sel of ['#intro .chapter-label', 'h1', '.cv-link', '.owner', '.language-picker']) {
        const box = await p.locator(sel).boundingBox();
        assert.ok(box && box.y >= 0 && box.y + box.height <= 844 && box.x >= 0 && box.x + box.width <= 390, `${lang} ${sel} ${JSON.stringify(box)}`);
      }
      assert.equal(await p.locator('nav[aria-label] .cv-link').count(), 1);
      assert.equal(await p.locator('header > .cv-link').count(), 0);
      // The opening sketch shares the first screen rather than filling it.
      const host = await p.locator('#intro .scene-host').boundingBox();
      assert.ok(host.y > 300 && host.y < 844, `${lang} host at ${host.y}`);
    } finally { await close(p); }
  }
});

test('320px and 400% zoom reflow without horizontal scrolling or overlap in the header', async () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 320, height: 256 }]) {
    for (const lang of ['en', 'fr', 'ar']) {
      const p = await open(`/?lang=${lang}`, { viewport });
      try {
        const result = await p.evaluate(() => {
          const boxes = ['.owner', '.cv-link', '.language-picker'].map(s => document.querySelector(s).getBoundingClientRect());
          const overlap = boxes.some((a, i) => boxes.some((b, j) => i < j && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
          return { scroll: document.documentElement.scrollWidth, width: innerWidth, overlap };
        });
        assert.ok(result.scroll <= result.width, `${lang} ${viewport.height}: ${JSON.stringify(result)}`);
        assert.equal(result.overlap, false, `${lang} header items overlap`);
      } finally { await close(p); }
    }
  }
});

test('no nested primary scrolling surface; wide text column stays 420–520px', async () => {
  for (const width of [900, 1100, 1280, 1440, 1920]) {
    const p = await open('/', { viewport: { width, height: 900 } });
    try {
      const result = await p.evaluate(() => {
        const scrollers = [...document.querySelectorAll('body *')].filter(el => {
          const s = getComputedStyle(el);
          return /(auto|scroll)/.test(s.overflowY + s.overflowX) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
        }).map(el => el.className || el.tagName);
        return { scrollers, text: document.querySelector('#intro').getBoundingClientRect().width, rail: document.querySelector('.scene-rail').getBoundingClientRect().width, content: document.querySelector('#portfolio').clientWidth };
      });
      assert.deepEqual(result.scrollers, []);
      assert.ok(result.text >= 419 && result.text <= 520.5, `${width}: text ${result.text}`);
      if (width >= 1100) assert.ok(result.rail / result.content >= 0.48 && result.rail / result.content <= 0.62, `${width}: rail ${result.rail}/${result.content}`);
    } finally { await close(p); }
  }
});

test('?view= values land on the readable document and survive navigation', async () => {
  for (const view of ['read', 'stills', 'garden', 'unknown']) {
    const p = await open(`/?view=${view}&lang=en&quality=low&ref=x#whisperbook`);
    try {
      assert.ok((await clearOfHeader(p, '#whisperbook .chapter-label')).ok, view);
      await p.locator('.nav-sections a[href="#contact"]').click();
      const url = new URL(p.url());
      assert.equal(url.search, `?view=${view}&lang=en&quality=low&ref=x`, view);
      assert.equal(url.hash, '#contact');
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  }
});
