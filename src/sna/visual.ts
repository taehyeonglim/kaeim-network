import {displayColor} from '../theme';
import type {Atlas} from '../types';
import type {SpaceNode,SpaceLink} from '../graph3d';
import type {AnalysisResult,AnalysisOptions,AnalysisNode,LayoutResult} from './types';
export const sizeLabels={papers:'게재 논문 수',degree:'공동연구자 수',betweenness:'매개중심성'};
export const weightLabels={papers:'공저 논문 수',fractional:'공동저자 수 보정'};
export function communityColor(id:string|null){if(!id)return '#8393a4';const n=Number(id.split('-').at(-1)),h=(Math.round(n*137.508)%360)/60,s=.55,l=.65,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h%2-1)),m=l-c/2;const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return '#'+rgb.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');}
export const groupLabel=(id:string)=>id.startsWith('community-')?'협력집단 '+id.split('-').at(-1):'연결요소 '+id.split('-').at(-1);
export function metric(n:AnalysisNode,size:AnalysisOptions['size']){return n[size];}
export function analysisVisual(a:Atlas,r:AnalysisResult,l:LayoutResult,o:AnalysisOptions,highlight:Set<string>|null){
 const people=new Map(a.researchers.map(n=>[n.id,n]));const topics=new Map(a.taxonomy.topics.map(t=>[t.id,displayColor(t.color)]));const max=Math.max(0,...r.nodes.map(n=>metric(n,o.size)));
 const nodes:SpaceNode[]=r.nodes.map(n=>{const p=l.positions3d[n.id];if(!p)throw Error('Missing analysis position');const [x,y,z]=p;return {id:n.id,name:people.get(n.id)!.name,kind:'researcher',color:highlight&&!highlight.has(n.id)?'#52647b':o.color==='community'?communityColor(n.community):topics.get(n.topic||'')||'#8393a4',val:1+(max?63*metric(n,o.size)/max:0),context:!!highlight&&!highlight.has(n.id),x,y,z,fx:x,fy:y,fz:z};});
 const links:SpaceLink[]=r.edges.map(e=>({source:e.source,target:e.target,weight:e.weight}));
 return {nodes,links,contextCount:0};
}
