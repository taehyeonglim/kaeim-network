import type {Atlas,Mode,Paper} from './types';
import {connections} from './model';
export type Layout3D={version:string;authors:Record<string,[number,number,number]>;citations:Record<string,[number,number,number]>};
export type SpaceNode={id:string;name:string;kind:'researcher'|'paper'|'topic';color:string;val:number;context:boolean;x:number;y:number;z:number;fx:number;fy:number;fz:number};
export type SpaceLink={source:string|SpaceNode;target:string|SpaceNode;weight:number};
export const endpoint=(node:string|SpaceNode)=>typeof node==='string'?node:node.id;
function sphere(i:number,n:number,r:number):[number,number,number]{const y=1-2*(i+.5)/n;const a=i*2.399963229728653;const s=Math.sqrt(1-y*y);return [Math.cos(a)*s*r,y*r,Math.sin(a)*s*r];}
function scatter(id:string,r:number):[number,number,number]{const s=parseInt(id.replace(/[^0-9a-f]/gi,'').slice(-8),16)||1;const y=(s%1009)/1009*2-1;const angle=(s%997)/997*Math.PI*2;const radius=r*Math.cbrt(.15+(s%991)/991*.85);return [Math.cos(angle)*Math.sqrt(1-y*y)*radius,y*radius,Math.sin(angle)*Math.sqrt(1-y*y)*radius];}
export function buildSpaceGraph(atlas:Atlas,papers:Paper[],mode:Mode,layout:Layout3D){
 if(layout.version!==atlas.meta.version)throw Error('3D layout version mismatch');
 const c=connections(atlas,papers);const topics=atlas.taxonomy.topics;
 const researchers=new Map(atlas.researchers.map(r=>[r.id,r]));const pm=new Map(atlas.articles.map(p=>[p.id,p]));
 const counts=new Map<string,number>();const tc=new Map<string,Map<string,number>>();
 papers.forEach(p=>p.authors.forEach(id=>{counts.set(id,(counts.get(id)||0)+1);if(!tc.has(id))tc.set(id,new Map());p.topics.forEach(t=>tc.get(id)!.set(t,(tc.get(id)!.get(t)||0)+1));}));
 const color=(id:string)=>topics.find(t=>t.id===id)?.color||'#8393a4';
 const dominant=(id:string)=>[...(tc.get(id)||new Map<string,number>())].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
 const nodes:SpaceNode[]=[];const links:SpaceLink[]=[];
 const add=(id:string,name:string,kind:SpaceNode['kind'],color:string,val:number,pos:[number,number,number],context=false)=>{if(!pos||pos.some(v=>!Number.isFinite(v)))throw Error('Missing 3D position');const[x,y,z]=pos;nodes.push({id,name,kind,color,val,context,x,y,z,fx:x,fy:y,fz:z});};
 if(mode==='citations'){
  const visible=new Set([...c.ids,...c.citations.map(e=>e.target)]);const incoming=new Map<string,number>();c.citations.forEach(e=>incoming.set(e.target,(incoming.get(e.target)||0)+1));
  visible.forEach(id=>{const p=pm.get(id)!;add(id,p.title,'paper',c.ids.has(id)?color(p.topics[0]):'#657587',1+(incoming.get(id)||0),layout.citations[id],!c.ids.has(id));});
  c.citations.forEach(e=>links.push({source:e.source,target:e.target,weight:1}));
 }else{
  const anchors=new Map(topics.map((t,i)=>[t.id,sphere(i,topics.length,175)]));
  if(mode==='topics'&&papers.length)topics.forEach(t=>add(t.id,t.short||t.label,'topic',t.color!,80,anchors.get(t.id)!));
  c.researchers.forEach(id=>{
   const r=researchers.get(id)!;const t=dominant(id);let pos=layout.authors[id];
   if(mode==='topics'){const center=anchors.get(t)||[0,0,0];const delta=scatter(id,t?48:38);pos=[center[0]+delta[0],center[1]+delta[1],center[2]+delta[2]];}
   add(id,r.name,'researcher',color(t),counts.get(id)||1,pos);
   if(mode==='topics')for(const [topic,n] of tc.get(id)||[])links.push({source:id,target:topic,weight:n});
  });
  if(mode==='coauthor')c.coauthors.forEach(e=>links.push({source:e.source,target:e.target,weight:e.articles.length}));
 }
 return {nodes,links,contextCount:nodes.filter(n=>n.context).length};
}
