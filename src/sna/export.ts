import gexf from 'graphology-gexf';
import {graphFor} from './engine';
import type {Atlas} from '../types';
import type {AnalysisResult} from './types';
export function csvCell(value:unknown){
 let s=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
 if(typeof value==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
export function csv(rows:Record<string,unknown>[],columns?:string[]){const keys=columns||Object.keys(rows[0]||{});return '\uFEFF'+[keys.map(csvCell).join(','),...rows.map(row=>keys.map(k=>csvCell(row[k])).join(','))].join('\r\n')+'\r\n';}
export function exportAnalysis(a:Atlas,r:AnalysisResult,kind:'nodes'|'edges'|'gexf'|'method'){
 const people=new Map(a.researchers.map(n=>[n.id,n]));
 const metadata={dataVersion:r.dataVersion,methodVersion:r.methodVersion,from:r.from,to:r.to,weighting:r.weighting,scope:'selected-period-all-papers',distance:'1 / weight',betweenness:'normalized undirected weighted shortest paths; endpoints excluded',community:'weighted Louvain, resolution 1, 10 fixed seeds; disconnected partitions split',identity:'user-reviewed + pending + provisional groups; not verified member count'};
 const prefix={dataVersion:r.dataVersion,methodVersion:r.methodVersion,from:r.from,to:r.to,weighting:r.weighting};
 if(kind==='method')return JSON.stringify({...metadata,summary:r.summary,diagnostics:r.diagnostics},null,2);
 const rows=r.nodes.map(n=>{const p=people.get(n.id)!;return {...prefix,id:n.id,name:p.name,institutions:p.institutions,identityStatus:p.identityStatus,papers:n.papers,degree:n.degree,degreeCentrality:n.degreeCentrality,strength:n.strength,betweenness:n.betweenness,component:n.component,community:n.community,crossCommunityPartners:n.crossCommunityPartners,articleIds:n.articleIds};});
 if(kind==='nodes')return csv(rows,[...Object.keys(prefix),'id','name','institutions','identityStatus','papers','degree','degreeCentrality','strength','betweenness','component','community','crossCommunityPartners','articleIds']);
 if(kind==='edges')return csv(r.edges.map(e=>({...prefix,...e})),[...Object.keys(prefix),'source','target','articles','paperCount','fractionalWeight','weight','distance']);
 const g=graphFor(r.edges,r.nodes.map(n=>n.id));
 g.replaceAttributes({creator:'KAEIM Research Atlas',description:JSON.stringify({...metadata,summary:r.summary,diagnostics:r.diagnostics})});
 for(const n of rows)g.mergeNodeAttributes(n.id,{...n,label:n.name,institutions:JSON.stringify(n.institutions),articleIds:JSON.stringify(n.articleIds),community:n.community||'isolated'});
 for(const e of r.edges)g.mergeEdgeAttributes(g.edge(e.source,e.target),{...prefix,paperCount:e.paperCount,fractionalWeight:e.fractionalWeight,articles:JSON.stringify(e.articles)});
 return gexf.write(g);
}
export function downloadAnalysis(a:Atlas,r:AnalysisResult,kind:'nodes'|'edges'|'gexf'|'method'){
 const data=exportAnalysis(a,r,kind),ext=kind==='method'?'json':kind==='gexf'?'gexf':'csv';
 const blob=new Blob([data],{type:ext==='csv'?'text/csv;charset=utf-8':ext==='gexf'?'application/xml':'application/json'});const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=`kaeim-${r.from}-${r.to}-${r.weighting}-${r.dataVersion}-${kind}.${ext}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
