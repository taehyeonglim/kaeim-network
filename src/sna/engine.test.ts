import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Graph from 'graphology';
import gexf from 'graphology-gexf';
import {analyze,components,graphFor} from './engine';
import {calculateLayout} from './layout';
import {exportAnalysis,csvCell} from './export';
import {analysisVisual,communityColor} from './visual';
import {readAnalysisOptions,METHOD_VERSION} from './types';
import type {AnalysisInput,AnalysisResult,Baseline} from './types';
import type {Atlas,Paper} from '../types';
const atlas=JSON.parse(fs.readFileSync(new URL('../../public/data/atlas.json',import.meta.url),'utf8')) as Atlas;
function input(authors:string[][]):AnalysisInput{return {meta:{...atlas.meta,version:'fixture'},researchers:[...new Set(authors.flat())].map(id=>({id,name:id,institutions:[],englishNames:[],articles:[],occurrences:[],identityStatus:'provisional',sameNameIds:[]})),articles:authors.map((authors,i)=>({id:'p'+i,authors,year:2020,topics:[],policies:[],title:'p'+i,keywords:[],month:1,kciCitations:null,internalCitations:0,referenceCount:null,source:'fixture'}))};}
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
// Independent exhaustive shortest-path enumeration, intentionally used only on tiny fixtures.
function independentBetweenness(r:AnalysisResult){
 const ids=r.nodes.map(n=>n.id),scores=Object.fromEntries(ids.map(id=>[id,0]));
 const adjacent=new Map(ids.map(id=>[id,[] as {id:string;d:number}[]]));for(const e of r.edges){adjacent.get(e.source)!.push({id:e.target,d:e.distance});adjacent.get(e.target)!.push({id:e.source,d:e.distance});}
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  let best=Infinity,paths:string[][]=[];
  const walk=(path:string[],distance:number)=>{const last=path.at(-1)!;if(distance>best+1e-9)return;if(last===ids[j]){if(distance<best-1e-9){best=distance;paths=[];}paths.push(path);return;}for(const e of adjacent.get(last)!)if(!path.includes(e.id))walk([...path,e.id],distance+e.d);};walk([ids[i]],0);
  if(paths.length)for(const path of paths)for(const id of path.slice(1,-1))scores[id]+=1/paths.length;
 }
 const scale=ids.length>2?2/((ids.length-1)*(ids.length-2)):0;return Object.fromEntries(ids.map(id=>[id,scores[id]*scale]));
}
test('path, star, triangle, disconnected nodes and small periods have independent exact centralities',()=>{
 for(const authors of [[['A','B'],['B','C']],[['A','B'],['A','C'],['A','D']],[['A','B','C']],[['A','B'],['B','C'],['D']],[['A']],[['A','B']],[]]){
  const r=analyze(input(authors),2020,2020,'papers');const expected=independentBetweenness(r);
  for(const n of r.nodes)close(n.betweenness,expected[n.id]);
  assert.equal(r.summary.components,components(graphFor(r.edges,r.nodes.map(n=>n.id))).length);
 }
 const r=analyze(input([['A','B'],['B','C'],['D']]),2020,2020,'papers');assert.equal(r.summary.isolates,1);close(r.nodes.find(n=>n.id==='B')!.betweenness,1/3);assert.equal(r.nodes.find(n=>n.id==='D')!.community,null);
});
test('both weighting rules conserve papers and use inverse tie strength for shortest paths',()=>{
 const a=input([['A','B','C'],['A','B'],['A','B'],['B','D'],['D','C'],['E'],['A','A','B']]);
 for(const weighting of ['papers','fractional'] as const){
  const r=analyze(a,2020,2020,weighting),expected=independentBetweenness(r);for(const n of r.nodes)close(n.betweenness,expected[n.id]);
  const ab=r.edges.find(e=>e.source==='A'&&e.target==='B')!;assert.equal(ab.paperCount,4);close(ab.fractionalWeight,3.5);close(ab.distance,1/(weighting==='papers'?4:3.5));assert.equal(r.nodes.find(n=>n.id==='A')!.papers,4);
 }
});
test('weighted exhaustive check on varied six-node paper networks',()=>{
 for(let fixture=1;fixture<10;fixture++){
  const papers:string[][]=[];for(let i=0;i<6;i++){papers.push(['n'+i]);for(let j=i+1;j<6;j++)if((i*7+j*3+fixture)%4)for(let k=0;k<1+(i+j+fixture)%3;k++)papers.push(['n'+i,'n'+j]);}
  const r=analyze(input(papers),2020,2020,'papers'),expected=independentBetweenness(r);for(const n of r.nodes)close(n.betweenness,expected[n.id]);
 }
});
test('analysis is deterministic and communities are connected partitions with maximal recorded modularity',()=>{
 const a=input([['A','B','C'],['C','D'],['D','E','F'],['G']]);const r=analyze(a,2020,2020,'fractional');assert.deepEqual(analyze(a,2020,2020,'fractional'),r);
 const g=graphFor(r.edges,r.nodes.map(n=>n.id));for(const c of r.communities)assert.equal(components(g,new Set(c.members)).length,1);
 assert.deepEqual(new Set(r.communities.flatMap(c=>c.members)),new Set(r.nodes.filter(n=>n.degree).map(n=>n.id)));
 assert.equal(new Set(r.communities.flatMap(c=>c.members)).size,r.communities.flatMap(c=>c.members).length);
 close(r.summary.modularity!,Math.max(...r.diagnostics.seedRuns.map(s=>s.modularity)));
 const empty=analyze(a,2021,2021,'papers');assert.equal(empty.summary.nodes,0);assert.equal(empty.summary.modularity,null);
});
test('public baselines match the current source version and all author/collaboration records',()=>{
 for(const weighting of ['papers','fractional'] as const){
  const b=JSON.parse(fs.readFileSync(new URL(`../../public/data/sna-${weighting}.json`,import.meta.url),'utf8')) as Baseline;
  assert.equal(b.dataVersion,atlas.meta.version);assert.equal(b.methodVersion,METHOD_VERSION);assert.equal(b.result.summary.nodes,1324);assert.equal(b.result.summary.edges,2456);
  const baseline=analyze(atlas,atlas.meta.minYear,atlas.meta.maxYear,weighting);assert.deepEqual(b.result,baseline);
  const original=new Map(atlas.coauthors.map(e=>[e.source+'|'+e.target,e.articles]));for(const e of baseline.edges)assert.deepEqual(e.articles,original.get(e.source+'|'+e.target));
  assert.deepEqual(new Set(b.result.nodes.map(n=>n.id)),new Set(atlas.researchers.map(n=>n.id)));
  for(const n of b.result.nodes){assert.ok(b.layout.positions2d[n.id].every(Number.isFinite));assert.ok(b.layout.positions3d[n.id].every(Number.isFinite));}
 }
});
test('same metrics and topology power visuals; highlights and size changes never change coordinates',()=>{
 const b=JSON.parse(fs.readFileSync(new URL('../../public/data/sna-papers.json',import.meta.url),'utf8')) as Baseline;const before=JSON.stringify(b);
 const o=readAnalysisOptions('');const v=analysisVisual(atlas,b.result,b.layout,o,null);const highlighted=analysisVisual(atlas,b.result,b.layout,{...o,size:'betweenness',color:'topic'},new Set());
 assert.deepEqual(v.links,highlighted.links);assert.deepEqual(v.nodes.map(n=>[n.id,n.x,n.y,n.z]),highlighted.nodes.map(n=>[n.id,n.x,n.y,n.z]));assert.ok(highlighted.nodes.every(n=>n.context));assert.equal(JSON.stringify(b),before);
});
test('CSV escaping and GEXF roundtrip preserve identities, weights and metadata',()=>{
 assert.equal(csvCell('=SUM(A1)'),`"'=SUM(A1)"`);assert.equal(csvCell(' \t@cmd'),`"' \t@cmd"`);assert.equal(csvCell('가,"나"\n다'),'"가,""나""\n다"');assert.equal(csvCell(-1),'"-1"');
 const r=analyze(atlas,2026,2026,'fractional');const text=exportAnalysis(atlas,r,'gexf');const g=gexf.parse(Graph,text);
 assert.equal(g.order,r.nodes.length);assert.equal(g.size,r.edges.length);for(const e of r.edges)close(g.getEdgeAttribute(g.edge(e.source,e.target),'weight'),e.weight);
 for(const n of r.nodes){assert.equal(g.getNodeAttribute(n.id,'identityStatus'),atlas.researchers.find(p=>p.id===n.id)!.identityStatus);close(g.getNodeAttribute(n.id,'betweenness'),n.betweenness);assert.deepEqual(JSON.parse(g.getNodeAttribute(n.id,'articleIds')),n.articleIds);}
 assert.ok(text.includes('1 / weight'));assert.ok(text.includes(atlas.meta.version));assert.ok(exportAnalysis(atlas,r,'nodes').startsWith('\uFEFF'));
});
test('layouts include isolated and empty graphs with stable finite coordinates',()=>{
 const r=analyze(input([['A','B'],['C']]),2020,2020,'papers');const a=calculateLayout(r,40,40);assert.deepEqual(calculateLayout(r,40,40),a);assert.equal(Object.keys(a.positions2d).length,3);assert.equal(Object.keys(a.positions3d).length,3);assert.deepEqual(calculateLayout(analyze(input([]),2020,2020,'papers'),10,10),{positions2d:{},positions3d:{}});
});

test('community colors use a color format supported by both renderers',()=>{for(let i=1;i<=200;i++)assert.match(communityColor('community-'+i),/^#[0-9a-f]{6}$/);});
test('empty exports have headers without invented researcher or edge rows',()=>{const r=analyze(atlas,1997,1997,'papers');for(const kind of ['nodes','edges'] as const){const text=exportAnalysis(atlas,r,kind);assert.equal(text.trim().split('\r\n').length,1);}const g=gexf.parse(Graph,exportAnalysis(atlas,r,'gexf'));assert.equal(g.order,0);assert.equal(g.size,0);});
