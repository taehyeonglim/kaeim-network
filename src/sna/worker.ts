import {analyze} from './engine';
import {calculateLayout} from './layout';
import type {WorkerRequest,WorkerResponse} from './types';
self.onmessage=(event:MessageEvent<WorkerRequest>)=>{
 const m=event.data;const send=(r:WorkerResponse)=>self.postMessage(r);
 try{
  send({id:m.id,kind:'progress',message:m.kind==='analysis'?'중심성과 협력집단을 계산하고 있습니다…':'지도 배치를 계산하고 있습니다…'});
  if(m.kind==='analysis')send({id:m.id,kind:'analysis',result:analyze(m.input,m.from,m.to,m.weighting)});
  else send({id:m.id,kind:'layout',result:calculateLayout(m.result)});
 }catch(e){send({id:m.id,kind:'error',message:e instanceof Error?e.message:String(e)});}
};
