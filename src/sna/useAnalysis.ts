import {useEffect,useState} from 'react';
import type {Atlas} from '../types';
import {METHOD_VERSION} from './types';
import type {AnalysisResult,LayoutResult,AnalysisOptions,Baseline,WorkerRequest,WorkerResponse} from './types';
const results=new Map<string,AnalysisResult>(),layouts=new Map<string,LayoutResult>();
function remember<T>(map:Map<string,T>,key:string,value:T){map.set(key,value);if(map.size>20)map.delete(map.keys().next().value!);}
export function useAnalysis(atlas:Atlas,from:number,to:number,options:AnalysisOptions,retry:number){
 const key=[atlas.meta.version,METHOD_VERSION,from,to,options.weighting].join(':');
 const layoutKey=[atlas.meta.version,METHOD_VERSION,options.layout==='reference'?atlas.meta.minYear:from,options.layout==='reference'?atlas.meta.maxYear:to,options.weighting].join(':');
 const requestKey=key+':'+layoutKey;
 const [state,setState]=useState<{key:string;result?:AnalysisResult;layout?:LayoutResult;status:string;error?:string}>({key:'',status:'분석을 준비하고 있습니다…'});
 useEffect(()=>{
  let disposed=false,worker:Worker|undefined;let requestId=0;const abort=new AbortController();
  const update=(patch:Partial<typeof state>)=>{if(!disposed)setState(s=>({...s,...patch,key:requestKey}));};
  setState({key:requestKey,status:'분석을 준비하고 있습니다…'});
  const run=(job:Omit<Extract<WorkerRequest,{kind:'analysis'}>,'id'>|Omit<Extract<WorkerRequest,{kind:'layout'}>,'id'>)=>new Promise<AnalysisResult|LayoutResult>((resolve,reject)=>{
   if(disposed){reject(new Error('cancelled'));return;}
   worker??=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
   const id=++requestId;
   worker.onmessage=(event:MessageEvent<WorkerResponse>)=>{const m=event.data;if(disposed||m.id!==id)return;if(m.kind==='progress')update({status:m.message});else if(m.kind==='error')reject(new Error(m.message));else resolve(m.result);};
   worker.onerror=()=>reject(new Error('분석 작업을 실행하지 못했습니다.'));
   worker.postMessage({...job,id});
  });
  const fullKey=[atlas.meta.version,METHOD_VERSION,atlas.meta.minYear,atlas.meta.maxYear,options.weighting].join(':');
  (async()=>{
   // A saved baseline accelerates first use; missing/stale artifacts are computed locally.
   if(!results.has(fullKey)||!layouts.has(fullKey)){
    try{
     const response=await fetch(`${import.meta.env.BASE_URL}data/sna-${options.weighting}.json?v=${atlas.meta.version}`,{signal:abort.signal});
     if(!response.ok)throw Error('baseline');const b:Baseline=await response.json();
     if(b.dataVersion!==atlas.meta.version||b.methodVersion!==METHOD_VERSION||b.weighting!==options.weighting||b.result.nodes.length!==atlas.meta.researcherGroups||!b.layout.positions2d||!b.layout.positions3d)throw Error('baseline version');
     if(disposed)return;remember(results,fullKey,b.result);remember(layouts,fullKey,b.layout);
    }catch(e){if(disposed)return;}
   }
   let result=results.get(key);
   if(!result){result=await run({kind:'analysis',input:atlas,from,to,weighting:options.weighting}) as AnalysisResult;if(disposed)return;remember(results,key,result);}
   update({result,status:'지도 배치를 준비하고 있습니다…'});
   let layout=layouts.get(layoutKey);
   if(!layout){
    let layoutInput=results.get(layoutKey);
    if(!layoutInput){layoutInput=await run({kind:'analysis',input:atlas,from:atlas.meta.minYear,to:atlas.meta.maxYear,weighting:options.weighting}) as AnalysisResult;if(disposed)return;remember(results,layoutKey,layoutInput);}
    layout=await run({kind:'layout',result:layoutInput}) as LayoutResult;if(disposed)return;remember(layouts,layoutKey,layout);
   }
   update({result,layout,status:''});worker?.terminate();
  })().catch(e=>{update({error:String(e),status:''});worker?.terminate();});
  return()=>{disposed=true;abort.abort();worker?.terminate();};
 },[atlas,key,layoutKey,requestKey,retry]);
 return state.key===requestKey?state:{key:requestKey,status:'분석 조건을 변경하고 있습니다…'};
}
