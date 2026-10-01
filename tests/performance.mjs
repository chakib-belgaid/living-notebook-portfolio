import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.TEST_URL || 'http://127.0.0.1:5199';
const output=process.env.QA_OUTPUT || '/private/tmp/notebook-qa';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const results=[];
async function traceStart(page) {
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Tracing.start',{categories:'toplevel,devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});
 return async name=>{
  const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
  await cdp.send('Tracing.end');const {stream}=await done;
  let content='';while(true){const x=await cdp.send('IO.read',{handle:stream});content+=x.data;if(x.eof)break;}
  await cdp.send('IO.close',{handle:stream});
  await writeFile(output+'/'+name+'.json',content);
 };
}
try {
 for(const mode of ['default','paused','reduced']) {
  for(let run=0;run<5;run++) {
   const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1.6,reducedMotion:mode==='reduced'?'reduce':'no-preference'});
   const page=await context.newPage();
   await page.route('**/*open-meteo.com/**',r=>r.abort());
   await page.addInitScript(({paused})=>{
    window.samples={longtasks:[],frames:[],sampling:false,prev:0};
    new PerformanceObserver(l=>window.samples.longtasks.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
    function sample(t){if(window.samples.sampling && window.samples.prev)window.samples.frames.push(t-window.samples.prev);window.samples.prev=window.samples.sampling?t:0;requestAnimationFrame(sample);}requestAnimationFrame(sample);
    if(paused){new MutationObserver((_,o)=>{const b=document.querySelector('#motion-toggle');if(b&&document.documentElement.classList.contains('enhanced')){b.click();o.disconnect();}}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}
   },{paused:mode==='paused'});
   const finish=run===0?await traceStart(page):null;
   await page.goto(base);
   await page.waitForFunction(()=>document.querySelector('#scene')?.dataset.progress);
   await page.waitForFunction(()=>performance.getEntriesByName("notebook:shader-first-use-complete").length>0,{},{timeout:15000});
   await page.waitForTimeout(500);
   const cold=await page.evaluate(()=>({tasks:window.samples.longtasks,paints:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),marks:performance.getEntriesByType('measure').filter(e=>e.name.startsWith('notebook:')).map(e=>({name:e.name,start:e.startTime,ms:e.duration}))}));
   const start=await page.evaluate(()=>{window.samples.longtasks=[];window.samples.frames=[];window.samples.sampling=true;return performance.now();});
   // Exercise the ruler across every note; do not capture screenshots while sampling.
   const positions=await page.locator('.chapter').evaluateAll(es=>es.map(e=>Math.min(e.offsetTop,document.documentElement.scrollHeight-innerHeight)));
   const max=await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
   for(const y of positions){await page.locator('#scrub').fill(String(Math.ceil(y/max*1000)));await page.waitForTimeout(220);}
   await page.waitForTimeout(650);
   await page.locator('.dock > summary').click();
   await page.getByRole('button',{name:'Fog',exact:true}).click();
   await page.waitForTimeout(500);
   for(const id of ['about','contact','work','contact']){await page.locator(`.masthead a[href="#${id}"]`).click();await page.waitForTimeout(650);}
   const warm=await page.evaluate(start=>{
    window.samples.sampling=false;
    return {tasks:window.samples.longtasks,frames:window.samples.frames,marks:performance.getEntriesByType('measure').filter(e=>e.startTime>=start&&e.name.startsWith('notebook:')).map(e=>({name:e.name,start:e.startTime,ms:e.duration}))};
   },start);
   if(finish)await finish('trace-'+mode);
   const frames=warm.frames.sort((a,b)=>a-b);
   const under=frames.filter(n=>n<33).length/Math.max(1,frames.length);
   const summary={mode,run:run+1,cold,warm:{tasks:warm.tasks,marks:warm.marks,frameCount:frames.length,p95:frames[Math.floor(frames.length*0.95)],under33:under},maxCold:Math.max(0,...cold.tasks.map(e=>e.ms)),maxInteraction:Math.max(0,...warm.tasks.map(e=>e.ms))};
   results.push(summary);
   console.log(JSON.stringify({mode,run:run+1,coldMs:summary.maxCold,interactionMs:summary.maxInteraction,framesUnder33:Math.round(under*10000)/100}));
   await context.close();
  }
 }
 // The compact reading default must not initialize a scene at all.
 for(let run=0;run<5;run++){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});const page=await context.newPage();
  await page.addInitScript(()=>{window.tasks=[];new PerformanceObserver(l=>window.tasks.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});});
  await page.goto(base);await page.waitForTimeout(500);
  const cold=await page.evaluate(()=>window.tasks);await page.evaluate(()=>window.tasks=[]);
  for(const id of ['whisperbook','wattch','about','contact','work','contact']){
   await page.locator(`.masthead a[href="#${['whisperbook','wattch'].includes(id)?'work':id}"]`).click();
   if(['whisperbook','wattch'].includes(id)) await page.locator(`#work > .project-shortcuts a[href="#${id}"]`).click();
   await page.waitForTimeout(700);
  }
  const warm=await page.evaluate(()=>window.tasks);
  results.push({mode:'mobile-reading',run:run+1,cold:{tasks:cold},warm:{tasks:warm},maxCold:Math.max(0,...cold.map(e=>e.ms)),maxInteraction:Math.max(0,...warm.map(e=>e.ms)),sceneLoaded:await page.locator('#scene canvas').count(),view:await page.locator('html').getAttribute('data-view')});await context.close();
 }
 await writeFile(output+'/performance.json',JSON.stringify({browser:browser.version(),longTaskThresholdMs:50,frameThresholdMs:33,viewport:{width:1440,height:900,deviceScaleFactor:1.6},results},null,2));
} finally {await browser.close();}
