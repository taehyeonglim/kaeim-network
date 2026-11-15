import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const atlas=JSON.parse(fs.readFileSync(new URL('public/data/atlas.json',root),'utf8'));
const review=JSON.parse(fs.readFileSync(new URL('config/identity-review.json',root),'utf8'));
const base=process.env.ATLAS_TEST_URL||'http://127.0.0.1:5173/';
const output=new URL('../tmp/atlas-qa/identity/',root);fs.mkdirSync(output,{recursive:true});
const report={base,version:atlas.meta.version,checkedAt:new Date().toISOString(),scenarios:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
page.on('pageerror',e=>report.errors.push(String(e)));
const decision=name=>review.decisions.find(d=>d.name===name);
async function profile(id){await page.goto(base+'#type=researcher&id='+id);await page.locator('.profile-heading h2').waitFor();}
async function check(name,fn){await fn();report.scenarios.push({name,status:'passed'});console.log('PASS',name);}
try{
 await check('deployed snapshot matches the reviewed version',async()=>{
  const result=await page.request.get(base+'data/atlas.json');assert.ok(result.ok());const data=await result.json();assert.equal(data.meta.version,atlas.meta.version);
 });
 await check('old profile URL opens merged papers and rewrites canonical ID',async()=>{
  const d=decision('임태형');await profile(d.existingGroupIds[1]);assert.equal(await page.locator('.profile-heading h2').textContent(),'임태형');assert.equal(await page.locator('.profile-metrics strong').first().textContent(),'8');await page.getByText('사용자 확인 연구자 묶음',{exact:true}).waitFor();assert.ok(page.url().includes(d.existingGroupIds[0]));
 });
 await check('confirmed namesakes show explicit separation and distinct current affiliations',async()=>{
  await profile(decision('신소영').existingGroupIds[0]);await page.locator('.current-affiliation').getByText('연세대학교 강사',{exact:true}).waitFor();await page.locator('.current-affiliation').getByText('서강대학교 대우교수',{exact:true}).waitFor();await page.getByText('같은 이름의 다른 묶음',{exact:true}).click();await page.getByText('다른 사람으로 확인',{exact:true}).waitFor();await page.screenshot({path:new URL('confirmed.png',output).pathname,fullPage:true});
 });
 await check('deferred identity stays pending and is not labelled a confirmed different person',async()=>{
  await profile(decision('이정민').deferredGroupIds[0]);await page.locator('.identity-note').getByText(/동일인 판단 보류/).waitFor();await page.getByText('같은 이름의 다른 묶음',{exact:true}).click();assert.ok(await page.getByText('동일인 여부 미확인',{exact:true}).count()>0);assert.equal(await page.getByText('다른 사람으로 확인',{exact:true}).count(),0);
 });
 await check('partial merge preserves unknown groups',async()=>{
  await profile(decision('김민정').existingGroupIds[0]);await page.locator('.current-affiliation').getByText('단국대학교 교수',{exact:true}).waitFor();await page.getByText('같은 이름의 다른 묶음',{exact:true}).click();assert.equal(await page.getByText('동일인 여부 미확인',{exact:true}).count(),2);
 });
 await check('corrected affiliation appears in profile and source spelling remains inspectable',async()=>{
  await profile(decision('정옥년').existingGroupIds[0]);assert.equal(await page.locator('.profile-heading>p').textContent(),'가톨릭대학교');await page.goto(base+'#type=paper&id=KISS:1994272');await page.locator('.source-link').waitFor();await page.getByText('사용자 확인 표기 교정',{exact:true}).click();await page.getByText('정옥년: 카톨릭대 → 가톨릭대학교',{exact:true}).waitFor();
 });
 await check('corrected name is searchable by old spelling',async()=>{
  await page.goto(base+'#q=임병로');await page.getByRole('button',{name:'목록 보기',exact:true}).click();await page.locator('.researcher-row').filter({has:page.getByText('임병노',{exact:true})}).waitFor();assert.equal(await page.locator('.researcher-row').filter({has:page.getByText('임병로',{exact:true})}).count(),0);
 });
 await check('mobile reviewed profile fits without horizontal scrolling',async()=>{
  await page.setViewportSize({width:390,height:844});await profile(decision('신소영').existingGroupIds[0]);await page.locator('.current-affiliation').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:new URL('mobile.png',output).pathname,fullPage:true});
 });
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);console.error(e);process.exitCode=1;}
finally{fs.writeFileSync(process.env.ATLAS_QA_REPORT||new URL('docs/browser-identity-qa.json',root),JSON.stringify(report,null,2)+'\n');await browser.close();}
