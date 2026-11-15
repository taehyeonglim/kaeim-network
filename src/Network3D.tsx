import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type {ForceGraphMethods} from 'react-force-graph-3d';
import {Vector3} from 'three';
import {Maximize2,ZoomIn,ZoomOut,RotateCcw,Box} from 'lucide-react';
import type {Atlas,Mode,Paper,Selection} from './types';
import {buildSpaceGraph,endpoint} from './graph3d';
import type {Layout3D,SpaceNode,SpaceLink} from './graph3d';
import {number} from './model';
import {displayColor,graphTheme} from './theme';

export type SpacePresentation={data:{nodes:SpaceNode[];links:SpaceLink[];contextCount:number};sizeLabel:string;weightLabel:string};
type Props={presentation?:SpacePresentation;atlas:Atlas;papers:Paper[];mode:Mode;selection:Selection;onSelect:(s:Selection)=>void;onTopic:(id:string)=>void;onFallback:()=>void};
type Label={id:string;name:string;kind:string;x:number;y:number;color:string;selected:boolean};
const duration=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:600;
export default function Network3D(props:Props){
 const [layout,setLayout]=useState<Layout3D|null>(null);const[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch(`${import.meta.env.BASE_URL}data/layout-3d.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('layout');return r.json();}).then(d=>{if(d.version!==props.atlas.meta.version)throw Error('version');setLayout(d);}).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>controller.abort();},[props.atlas.meta.version]);
 if(error)return <div className="network-wrap three-loading"><Box/><p>3D 지도를 불러오지 못했습니다.</p><button onClick={props.onFallback}>2D 지도로 보기</button></div>;
 if(!layout)return <div className="network-wrap three-loading" role="status"><Box/><p>입체 연구지도를 준비하고 있습니다.</p></div>;
 return <SpaceScene {...props} layout={layout}/>;
}
export function SpaceScene({atlas,papers,mode,selection,onSelect,onTopic,onFallback,layout,presentation}:Props&{layout:Layout3D}){
 const host=useRef<HTMLDivElement>(null);const fg=useRef<ForceGraphMethods<SpaceNode,SpaceLink>|undefined>(undefined);
 const [size,setSize]=useState({width:0,height:0});const [ready,setReady]=useState(false);const [failed,setFailed]=useState(false);const [hover,setHover]=useState<string|null>(null);const [labels,setLabels]=useState<Label[]>([]);
 const data=useMemo(()=>presentation?{...presentation.data,nodes:presentation.data.nodes.map(n=>({...n})),links:presentation.data.links.map(e=>({...e}))}:buildSpaceGraph(atlas,papers,mode,layout),[atlas,papers,mode,layout,presentation]);
 const selected=selection&&data.nodes.some(n=>n.id===selection.id)?selection.id:null;
 const active=hover||selected;
 const neighbors=useMemo(()=>{const set=new Set<string>();if(active)for(const e of data.links){const s=endpoint(e.source),t=endpoint(e.target);if(s===active)set.add(t);if(t===active)set.add(s);}return set;},[data,active]);
 const brightColors=useMemo(()=>new Map(data.nodes.map(n=>[n.id,presentation?n.color:displayColor(n.color)])),[data,presentation]);
 useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(([entry])=>setSize({width:Math.floor(entry.contentRect.width),height:Math.floor(entry.contentRect.height)}));observer.observe(host.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{setReady(false);setHover(null);setLabels([]);},[data]);
 const fit=useCallback(()=>{if(!fg.current||!data.nodes.length)return;fg.current.cameraPosition({x:280,y:145,z:650},{x:0,y:0,z:0},0);fg.current.zoomToFit(duration(),65);},[data]);
 useEffect(()=>{if(!ready)return;const graph=fg.current;if(!graph)return;
  if(selected){const node=data.nodes.find(n=>n.id===selected)!;const camera=graph.camera();const direction=new Vector3().copy(camera.position).sub(new Vector3(node.x,node.y,node.z)).normalize();if(direction.lengthSq()===0)direction.set(0,0,1);const distance=size.width<500?170:130;graph.cameraPosition({x:node.x+direction.x*distance,y:node.y+direction.y*distance,z:node.z+direction.z*distance},{x:node.x,y:node.y,z:node.z},duration());}
  else fit();
 },[ready,selected,data,fit,size.width,size.height]);
 // Project a bounded set of labels into the current camera view. React text escapes paper/author names.
 useEffect(()=>{
  if(!ready||!fg.current)return;
  const graph=fg.current;const canvas=graph.renderer().domElement;let frame=0,last=0,signature='';
  const lost=(event:Event)=>{event.preventDefault();setFailed(true);};canvas.addEventListener('webglcontextlost',lost);
  const project=(now:number)=>{frame=requestAnimationFrame(project);if(now-last<120||document.hidden)return;last=now;
   const camera=graph.camera();camera.updateMatrixWorld();const position=camera.position;
   const candidates=data.nodes.filter(n=>(!active||n.id===selected||n.id===active||neighbors.has(n.id))&&(n.kind==='topic'||n.id===selected||n.id===active||Math.hypot(n.x-position.x,n.y-position.y,n.z-position.z)<190)).sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)||Number(b.id===active)-Number(a.id===active)||Number(b.kind==='topic')-Number(a.kind==='topic')||b.val-a.val);
   const visible:Label[]=[];
   for(const node of candidates){
    const ndc=new Vector3(node.x,node.y,node.z).project(camera);if(ndc.z< -1||ndc.z>1||Math.abs(ndc.x)>.9||Math.abs(ndc.y)>.83)continue;
    const p=graph.graph2ScreenCoords(node.x,node.y,node.z);const x=Math.round(p.x),y=Math.round(p.y);
    if(visible.some(l=>Math.abs(l.x-x)<95&&Math.abs(l.y-y)<27))continue;
    visible.push({id:node.id,name:node.name,kind:node.kind,x,y,color:brightColors.get(node.id)!,selected:node.id===selected});if(visible.length>=12)break;
   }
   const next=JSON.stringify(visible);if(next!==signature){signature=next;setLabels(visible);}
  };frame=requestAnimationFrame(project);
  return()=>{cancelAnimationFrame(frame);canvas.removeEventListener('webglcontextlost',lost);};
 },[ready,data,active,selected,size,brightColors,neighbors]);
 const click=useCallback((node:SpaceNode)=>{if(node.kind==='topic')onTopic(node.id);else onSelect({type:node.kind,id:node.id});},[onSelect,onTopic]);
 const zoom=(factor:number)=>{const graph=fg.current;if(!graph)return;const controls=graph.controls() as {target:Vector3};const center=controls.target;const p=graph.camera().position;graph.cameraPosition({x:center.x+(p.x-center.x)*factor,y:center.y+(p.y-center.y)*factor,z:center.z+(p.z-center.z)*factor},{x:center.x,y:center.y,z:center.z},duration());};
 return <div className="network-wrap space-wrap" data-ready={ready} data-nodes={data.nodes.length} data-links={data.links.length} data-focus={selected||''} data-mode={mode}>
  <div className="space-canvas" ref={host} role="img" aria-label={`3차원 ${mode==='topics'?'연구분야 성단':mode==='citations'?'인용':'공저자'} 지도. ${data.nodes.length}개 점과 ${data.links.length}개 연결. 드래그로 회전하고 스크롤로 확대합니다. 목록 보기에서도 같은 연구를 탐색할 수 있습니다.`}>
   {size.width>0&&size.height>0&&!failed&&<ForceGraph3D<SpaceNode,SpaceLink> ref={fg} width={size.width} height={size.height} graphData={data} backgroundColor={graphTheme.background} showNavInfo={false} controlType="orbit" numDimensions={3} enableNodeDrag={false} nodeRelSize={2.3} nodeVal="val" nodeResolution={10} nodeOpacity={.94} nodeLabel={()=>''} nodeColor={node=>active&&node.id!==selected&&node.id!==active&&!neighbors.has(node.id)?graphTheme.muted:brightColors.get(node.id)!} linkVisibility={link=>!active||endpoint(link.source)===active||endpoint(link.target)===active} linkColor={()=>active?graphTheme.selectedEdge:graphTheme.strongEdge} linkOpacity={active ? .75 : .25} linkWidth={link=>presentation?Math.min(1,.08+Math.sqrt(link.weight)*.12):active?Math.min(.65,.15+Math.sqrt(link.weight)*.08):0} linkDirectionalArrowLength={mode==='citations'?3:0} linkDirectionalArrowRelPos={.92} linkDirectionalArrowColor={()=>'#a7cedd'} warmupTicks={1} cooldownTicks={1} onEngineStop={()=>setReady(true)} onNodeHover={node=>setHover(node?.id||null)} onNodeClick={click} onBackgroundClick={()=>onSelect(null)}/>}
  </div>
  <div className="space-labels">{labels.map(label=><button key={label.id} className={`space-label ${label.selected?'selected':''}`} style={{left:label.x,top:label.y,borderColor:label.color}} aria-label={`${label.kind==='topic'?'분야':label.kind==='paper'?'논문':'연구자'} ${label.name} 선택`} onClick={()=>click(data.nodes.find(n=>n.id===label.id)!)}><i style={{background:label.color}}/>{label.name}</button>)}</div>
  <div className="map-caption"><span className="space-badge"><Box size={12}/> 3D {mode==='topics'?'연구분야 성단':'입체 네트워크'}</span><span>{mode==='topics'?'분야별 성단 사이에서 연구의 연결을 찾으세요':mode==='citations'?'화살표: 인용한 논문 → 인용된 논문':'학회를 이루는 연구의 연결을 입체적으로 탐색하세요'}</span><small>{number(data.nodes.length)} 노드 · {number(data.links.length)} 연결{data.contextCount?` · 조건 밖 참고 논문 ${data.contextCount}편`:''}{active?' · 선택 주변 연결 강조':''}</small></div>
  <div className="space-help">드래그: 회전 <span>·</span> 스크롤·두 손가락: 확대 <span>·</span> 점 선택: 상세 보기</div>
  <div className="zoom-controls"><button aria-label="3D 지도 확대" onClick={()=>zoom(.75)}><ZoomIn size={18}/></button><button aria-label="3D 지도 축소" onClick={()=>zoom(1.3)}><ZoomOut size={18}/></button><button aria-label="3D 지도 전체 보기" onClick={fit}><Maximize2 size={17}/></button><button aria-label="3D 회전 초기화" onClick={fit}><RotateCcw size={16}/></button></div>
  <div className="map-note">{presentation?`구 부피: ${presentation.sizeLabel} · 선 굵기: ${presentation.weightLabel}`:mode==='topics'?'큰 구: 연구분야 · 작은 구: 연구자 묶음':'구 크기: '+(mode==='citations'?'현재 내부 피인용 수':'게재 논문 수')}<br/>공간상의 높이·거리는 연구자의 우열이나 실제 지리적 위치가 아닙니다.</div>
  {failed&&<div className="network-error"><p>이 환경에서 3D 표시가 중단됐습니다.</p><button onClick={onFallback}>2D 지도로 보기</button></div>}
  {!papers.length&&<div className="network-error"><strong>조건에 맞는 논문이 없습니다.</strong><p>검색어나 분야·기간을 조정해 주세요.</p></div>}
 </div>;
}
