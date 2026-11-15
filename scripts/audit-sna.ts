import fs from 'node:fs';
import {analyze} from '../src/sna/engine';
import {calculateLayout} from '../src/sna/layout';
import type {Atlas} from '../src/types';
import type {AnalysisResult,LayoutResult,Baseline} from '../src/sna/types';
const root=new URL('../',import.meta.url),a=JSON.parse(fs.readFileSync(new URL('public/data/atlas.json',root),'utf8')) as Atlas;
function neighborhood(r:AnalysisResult,positions:Record<string,number[]>){
 const adj=new Map(r.nodes.map(n=>[n.id,new Set<string>()]));for(const e of r.edges){adj.get(e.source)!.add(e.target);adj.get(e.target)!.add(e.source);}
 let total=0,count=0;for(const n of r.nodes){const actual=adj.get(n.id)!;if(!actual.size)continue;const p=positions[n.id];const nearest=r.nodes.filter(m=>m.id!==n.id).map(m=>({id:m.id,d:positions[m.id].reduce((s,x,i)=>s+(x-p[i])**2,0)})).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).slice(0,actual.size);total+=nearest.filter(m=>actual.has(m.id)).length/actual.size;count++;}
 return count?total/count:null;
}
function distanceCorrelation(ids:string[],p:Record<string,number[]>,q:Record<string,number[]>){
 const x:number[]=[],y:number[]=[];for(let i=0;i<4000;i++){const a=ids[(i*17)%ids.length],b=ids[(i*71+137)%ids.length];if(a===b)continue;const d=(pos:typeof p)=>Math.sqrt(pos[a].reduce((s,v,k)=>s+(v-pos[b][k])**2,0));x.push(d(p));y.push(d(q));}
 const mx=x.reduce((s,v)=>s+v,0)/x.length,my=y.reduce((s,v)=>s+v,0)/y.length;let cov=0,vx=0,vy=0;for(let i=0;i<x.length;i++){cov+=(x[i]-mx)*(y[i]-my);vx+=(x[i]-mx)**2;vy+=(y[i]-my)**2;}return cov/Math.sqrt(vx*vy);
}
const report:{dataVersion:string;checkedAt:string;interpretation:string;variants:unknown[]}={dataVersion:a.meta.version,checkedAt:new Date().toISOString(),interpretation:'Neighborhood preservation compares each nonisolated node with its degree-many nearest geometric neighbors. Distance correlation uses 4000 deterministic pairs in the largest component; it is scale/rotation invariant. These are layout diagnostics, not centrality validity or a convergence guarantee. Seed partition hashes are not membership probabilities.',variants:[]};
for(const weighting of ['papers','fractional'] as const){
 const b=JSON.parse(fs.readFileSync(new URL(`public/data/sna-${weighting}.json`,root),'utf8')) as Baseline;
 const t=performance.now(),r=analyze(a,a.meta.minYear,a.meta.maxYear,weighting),analysisMs=performance.now()-t;
 for(const variant of ['default','double-iterations','different-seed'] as const){
  const start=performance.now();const l:LayoutResult=variant==='default'?b.layout:calculateLayout(r,variant==='double-iterations'?2000:1000,variant==='double-iterations'?1200:600,variant==='different-seed'?1:0);
  const row={weighting,variant,analysisMs:Math.round(analysisMs),layoutMs:variant==='default'?null:Math.round(performance.now()-start),neighborhood2d:neighborhood(r,l.positions2d),neighborhood3d:neighborhood(r,l.positions3d),distanceCorrelation2d:distanceCorrelation(r.components[0].members,b.layout.positions2d,l.positions2d),distanceCorrelation3d:distanceCorrelation(r.components[0].members,b.layout.positions3d,l.positions3d),communityPartitions:new Set(r.diagnostics.seedRuns.map(x=>x.partition)).size,modularityRange:[Math.min(...r.diagnostics.seedRuns.map(x=>x.modularity)),Math.max(...r.diagnostics.seedRuns.map(x=>x.modularity))]};report.variants.push(row);console.log(JSON.stringify(row));
 }
}
fs.writeFileSync(new URL('docs/sna-audit.json',root),JSON.stringify(report,null,2)+'\n');
