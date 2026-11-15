import type {Atlas,Filters,Paper,Researcher} from './types';
export const normalize=(s:string)=>s.toLocaleLowerCase().replace(/[\s·–-]+/g,'');
export const number=(n:number)=>n.toLocaleString('ko-KR');
export function indexAtlas(a:Atlas){
 const researchers=new Map(a.researchers.map(r=>[r.id,r]));
 const papers=new Map(a.articles.map(p=>[p.id,p]));
 const labels=new Map([...a.taxonomy.topics,...a.taxonomy.policies].map(t=>[t.id,t.label]));
 const search=new Map(a.articles.map(p=>[p.id,normalize([p.title,...p.keywords,...p.topics.map(t=>labels.get(t)),...p.policies.map(t=>labels.get(t)),...p.authors.flatMap(id=>{const r=researchers.get(id)!;return[r.name,...(r.nameAliases||[]),...r.institutions,...r.englishNames,...(r.currentAffiliations||[]).map(c=>c.institution)]})].join(' '))]));
 return {researchers,papers,search};
}
export function filterPapers(a:Atlas,f:Filters,index:ReturnType<typeof indexAtlas>){
 const words=f.q.toLowerCase().trim().split(/\s+/).filter(Boolean).map(normalize);
 return a.articles.filter(p=>p.year>=f.from&&p.year<=f.to&&(!f.topic||p.topics.includes(f.topic))&&(!f.policy||p.policies.includes(f.policy))&&words.every(w=>index.search.get(p.id)!.includes(w)));
}
export function connections(a:Atlas,papers:Paper[]){
 const ids=new Set(papers.map(p=>p.id));
 const researchers=new Set(papers.flatMap(p=>p.authors));
 const coauthors=a.coauthors.map(e=>({...e,articles:e.articles.filter(id=>ids.has(id))})).filter(e=>e.articles.length>0);
 const citations=a.citations.filter(e=>ids.has(e.source));
 return {ids,researchers,coauthors,citations};
}
export function researcherStats(r:Researcher,papers:Paper[],a:Atlas){
 const own=papers.filter(p=>p.authors.includes(r.id));
 const ownIds=new Set(own.map(p=>p.id));
 const coauthors=new Set(own.flatMap(p=>p.authors).filter(id=>id!==r.id));
 const known=own.filter(p=>p.kciCitations!==null);
 const topics=new Map<string,number>();for(const p of own)for(const t of p.topics)topics.set(t,(topics.get(t)||0)+1);
 // Each distinct paper-to-paper link is counted once; multiple matching authors cannot inflate it.
 const incoming=a.citations.filter(e=>ownIds.has(e.target));
 const outgoing=a.citations.filter(e=>ownIds.has(e.source));
 return {papers:own,coauthors,topics,kci:known.reduce((s,p)=>s+p.kciCitations!,0),kciKnown:known.length,incoming,outgoing,latest:Math.max(0,...own.map(p=>p.year))};
}
export function readState(a:Atlas,hash=window.location.hash){
 const p=new URLSearchParams(hash.slice(1));
 const clamp=(n:number)=>Math.min(a.meta.maxYear,Math.max(a.meta.minYear,n));
 const getYear=(key:string,def:number)=>p.has(key)&&Number.isFinite(Number(p.get(key)))?clamp(Number(p.get(key))):def;
 const from=getYear('from',a.meta.minYear),to=getYear('to',a.meta.maxYear);
 const topic=a.taxonomy.topics.some(t=>t.id===p.get('topic'))?p.get('topic')!:'';
 const policy=a.taxonomy.policies.some(t=>t.id===p.get('policy'))?p.get('policy')!:'';
 const mode=(['coauthor','topics','citations'].includes(p.get('view')||'')?p.get('view'):'coauthor') as 'coauthor'|'topics'|'citations';
 const type=p.get('type');const requestedId=p.get('id');const id=type==='researcher'&&requestedId?(a.researcherRedirects?.[requestedId]||requestedId):requestedId;
 const selection=id&&((type==='researcher'&&a.researchers.some(r=>r.id===id))||(type==='paper'&&a.articles.some(r=>r.id===id)))?{id,type:type as 'researcher'|'paper'}:null;
 const dimension:'2d'|'3d'=p.get('dim')==='3d'?'3d':'2d';
 return {dimension,filters:{from:Math.min(from,to),to:Math.max(from,to),topic,policy,q:p.get('q')||''},mode,selection};
}

export const identityLabel=(r:Researcher)=>r.identityStatus==='reviewed'?'사용자 확인 연구자 묶음':r.identityStatus==='pending'?'동일인 판단 보류':'이름·소속 기준 임시 묶음';
