import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'public/data/atlas.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
function layout(nodes,edges){
 const g=new Graph({multi:false,allowSelfLoops:false});
 nodes.forEach((n,i)=>{const a=i*2.399963229728653,r=Math.sqrt(i+1);g.addNode(n,{x:r*Math.cos(a),y:r*Math.sin(a),size:1});});
 edges.forEach(e=>{if(e.source!==e.target&&!g.hasEdge(e.source,e.target))g.addEdge(e.source,e.target,{weight:e.articles?.length??1});});
 forceAtlas2.assign(g,{iterations:200,settings:{...forceAtlas2.inferSettings(g),barnesHutOptimize:true,gravity:0.7,scalingRatio:7,slowDown:5}});
 const positions={};g.forEachNode((id,a)=>positions[id]=[+a.x.toFixed(3),+a.y.toFixed(3)]);return positions;
}
data.positions={authors:layout(data.researchers.map(r=>r.id),data.coauthors),citations:layout(data.articles.map(p=>p.id),data.citations)};
fs.writeFileSync(file,JSON.stringify(data)+'\n');
console.log(`Stable layouts: ${data.researchers.length} researcher groups / ${data.articles.length} papers`);
