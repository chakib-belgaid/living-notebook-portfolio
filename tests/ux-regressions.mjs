import assert from 'node:assert/strict';
import { captureScene } from '../scripts/scene-capture.mjs';

export async function headerLayout(page) {
  return page.evaluate(() => {
    const header = document.querySelector('.masthead');
    const controls = [...header.querySelectorAll('a, select, .scene-toggle')].filter(el => el.getBoundingClientRect().width);
    const boxes = controls.map(el => {
      const b = el.getBoundingClientRect();
      return { label: el.textContent || el.getAttribute('aria-label'), left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    });
    const overlaps = boxes.flatMap((a, i) => boxes.slice(i + 1).filter(b => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1).map(b => [a.label, b.label]));
    return { boxes, overlaps, width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      height: header.getBoundingClientRect().height,
      clearance: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-clearance')),
      sticky: getComputedStyle(header).position === 'sticky' };
  });
}

export async function assertHeader(page) {
  const layout = await headerLayout(page);
  assert.ok(layout.documentWidth <= layout.width + 1, JSON.stringify(layout));
  assert.deepEqual(layout.overlaps, [], JSON.stringify(layout));
  assert.ok(layout.boxes.every(b => b.left >= -1 && b.right <= layout.width + 1), JSON.stringify(layout));
  assert.ok(Math.abs(layout.clearance - (layout.sticky ? layout.height : 0)) < 1, JSON.stringify(layout));
  return layout;
}

export async function assertLanding(page, id) {
  await page.locator(`.nav-sections a[href="#${id}"]`).click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement.id), `${id}-title`);
  const landed = await page.evaluate(id => {
    const header = document.querySelector('.masthead');
    const edge = getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0;
    return { top: document.getElementById(`${id}-title`).getBoundingClientRect().top, edge };
  }, id);
  assert.ok(landed.top >= landed.edge - 1, JSON.stringify(landed));
}

export async function assertMobilePriorities(page) {
  await assertLanding(page, 'work');
  const work = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.work-index a')];
    const scene = document.querySelector('#work .scene-host');
    return { links: links.map(el => ({ name: el.querySelector('.index-title').textContent, bottom: el.querySelector('.index-title').getBoundingClientRect().bottom })),
      sceneAfter: links.every(el => !!(el.compareDocumentPosition(scene) & Node.DOCUMENT_POSITION_FOLLOWING)), height: innerHeight };
  });
  assert.equal(work.links.length, 4);
  assert.ok(work.links.every(el => el.bottom <= work.height), JSON.stringify(work));
  assert.ok(work.sceneAfter, 'the Work scene follows the four choices');
  await assertLanding(page, 'contact');
  const contact = await page.evaluate(() => {
    const mail = document.querySelector('#contact a[href^="mailto:"]');
    const box = mail.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: innerHeight,
      sceneAfter: !!(mail.compareDocumentPosition(document.querySelector('#contact .scene-host')) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  assert.ok(contact.top >= 0 && contact.bottom <= contact.height, JSON.stringify(contact));
  assert.ok(contact.sceneAfter, 'contact actions precede the scene');
}

/** The reading ruler: on wide layouts the whole bar beside the chapter card,
 * on stacked layouts the carbon tally alone as a pill; the figure is on
 * screen, its panel opens on screen and closes on Escape. */
export async function assertRuler(page, wide) {
  await page.waitForFunction(() => /CO₂e|Unavailable/.test(document.querySelector('[data-carbon-figure]')?.textContent ?? ''));
  const layout = await page.evaluate(() => {
    const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
    const current = document.querySelector('.chapter-index a[aria-current]').getAttribute('href').slice(1);
    const remote = document.querySelector('[data-scene-remote="pause"]');
    return { width: innerWidth, height: innerHeight, header: document.querySelector('.masthead').getBoundingClientRect().bottom,
      trackShown: getComputedStyle(document.querySelector('.ruler-track')).display !== 'none',
      dots: document.querySelectorAll('.ruler-dot').length, current,
      pauseShown: getComputedStyle(remote).display !== 'none',
      pauseMirrored: remote.getAttribute('aria-pressed') === document.querySelector('[data-scene-control="pause"]').getAttribute('aria-pressed'),
      bar: box(document.querySelector('.ruler')), pill: box(document.querySelector('.tally > summary')),
      card: box(document.querySelector(`.chapter[data-chapter="${current}"] .chapter-card`)),
      figure: document.querySelector('[data-carbon-figure]').textContent };
  });
  assert.equal(layout.trackShown, wide, JSON.stringify(layout));
  assert.equal(layout.dots, 8);
  assert.equal(layout.pauseShown, wide, JSON.stringify(layout));
  assert.ok(layout.pauseMirrored, 'the bar\'s pause button shows the header\'s state');
  assert.match(layout.figure, /CO₂e|Unavailable/);
  const within = b => b.left >= -1 && b.right <= layout.width + 1 && b.top >= layout.header - 1 && b.bottom <= layout.height + 1;
  assert.ok(within(layout.pill), JSON.stringify(layout));
  if (wide) {
    const { bar, card } = layout;
    assert.ok(within(bar), JSON.stringify(layout));
    assert.ok(!(bar.left < card.right && bar.right > card.left && bar.top < card.bottom && bar.bottom > card.top), `the bar is clear of the card: ${JSON.stringify(layout)}`);
  }
  await page.locator('.tally > summary').click();
  const panel = await page.evaluate(() => {
    const b = document.querySelector('.tally-panel').getBoundingClientRect();
    return { open: document.querySelector('.tally').open, left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  });
  assert.ok(panel.open && within(panel), JSON.stringify({ panel, layout }));
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.querySelector('.tally').open), false);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SUMMARY');
}

export async function assertSceneIsolation(page, portrait = false) {
  await page.setContent(`<style>body{margin:0}.scene-stage{position:${portrait ? 'absolute' : 'fixed'};inset:0;background:#123456}.scene-stage span{display:block;background:#abcdef;width:70px;height:80px}.chapter{position:relative;height:300px}.overlay{position:fixed;z-index:10;inset:0 50% 50% 0;background:red}</style><div class="chapter"><div class="scene-stage"><span></span></div></div><header class="overlay">Fake navigation and copy</header>`);
  const stage = page.locator('.scene-stage');
  const before = await stage.boundingBox();
  const isolated = await captureScene(stage);
  assert.deepEqual(await stage.boundingBox(), before, 'capture must not change scene geometry');
  assert.equal(await page.locator('.overlay').isVisible(), true, 'capture restores real page UI');
  await page.locator('.overlay').evaluate(el => el.style.visibility = 'hidden');
  const expected = await stage.screenshot();
  assert.deepEqual(isolated, expected, 'all captured pixels match the unobstructed scene, including its children');
}
