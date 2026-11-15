import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {panel,closePanel} from './browser-panels.mjs';
const root=new URL('../',import.meta.url),base=process.env.ATLAS_TEST_URL||'http://127.0.0.1:5173/';
const atlas=JSON.parse(fs.readFileSync(new URL('public/data/atlas.json',root),'utf8'));
const output=new URL('../tmp/atlas-qa/observatory/',root);fs.mkdirSync(output,{recursive:true});
const report={base,checkedAt:new Date().toISOString(),version:atlas.meta.version,scenarios:[],errors:[],screenshots:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();context.on('page',p=>p.on('pageerror',e=>report.errors.push(String(e))));page.on('pageerror',e=>report.errors.push(String(e)));
const check=async(name,fn)=>{await fn();report.scenarios.push({name,status:'passed'});console.log('PASS',name);};
const two=async(p=page)=>p.locator('.network-canvas canvas').first().waitFor();
const three=async(p=page)=>p.locator('.space-wrap[data-ready=true] canvas').waitFor({timeout:30000});
const snap=async(p,name)=>{await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const file=new URL(name+'.png',output).pathname;await p.screenshot({path:file,fullPage:true});report.screenshots.push(file);};
const fit=async(p=page)=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),'document overflows viewport');
const drawerFits=async(p=page)=>assert.ok(await p.locator('.observatory-drawer').evaluate(e=>{const r=e.getBoundingClientRect(),b=e.querySelector('.drawer-body');return r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1&&b.clientHeight>0&&b.clientHeight<innerHeight;}),'drawer does not fit viewport');
try{
 await check('new desktop visit opens real 3D graph with the official local logo',async()=>{
  await page.goto(base);await three();await fit();assert.equal(await page.locator('.space-wrap').getAttribute('data-nodes'),'1324');assert.equal(await page.locator('.summary-strip b').first().textContent(),'1,168');assert.ok(await page.locator('.official-logo').evaluate(e=>e.complete&&e.naturalWidth===801&&e.src.includes('/brand/')));assert.equal(await page.locator('.intro').count(),0);await snap(page,'desktop');
 });
 await check('each experience remembers its dimension while analysis initially opens in 2D',async()=>{
  await page.getByRole('button',{name:'구조 분석 SNA',exact:true}).click();await two();assert.equal(await page.getByRole('button',{name:'분석 2D 지도',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'분석 3D 지도',exact:true}).click();await three();await page.getByRole('button',{name:'연구 탐색',exact:true}).click();await three();await page.getByRole('button',{name:'2D 지도',exact:true}).click();await two();await page.getByRole('button',{name:'구조 분석 SNA',exact:true}).click();await three();await page.getByRole('button',{name:'연구 탐색',exact:true}).click();await two();assert.ok(page.url().includes('dim=2d'));
 });
 await check('legacy URLs preserve 2D and explicit 3D links restore 3D',async()=>{
  await page.goto(base+'#view=topics&from=2018&to=2022');await two();assert.ok(page.url().includes('dim=2d'));assert.ok(page.url().includes('from=2018'));await page.goto(base+'#view=topics&dim=3d');await three();
 });
 await check('desktop filters scroll inside a bounded panel and return keyboard focus',async()=>{
  await panel(page,'filters');await drawerFits();await page.getByLabel('시작 연도',{exact:true}).selectOption('2021');await page.getByLabel('끝 연도',{exact:true}).selectOption('2021');await page.locator('.topic-option').filter({hasText:'AI·데이터'}).click();assert.equal(await page.locator('.summary-strip b').first().textContent(),String(atlas.articles.filter(p=>p.year===2021&&p.topics.includes('ai')).length));await snap(page,'filters');await page.keyboard.press('Escape');assert.equal(await page.locator('.observatory-drawer').count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'탐색 조건 열기');
 });
 await check('closing details keeps selection and reopening preserves its evidence',async()=>{
  const r=atlas.researchers.find(r=>r.name==='임태형');await page.goto(base+'#type=researcher&id='+r.id);await page.locator('.profile-heading h2').waitFor();await drawerFits();await page.waitForFunction(()=>{const h=document.querySelector('.network-canvas'),c=h?.querySelector('canvas');return h&&c&&Math.abs(c.getBoundingClientRect().width-h.clientWidth)<1;});await snap(page,'researcher');await closePanel(page);assert.ok(page.url().includes(r.id));await panel(page,'detail');assert.equal(await page.locator('.profile-heading h2').textContent(),'임태형');await page.locator('.detail-panel .paper-row').first().click();await page.locator('.source-link').waitFor();assert.equal(await page.locator('.drawer-body').evaluate(e=>e.scrollTop),0);await snap(page,'paper');
 });
 await check('skip navigation focuses the workspace without destroying shared state',async()=>{
  const url=page.url();await closePanel(page);await page.locator('.skip-link').focus();await page.keyboard.press('Enter');assert.equal(page.url(),url);assert.equal(await page.evaluate(()=>document.activeElement?.id),'explore');
 });
 await check('zero search results can be recovered from the persistent search',async()=>{
  await page.goto(base+'#view=coauthor');await two();await page.getByLabel('연구자, 소속, 논문, 키워드 검색',{exact:true}).fill('NO-SUCH-RESEARCHER-XYZ');await page.getByText('조건에 맞는 논문이 없습니다.',{exact:true}).waitFor();await page.getByRole('button',{name:'검색어 지우기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.summary-strip b')?.textContent==='1,168');
 });
 await check('mobile starts in 2D and opens only one modal bottom sheet',async()=>{
  const p=await context.newPage();await p.setViewportSize({width:390,height:844});const requests=[];p.on('request',r=>requests.push(r.url()));await p.goto(base);await two(p);assert.ok(!requests.some(u=>u.includes('layout-3d')));await fit(p);await snap(p,'mobile');await panel(p,'filters');await drawerFits(p);assert.ok(await p.locator('.observatory-drawer').evaluate(e=>e.matches(':modal')));await p.keyboard.press('Shift+Tab');assert.ok(await p.evaluate(()=>!!document.activeElement?.closest('.observatory-drawer')));await snap(p,'mobile-filters');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'탐색 조건 열기');
  await p.getByRole('button',{name:'목록 보기',exact:true}).click();await p.locator('.researcher-row').first().click();await p.locator('.profile-heading h2').waitFor();assert.equal(await p.locator('dialog[open]').count(),1);await drawerFits(p);await fit(p);await snap(p,'mobile-researcher');await closePanel(p);await panel(p,'filters');assert.equal(await p.locator('dialog[open]').count(),1);await p.close();
 });
 await check('resizing an open sheet preserves state and changes modality safely',async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto(base+'#experience=analysis');await two();await panel(page,'analysis');await page.getByLabel('분석 시작 연도',{exact:true}).selectOption('2018');await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>document.querySelector('.observatory-drawer')?.matches(':modal')===false);await drawerFits();assert.equal(await page.locator('.observatory-drawer').evaluate(e=>e.matches(':modal')),false);assert.equal(await page.getByLabel('분석 시작 연도',{exact:true}).inputValue(),'2018');await closePanel(page);
 });
 await check('mobile analysis, tablet and short desktop controls remain reachable',async()=>{
  for(const [width,height,name] of [[390,844,'mobile-analysis'],[820,1180,'tablet-analysis'],[1280,720,'compact-analysis']]){
   await page.setViewportSize({width,height});await page.goto(base+'#experience=analysis');await page.reload();await two();await fit();await snap(page,name);await panel(page,'tools');await drawerFits();await page.getByRole('button',{name:'계산 기준 JSON',exact:true}).scrollIntoViewIfNeeded();await closePanel(page);const controls=await page.locator('.map-controls').boundingBox();assert.ok(controls.y+controls.height<=height);await page.getByRole('button',{name:'표 보기',exact:true}).click();assert.equal(await page.locator('.sna-table tbody tr').count(),1324);
  }
 });
 await check('embedded atlas keeps compact controls and 2D as its first view',async()=>{
  await page.setViewportSize({width:1000,height:760});await page.goto(base+'?embed=1');await two();await fit();await panel(page,'filters');await drawerFits();await closePanel(page);await snap(page,'embed');
 });
 await check('reduced motion disables drawer animation and theme has readable base contrast',async()=>{
  await panel(page,'filters');assert.equal(await page.locator('.observatory-drawer').evaluate(e=>getComputedStyle(e).animationName),'none');
  const luminance=hex=>{const a=hex.match(/\w\w/g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];};
  for(const fg of ['eef4fc','a6b8ce'])for(const bg of ['07111f','101e33'])assert.ok((luminance(fg)+.05)/(luminance(bg)+.05)>=4.5);
 });
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);console.error(e);process.exitCode=1;await snap(page,'observatory-failure').catch(()=>{});}
finally{fs.writeFileSync(process.env.ATLAS_QA_REPORT||new URL('docs/browser-observatory-qa.json',root),JSON.stringify(report,null,2)+'\n');await browser.close();}
