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

test('all human identity decisions, pending groups and old links survive publication',()=>{
 const review=JSON.parse(fs.readFileSync(new URL('../config/identity-review.json',import.meta.url),'utf8'));
 const resolve=id=>atlas.researcherRedirects[id]||id;
 const owner=new Map(atlas.researchers.flatMap(r=>r.occurrences.map(o=>[o,r.id])));
 const authorized=new Set();
 for(const d of review.decisions){
  assert.equal(d.applied,true,d.name);
  for(const part of d.mergeGroups||[d]){
   const ids=part.existingGroupIds;if(!ids.length)continue;
   const target=resolve(ids[0]);
   assert.equal(researchers.get(target).identityStatus,'reviewed');
   for(const id of ids){assert.equal(resolve(id),target,d.name);if(id!==target)authorized.add(id);}
   assert.deepEqual(new Set(researchers.get(target).occurrences),new Set(part.occurrenceIds),d.name);
   for(const oid of part.occurrenceIds)assert.equal(owner.get(oid),target,d.name);
  }
  for(const id of d.deferredGroupIds||[]){assert.equal(resolve(id),id,d.name);assert.equal(researchers.get(id).identityStatus,'pending');}
  for(const pair of d.cannotLink||[]){const l=resolve(pair.left),r=resolve(pair.right);assert.notEqual(l,r,d.name);assert.ok(researchers.get(l).distinctFromIds.includes(r));assert.ok(researchers.get(r).distinctFromIds.includes(l));}
  if(d.decision==='correct_name_and_link')for(const id of d.sourceGroupIds)assert.equal(researchers.get(resolve(id)).name,d.canonicalName);
 }
 assert.deepEqual(new Set(Object.keys(atlas.researcherRedirects)),authorized);
 for(const [old,id] of Object.entries(atlas.researcherRedirects)){assert.ok(!researchers.has(old));assert.ok(researchers.has(id));assert.ok(!atlas.researcherRedirects[id]);}
 assert.equal(atlas.meta.researcherGroups,1324);
 assert.equal(atlas.researchers.filter(r=>r.identityStatus==='pending').length,81);
});

test('name and affiliation corrections are scoped and retain their original spelling',()=>{
 const corrected=atlas.researchers.find(r=>r.name==='임병노');
 assert.ok(corrected.nameAliases.includes('임병로'));assert.equal(corrected.occurrences.length,10);
 assert.equal(atlas.researchers.filter(r=>r.name==='임병로').length,0);
 for(const [name,from,to] of [['강명희','이화여자대학고','이화여자대학교'],['임현진','이회여자대학교','이화여자대학교'],['정옥년','카톨릭대','가톨릭대학교']]){
  const r=atlas.researchers.find(r=>r.name===name);assert.ok(r.institutions.includes(to));assert.ok(!r.institutions.includes(from));
  const rows=r.articles.flatMap(id=>JSON.parse(fs.readFileSync(new URL(`articles/${id.replace(':','_')}.json`,root),'utf8')).authorsDetail).filter(a=>a.id===r.id&&a.originalInstitution===from);
  assert.ok(rows.length);assert.ok(rows.every(a=>a.institution===to));
 }
 const shin=atlas.researchers.filter(r=>r.name==='신소영');assert.equal(shin.length,2);
 assert.deepEqual(shin.map(r=>r.currentAffiliations.length).sort(),[1,2]);
 for(const r of shin)assert.ok(r.currentAffiliations.every(c=>c.source==='user_confirmation'));
});
