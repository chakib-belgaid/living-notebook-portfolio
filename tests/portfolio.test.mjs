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
  await p.goto(base + '/' + path);
  await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
}
async function go(p, id) {
  // The masthead links Work, About and Contact; projects are reached by their fragment.
  const link = p.locator(`.masthead a[href="#${id}"]`);
  if (await link.count()) await link.click();
  else await p.evaluate(id => { location.hash = id; }, id);
  await p.waitForTimeout(1500);
  if (id === 'contact' && await p.locator('html').getAttribute('data-view') === 'garden') await p.locator('.chapter.active textarea').waitFor({state:'visible',timeout:5000});
}
function healthy(p) { assert.deepEqual(p.errors, []); }
// The sheet slides up; measure it once it has arrived.
const settled = sheet => sheet.evaluate(d => Promise.all(d.getAnimations().map(a => a.finished)));

test('every journey stop and its details are in the served page', async () => {
  const html = await (await fetch(base + '/')).text();
  for (const s of ['sketch', 'blueprint', 'build', 'whisperbook', 'wattch', 'bloom']) assert.match(html, new RegExp(`data-stop="${s}"`), s);
  for (const d of ['about', 'whisperbook', 'wattch', 'contact']) assert.match(html, new RegExp(`data-detail="${d}"`), d);
  assert.equal((html.match(/class="[^"]*\bstop-card\b/g) || []).length, 6);
  assert.match(html, /class="stop-line">Product engineer, Ph\.D\. AI products, developer tools, and how we measure the energy software uses\.</);
  assert.match(html, /class="static-garden"[^>]*loading="lazy"/);
});

test('desktop entry, project links, wheel chaining and clean landmarks', async () => {
  const p = await page();
  try {
    await ready(p);
    assert.match(await p.title(), /Chakib Belgaid.*Product engineer/);
    assert.equal(await p.locator('html').getAttribute('data-view'), 'garden');
    await p.locator('.chapter.active a[href="#whisperbook"]').click();
    await p.waitForTimeout(1500);
    assert.match(p.url(), /#whisperbook$/);
    assert.equal(await p.locator('.chapter:not(.active):not([inert])').count(), 0);
    assert.equal(await p.locator('.chapter.active h2').innerText(), 'Whisperbook');
    const before = await p.evaluate(() => scrollY);
    await p.locator('.chapter.active .note').hover();
    await p.mouse.wheel(0, 800);
    await p.waitForTimeout(500);
    assert.ok(await p.evaluate(() => scrollY) > before, 'wheel over a note advances the document');
    await p.screenshot({ path: output + '/desktop-story.png' });
    healthy(p);
  } finally { await p.context().close(); }
});

test('draft survives navigation, view changes, resize and email handoff', async () => {
  const p = await page();
  try {
    await ready(p);
    await go(p, 'contact');
    await p.locator('.chapter.active textarea').fill('Hello & a draft with accents: café.');
    await go(p, 'about');
    await go(p, 'contact');
    assert.equal(await p.locator('.chapter.active textarea').inputValue(), 'Hello & a draft with accents: café.');
    await p.setViewportSize({width:320,height:568});
    await p.waitForTimeout(300);
    assert.equal(await p.locator('#contact textarea').inputValue(), 'Hello & a draft with accents: café.');
    assert.equal(await p.locator('#contact .note-count span').innerText(), String('Hello & a draft with accents: café.'.length));
    assert.equal(await p.locator('#contact [data-send]').isEnabled(), true);
    const mail = await p.locator('#contact [data-send]').evaluate(button => {
      let href;
      const original = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { href = this.href; };
      button.click();
      HTMLAnchorElement.prototype.click = original;
      return href;
    });
    assert.match(mail, /^mailto:chakib\.belgaid@gmail\.com\?subject=/);
    assert.equal(new URLSearchParams(mail.split('?')[1]).get('body'), 'Hello & a draft with accents: café.');
    assert.equal(await p.locator('#contact textarea').inputValue(), 'Hello & a draft with accents: café.');
    await p.setViewportSize({width:1440,height:900});
    await p.waitForTimeout(500);
    assert.equal(await p.locator('.chapter.active textarea').inputValue(), 'Hello & a draft with accents: café.');
    await p.reload();
    await p.locator('.chapter.active textarea').waitFor({state:'visible'});
    assert.equal(await p.locator('.chapter.active textarea').inputValue(), '');
    assert.equal(await p.locator('.chapter.active [data-send]').isDisabled(), true);
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

test('a contact field usable during scene loading keeps its draft and focus when the scene arrives', async () => {
  const p = await page();
  try {
    const delay = async route => { await new Promise(resolve=>setTimeout(resolve,1000));await route.continue(); };
    await p.route('**/assets/scene-*.js', delay);
    await p.route('**/src/scene.ts*', delay);
    await ready(p, '#contact');
    const field=p.locator('.chapter.active textarea');
    await field.fill('A draft written while the garden loads.');
    await p.waitForFunction(()=>document.querySelector('#scene').dataset.progress==='1.000');
    assert.equal(await field.inputValue(), 'A draft written while the garden loads.');
    assert.equal(await field.evaluate(e=>e===document.activeElement), true);
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
    await p.screenshot({path:output+'/evidence-dialog.png'});
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
      assert.equal(await p.locator('#scene canvas').count(), 0, 'the journey does not initialize WebGL');
      await p.waitForFunction(() => { const i = document.querySelector('.journey-still[data-still="sketch"]'); return i?.complete && i.naturalWidth > 0; });
      assert.equal(await p.evaluate(()=>scrollY), 0, 'the introduction starts above the fold');
      assert.ok(await p.locator('#intro-title').evaluate(e=>e.getBoundingClientRect().top>=document.querySelector('.masthead').getBoundingClientRect().bottom),'the header does not obscure the introduction');
      const clipped = await p.locator('.masthead a').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(e=>e.textContent));
      assert.deepEqual(clipped, []);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.screenshot({path:output+`/journey-${width}x${height}.png`});
      await go(p,'contact');
      const leave = p.getByRole('button',{name:'Leave a note',exact:true});
      await leave.click();
      await p.locator('dialog.sheet textarea').fill('A visible mobile draft.');
      await p.screenshot({path:output+`/sheet-${width}x${height}.png`});
      await p.keyboard.press('Escape');
      await p.waitForFunction(()=>!document.querySelector('dialog.sheet').open);
      assert.equal(await p.locator('#contact textarea').inputValue(), 'A visible mobile draft.', 'the draft goes back with the form');
      assert.equal(await leave.evaluate(e=>e===document.activeElement), true, 'focus returns to the opener');
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
    await p.screenshot({path:output+'/reading-844x390.png'});
    await go(p,'contact');
    await p.locator('#contact textarea').fill('A visible landscape draft.');
    assert.equal(await p.locator('#contact textarea').evaluate(e=>getComputedStyle(e).position),'static');
    healthy(p);
  } finally { await p.context().close(); }
});

test('a card’s More opens its details in a sheet and puts them back', async () => {
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await go(p,'whisperbook');
    assert.equal(await p.locator('.journey-label').textContent(), 'Build · Whisperbook');
    assert.ok(await p.locator('#whisperbook .stop-card').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}), 'the card is on screen at its stop');
    const more = p.getByRole('button',{name:'More about Whisperbook',exact:true});
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
    await p.getByRole('button',{name:'More about Wattch Core',exact:true}).click();
    await p.locator('dialog.sheet').waitFor({state:'visible'});
    await p.setViewportSize({width:844,height:390});
    await p.waitForTimeout(400);
    assert.equal(await p.locator('html').getAttribute('data-journey'), null);
    assert.equal(await p.locator('dialog.sheet').evaluate(d=>d.open), false);
    assert.equal(await p.locator('#wattch [data-detail="wattch"]').count(), 2);
    assert.equal(await p.locator('#wattch .project-tech').isVisible(), true);
    assert.deepEqual(await p.locator('#portfolio > section').evaluateAll(es=>es.map(e=>e.id)), ['intro','work','about','contact'], 'reading order is restored');
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
    await ready(p);
    await p.waitForTimeout(800);
    const stills = urls.filter(u => u.includes('/assets/stills/'));
    assert.ok(stills.some(u => u.endsWith('/sketch.webp')), stills.join());
    assert.ok(stills.length <= 2, stills.join());
    assert.equal(urls.filter(u => u.includes('garden-preview.png')).length, 0);
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
      if(!javaScriptEnabled) await p.screenshot({path:output+'/no-javascript.png'});
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

test('on phones the sprout swaps the stills for the live garden, which follows the stops', async () => {
  const p=await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await p.locator('.view-switch').click();
    await p.waitForFunction(()=>!!document.querySelector('.journey #scene canvas'));
    assert.equal(await p.locator('html').getAttribute('data-journey'),'true');
    assert.equal(await p.locator('#stage').isVisible(),true);
    assert.equal(await p.locator('.journey-still[data-still="sketch"]').isVisible(),false);
    assert.match(p.url(),/view=garden/);
    await p.locator('.view-switch').click();
    assert.equal(await p.locator('#stage').isVisible(),false);
    assert.doesNotMatch(p.url(),/view=/);
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.locator('#stage').isVisible(),true);
    await p.goBack();
    await p.waitForTimeout(300);
    assert.equal(await p.locator('#stage').isVisible(),false);
    await p.locator('.view-switch').click();
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
    assert.equal(await failed.locator('.chapter.active textarea').isVisible(),true);
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

test('missing local speech voices and clipboard rejection have useful fallback states', async () => {
  const p=await page();
  try {
    await p.addInitScript(()=>{
      speechSynthesis.getVoices=()=>[];
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Denied');}}});
    });
    await ready(p,'?view=read#whisperbook');
    await p.locator('#whisperbook details summary').click();
    await p.waitForTimeout(1600);
    assert.equal(await p.locator('#whisperbook .play').isDisabled(),true);
    assert.match(await p.locator('#whisperbook .player-voice').innerText(),/no on-device voice/);
    await go(p,'contact');
    await p.locator('#contact [data-copy]').click();
    assert.match(await p.locator('#contact [data-copy-status]').innerText(),/Copy isn’t available/);
    healthy(p);
  } finally {await p.context().close();}
});

test('200% text enlargement and 400% reflow expose links and fields', async () => {
  const p=await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
    await p.addStyleTag({content:':root {font-size:200%;}'});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% text does not overflow');
    const clipped=await p.locator('.masthead a').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>e.textContent));
    assert.deepEqual(clipped,[]);
    await p.screenshot({path:output+'/text-200.png'});
    await go(p,'contact');
    await p.getByRole('button',{name:'Leave a note',exact:true}).click();
    const sheet = p.locator('dialog.sheet');
    await sheet.locator('textarea').fill('Enlarged text remains readable.');
    await settled(sheet);
    assert.ok(await sheet.evaluate(d=>{const r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1;}),'the sheet stays within the viewport');
    await p.screenshot({path:output+'/text-200-sheet.png'});
    healthy(p);
  } finally {await p.context().close();}
  const zoom=await page({viewport:{width:360,height:225}});
  try {
    await ready(zoom);
    assert.ok(await zoom.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'400% equivalent reflow does not overflow');
    await go(zoom,'contact');
    assert.equal(await zoom.locator('#contact textarea').isVisible(),true);
    await zoom.screenshot({path:output+'/reflow-400.png'});
    healthy(zoom);
  } finally {await zoom.context().close();}
});

test('phone motion pauses from the header, and reduced motion keeps the journey still', async () => {
  const running = p => p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
  const p = await page({viewport:{width:390,height:844}});
  try {
    await ready(p);
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
    const more = r.getByRole('button',{name:'More about Wattch Core',exact:true});
    await more.click();
    assert.equal(await r.locator('dialog.sheet').evaluate(d=>d.open), true);
    await r.keyboard.press('Escape');
    assert.equal(await r.locator('dialog.sheet').evaluate(d=>d.open), false, 'closes at once');
    assert.equal(await more.evaluate(e=>e===document.activeElement), true);
    healthy(r);
  } finally { await r.context().close(); }
});
