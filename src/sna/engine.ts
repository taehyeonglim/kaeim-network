import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import betweenness from 'graphology-metrics/centrality/betweenness';
import modularity from 'graphology-metrics/graph/modularity';
import seedrandom from 'seedrandom';
import {METHOD_VERSION} from './types';
import type {AnalysisInput,AnalysisResult,AnalysisEdge,Group,Weighting} from './types';

export function graphFor(edges:AnalysisEdge[],ids:string[]){
 const g=new Graph({type:'undirected',multi:false,allowSelfLoops:false});
 for(const id of [...ids].sort())g.addNode(id);
 for(const e of edges)g.addEdge(e.source,e.target,{weight:e.weight,distance:e.distance});
 return g;
}
export function components(g:Graph,allowed?:Set<string>):string[][]{
 const remaining=new Set(allowed||g.nodes());const groups:string[][]=[];
 for(const start of [...remaining].sort()){
  if(!remaining.has(start))continue;
  const stack=[start],members:string[]=[];remaining.delete(start);
  while(stack.length){const id=stack.pop()!;members.push(id);for(const n of g.neighbors(id))if(remaining.delete(n))stack.push(n);}
  groups.push(members.sort());
 }
 return groups.sort((a,b)=>b.length-a.length||a[0].localeCompare(b[0]));
}
export function partitionSignature(groups:string[][]){
 let h=2166136261;
 for(const c of groups.map(x=>[...x].sort().join(',')).sort().join('|'))h=Math.imul(h^c.charCodeAt(0),16777619);
 return (h>>>0).toString(16);
}
export function analyze(input:AnalysisInput,from:number,to:number,weighting:Weighting):AnalysisResult{
 const papers=input.articles.filter(p=>p.year>=from&&p.year<=to).sort((a,b)=>a.id.localeCompare(b.id));
 const own=new Map<string,Set<string>>(),topicCounts=new Map<string,Map<string,number>>(),edgeMap=new Map<string,AnalysisEdge>();
 for(const p of papers){
  const ids=[...new Set(p.authors)].sort();
  for(const id of ids){if(!own.has(id)){own.set(id,new Set());topicCounts.set(id,new Map());}own.get(id)!.add(p.id);for(const t of p.topics)topicCounts.get(id)!.set(t,(topicCounts.get(id)!.get(t)||0)+1);}
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const key=ids[i]+'|'+ids[j];let e=edgeMap.get(key);
   if(!e){e={source:ids[i],target:ids[j],articles:[],paperCount:0,fractionalWeight:0,weight:0,distance:0};edgeMap.set(key,e);}
   e.articles.push(p.id);e.paperCount++;e.fractionalWeight+=1/(ids.length-1);
  }
 }
 const ids=[...own.keys()].sort();const edges=[...edgeMap.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.target.localeCompare(b.target));
 for(const e of edges){e.weight=weighting==='papers'?e.paperCount:e.fractionalWeight;e.distance=1/e.weight;}
 const g=graphFor(edges,ids);const parts=components(g);const componentMap=new Map(parts.flatMap((p,i)=>p.map(id=>[id,'component-'+(i+1)] as const)));
 const centrality=g.order<3?Object.fromEntries(ids.map(id=>[id,0])):betweenness(g,{getEdgeWeight:'distance',normalized:true});
 const runs:AnalysisResult['diagnostics']['seedRuns']=[];let best:string[][]=[],bestQ=-Infinity,selectedSeed:number|null=null;
 if(g.size){
  for(let seed=0;seed<10;seed++){
   const partition=louvain(g,{getEdgeWeight:'weight',resolution:1,rng:seedrandom(METHOD_VERSION+':'+seed)});
   const raw=new Map<number,string[]>();
   for(const id of ids){if(!g.degree(id))continue;const c=partition[id];if(!raw.has(c))raw.set(c,[]);raw.get(c)!.push(id);}
   const split=[...raw.values()].flatMap(group=>components(g,new Set(group))).sort((a,b)=>b.length-a.length||a[0].localeCompare(b[0]));
   for(const id of ids)g.setNodeAttribute(id,'community','isolate-'+id);
   split.forEach((group,i)=>group.forEach(id=>g.setNodeAttribute(id,'community',i)));
   const q=modularity(g,{getEdgeWeight:'weight',getNodeCommunity:'community',resolution:1});
   runs.push({seed,modularity:q,partition:partitionSignature(split)});
   if(q>bestQ+1e-12){bestQ=q;best=split;selectedSeed=seed;}
  }
 }
 const communityMap=new Map(best.flatMap((p,i)=>p.map(id=>[id,'community-'+(i+1)] as const)));
 const makeGroup=(members:string[],id:string):Group=>{
  const articleIds=new Set(members.flatMap(id=>[...own.get(id)!]));const counts=new Map<string,number>();
  for(const p of papers)if(articleIds.has(p.id))for(const t of p.topics)counts.set(t,(counts.get(t)||0)+1);
  return {id,members,articles:[...articleIds].sort(),topics:[...counts].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id))};
 };
 const nodes=ids.map(id=>({id,papers:own.get(id)!.size,articleIds:[...own.get(id)!].sort(),degree:g.degree(id),degreeCentrality:ids.length>1?g.degree(id)/(ids.length-1):0,strength:g.edges(id).reduce((sum,e)=>sum+g.getEdgeAttribute(e,'weight'),0),betweenness:centrality[id]||0,component:componentMap.get(id)!,community:communityMap.get(id)||null,crossCommunityPartners:g.neighbors(id).filter(n=>communityMap.get(n)!==communityMap.get(id)).length,topic:[...topicCounts.get(id)!].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||null}));
 return {dataVersion:input.meta.version,methodVersion:METHOD_VERSION,from,to,weighting,nodes,edges,components:parts.map((p,i)=>makeGroup(p,'component-'+(i+1))),communities:best.map((p,i)=>makeGroup(p,'community-'+(i+1))),summary:{papers:papers.length,nodes:g.order,edges:g.size,density:g.order<2?0:2*g.size/(g.order*(g.order-1)),components:parts.length,largestComponent:parts[0]?.length||0,largestComponentShare:g.order?(parts[0]?.length||0)/g.order:0,isolates:nodes.filter(n=>!n.degree).length,communities:best.length,modularity:g.size?bestQ:null},diagnostics:{resolution:1,seedRuns:runs,selectedSeed}};
}
