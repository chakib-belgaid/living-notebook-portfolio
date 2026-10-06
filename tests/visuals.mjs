import { chromium } from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL || 'http://127.0.0.1:5199';
const output=process.env.QA_OUTPUT || '/private/tmp/notebook-qa';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const diagnostics=[];
async function create(viewport={width:1440,height:900}) {
 const context=await browser.newContext({viewport,deviceScaleFactor:1.6});
 const page=await context.newPage();
 page.on('pageerror',error=>diagnostics.push({type:'pageerror',message:error.message}));
 page.on('console',message=>{if(['error','warning'].includes(message.type()))diagnostics.push({type:message.type(),message:message.text()});});
 await page.route('**/*open-meteo.com/**',r=>r.abort());
 return page;
}
try {
 const entry=await create();
 await entry.goto(base+'/?view=garden');
 await entry.waitForFunction(()=>document.querySelector('#scene')?.dataset.progress==='0.000');
 await entry.waitForTimeout(2200);
 await entry.screenshot({path:output+'/desktop-garden.png'});
 await entry.context().close();
 const read=await create();
 await read.goto(base);await read.evaluate(()=>document.fonts.ready);
 await read.screenshot({path:output+'/desktop-reading.png'});
 for(const id of ['whisperbook','wattch']){
  await read.goto(base+'/?view=read#'+id);await read.waitForTimeout(250);
  await read.screenshot({path:output+'/desktop-'+id+'.png'});
 }
 const cdp=await read.context().newCDPSession(read);
 await writeFile(output+'/accessibility-reading.json',JSON.stringify(await cdp.send('Accessibility.getFullAXTree'),null,2));
 await read.context().close();
 for(const quality of ['full','low']){
  const p=await create();await p.goto(base+'/?view=garden&quality='+quality+'#contact');
  await p.waitForFunction(()=>performance.getEntriesByName('notebook:shader-first-use-complete').length>0);
  await p.locator('.dock > summary').click();
  await p.getByRole('button',{name:'Clear',exact:true}).click();
  await p.getByRole('button',{name:'Autumn',exact:true}).click();
  await p.locator('#hour').fill('13');
  await p.getByRole('button',{name:'Pause motion',exact:true}).click();
  await p.waitForTimeout(1000);
  await p.locator('.dock > summary').click();
  if(quality==='full'){
   const session=await p.context().newCDPSession(p);
   await writeFile(output+'/accessibility-garden.json',JSON.stringify(await session.send('Accessibility.getFullAXTree'),null,2));
  }
  await p.addStyleTag({content:'.note,.hotspot {visibility:hidden}'});
  await p.screenshot({path:output+'/quality-'+quality+'.png'});
  await p.context().close();
 }
 const phone=await create({width:390,height:844});
 await phone.goto(base+'/?view=garden#contact');
 await phone.waitForFunction(()=>document.querySelector('#scene')?.dataset.progress==='1.000');
 await phone.screenshot({path:output+'/mobile-garden-preview.png'});
 await phone.context().close();
 await writeFile(output+'/visual-diagnostics.json',JSON.stringify(diagnostics,null,2));
 console.log('Visuals and accessibility trees saved to '+output);
}finally{await browser.close();}
