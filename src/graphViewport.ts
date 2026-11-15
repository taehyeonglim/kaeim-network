import type Graph from 'graphology';
import type Sigma from 'sigma';

export const viewportScale=(host:HTMLElement)=>Math.max(.45,Math.min(1,Math.min(host.clientWidth,host.clientHeight)/700));

// Sigma listens to window resizing; drawers also resize the canvas without a window event.
// Only display size changes. Graph coordinates and metric ratios are retained.
export function observeGraphViewport(host:HTMLElement,graph:Graph,renderer:Sigma,initialScale:number){
 const baseSizes=new Map(graph.mapNodes((id,a)=>[id,a.size/initialScale] as const));
 const observer=new ResizeObserver(()=>{
  if(!host.clientWidth||!host.clientHeight)return;
  const scale=viewportScale(host);
  graph.updateEachNodeAttributes((id,a)=>({...a,size:baseSizes.get(id)!*scale}),{attributes:['size']});
  renderer.setSetting('labelRenderedSizeThreshold',8*scale);
  renderer.resize();renderer.refresh();
 });
 observer.observe(host);
 return ()=>observer.disconnect();
}
