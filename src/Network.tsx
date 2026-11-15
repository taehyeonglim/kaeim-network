import {useEffect,useRef,useState} from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import {ZoomIn,ZoomOut,Maximize2} from 'lucide-react';
import type {Atlas,Paper,Mode,Selection} from './types';
import {connections,number} from './model';

type Props={atlas:Atlas;papers:Paper[];mode:Mode;selection:Selection;onSelect:(s:Selection)=>void;onTopic:(id:string)=>void;onFallback:()=>void};
export function Network({atlas,papers,mode,selection,onSelect,onTopic,onFallback}:Props){
 const ref=useRef<HTMLDivElement>(null);const renderer=useRef<Sigma|null>(null);const [error,setError]=useState('');const [stats,setStats]=useState({nodes:0,edges:0,context:0});
 const callbacks=useRef({onSelect,onTopic,onFallback});callbacks.current={onSelect,onTopic,onFallback};
 useEffect(()=>{
  if(!ref.current)return;setError('');
  const graph=new Graph({type:mode==='citations'?'directed':'undirected',multi:false,allowSelfLoops:true});
  const visualScale=ref.current.clientWidth<500?.65:1;
  const c=connections(atlas,papers);const topics=atlas.taxonomy.topics;
  const paperMap=new Map(atlas.articles.map(p=>[p.id,p]));const rs=new Map(atlas.researchers.map(r=>[r.id,r]));
  const tc=new Map<string,Map<string,number>>();const counts=new Map<string,number>();
  papers.forEach(p=>p.authors.forEach(id=>{counts.set(id,(counts.get(id)||0)+1);if(!tc.has(id))tc.set(id,new Map());p.topics.forEach(t=>tc.get(id)!.set(t,(tc.get(id)!.get(t)||0)+1));}));
  const dominant=(id:string)=>[...(tc.get(id)||new Map<string,number>())].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
  const color=(id:string)=>topics.find(t=>t.id===id)?.color||'#8393a4';
  if(mode==='citations'){
   const visible=new Set([...papers.map(p=>p.id),...c.citations.map(e=>e.target)]);
   const incoming=new Map<string,number>();c.citations.forEach(e=>incoming.set(e.target,(incoming.get(e.target)||0)+1));
   visible.forEach(id=>{const p=paperMap.get(id)!;const pos=atlas.positions.citations[id];graph.addNode(id,{x:pos[0],y:pos[1],label:p.title,size:(3+Math.sqrt(incoming.get(id)||0)*1.6)*visualScale,color:c.ids.has(id)?color(p.topics[0]):'#b8c3ce',kind:'paper',context:!c.ids.has(id),zIndex:0});});
   c.citations.forEach((e,i)=>graph.addEdgeWithKey('e'+i,e.source,e.target,{size:0.6,color:'#c6d3df',type:'arrow'}));
  }else{
   if(mode==='topics')topics.forEach((t,i)=>{const angle=i/topics.length*2*Math.PI;graph.addNode(t.id,{x:Math.cos(angle)*100,y:Math.sin(angle)*100,label:t.short||t.label,size:15*visualScale,color:t.color,kind:'topic',forceLabel:true,zIndex:5});});
   let i=0;
   c.researchers.forEach(id=>{
    const r=rs.get(id)!;const topic=dominant(id);let pos=atlas.positions.authors[id];
    if(mode==='topics'){
     const ti=topics.findIndex(t=>t.id===topic);const a=(ti>=0?ti:0)/topics.length*2*Math.PI;
     const seed=parseInt(id.slice(2,10),16);const ra=(seed%10000)/10000*Math.PI*2;const radius=8+Math.sqrt((seed%997)/997)*30;
     pos=ti<0?[Math.cos(ra)*28,Math.sin(ra)*28]:[Math.cos(a)*100+Math.cos(ra)*radius,Math.sin(a)*100+Math.sin(ra)*radius];
    }
    graph.addNode(id,{x:pos[0],y:pos[1],label:r.name,size:(3+Math.sqrt(counts.get(id)||1)*1.6)*visualScale,color:color(topic),kind:'researcher',zIndex:1});
    if(mode==='topics')for(const [t,n] of tc.get(id)||[])graph.addEdgeWithKey('t'+i++,id,t,{size:Math.min(1.8,.3+Math.sqrt(n)*.2),color:'#d9e1e9'});
   });
   if(mode==='coauthor')c.coauthors.forEach((e,i)=>graph.addEdgeWithKey('e'+i,e.source,e.target,{size:Math.min(3,.35+Math.sqrt(e.articles.length)*.3),color:e.articles.length>2?'#aabfce':'#d3dfe8'}));
  }
  setStats({nodes:graph.order,edges:graph.size,context:graph.filterNodes((_,a)=>a.context).length});
  let sigma:Sigma;
  try{
   sigma=new Sigma(graph,ref.current,{renderEdgeLabels:false,labelFont:'system-ui, sans-serif',labelSize:12,labelWeight:'500',labelColor:{color:'#273d52'},labelDensity:.12,labelGridCellSize:100,labelRenderedSizeThreshold:8*visualScale,defaultEdgeType:mode==='citations'?'arrow':'line',zIndex:true,minCameraRatio:.03,maxCameraRatio:8,allowInvalidContainer:true});
   renderer.current=sigma;
   sigma.on('clickNode',({node})=>{const kind=graph.getNodeAttribute(node,'kind');if(kind==='topic')callbacks.current.onTopic(node);else callbacks.current.onSelect({id:node,type:kind});});
   sigma.on('clickStage',()=>callbacks.current.onSelect(null));
   let hovered:string|null=null;
   const update=()=>{const selected=ref.current?.dataset.selected;const active=hovered||(selected&&graph.hasNode(selected)?selected:null);const neighbors=active?new Set(graph.neighbors(active)):new Set<string>();
    sigma.setSetting('nodeReducer',(id,data)=>active?{...data,color:id===active||neighbors.has(id)?data.color:'#e2e8ee',forceLabel:id===active||neighbors.has(id),zIndex:id===active?10:neighbors.has(id)?5:0}:data);
    sigma.setSetting('edgeReducer',(id,data)=>active?{...data,hidden:!graph.hasExtremity(id,active),color:'#7994ad',size:1.3}:data);
   };
   sigma.on('enterNode',({node})=>{hovered=node;update();if(ref.current)ref.current.style.cursor='pointer';});
   sigma.on('leaveNode',()=>{hovered=null;update();if(ref.current)ref.current.style.cursor='grab';});
   const observer=new MutationObserver(update);observer.observe(ref.current,{attributes:true,attributeFilter:['data-selected']});update();
   return()=>{observer.disconnect();sigma.kill();renderer.current=null;};
  }catch(e){setError('이 환경에서는 지도를 표시할 수 없습니다. 같은 데이터를 목록으로 탐색할 수 있습니다.');renderer.current?.kill();renderer.current=null;}
 },[atlas,papers,mode]);
 return <div className="network-wrap">
  <div className="network-canvas" ref={ref} data-selected={selection?.id||''} role="img" aria-label={`${mode==='citations'?'논문 인용':mode==='topics'?'연구분야':'공저자'} 네트워크. ${stats.nodes}개 노드와 ${stats.edges}개 연결. 목록 보기에서 키보드로 같은 자료를 탐색할 수 있습니다.`}/>
  {error?<div className="network-error"><p>{error}</p><button onClick={onFallback}>목록으로 탐색하기</button></div>:null}
  {!papers.length&&<div className="network-error"><strong>조건에 맞는 논문이 없습니다.</strong><p>검색어나 분야·기간을 조정해 주세요.</p></div>}
  <div className="map-caption"><span className="live-dot"/> {mode==='coauthor'?'함께 쓴 논문이 연구자를 연결합니다':mode==='topics'?'연구주제가 사람과 연구를 연결합니다':'화살표: 인용한 논문 → 인용된 논문'}<small>{number(stats.nodes)} 노드 · {number(stats.edges)} 연결{stats.context>0?` · 조건 밖 참고 논문 ${stats.context}편`:''}{selection&&' · 선택 주변 연결 강조'}</small></div>
  <div className="zoom-controls"><button aria-label="지도 확대" onClick={()=>renderer.current?.getCamera().animatedZoom({duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:200})}><ZoomIn size={18}/></button><button aria-label="지도 축소" onClick={()=>renderer.current?.getCamera().animatedUnzoom({duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:200})}><ZoomOut size={18}/></button><button aria-label="지도 전체 보기" onClick={()=>renderer.current?.getCamera().animatedReset({duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:200})}><Maximize2 size={17}/></button></div>
  <div className="map-note">{mode==='coauthor'?'점 크기: 게재 논문 수 · 선 굵기: 공동 논문 수':mode==='topics'?'큰 점: 연구분야 · 작은 점: 연구자 묶음 · 중심: 미분류':'점 크기: 현재 인용망의 피인용 수 · 회색: 조건 밖 논문'}</div>
 </div>;
}
