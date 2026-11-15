import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSpaceGraph,endpoint} from './graph3d';
import type {Layout3D} from './graph3d';
import type {Atlas} from './types';
import {connections,filterPapers,indexAtlas,readState} from './model';
const a=JSON.parse(fs.readFileSync(new URL('../public/data/atlas.json',import.meta.url),'utf8')) as Atlas;
const layout=JSON.parse(fs.readFileSync(new URL('../public/data/layout-3d.json',import.meta.url),'utf8')) as Layout3D;
test('3D layout covers all source nodes and has genuine depth',()=>{
 assert.equal(layout.version,a.meta.version);
 for(const [ids,positions] of [[a.researchers.map(r=>r.id),layout.authors],[a.articles.map(p=>p.id),layout.citations]] as const){
  assert.deepEqual(Object.keys(positions).sort(),[...ids].sort());
  for(const xyz of Object.values(positions))assert.ok(xyz.length===3&&xyz.every(Number.isFinite));
  assert.ok(Math.max(...Object.values(positions).map(p=>p[2]))-Math.min(...Object.values(positions).map(p=>p[2]))>100);
 }
});
test('3D coauthor graph preserves research identities, edges and weights',()=>{
 const before=JSON.stringify(a);const g=buildSpaceGraph(a,a.articles,'coauthor',layout);
 assert.equal(g.nodes.length,1679);assert.equal(g.links.length,2639);
 assert.deepEqual(g.links.map(e=>[endpoint(e.source),endpoint(e.target),e.weight]),a.coauthors.map(e=>[e.source,e.target,e.articles.length]));
 assert.equal(JSON.stringify(a),before);
});
test('filtered constellations preserve every topic membership and do not create coauthor claims',()=>{
 const papers=filterPapers(a,{from:2022,to:2026,q:'',topic:'ai',policy:''},indexAtlas(a));
 const g=buildSpaceGraph(a,papers,'topics',layout);const c=connections(a,papers);
 assert.equal(g.nodes.filter(n=>n.kind==='researcher').length,c.researchers.size);
 assert.equal(g.nodes.filter(n=>n.kind==='topic').length,10);
 const byId=new Map(g.nodes.map(n=>[n.id,n]));
 for(const e of g.links){assert.equal(byId.get(endpoint(e.source))!.kind,'researcher');assert.equal(byId.get(endpoint(e.target))!.kind,'topic');assert.equal(e.weight,papers.filter(p=>p.authors.includes(endpoint(e.source))&&p.topics.includes(endpoint(e.target))).length);}
});
test('3D citations retain direction and out-of-window context',()=>{
 const papers=a.articles.filter(p=>p.year===2021);const c=connections(a,papers);const g=buildSpaceGraph(a,papers,'citations',layout);
 assert.deepEqual(g.links.map(e=>[endpoint(e.source),endpoint(e.target)]),c.citations.map(e=>[e.source,e.target]));
 assert.ok(g.contextCount>0);assert.equal(g.contextCount,g.nodes.filter(n=>n.context).length);
});
test('empty results and stale positions fail safely',()=>{
 for(const mode of ['coauthor','topics','citations'] as const)assert.deepEqual(buildSpaceGraph(a,[],mode,layout),{nodes:[],links:[],contextCount:0});
 assert.throws(()=>buildSpaceGraph(a,a.articles,'coauthor',{...layout,version:'stale'}));
});
test('sharing restores dimension and preserves legacy 2D URLs',()=>{
 assert.equal(readState(a,'#view=topics&dim=3d&topic=ai').dimension,'3d');
 assert.equal(readState(a,'#view=coauthor').dimension,'2d');
 assert.equal(readState(a,'#dim=invalid').dimension,'2d');
 const state=readState(a,'#dim=3d&type=researcher&id='+a.researchers[0].id);assert.equal(state.selection?.id,a.researchers[0].id);
});
