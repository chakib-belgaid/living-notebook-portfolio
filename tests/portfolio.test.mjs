import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const output = process.env.QA_OUTPUT || '/private/tmp/notebook-qa';
let browser;
before(async () => {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => browser?.close());
async function page(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  await p.route('**/*open-meteo.com/**', route => route.abort());
  return p;
}
async function ready(p, path = '') {
  // These fixtures exercise the opt-in garden (or an explicitly requested reader).
  const url = new URL(base + '/' + path);
  if (!url.searchParams.has('view')) url.searchParams.set('view', 'garden');
  await p.goto(url.href);
  await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
}
async function go(p, id) {
  // The masthead links Work, About and Contact; projects are reached by their fragment.
  const link = p.locator(`.masthead a[href="#${id}"]`);
  if (await link.count()) await link.click();
  else await p.evaluate(id => { location.hash = id; }, id);
  await p.waitForTimeout(1500);
  // Links glide for up to 3 s on long trips: wait for the page to come to rest.
  for (let y = -1, i = 0; i < 20; i++) {
    const now = await p.evaluate(() => scrollY);
    if (now === y) break;
    y = now;
    await p.waitForTimeout(250);
  }
  if (id === 'contact' && await p.locator('html').getAttribute('data-view') === 'garden') await p.locator('.chapter.active .note-email a').waitFor({state:'visible',timeout:5000});
}
function healthy(p) { assert.deepEqual(p.errors, []); }
// QA screenshots for review. Chromium's headless shell now and then can't
// capture a frame, so try again before failing.
async function snap(p, path) {
  for (let attempt = 1; ; attempt++) {
    try { return await p.screenshot({ path }); }
    catch (e) { if (attempt === 3 || !/Unable to capture screenshot/.test(e.message)) throw e; await p.waitForTimeout(250); }
  }
}
// The sheet slides up; measure it once it has arrived.
const settled = sheet => sheet.evaluate(d => Promise.all(d.getAnimations().map(a => a.finished)));

test('every journey stop and its details are in the served page', async () => {
  const html = await (await fetch(base + '/')).text();
  for (const s of ['sketch', 'blueprint', 'build', 'whisperbook', 'wattch', 'bloom']) assert.match(html, new RegExp(`data-stop="${s}"`), s);
  for (const d of ['about', 'whisperbook', 'wattch']) assert.match(html, new RegExp(`data-detail="${d}"`), d);
  assert.match(html, /data-stop="bloom"[\s\S]*href="mailto:chakib\.belgaid@gmail\.com"/, 'Bloom carries the email link');
  assert.equal((html.match(/class="[^"]*\bstop-card\b/g) || []).length, 6);
  assert.match(html, /class="stop-line">Product engineer, Ph\.D\. AI products, developer tools, and how we measure the energy software uses\.</);
  assert.match(html, /class="static-garden"[^>]*loading="lazy"/);
});

test('opt-in desktop garden, project links, wheel chaining and clean landmarks', async () => {
  const p = await page();
  try {
    await ready(p);
    assert.match(await p.title(), /Chakib Belgaid.*Product engineer/);
    assert.equal(await p.locator('html').getAttribute('data-view'), 'garden');
    await p.locator('.chapter.active a[href="#whisperbook"]').click();
    // The smooth scroll can take a while on a busy machine.
    await p.waitForFunction(() => document.querySelector('.chapter.active h2')?.textContent === 'Whisperbook');
    assert.match(p.url(), /#whisperbook$/);
    assert.equal(await p.locator('.chapter:not(.active):not([inert])').count(), 0);
    assert.equal(await p.locator('.chapter.active h2').innerText(), 'Whisperbook');
    const before = await p.evaluate(() => scrollY);
    await p.locator('.chapter.active .note').hover();
    await p.mouse.wheel(0, 800);
    await p.waitForTimeout(500);
    assert.ok(await p.evaluate(() => scrollY) > before, 'wheel over a note advances the document');
    await snap(p, output + '/desktop-story.png');
    healthy(p);
  } finally { await p.context().close(); }
});

test('wheel chains from the bottom of an overflowing garden note into the document', async () => {
  const p = await page({viewport:{width:1440,height:600}});
  try {
    await ready(p, '#whisperbook');
    await p.getByRole('button',{name:'Pause motion',exact:true}).click();
    await p.locator('[data-chapter="10"]').evaluate(e => scrollTo({top:e.offsetTop,behavior:'instant'}));
    await p.locator('[data-chapter="10"] .note').waitFor({state:'visible'});
    const note = p.locator('[data-chapter="10"] .note');
    assert.ok(await note.evaluate(e=>e.scrollHeight>e.clientHeight), 'fixture uses a genuinely overflowing note');
    await note.evaluate(e=>e.scrollTop=e.scrollHeight);
    const before = await p.evaluate(()=>scrollY);
    await note.hover();await p.mouse.wheel(0,400);await p.waitForTimeout(200);
    assert.ok(await p.evaluate(()=>scrollY)>before, 'wheel continues beyond the note');
    healthy(p);
  } finally {await p.context().close();}
});

test('stable fragments, refresh and Back/Forward restore the section', async () => {
  const p = await page();
  try {
    await ready(p, '?view=read#whisperbook');
    assert.equal(await p.locator('#whisperbook').isVisible(), true);
    await p.locator('#whisperbook').getByRole('heading', {name:'Whisperbook',exact:true}).scrollIntoViewIfNeeded();
    await p.locator('.project-shortcuts a[href="#wattch"]').first().click();
    await p.waitForTimeout(1600);
    assert.match(p.url(), /#wattch$/);
    assert.equal(await p.evaluate(()=>document.activeElement.id), 'wattch-title');
    await p.reload();
    await p.waitForTimeout(500);
    assert.match(p.url(), /#wattch$/);
    assert.ok(await p.locator('#wattch').evaluate(e=>Math.abs(e.getBoundingClientRect().top)<250));
    await p.goBack();
    await p.waitForTimeout(500);
    assert.match(p.url(), /#whisperbook$/);
    await p.goForward();
    await p.waitForTimeout(500);
    assert.match(p.url(), /#wattch$/);
    healthy(p);
  } finally { await p.context().close(); }
});

test('screenshot dialog supports keyboard, actual size, Escape and focus restoration', async () => {
  const p = await page();
  try {
    await ready(p, '?view=read#wattch');
    const opener = p.locator('#wattch figcaption a');
    await opener.focus();
    await opener.press('Enter');
    const dialog = p.getByRole('dialog');
    assert.equal(await dialog.isVisible(), true);
    assert.match(await dialog.innerText(), /synthetic values/);
    await dialog.getByRole('button',{name:'Actual size',exact:true}).click();
    assert.equal(await dialog.locator('img').evaluate(e=>getComputedStyle(e).maxHeight), 'none');
    await snap(p, output+'/evidence-dialog.png');
    await dialog.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await opener.evaluate(e=>e===document.activeElement), true);
    healthy(p);
  } finally { await p.context().close(); }
});

test('resizing and zoom reflow preserve the selected section without moving focus', async () => {
  const p = await page();
  try {
    await ready(p, '?view=read#wattch');
    await p.waitForTimeout(1800);
    await p.locator('.owner').focus();
    const history = await p.evaluate(() => window.history.length);
    for (const [width, height] of [[1100,700],[390,844],[360,225],[1440,900]]) {
      await p.setViewportSize({width,height});
      await p.waitForTimeout(250);
      assert.match(p.url(), /#wattch$/);
      assert.equal(await p.locator('.owner').evaluate(e => e === document.activeElement), true);
      assert.ok(await p.locator('#wattch').evaluate(e => Math.abs(e.getBoundingClientRect().top) < 250));
    }
    assert.equal(await p.evaluate(() => window.history.length), history);
    healthy(p);
  } finally { await p.context().close(); }
});

test('Fog and every CSS/canvas layer stop when paused; stage actions are keyboard accessible', async () => {
  const p = await page();
  try {
    await ready(p, '#contact');
    await p.waitForFunction(()=>document.querySelector('#scene').dataset.progress==='1.000');
    await p.locator('.dock > summary').click();
    await p.getByRole('button',{name:'Fog',exact:true}).click();
    await p.getByRole('button',{name:'Pause motion',exact:true}).click();
    await p.waitForTimeout(1200);
    const before = await p.locator('#scene').getAttribute('data-animation-time');
    const skyBefore = await p.locator('.sky').evaluateAll(es=>es.map(e=>e.toDataURL()));
    await p.waitForTimeout(400);
    assert.equal(await p.locator('#scene').getAttribute('data-animation-time'), before);
    assert.deepEqual(await p.locator('.sky').evaluateAll(es=>es.map(e=>e.toDataURL())), skyBefore, 'both sky layers remain still');
    assert.equal(await p.getByRole('button',{name:'Resume motion',exact:true}).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>a.animationName)), []);
    await p.getByRole('button',{name:'Go to Blueprint',exact:true}).focus();
    await p.getByRole('button',{name:'Go to Blueprint',exact:true}).press('Enter');
    await p.waitForTimeout(1600);
    assert.equal(await p.getByRole('button',{name:'Go to Blueprint',exact:true}).getAttribute('aria-current'),'step');
    healthy(p);
  } finally { await p.context().close(); }
});

for (const [width,height] of [[390,844],[375,667],[320,568]]) {
  test(`the phone journey at ${width}×${height}`, async () => {
    const p = await page({viewport:{width,height}});
    try {
      await ready(p);
      assert.equal(await p.locator('html').getAttribute('data-view'), 'read');
      assert.equal(await p.locator('html').getAttribute('data-journey'), 'true');
      await p.waitForFunction(() => { const i = document.querySelector('.journey-still[data-still="sketch"]'); return i?.complete && i.naturalWidth > 0; });
      await p.waitForFunction(() => !!document.querySelector('.journey[data-live] #scene canvas'), undefined, {timeout:15000});
      assert.equal(await p.evaluate(()=>scrollY), 0, 'the introduction starts above the fold');
      assert.ok(await p.locator('#intro-title').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.masthead').getBoundingClientRect().bottom),'the header does not obscure the introduction');
      const clipped = await p.locator('.masthead a').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(e=>e.textContent));
      assert.deepEqual(clipped, []);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await snap(p, output+`/journey-${width}x${height}.png`);
      await go(p,'contact');
      const email = p.locator('#contact .note-email a');
      assert.ok(await email.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth+1;}), 'the email link is on screen at Bloom');
      assert.equal(await p.locator('#contact .note-links a').count(), 4);
      assert.equal(await p.locator('#contact .stop-more').count(), 1, 'only Explore the garden; the details are on the card');
      await snap(p, output+`/contact-${width}x${height}.png`);
      healthy(p);
    } finally { await p.context().close(); }
  });
}

test('landscape phones keep the reading page', async () => {
  const p = await page({viewport:{width:844,height:390}});
  try {
    await ready(p);
    assert.equal(await p.locator('html').getAttribute('data-journey'), null);
    assert.equal(await p.locator('#portfolio').isVisible(), true);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await snap(p, output+'/reading-844x390.png');
    await go(p,'contact');
    assert.equal(await p.locator('#contact .note-email a').isVisible(), true);
    healthy(p);
  } finally { await p.context().close(); }
});

test('a card’s View project opens its details in a sheet and puts them back', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'whisperbook');
    assert.equal(await p.locator('.journey-label').textContent(), 'Build · Whisperbook');
    assert.ok(await p.locator('#whisperbook .stop-card').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}), 'the card is on screen at its stop');
    const more = p.getByRole('button',{name:'View details about Whisperbook',exact:true});
    await more.click();
    const sheet = p.locator('dialog.sheet');
    await sheet.waitFor({state:'visible'});
    await settled(sheet);
    assert.equal(await sheet.locator('h2').innerText(), 'Whisperbook');
    assert.equal(await sheet.getByRole('link',{name:/Read Whisperbook on GitHub/}).isVisible(), true);
    assert.equal(await sheet.locator('img[src$="whisperbook.webp"]').isVisible(), true);
    assert.ok(await sheet.evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}), 'the sheet fits the screen');
    await sheet.getByRole('button',{name:'Close',exact:true}).click();
    await p.waitForFunction(()=>!document.querySelector('dialog.sheet').open);
    assert.equal(await p.locator('#whisperbook [data-detail="whisperbook"]').count(), 2, 'both detail nodes are back');
    assert.equal(await more.evaluate(e=>e===document.activeElement), true);
    healthy(p);
  } finally { await p.context().close(); }
});

test('rotating to landscape with a sheet open restores the reading page intact', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'wattch');
    await p.getByRole('button',{name:'View details about Wattch Core',exact:true}).click();
    await p.locator('dialog.sheet').waitFor({state:'visible'});
    await p.setViewportSize({width:844,height:390});
    await p.waitForTimeout(400);
    assert.equal(await p.locator('html').getAttribute('data-journey'), null);
    assert.equal(await p.locator('dialog.sheet').evaluate(d=>d.open), false);
    assert.equal(await p.locator('#wattch [data-detail="wattch"]').count(), 2);
    assert.equal(await p.locator('#wattch .project-tech').isVisible(), true);
    assert.deepEqual(await p.locator('#portfolio > section').evaluateAll(es=>es.map(e=>e.id)), ['intro','work','about','contact'], 'reading order is restored');
    assert.equal(await p.evaluate(()=>document.activeElement?.id), 'wattch-title', 'focus moves to the stop’s heading');
    healthy(p);
  } finally { await p.context().close(); }
});

test('a deep link opens the journey at its stop', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p, '#wattch');
    await p.waitForTimeout(600);
    assert.equal(await p.locator('.journey-label').textContent(), 'Build · Wattch Core');
    assert.equal(await p.locator('.journey').getAttribute('data-at'), 'wattch');
    assert.equal(await p.locator('.journey-still[data-still="wattch"]').evaluate(e=>getComputedStyle(e).getPropertyValue('--wipe').trim()), '1.000');
    healthy(p);
  } finally { await p.context().close(); }
});

test('a phone load fetches the first still, at most one ahead, and no preview image', async () => {
  const p = await page({viewport:{width:390,height:844}});
  const urls = [];
  p.on('request', r => urls.push(r.url()));
  // A slow entry module: the page lays out well before the journey starts.
  await p.route('**/assets/index-*.js', async route => { await new Promise(f => setTimeout(f, 1000)); await route.continue(); });
  try {
    await p.clock.setFixedTime(new Date(2026, 9, 2, 13));
    await ready(p);
    await p.waitForTimeout(800);
    const stills = urls.filter(u => u.includes('/assets/stills/'));
    assert.ok(stills.some(u => u.endsWith('/sketch.webp')), stills.join());
    assert.ok(stills.length <= 2, stills.join());
    assert.equal(urls.filter(u => u.includes('garden-preview.') || u.includes('garden-loading.webp')).length, 0);
    healthy(p);
  } finally { await p.context().close(); }
});

test('no JavaScript, blocked entry module, and print still expose the portfolio', async () => {
  for (const javaScriptEnabled of [false,true]) {
    const p = await page({javaScriptEnabled});
    try {
      if(javaScriptEnabled) {
        await p.route('**/assets/index-*.js',route=>route.abort());
        await p.route('**/src/main.ts*',route=>route.abort());
      }
      await p.goto(base);
      assert.equal(await p.locator('#portfolio').isVisible(),true);
      assert.equal(await p.locator('#contact a[href^="mailto:"]').isVisible(),true);
      assert.match(await p.locator('#work').innerText(),/Whisperbook/);
      if(!javaScriptEnabled) await snap(p, output+'/no-javascript.png');
    } finally { await p.context().close(); }
  }
  const interrupted = await page();
  try {
    await interrupted.addInitScript(() => { window.ResizeObserver = class { constructor() {throw new Error('Simulated controller initialization failure');} }; });
    await interrupted.goto(base);
    assert.equal(await interrupted.locator('html').evaluate(e=>e.classList.contains('enhanced')), false);
    assert.equal(await interrupted.locator('#portfolio').isVisible(), true);
    assert.equal(await interrupted.locator('#experience').isVisible(), false);
    assert.equal(await interrupted.locator('#contact a[href^="mailto:"]').isVisible(), true);
    assert.match(interrupted.errors[0], /Simulated controller initialization failure/);
  } finally {await interrupted.context().close();}
  const p = await page();
  try {
    await ready(p);
    await p.emulateMedia({media:'print'});
    assert.equal(await p.locator('#portfolio').isVisible(),true);
    assert.equal(await p.locator('.chapters').isVisible(),false);
    await p.pdf({path:output+'/portfolio-print.pdf',format:'A4',printBackground:true});
    healthy(p);
  } finally { await p.context().close(); }
  const phone = await page({viewport:{width:390,height:844}});
  try {
    await ready(phone);
    await go(phone,'wattch');
    await phone.emulateMedia({media:'print'});
    await phone.waitForTimeout(300);
    assert.equal(await phone.locator('html').getAttribute('data-journey'), null, 'a phone prints the reading page');
    assert.deepEqual(await phone.locator('#portfolio > section').evaluateAll(es=>es.map(e=>e.id)), ['intro','work','about','contact']);
    healthy(phone);
  } finally { await phone.context().close(); }
});

test('on phones the live garden grows with the scroll, and ?view=stills keeps the stills', async () => {
  const p=await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await p.waitForFunction(()=>!!document.querySelector('.journey[data-live] #scene canvas'), undefined, {timeout:15000});
    assert.equal(await p.locator('html').getAttribute('data-journey'),'true');
    assert.equal(await p.locator('#stage').isVisible(),true);
    assert.match(p.url(),/view=garden/);
    // Halfway between two stops the garden is between their stages, and no card shows.
    const between = await p.evaluate(()=>{const t=document.querySelector('[data-stop="blueprint"]').getBoundingClientRect().top+scrollY;scrollTo(0,t-innerHeight*0.7);return t;});
    await p.waitForTimeout(300);
    const growth = Number(await p.locator('#scrub').inputValue());
    assert.ok(growth > 0 && growth < 330, `growth ${growth}`);
    assert.equal(await p.locator('.stop-card.current').count(), 0);
    await p.evaluate(t=>scrollTo(0,t),between);
    await p.waitForTimeout(300);
    assert.equal(await p.locator('#scrub').inputValue(),'330');
    assert.deepEqual(await p.locator('.stop-card.current').evaluateAll(es=>es.map(e=>e.closest('[data-stop]').dataset.stop)), ['blueprint']);
    await go(p,'wattch');
    await p.waitForTimeout(500);
    assert.equal(await p.locator('#scrub').inputValue(),'660');
    healthy(p);
  } finally {await p.context().close();}
});

test('WebGL unavailable, context loss/restoration and offline weather preserve navigation', async () => {
  const failed=await page();
  try {
    await failed.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args) {return type.startsWith('webgl')?null:original.call(this,type,...args);};
    });
    await ready(failed);
    await failed.waitForFunction(()=>document.querySelector('[data-fallback-message]').textContent.includes('can’t be drawn'));
    await go(failed,'contact');
    assert.equal(await failed.locator('.chapter.active .note-email a').isVisible(),true);
    healthy(failed);
  } finally {await failed.context().close();}
  const p=await page();
  try {
    await ready(p,'#contact');
    await p.waitForFunction(()=>document.querySelector('#scene').dataset.progress==='1.000');
    await p.locator('.dock > summary').click();
    await p.waitForFunction(()=>document.querySelector('#sky-report').textContent.includes('isn’t available'));
    await p.locator('#scene canvas').evaluate(canvas=>{window.lostContext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');window.lostContext.loseContext();});
    await p.waitForFunction(()=>!document.querySelector('.scene-fallback').hidden);
    await go(p,'about');
    assert.match(await p.locator('.chapter.active h2').innerText(),/question/);
    await p.evaluate(()=>window.lostContext.restoreContext());
    await p.waitForFunction(()=>document.querySelector('.scene-fallback').hidden);
    healthy(p);
  } finally {await p.context().close();}
});

test('missing local speech voices have a useful fallback state', async () => {
  const p=await page();
  try {
    await p.addInitScript(()=>{
      speechSynthesis.getVoices=()=>[];
    });
    await ready(p,'?view=read#whisperbook');
    await p.locator('#whisperbook details summary').click();
    await p.waitForTimeout(1600);
    assert.equal(await p.locator('#whisperbook .play').isDisabled(),true);
    assert.match(await p.locator('#whisperbook .player-voice').innerText(),/no on-device voice/);
    healthy(p);
  } finally {await p.context().close();}
});

test('200% text enlargement and 400% reflow expose links and sheets', async () => {
  const p=await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await p.addStyleTag({content:':root {font-size:200%;}'});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% text does not overflow');
    const clipped=await p.locator('.masthead a').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>e.textContent));
    assert.deepEqual(clipped,[]);
    await snap(p, output+'/text-200.png');
    await go(p,'wattch');
    await p.getByRole('button',{name:'View details about Wattch Core',exact:true}).click();
    const sheet = p.locator('dialog.sheet');
    await sheet.waitFor({state:'visible'});
    await settled(sheet);
    assert.ok(await sheet.evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1;}),'the sheet stays within the viewport');
    await snap(p, output+'/text-200-sheet.png');
    healthy(p);
  } finally {await p.context().close();}
  const zoom=await page({viewport:{width:360,height:225}});
  try {
    await ready(zoom);
    assert.ok(await zoom.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'400% equivalent reflow does not overflow');
    await go(zoom,'contact');
    assert.equal(await zoom.locator('#contact .note-email a').isVisible(),true);
    await snap(zoom, output+'/reflow-400.png');
    healthy(zoom);
  } finally {await zoom.context().close();}
});

test('phone motion pauses from the header, and reduced motion keeps the journey still', async () => {
  const running = p => p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
  const p = await page({viewport:{width:390,height:844}});
  try {
    // The stills' own sky: with the live garden on, the garden draws it.
    await ready(p, '?view=stills');
    await go(p,'contact');
    await p.waitForTimeout(600);
    assert.ok(await running(p) > 0, 'clouds drift and leaves fall in Bloom');
    await p.getByRole('button',{name:'Pause motion',exact:true}).click();
    assert.equal(await running(p), 0);
    assert.equal(await p.getByRole('button',{name:'Resume motion',exact:true}).getAttribute('aria-pressed'),'true');
    healthy(p);
  } finally { await p.context().close(); }
  const r = await page({viewport:{width:390,height:844}, reducedMotion:'reduce'});
  try {
    await ready(r);
    await go(r,'wattch');
    assert.equal(await running(r), 0);
    const wipes = await r.locator('.journey-still').evaluateAll(es=>es.map(e=>getComputedStyle(e).getPropertyValue('--wipe').trim()));
    assert.ok(wipes.every(w=>w==='0.000'||w==='1.000'), wipes.join());
    const more = r.getByRole('button',{name:'View details about Wattch Core',exact:true});
    await more.click();
    assert.equal(await r.locator('dialog.sheet').evaluate(d=>d.open), true);
    await r.keyboard.press('Escape');
    assert.equal(await r.locator('dialog.sheet').evaluate(d=>d.open), false, 'closes at once');
    assert.equal(await more.evaluate(e=>e===document.activeElement), true);
    healthy(r);
  } finally { await r.context().close(); }
});

test('a sheet opens on screen while motion is paused', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'wattch');
    await p.getByRole('button',{name:'Pause motion',exact:true}).click();
    await p.getByRole('button',{name:'View details about Wattch Core',exact:true}).click();
    await p.waitForTimeout(400);
    assert.ok(await p.locator('dialog.sheet').evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}), 'the sheet is on screen');
    healthy(p);
  } finally { await p.context().close(); }
});

test('a second Escape while the sheet closes leaves the next sheet working', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'wattch');
    const more = p.getByRole('button',{name:'View details about Wattch Core',exact:true});
    await more.click();
    await settled(p.locator('dialog.sheet'));
    await p.keyboard.press('Escape');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(600);
    assert.equal(await p.locator('#wattch [data-detail="wattch"]').count(), 2);
    await more.click();
    await p.waitForTimeout(700);
    assert.equal(await p.locator('dialog.sheet').evaluate(d=>d.open), true, 'the sheet stays open');
    healthy(p);
  } finally { await p.context().close(); }
});

test('the phone URL bar showing or hiding keeps the reader where they are', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await p.evaluate(()=>scrollTo(0,2000));
    await p.waitForTimeout(400);
    await p.setViewportSize({width:390,height:788});
    await p.waitForTimeout(400);
    const y = await p.evaluate(()=>scrollY);
    assert.ok(Math.abs(y-2000) < 100, `scrollY ${y}`);
    healthy(p);
  } finally { await p.context().close(); }
});

test('a deep link loads its own still, one either side, and none before', async () => {
  const p = await page({viewport:{width:390,height:844}});
  const urls = [];
  p.on('request', r => urls.push(r.url()));
  try {
    await p.clock.setFixedTime(new Date(2026, 9, 2, 13));
    await ready(p, '#wattch');
    await p.waitForTimeout(800);
    const stills = urls.filter(u => u.includes('/assets/stills/')).map(u => u.split('/').pop()).sort();
    assert.deepEqual(stills, ['bloom.webp', 'wattch.webp', 'whisperbook.webp']);
    await p.waitForFunction(() => { const i = document.querySelector('.journey-still[data-still="wattch"]'); return i.complete && i.naturalWidth > 0; });
    healthy(p);
  } finally { await p.context().close(); }
});

test('200% text on the smallest phone does not scroll sideways', async () => {
  const p = await page({viewport:{width:320,height:568}});
  try {
    await ready(p);
    await p.addStyleTag({content:':root {font-size:200%;}'});
    await p.waitForTimeout(300);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'no horizontal overflow');
    healthy(p);
  } finally { await p.context().close(); }
});

test('on phones the header has no garden switch, and Bloom explores the garden', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p, '?view=stills');
    assert.equal(await p.locator('.masthead .view-switch').isVisible(), false);
    assert.equal(await p.locator('#stage').isVisible(), false, 'the stills are chosen');
    assert.equal(await p.locator('.journey').getAttribute('data-live'), null);
    await go(p,'contact');
    const explore = p.getByRole('button',{name:'Explore the garden',exact:true});
    await explore.click();
    await p.waitForFunction(()=>!!document.querySelector('.journey[data-live] #scene canvas'), undefined, {timeout:15000});
    assert.equal(await p.locator('html').getAttribute('data-exploring'), 'true');
    const done = p.getByRole('button',{name:'Done',exact:true});
    assert.equal(await done.evaluate(e=>e===document.activeElement), true, 'focus moves to Done');
    assert.equal(await p.locator('#portfolio').evaluate(e=>e.inert), true);
    const box = await p.locator('#scene').boundingBox();
    await p.mouse.move(box.x + 120, box.y + 300);
    await p.mouse.down();
    await p.mouse.move(box.x + 260, box.y + 300, {steps: 5});
    assert.equal(await p.locator('html').evaluate(e=>e.classList.contains('turning')), true, 'a drag turns the garden');
    await p.mouse.up();
    await snap(p, output+'/explore-390x844.png');
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('html').getAttribute('data-exploring'), null);
    assert.equal(await p.locator('#portfolio').evaluate(e=>e.inert), false);
    assert.equal(await explore.evaluate(e=>e===document.activeElement), true, 'focus returns to Explore');
    healthy(p);
  } finally { await p.context().close(); }
});

test('on phones the header opens the garden controls: time, weather and season', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p, '?view=stills');
    // The controls wait for Bloom.
    await go(p,'contact');
    const opener = p.getByRole('button',{name:'Garden controls',exact:true});
    await opener.click();
    const sheet = p.locator('dialog.sheet[open]');
    await settled(sheet);
    assert.equal(await sheet.getByRole('heading',{name:'Make the garden yours'}).isVisible(), true);
    await p.waitForFunction(()=>!!document.querySelector('.journey[data-live] #scene canvas'), undefined, {timeout:15000});
    await sheet.getByRole('button',{name:'Rain',exact:true}).click();
    assert.equal(await p.locator('html').getAttribute('data-weather'), 'rain');
    await sheet.getByRole('button',{name:'Winter',exact:true}).click();
    assert.equal(await p.locator('html').getAttribute('data-season'), 'winter');
    await sheet.getByRole('slider',{name:'Time of day'}).fill('22');
    assert.match(await p.locator('#hour-readout').textContent(), /10:00/);
    const box = await sheet.boundingBox();
    assert.ok(box.y > 844 * 0.3, 'the garden stays in view above the controls');
    await snap(p, output+'/controls-390x844.png');
    await p.keyboard.press('Escape');
    await p.waitForFunction(()=>!document.querySelector('dialog.sheet[open]'));
    assert.equal(await opener.evaluate(e=>e===document.activeElement), true, 'focus returns to the opener');
    assert.equal(await p.locator('#preview-tools .dock-body').count(), 1, 'the controls go back to the page');
    healthy(p);
  } finally { await p.context().close(); }
});

test('exploring on a phone, a pinch and the zoom buttons zoom the garden, not the page', async () => {
  const p = await page({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2});
  try {
    await ready(p, '#contact');
    await p.getByRole('button',{name:'Explore the garden',exact:true}).click();
    await p.waitForFunction(()=>!!document.querySelector('.journey[data-live] #scene canvas'), undefined, {timeout:15000});
    await p.waitForTimeout(1500);
    const shot = () => p.locator('#scene').screenshot();
    const before = await shot();
    const cdp = await p.context().newCDPSession(p);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points.map(([x,y],id)=>({x,y,id}))});
    await touch('touchStart', [[170,420],[220,420]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[170-i*12,420],[220+i*12,420]]);
    await touch('touchEnd', []);
    await p.waitForTimeout(800);
    assert.equal(await p.evaluate(()=>visualViewport.scale), 1, 'the page itself does not zoom');
    const pinched = await shot();
    assert.notDeepEqual(pinched, before, 'the garden zooms');
    await p.getByRole('button',{name:'Zoom out',exact:true}).click();
    await p.getByRole('button',{name:'Zoom out',exact:true}).click();
    await p.getByRole('button',{name:'Zoom out',exact:true}).click();
    await p.waitForTimeout(800);
    await p.getByRole('button',{name:'Zoom in',exact:true}).click();
    await p.waitForTimeout(800);
    assert.notDeepEqual(await shot(), pinched);
    await snap(p, output+'/explore-zoomed-390x844.png');
    await p.getByRole('button',{name:'Done',exact:true}).click();
    assert.equal(await p.locator('html').getAttribute('data-exploring'), null);
    healthy(p);
  } finally { await p.context().close(); }
});

test('the live garden opened from the reading page closes back to the page', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await p.getByRole('link',{name:'Read as a page',exact:true}).click();
    assert.equal(await p.locator('html').getAttribute('data-journey'), null);
    await p.locator('.view-switch').click();
    await p.waitForFunction(()=>!!document.querySelector('#scene canvas'));
    assert.equal(await p.locator('html').getAttribute('data-journey'), null, 'the garden opens over the page');
    assert.match(p.url(), /view=garden/);
    await p.locator('.view-switch').click();
    assert.equal(await p.locator('html').getAttribute('data-journey'), null, 'closing it returns to the page');
    assert.match(p.url(), /view=read/);
    assert.equal(await p.locator('#stage').isVisible(), false);
    healthy(p);
  } finally { await p.context().close(); }
});

test('on phones a live garden that cannot be drawn gives way to the stills and is announced', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await p.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args) {return type.startsWith('webgl')?null:original.call(this,type,...args);};
    });
    await ready(p);
    await p.waitForFunction(()=>document.querySelector('#announce').textContent.includes('can’t be drawn'), undefined, {timeout:10000});
    assert.match(p.url(), /view=stills/);
    assert.equal(await p.locator('html').getAttribute('data-preview'), 'false');
    assert.equal(await p.locator('.journey-toast').isVisible(), true, 'the header shows it too');
    healthy(p);
  } finally { await p.context().close(); }
});

test('the sheet follows the finger while dragged', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'wattch');
    await p.getByRole('button',{name:'View details about Wattch Core',exact:true}).click();
    const sheet = p.locator('dialog.sheet');
    await settled(sheet);
    const head = await sheet.locator('.sheet-handle').boundingBox();
    await p.mouse.move(head.x + head.width / 2, head.y + 10);
    await p.mouse.down();
    await p.mouse.move(head.x + head.width / 2, head.y + 110);
    assert.equal(await sheet.evaluate(d=>new DOMMatrix(getComputedStyle(d).transform).f), 100);
    await p.mouse.up();
    healthy(p);
  } finally { await p.context().close(); }
});

test('at night the journey shows the garden at night', async () => {
  const p = await page({viewport:{width:390,height:844}});
  const urls = [];
  p.on('request', r => urls.push(r.url()));
  try {
    await p.clock.setFixedTime(new Date(2026, 9, 2, 22, 30));
    await ready(p);
    await p.waitForFunction(() => { const i = document.querySelector('.journey-still[data-still="sketch"]'); return i?.complete && i.naturalWidth > 0; });
    const stills = urls.filter(u => u.includes('/assets/stills/')).map(u => u.split('/').pop());
    assert.ok(stills.length && stills.every(n => n.endsWith('-night.webp')), stills.join());
    healthy(p);
  } finally { await p.context().close(); }
});


// Counts every audio context the page makes.
const countAudio = () => {
  window.audioContexts = [];
  const Base = window.AudioContext;
  window.AudioContext = class extends Base { constructor(...a) { super(...a); window.audioContexts.push(this); } };
};
const audioState = p => p.evaluate(() => window.audioContexts.map(c => c.state));

test('garden sound is on by default, starts on the first gesture, follows the pause, and sleeps when silent', async () => {
  const p = await page();
  try {
    await p.addInitScript(countAudio);
    await ready(p, '#contact');
    await p.waitForFunction(()=>document.querySelector('#scene').dataset.progress==='1.000');
    assert.deepEqual(await audioState(p), [], 'no audio engine before the visitor interacts');
    assert.equal(await p.locator('html').getAttribute('data-sound'), 'waiting');
    assert.equal(await p.locator('#sound-toggle').getAttribute('aria-pressed'), 'false', 'nothing is heard yet');
    const hint = p.locator('.sound-hint');
    await hint.waitFor({state:'visible', timeout: 5000});
    assert.equal(await hint.textContent(), 'Click to hear the garden');
    await p.keyboard.press('Shift');
    await p.waitForFunction(() => window.audioContexts[0]?.state === 'running');
    await p.waitForFunction(() => document.documentElement.dataset.sound === 'playing');
    assert.equal(await hint.isVisible(), false, 'the note goes once the garden plays');
    const stop = p.getByRole('button',{name:'Stop garden sounds',exact:true});
    assert.equal(await stop.getAttribute('aria-pressed'), 'true');
    await p.getByRole('button',{name:'Pause motion',exact:true}).click();
    assert.equal(await p.locator('html').getAttribute('data-sound'), 'paused');
    await p.waitForFunction(() => window.audioContexts[0].state === 'suspended', undefined, {timeout: 5000});
    await p.getByRole('button',{name:'Resume motion',exact:true}).click();
    await p.waitForFunction(() => window.audioContexts[0].state === 'running');
    await stop.click();
    assert.equal(await p.locator('html').getAttribute('data-sound'), 'off');
    const play = p.getByRole('button',{name:'Play garden sounds',exact:true});
    assert.equal(await play.getAttribute('aria-pressed'), 'false');
    await p.waitForFunction(() => window.audioContexts[0].state === 'suspended', undefined, {timeout: 5000});
    await play.click();
    await p.waitForFunction(() => window.audioContexts[0].state === 'running');
    assert.equal((await audioState(p)).length, 1, 'one engine, reused');
    healthy(p);
  } finally { await p.context().close(); }
});

test('while the garden waits, its speaker plays it rather than turning it off', async () => {
  const p = await page();
  try {
    await p.addInitScript(countAudio);
    await ready(p, '#contact');
    await p.waitForFunction(()=>document.querySelector('#scene').dataset.progress==='1.000');
    assert.equal(await p.locator('html').getAttribute('data-sound'), 'waiting');
    await p.getByRole('button',{name:'Play garden sounds',exact:true}).click();
    await p.waitForFunction(() => window.audioContexts[0]?.state === 'running');
    await p.waitForFunction(() => document.documentElement.dataset.sound === 'playing');
    assert.equal(await p.locator('#sound-toggle').getAttribute('aria-pressed'), 'true');
    healthy(p);
  } finally { await p.context().close(); }
});

test('garden sound plays in the phone journey, and the reading page is silent', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await p.addInitScript(countAudio);
    await ready(p, '?view=stills');
    const button = p.locator('.journey-bar .journey-sound');
    assert.equal(await button.getAttribute('aria-label'), 'Play garden sounds');
    assert.equal(await p.locator('html').getAttribute('data-sound'), 'waiting');
    assert.deepEqual(await audioState(p), []);
    await p.waitForFunction(() => /hear the garden/.test(document.querySelector('.journey-toast').textContent), undefined, {timeout: 5000});
    await p.locator('#intro-title').click();
    await p.waitForFunction(() => window.audioContexts[0]?.state === 'running');
    await p.waitForFunction(() => document.documentElement.dataset.sound === 'playing');
    assert.equal(await p.locator('.journey-toast').textContent(), '', 'the note goes once the garden plays');
    assert.equal(await button.getAttribute('aria-label'), 'Stop garden sounds');
    await button.click();
    assert.equal(await p.locator('html').getAttribute('data-sound'), 'off');
    healthy(p);
  } finally { await p.context().close(); }
  const r = await page();
  try {
    await r.addInitScript(countAudio);
    await ready(r, '?view=read');
    assert.equal(await r.locator('#sound-toggle').isVisible(), false);
    await r.keyboard.press('Shift');
    await r.waitForTimeout(300);
    assert.ok((await audioState(r)).every(state => state !== 'running'), 'a gesture on the reading page plays nothing');
    assert.deepEqual(await audioState(r), []);
    healthy(r);
  } finally { await r.context().close(); }
});

test('left alone, the garden view quiets its controls and note, and Bloom slowly turns', async () => {
  const p = await page();
  try {
    await ready(p, '#contact');
    await p.waitForFunction(()=>document.querySelector('#scene').dataset.progress==='1.000');
    await p.mouse.move(700, 300);
    const turned = Number(await p.locator('#scene').getAttribute('data-rotation'));
    assert.ok(Number(await p.locator('#scene').getAttribute('data-shift')) > 0.05, 'the garden sits beside the note');
    await p.waitForFunction(() => document.documentElement.dataset.idle === 'true', undefined, {timeout: 25000});
    await p.waitForTimeout(2500);
    assert.ok(Math.abs(Number(await p.locator('#scene').getAttribute('data-shift'))) < 0.01, 'idle, the garden is centred');
    assert.equal(await p.locator('.ruler').evaluate(e => getComputedStyle(e).opacity), '0');
    assert.equal(await p.locator('.chapter.active .note').evaluate(e => getComputedStyle(e).opacity), '0', 'the note steps back too');
    assert.ok(Number(await p.locator('#scene').getAttribute('data-rotation')) > turned + 0.02, 'the garden drifts');
    await p.mouse.move(720, 320);
    assert.equal(await p.locator('html').getAttribute('data-idle'), 'false');
    healthy(p);
  } finally { await p.context().close(); }
});

test('the garden controls wait for Bloom, on the desktop and in the phone journey', async () => {
  const visit = async (p, hash) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(1500); };
  const p = await page();
  try {
    await ready(p);
    const dock = p.getByText('Make the garden yours', { exact: true });
    for (const hash of ['intro', 'about', 'work', 'whisperbook', 'wattch']) {
      await visit(p, hash);
      assert.equal(await dock.isVisible(), false, `hidden at ${hash}`);
    }
    assert.equal(await p.locator('.dock').evaluate(e => e.inert), true, 'out of the tab order before Bloom');
    await visit(p, 'contact');
    await p.waitForFunction(() => getComputedStyle(document.querySelector('.dock')).opacity === '1');
    assert.equal(await dock.isVisible(), true);
    await dock.click();
    await visit(p, 'work');
    assert.equal(await p.locator('.dock').evaluate(e => e.open), false, 'closed on leaving Bloom');
    assert.equal(await dock.isVisible(), false);
    healthy(p);
  } finally { await p.context().close(); }
  const phone = await page({viewport:{width:390,height:844}});
  try {
    await ready(phone, '?view=stills');
    const controls = phone.locator('.journey-bar').getByRole('button', { name: 'Garden controls', exact: true });
    for (const hash of ['about', 'wattch']) {
      await visit(phone, hash);
      assert.equal(await controls.isVisible(), false, `hidden at ${hash}`);
    }
    await visit(phone, 'contact');
    assert.equal(await controls.isVisible(), true);
    healthy(phone);
  } finally { await phone.context().close(); }
});
