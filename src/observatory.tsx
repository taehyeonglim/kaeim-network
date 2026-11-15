import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowUpRight,SlidersHorizontal,ScanLine,X,ChartNoAxesCombined} from 'lucide-react';
import type {Selection} from './types';

export type Dimension='2d'|'3d';
export function entryDimension(hash:string,mobile:boolean,embed:boolean):Dimension{
 // A legacy URL without dim has always meant 2D. Only a genuinely new visit opts into 3D.
 if(hash.replace(/^#/,''))return new URLSearchParams(hash.slice(1)).get('dim')==='3d'?'3d':'2d';
 return mobile||embed?'2d':'3d';
}

type Panel='filters'|'detail'|'tools';
function Drawer({title,side,onClose,children,contentKey}:{contentKey?:string;title:string;side:'left'|'right';onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const dialog=ref.current!;const previous=document.activeElement as HTMLElement|null;
  const media=window.matchMedia('(max-width: 760px)');
  const show=()=>{if(dialog.open)dialog.close();if(media.matches)dialog.showModal();else dialog.show();dialog.querySelector<HTMLButtonElement>('.drawer-heading button')?.focus();};
  const escape=(event:KeyboardEvent)=>{
   if(document.querySelector('dialog.modal[open]'))return;
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key==='Tab'&&dialog.matches(':modal')){
    const controls=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  show();media.addEventListener('change',show);document.addEventListener('keydown',escape);
  return()=>{media.removeEventListener('change',show);document.removeEventListener('keydown',escape);dialog.close();if(previous?.isConnected&&previous!==document.body)previous.focus();else (document.querySelector<HTMLButtonElement>('.panel-launcher[aria-expanded="true"]')||document.querySelector<HTMLButtonElement>('.panel-launcher'))?.focus();};
 },[]);
 useEffect(()=>{ref.current?.querySelector('.drawer-body')?.scrollTo(0,0);},[contentKey]);
 return <dialog ref={ref} className={`observatory-drawer drawer-${side}`} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="drawer-heading"><span>{title}</span><button autoFocus className="icon-button" aria-label={`${title} 닫기`} onClick={onClose}><X size={19}/></button></div>
  <div className="drawer-body">{children}</div>
 </dialog>;
}

type Props={children:ReactNode;filters:ReactNode;detail:ReactNode;tools?:ReactNode;selection:Selection;detailKey?:string;period:string;condition:string;analysis?:boolean;analysisKey?:string};
export function ObservatoryWorkspace({children,filters,detail,tools,selection,detailKey,period,condition,analysis=false,analysisKey}:Props){
 const [panel,setPanel]=useState<Panel|null>(selection||detailKey?'detail':null);
 useEffect(()=>{if(selection||detailKey)setPanel('detail');else setPanel(p=>p==='detail'?null:p);},[selection,detailKey]);
 const toggle=(p:Panel)=>setPanel(v=>v===p?null:p);
 return <main id="explore" tabIndex={-1} className={`workspace observatory-workspace ${analysis?'analysis-workspace':''}`} data-analysis-key={analysisKey}>
  {children}
  <div className="workspace-coordinate" aria-hidden="true">KAEIM / {analysis?'02 — STRUCTURE':'01 — DISCOVERY'}</div>
  <div className="workspace-launchers">
   <button className="panel-launcher" aria-label={analysis?'분석 조건 열기':'탐색 조건 열기'} aria-expanded={panel==='filters'} onClick={()=>toggle('filters')}><SlidersHorizontal size={17}/><span>{analysis?'분석 조건':'탐색 조건'}<small>{period}{condition&&` · ${condition}`}</small></span><ArrowUpRight size={15}/></button>
   {tools&&<button className="panel-launcher tool-launcher" aria-label="분석 도구 열기" aria-expanded={panel==='tools'} onClick={()=>toggle('tools')}><ChartNoAxesCombined size={17}/><span>분석 도구<small>지표 · 집단 · 내보내기</small></span><ArrowUpRight size={15}/></button>}
  </div>
  {(selection||detailKey)&&<button className="panel-launcher detail-launcher" aria-label="선택 상세 열기" aria-expanded={panel==='detail'} onClick={()=>toggle('detail')}><ScanLine size={17}/> 선택 상세 <ArrowUpRight size={15}/></button>}
  {panel&&<Drawer key={panel} contentKey={panel==='detail'?(selection?.id||detailKey):undefined} title={panel==='filters'?(analysis?'분석 조건':'탐색 조건'):panel==='tools'?'분석 도구':'선택 상세'} side={panel==='detail'?'right':'left'} onClose={()=>setPanel(null)}>{panel==='filters'?filters:panel==='tools'?tools:detail}</Drawer>}
 </main>;
}
