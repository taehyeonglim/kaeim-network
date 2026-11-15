import forceAtlas2 from 'graphology-layout-forceatlas2';
import {forceSimulation,forceLink,forceManyBody,forceX,forceY,forceZ,forceCollide} from 'd3-force-3d';
import type {SimulationNodeDatum,SimulationLinkDatum} from 'd3-force-3d';
import seedrandom from 'seedrandom';
import {graphFor} from './engine';
import type {AnalysisResult,LayoutResult} from './types';
export function calculateLayout(result:AnalysisResult,iterations2d=1000,ticks3d=600,seed=0):LayoutResult{
 const g=graphFor(result.edges,result.nodes.map(n=>n.id));
 const rng=seedrandom('layout:'+seed);
 g.forEachNode(id=>{const a=rng()*Math.PI*2,r=10+20*rng();g.mergeNodeAttributes(id,{x:r*Math.cos(a),y:r*Math.sin(a),size:1});});
 if(g.order>1)forceAtlas2.assign(g,{iterations:iterations2d,settings:{...forceAtlas2.inferSettings(g),barnesHutOptimize:true,gravity:.7,scalingRatio:7,slowDown:5}});
 const positions2d:LayoutResult['positions2d']={};g.forEachNode((id,a)=>positions2d[id]=[+a.x.toFixed(3),+a.y.toFixed(3)]);
 type N=SimulationNodeDatum&{id:string};type L=SimulationLinkDatum<N>&{weight:number};
 const nodes:N[]=result.nodes.map(n=>({id:n.id}));const links:L[]=result.edges.map(e=>({source:e.source,target:e.target,weight:e.weight}));
 const sim=forceSimulation<N>(nodes,3).stop().randomSource(seedrandom('3d:'+seed))
  .force('link',forceLink<N,L>(links).id(n=>n.id).distance(e=>24/Math.pow(e.weight,.15)).strength(.6))
  .force('charge',forceManyBody().strength(-18)).force('x',forceX().strength(.025)).force('y',forceY().strength(.025)).force('z',forceZ().strength(.025)).force('collision',forceCollide(2.2));
 // Perturb deterministic starting coordinates only for the sensitivity audit.
 if(seed)for(const n of nodes){n.x!+=rng()*10;n.y!+=rng()*10;n.z!+=rng()*10;}
 sim.tick(ticks3d);sim.stop();const max=Math.max(1,...nodes.map(n=>Math.hypot(n.x!,n.y!,n.z!)));
 const positions3d:LayoutResult['positions3d']={};for(const n of nodes)positions3d[n.id]=[n.x!,n.y!,n.z!].map(x=>+(x/max*230).toFixed(3)) as [number,number,number];
 return {positions2d,positions3d};
}
