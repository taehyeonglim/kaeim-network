import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../public/data/',import.meta.url);
const atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',root),'utf8'));
const papers=new Map(atlas.articles.map(p=>[p.id,p]));
const researchers=new Map(atlas.researchers.map(r=>[r.id,r]));

test('public dataset conserves article and author records',()=>{
 assert.equal(papers.size,atlas.meta.articleCount);
 assert.equal(papers.size,atlas.articles.length);
 const occurrences=atlas.researchers.flatMap(r=>r.occurrences);
 assert.equal(occurrences.length,atlas.meta.authorOccurrences);
 assert.equal(new Set(occurrences).size,occurrences.length);
 for(const p of papers.values())for(const id of p.authors){assert.ok(researchers.has(id));assert.ok(researchers.get(id).articles.includes(p.id));}
});

test('every published paper has matching detail and traceable tag evidence',()=>{
 const files=fs.readdirSync(new URL('articles/',root)).filter(f=>f.endsWith('.json'));
 assert.equal(files.length,papers.size);
 for(const p of papers.values()){
  const detail=JSON.parse(fs.readFileSync(new URL(`articles/${p.id.replace(':','_')}.json`,root),'utf8'));
  for(const [key,value] of Object.entries(p))assert.deepEqual(detail[key],value);
  const fields={title:[detail.title],keyword:detail.keywords,abstract:detail.abstracts.map(a=>a.value)};
  for(const tag of detail.tags){assert.ok(tag.evidence.length);for(const e of tag.evidence){assert.ok(fields[e.field].some(s=>s.includes(e.quote)));assert.ok(e.quote.includes(e.term));}}
 }
});

test('coauthor edge weights match distinct shared articles',()=>{
 const expected=new Map();
 for(const p of papers.values()){
  const ids=[...new Set(p.authors)].sort();
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const key=ids[i]+'|'+ids[j];if(!expected.has(key))expected.set(key,[]);expected.get(key).push(p.id);
  }
 }
 assert.equal(expected.size,atlas.coauthors.length);
 for(const e of atlas.coauthors)assert.deepEqual([...e.articles].sort(),expected.get(e.source+'|'+e.target).sort());
});

test('citation graph joins existing papers without duplicate directed links',()=>{
 const keys=new Set();const incoming=new Map();
 for(const e of atlas.citations){assert.ok(papers.has(e.source)&&papers.has(e.target));assert.ok(e.referenceIds.length);assert.ok(e.methods.length);keys.add(e.source+'|'+e.target);incoming.set(e.target,(incoming.get(e.target)||0)+1);}
 assert.equal(keys.size,atlas.citations.length);assert.equal(keys.size,atlas.meta.internalEdges);
 for(const p of papers.values())assert.equal(p.internalCitations,incoming.get(p.id)||0);
});
