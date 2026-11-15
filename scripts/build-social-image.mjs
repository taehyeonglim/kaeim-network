import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

// A deterministic branded card using the published coauthor graph, not invented connections.
// Run locally with installed Chrome: npm run social:image
const root=new URL('../',import.meta.url);
const atlas=JSON.parse(await fs.readFile(new URL('public/data/atlas.json',root),'utf8'));
const layout=JSON.parse(await fs.readFile(new URL('public/data/layout-3d.json',root),'utf8'));
if(layout.version!==atlas.meta.version)throw new Error('Atlas and 3D layout versions differ');
const logo=(await fs.readFile(new URL('public/brand/kaeim-logo.png',root))).toString('base64');
const topics=new Map(atlas.taxonomy.topics.map(t=>[t.id,t.color]));
const counts=new Map(),memberships=new Map();
for(const p of atlas.articles)for(const id of p.authors){
 counts.set(id,(counts.get(id)||0)+1);
 const m=memberships.get(id)||new Map();for(const t of p.topics)m.set(t,(m.get(t)||0)+1);memberships.set(id,m);
}
const brighten=color=>'#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*.7+255*.3).toString(16).padStart(2,'0')).join('');
const projected=atlas.researchers.map(r=>{
 const [x,y,z]=layout.authors[r.id];const yaw=.37,pitch=-.23;
 const xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
 const yy=y*Math.cos(pitch)-zz*Math.sin(pitch),depth=y*Math.sin(pitch)+zz*Math.cos(pitch);
 const perspective=650/(650-depth);
 const topic=[...(memberships.get(r.id)||[])].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
 return {id:r.id,x:xx*perspective,y:yy*perspective,z:depth,color:brighten(topics.get(topic)||'#8393a4'),papers:counts.get(r.id)||1};
});
const extent=Math.max(...projected.map(p=>Math.hypot(p.x,p.y))),scale=315/extent;
const nodes=projected.map(p=>({...p,x:896+p.x*scale,y:314-p.y*scale,r:1.3+Math.sqrt(p.papers)*.52}));
const byId=new Map(nodes.map(p=>[p.id,p]));
const edges=atlas.coauthors.map(e=>{const a=byId.get(e.source),b=byId.get(e.target);return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#6cb9e9" stroke-opacity="${Math.min(.45,.10+Math.sqrt(e.articles.length)*.045)}" stroke-width="${.5+Math.sqrt(e.articles.length)*.18}"/>`;}).join('');
const dots=nodes.sort((a,b)=>a.z-b.z).map(n=>`<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${n.color}" opacity="${Math.max(.5,Math.min(.98,.75+n.z/700))}"/>`).join('');
const graph=`<svg viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="halo"><stop stop-color="#123b63" stop-opacity=".72"/><stop offset="1" stop-color="#07111f" stop-opacity="0"/></radialGradient><linearGradient id="fade"><stop offset="0" stop-color="#07111f"/><stop offset=".40" stop-color="#07111f"/><stop offset=".62" stop-color="#07111f" stop-opacity="0"/></linearGradient></defs><ellipse cx="899" cy="321" rx="440" ry="390" fill="url(#halo)"/>${edges}${dots}<rect width="1200" height="630" fill="url(#fade)"/></svg>`;
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}body{background:#07111f;color:#eef4fc;font-family:'Noto Sans KR','Apple SD Gothic Neo',system-ui,sans-serif}.graph{position:absolute;inset:0}.graph svg{display:block;width:1200px;height:630px}.logo{position:absolute;left:64px;top:48px;width:190px;height:auto;background:#fff;padding:6px;border-radius:3px}.eyebrow{position:absolute;top:146px;left:64px;font-size:13px;font-weight:600;letter-spacing:3.4px;color:#75d9f5}h1{position:absolute;top:181px;left:60px;margin:0;font-size:82px;letter-spacing:-4px;line-height:1.12;font-weight:700}h1 span{color:#a9cef4}.description{position:absolute;top:403px;left:64px;margin:0;font-size:23px;line-height:1.65;font-weight:400;letter-spacing:-.6px;color:#b4c9df}.footer{position:absolute;left:64px;right:64px;bottom:39px;border-top:1px solid #30455d;padding-top:18px;display:flex;justify-content:space-between;align-items:center;font-size:13px;letter-spacing:.2px;color:#a6b8ce}.footer strong{color:#e3edfa;font-weight:500}.footer i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#75d9f5;margin-right:10px;vertical-align:2px}.footer small{font-size:10px;letter-spacing:2px;color:#82a4c8}
</style><body><div class="graph">${graph}</div><img class="logo" src="data:image/png;base64,${logo}" alt="한국교육정보미디어학회"><div class="eyebrow">KAEIM RESEARCH ATLAS</div><h1>학회<br><span>연구지도</span></h1><p class="description">사람과 연구, 그 사이의 연결.<br>교육정보미디어연구 네트워크를 탐색하세요.</p><div class="footer"><strong><i></i>한국교육정보미디어학회</strong><small>RESEARCH CONNECTS US</small></div></body></html>`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
 await page.locator('.logo').evaluate(img=>img.decode());
 await fs.mkdir(new URL('public/social/',root),{recursive:true});
 const path=new URL('public/social/kaeim-research-atlas-v1.png',root).pathname;
 await page.screenshot({path,type:'png'});
 console.log(JSON.stringify({path,width:1200,height:630,dataVersion:atlas.meta.version,nodes:nodes.length,edges:atlas.coauthors.length}));
}finally{await browser.close();}
