import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import Graph from 'graphology';
import gexf from 'graphology-gexf';
const root=new URL('../',import.meta.url),base=process.env.ATLAS_TEST_URL||'http://127.0.0.1:5173/';
const atlas=JSON.parse(fs.readFileSync(new URL('public/data/atlas.json',root),'utf8'));
const full=JSON.parse(fs.readFileSync(new URL('public/data/sna-papers.json',root),'utf8')).result;
const output=new URL('../tmp/atlas-qa/sna/',root);fs.mkdirSync(output,{recursive:true});
const report={base,checkedAt:new Date().toISOString(),version:atlas.meta.version,scenarios:[],performance:{},errors:[],screenshots:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(String(e)));
const ready=async(p=page,from=1996,to=2026,weight='papers')=>{await p.locator(`.analysis-ready[data-from="${from}"][data-to="${to}"][data-weighting="${weight}"]`).waitFor({timeout:30000});};
const check=async(name,fn)=>{await fn();report.scenarios.push({name,status:'passed'});console.log('PASS',name);};
const snap=async(p,name)=>{const path=new URL(name+'.png',output).pathname;await p.screenshot({path,fullPage:true});report.screenshots.push(path);};
const profile=async(id,extra='')=>{await page.goto(base+'#experience=analysis&type=researcher&id='+id+extra);await page.getByRole('button',{name:'분석 2D 지도',exact:true}).click();await ready();await page.locator('.sna-metrics').waitFor();};
try{
 await check('exploration remains the default; analysis loads the complete period network',async()=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base);await page.locator('.network-canvas canvas').first().waitFor();assert.ok(!requests.some(u=>u.includes('/sna-papers.json')));
  await page.getByRole('button',{name:'구조 분석 SNA',exact:true}).click();await ready();assert.equal(await page.locator('.analysis-network').getAttribute('data-nodes'),'1324');assert.equal(await page.locator('.analysis-network').getAttribute('data-links'),'2456');await snap(page,'desktop');
 });
 await check('real 2D node selection opens network metrics',async()=>{
  const el=page.locator('.analysis-network .network-canvas');const box=await el.boundingBox();let hit=false;
  for(const y of [.5,.45,.55,.4,.6,.3,.7]){for(let x=.25;x<.8;x+=.02){await page.mouse.move(box.x+box.width*x,box.y+box.height*y);if(await el.evaluate(e=>e.style.cursor==='pointer')){await page.mouse.click(box.x+box.width*x,box.y+box.height*y);hit=true;break;}}if(hit)break;}assert.ok(hit);await page.locator('.sna-metrics').waitFor();
 });
 await check('search and topic highlighting never change analysis totals or selected centralities',async()=>{
  const node=full.nodes.find(n=>n.crossCommunityPartners>2);await profile(node.id);const metrics=await page.locator('.sna-metrics').textContent(),summary=await page.locator('[data-testid=sna-summary]').textContent();
  await page.getByLabel('분석 강조 검색',{exact:true}).fill('임태형');await page.getByLabel('분석 강조 분야',{exact:true}).selectOption('ai');await page.getByText(/강조:.*편의 연구자/).waitFor();
  assert.equal(await page.locator('.sna-metrics').textContent(),metrics);assert.equal(await page.locator('[data-testid=sna-summary]').textContent(),summary);
  await page.getByLabel('분석 강조 검색',{exact:true}).fill('NO-SUCH-RESEARCH-XYZ');await page.getByText('강조: 0편의 연구자 · 0개 묶음',{exact:true}).waitFor();assert.equal(await page.locator('.analysis-network').getAttribute('data-nodes'),'1324');
  await page.getByRole('button',{name:'강조 초기화',exact:true}).click();
 });
 await check('community selection highlights members and keeps the full graph',async()=>{
  await page.locator('.sna-group').first().click();await page.locator('.sna-detail h2').filter({hasText:'협력집단 1'}).waitFor();assert.equal(await page.locator('.analysis-network').getAttribute('data-nodes'),'1324');await page.getByRole('button',{name:'표 보기',exact:true}).click();assert.equal(await page.locator('.sna-table tbody tr').count(),1324);assert.equal(await page.locator('.sna-table tr.highlighted').count(),full.communities[0].members.length);await snap(page,'community-table');
 });
 await check('cross-community ties lead to their source paper',async()=>{
  const n=full.nodes.find(n=>n.crossCommunityPartners>2);await profile(n.id);await page.locator('.sna-detail .evidence summary').first().click();await page.locator('.sna-detail .evidence .paper-row').first().click();await page.locator('.sna-detail .source-link').waitFor();assert.match(await page.locator('.source-link').getAttribute('href'),/^https?:/);
 });
 await check('analysis options and canonical profile restore through a shared URL',async()=>{
  const n=full.nodes.find(n=>n.degree>3);await profile(n.id);await page.getByLabel('분석 점 크기',{exact:true}).selectOption('betweenness');await page.getByLabel('분석 점 색상',{exact:true}).selectOption('topic');
  const other=await context.newPage();await other.goto(page.url());await ready(other);assert.equal(await other.getByLabel('분석 점 크기',{exact:true}).inputValue(),'betweenness');assert.equal(await other.getByLabel('분석 점 색상',{exact:true}).inputValue(),'topic');assert.equal(await other.locator('.sna-detail h2').textContent(),atlas.researchers.find(r=>r.id===n.id).name);await other.close();
 });
 await check('fractional weighting updates metrics and preserves network identities',async()=>{
  await page.locator('.sna-advanced summary').click();await page.getByLabel('공저 가중치',{exact:true}).selectOption('fractional');await ready(page,1996,2026,'fractional');assert.equal(await page.locator('.analysis-network').getAttribute('data-links'),'2456');await page.getByRole('button',{name:'표 보기',exact:true}).click();const b=JSON.parse(fs.readFileSync(new URL('public/data/sna-fractional.json',root),'utf8')).result;const id=b.nodes[0].id;const row=page.locator(`tr[data-node-id="${id}"]`);assert.equal(await row.locator('td').nth(2).textContent(),b.nodes[0].strength.toLocaleString('ko-KR',{maximumFractionDigits:5}));
 });
 await check('CSV, GEXF and method downloads represent the entire selected period',async()=>{
  await page.getByLabel('분석 강조 검색',{exact:true}).fill('임태형');
  for(const [name,file] of [['연구자 CSV','nodes.csv'],['공저 연결 CSV','edges.csv'],['Gephi GEXF','network.gexf'],['계산 기준 JSON','method.json']]){
   const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const d=await pending;const path=new URL(file,output).pathname;await d.saveAs(path);const text=fs.readFileSync(path,'utf8');
   if(file.endsWith('.gexf')){const g=gexf.parse(Graph,text);assert.equal(g.order,1324);assert.equal(g.size,2456);}else if(file.endsWith('.json')){const m=JSON.parse(text);assert.equal(m.weighting,'fractional');assert.equal(m.summary.nodes,1324);}else{assert.ok(text.startsWith('\uFEFF'));assert.ok(text.includes(atlas.meta.version));}
  }
 });
 await check('uncached period analysis and repositioning stay within the desktop budget',async()=>{
  await page.getByRole('button',{name:'강조 초기화',exact:true}).click();await page.getByRole('button',{name:'표 보기',exact:true}).click();let start=performance.now();await page.getByLabel('분석 시작 연도',{exact:true}).selectOption('2018');await ready(page,2018,2026,'fractional');report.performance.periodAnalysisMs=Math.round(performance.now()-start);assert.ok(report.performance.periodAnalysisMs<5000);
  start=performance.now();await page.getByLabel('분석 배치 기준',{exact:true}).selectOption('period');await ready(page,2018,2026,'fractional');await page.locator('.sna-progress').waitFor({state:'hidden'});report.performance.periodLayoutMs=Math.round(performance.now()-start);assert.ok(report.performance.periodLayoutMs<10000);
 });
 await check('rapid period changes discard obsolete worker results',async()=>{
  await page.getByLabel('분석 시작 연도',{exact:true}).selectOption('2019');await page.getByLabel('분석 시작 연도',{exact:true}).selectOption('2020');await page.getByLabel('분석 시작 연도',{exact:true}).selectOption('2026');await ready(page,2026,2026,'fractional');assert.equal(await page.locator('.sna-summary b').first().textContent(),'125');
 });
 await check('3D consumes the same period graph and restores the analysis view',async()=>{
  const nodes=await page.locator('.analysis-network').getAttribute('data-nodes'),links=await page.locator('.analysis-network').getAttribute('data-links');await page.getByRole('button',{name:'분석 3D 지도',exact:true}).click();await page.locator('.space-wrap[data-ready=true] canvas').waitFor({timeout:30000});assert.equal(await page.locator('.space-wrap').getAttribute('data-nodes'),nodes);assert.equal(await page.locator('.space-wrap').getAttribute('data-links'),links);await snap(page,'3d');
  const other=await context.newPage();await other.goto(page.url());await ready(other,2026,2026,'fractional');await other.locator('.space-wrap[data-ready=true] canvas').waitFor();assert.equal(await other.getByRole('button',{name:'분석 3D 지도',exact:true}).getAttribute('aria-pressed'),'true');await other.close();
 });
 await check('empty and edge-free periods remain usable',async()=>{
  await page.getByRole('button',{name:'분석 2D 지도',exact:true}).click();await page.getByLabel('분석 시작 연도',{exact:true}).selectOption('1997');await page.getByLabel('분석 끝 연도',{exact:true}).selectOption('1997');await ready(page,1997,1997,'fractional');assert.equal(await page.locator('.analysis-network').getAttribute('data-nodes'),'0');await page.getByText('선택 기간에 논문이 없습니다.',{exact:true}).waitFor();
  const p=await context.newPage();await p.route('**/data/atlas.json',route=>route.fulfill({json:{...atlas,meta:{...atlas.meta,version:'isolated-fixture'},articles:atlas.articles.slice(0,3).map((x,i)=>({...x,authors:[atlas.researchers[i].id],year:2020}))}}));await p.route('**/sna-*.json*',route=>route.fulfill({status:404,body:'missing'}));await p.goto(base+'#experience=analysis&from=2020&to=2020&layout=period');await ready(p,2020,2020);assert.equal(await p.locator('.analysis-network').getAttribute('data-nodes'),'3');assert.equal(await p.locator('.analysis-network').getAttribute('data-links'),'0');await p.close();
 });
 await check('worker failure offers retry and a working exploration fallback',async()=>{
  const p=await context.newPage();await p.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('test unavailable worker');}};});await p.goto(base+'#experience=analysis&from=2022');await p.getByRole('alert').waitFor();await p.getByRole('button',{name:'분석 다시 시도',exact:true}).click();await p.getByRole('alert').waitFor();await p.getByRole('button',{name:'탐색으로 돌아가기',exact:true}).click();await p.locator('.network-canvas canvas').first().waitFor();await p.close();
 });
 await check('comparison shows a common period and explicit outside-period status',async()=>{
  await profile(full.nodes.find(n=>n.degree>5).id);await page.getByRole('button',{name:'구조 비교에 추가',exact:true}).click();await page.getByRole('button',{name:'구조 비교하기 (1/3)',exact:true}).click();await page.locator('dialog').waitFor();assert.equal(await page.locator('dialog .sna-metrics').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);await page.getByLabel('분석 끝 연도',{exact:true}).selectOption('1997');await page.getByLabel('분석 시작 연도',{exact:true}).selectOption('1997');await ready(page,1997,1997);await page.getByRole('button',{name:'구조 비교하기 (1/3)',exact:true}).click();await page.locator('dialog').getByText('선택 기간 분석에 포함되지 않습니다.',{exact:true}).waitFor();assert.equal(await page.locator('dialog .sna-metrics').count(),0);await page.keyboard.press('Escape');
 });
 await check('mobile analysis has no document overflow and supports keyboard selection',async()=>{
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(String(e)));await p.setViewportSize({width:390,height:844});await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'#experience=analysis');await ready(p);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.getByRole('button',{name:'표 보기',exact:true}).click();const b=p.locator('.sna-table tbody button').first();await b.focus();await p.keyboard.press('Enter');await p.locator('.sna-metrics').waitFor();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await snap(p,'mobile');await p.close();
 });
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);console.error(e);process.exitCode=1;await snap(page,'failure').catch(()=>{});}
finally{fs.writeFileSync(process.env.ATLAS_QA_REPORT||new URL('docs/browser-sna-qa.json',root),JSON.stringify(report,null,2)+'\n');await browser.close();}
