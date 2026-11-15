import fs from 'node:fs';
import {forceSimulation,forceLink,forceManyBody,forceX,forceY,forceZ,forceCollide} from 'd3-force-3d';
const root=new URL('../public/data/',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('atlas.json',root),'utf8'));
function layout(ids,edges){
 const nodes=[...ids].sort().map(id=>({id}));
 const links=edges.filter(e=>e.source!==e.target).map(e=>({source:e.source,target:e.target,weight:e.articles?.length||1}));
 const simulation=forceSimulation(nodes,3).stop()
  .force('link',forceLink(links).id(n=>n.id).distance(e=>24/Math.pow(e.weight,.15)).strength(.6))
  .force('charge',forceManyBody().strength(-18))
  .force('x',forceX().strength(.025)).force('y',forceY().strength(.025)).force('z',forceZ().strength(.025))
  .force('collision',forceCollide(2.2));
 simulation.tick(420);simulation.stop();
 const max=Math.max(...nodes.map(n=>Math.hypot(n.x,n.y,n.z)),1);
 return Object.fromEntries(nodes.map(n=>[n.id,[n.x,n.y,n.z].map(v=>+(v/max*230).toFixed(3))]));
}
const result={version:data.meta.version,algorithm:'d3-force-3d, deterministic initialization, 420 offline ticks',authors:layout(data.researchers.map(r=>r.id),data.coauthors),citations:layout(data.articles.map(p=>p.id),data.citations)};
fs.writeFileSync(new URL('layout-3d.json',root),JSON.stringify(result)+'\n');
console.log(`3D layouts: ${Object.keys(result.authors).length} researcher groups, ${Object.keys(result.citations).length} papers`);
