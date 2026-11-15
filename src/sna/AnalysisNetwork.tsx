import {useEffect,useRef,useState} from 'react';
import Graph from 'graphology';
import {observeGraphViewport,viewportScale} from '../graphViewport';
import {graphTheme,drawGraphLabel,drawGraphHover} from '../theme';
import Sigma from 'sigma';
import {ZoomIn,ZoomOut,Maximize2} from 'lucide-react';
import type {Selection} from '../types';
import type {SpaceNode,SpaceLink} from '../graph3d';
import {endpoint} from '../graph3d';
import type {Positions2D} from './types';
export function AnalysisNetwork({data,positions,selection,onSelect,onFallback,sizeLabel,weightLabel}:{data:{nodes:SpaceNode[];links:SpaceLink[]};positions:Positions2D;selection:Selection;onSelect:(s:Selection)=>void;onFallback:()=>void;sizeLabel:string;weightLabel:string}){
 const host=useRef<HTMLDivElement>(null),renderer=useRef<Sigma|null>(null);const callbacks=useRef({onSelect,onFallback});callbacks.current={onSelect,onFallback};const[error,setError]=useState(false);
 useEffect(()=>{
  if(!host.current)return;setError(false);const scale=viewportScale(host.current);const g=new Graph({type:'undirected'});
  for(const n of data.nodes){const [x,y]=positions[n.id];g.addNode(n.id,{x,y,label:n.name,color:n.context?graphTheme.context:n.color,size:Math.sqrt(9+2*n.val)*scale,zIndex:n.context?0:1});}
  for(const e of data.links)g.addEdge(endpoint(e.source),endpoint(e.target),{weight:e.weight,size:Math.min(4,.3+Math.sqrt(e.weight)*.5),color:graphTheme.edge});
  let sigma:Sigma;let observer:MutationObserver;let disconnectResize:(()=>void)|undefined;
  try{
   sigma=new Sigma(g,host.current,{defaultDrawNodeLabel:drawGraphLabel,defaultDrawNodeHover:drawGraphHover,labelColor:{color:graphTheme.label},labelSize:13,labelDensity:.12,labelGridCellSize:100,labelRenderedSizeThreshold:8,zIndex:true,minCameraRatio:.03,maxCameraRatio:8,allowInvalidContainer:true});renderer.current=sigma;disconnectResize=observeGraphViewport(host.current,g,sigma,scale);
   let hover:string|null=null;
   const update=()=>{const chosen=host.current?.dataset.selected;const active=hover||(chosen&&g.hasNode(chosen)?chosen:null);const neighbors=new Set(active?g.neighbors(active):[]);
    sigma.setSetting('nodeReducer',(id,a)=>active?{...a,label:id===active||neighbors.has(id)?a.label:'',color:id===active||neighbors.has(id)?a.color:graphTheme.muted,forceLabel:id===active,highlighted:id===active,zIndex:id===active?5:0}:a);
    sigma.setSetting('edgeReducer',(id,a)=>active?{...a,hidden:!g.hasExtremity(id,active),color:graphTheme.selectedEdge}:a);
   };
   sigma.on('clickNode',({node})=>callbacks.current.onSelect({type:'researcher',id:node}));sigma.on('clickStage',()=>callbacks.current.onSelect(null));
   sigma.on('enterNode',({node})=>{hover=node;update();if(host.current)host.current.style.cursor='pointer';});sigma.on('leaveNode',()=>{hover=null;update();if(host.current)host.current.style.cursor='grab';});
   observer=new MutationObserver(update);observer.observe(host.current,{attributes:true,attributeFilter:['data-selected']});update();
  }catch{setError(true);renderer.current?.kill();renderer.current=null;}
  return()=>{disconnectResize?.();observer?.disconnect();sigma?.kill();renderer.current=null;};
 },[data,positions]);
 return <div className="network-wrap analysis-network" data-nodes={data.nodes.length} data-links={data.links.length}>
  <div ref={host} className="network-canvas" role="img" data-selected={selection?.id||''} aria-label={`공저 구조 분석. ${data.nodes.length}개 연구자 묶음, ${data.links.length}개 연결. 표 보기에서도 탐색할 수 있습니다.`}/>
  <div className="map-caption">선택 기간 전체 공저망<small>{data.nodes.length.toLocaleString()} 노드 · {data.links.length.toLocaleString()} 연결</small></div>
  <div className="map-note">점 면적: {sizeLabel} · 선 굵기: {weightLabel}<br/>최소 표시 크기 포함 · 화면의 거리는 실제 사회적 거리가 아닙니다.</div>
  <div className="zoom-controls"><button aria-label="분석 지도 확대" onClick={()=>renderer.current?.getCamera().animatedZoom({duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:200})}><ZoomIn size={18}/></button><button aria-label="분석 지도 축소" onClick={()=>renderer.current?.getCamera().animatedUnzoom({duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:200})}><ZoomOut size={18}/></button><button aria-label="분석 지도 전체 보기" onClick={()=>renderer.current?.getCamera().animatedReset({duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:200})}><Maximize2 size={18}/></button></div>
  {error&&<div className="network-error"><p>이 환경에서는 지도를 표시할 수 없습니다.</p><button onClick={onFallback}>표로 탐색하기</button></div>}
  {!data.nodes.length&&<div className="network-error"><p>선택 기간에 논문이 없습니다.</p></div>}
 </div>;
}
