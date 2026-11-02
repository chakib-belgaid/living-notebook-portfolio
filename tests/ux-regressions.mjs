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
