// Shared presentation tokens for DOM, Sigma and Three. Source data keeps its original colors.
export const graphTheme={background:'#07111f',label:'#eef4fc',muted:'#33465f',edge:'#304b68',strongEdge:'#587b9c',selectedEdge:'#75d9f5',context:'#52647b'};
export function displayColor(color?:string){
 const hex=(color||'#8393a4').replace('#','');
 if(!/^[0-9a-f]{6}$/i.test(hex))return color||'#8393a4';
 return '#'+[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.73+255*.27).toString(16).padStart(2,'0')).join('');
}
type LabelData={x:number;y:number;size:number;color:string;label?:string|null;highlighted?:boolean};
export function drawGraphLabel(ctx:CanvasRenderingContext2D,data:LabelData){
 if(!data.label)return;
 ctx.font='500 13px system-ui, sans-serif';
 if(data.highlighted){ctx.beginPath();ctx.arc(data.x,data.y,data.size+4,0,2*Math.PI);ctx.strokeStyle=graphTheme.selectedEdge;ctx.lineWidth=1.5;ctx.stroke();}
 const x=data.x+data.size+6,y=data.y+4;
 ctx.lineWidth=4;ctx.strokeStyle=graphTheme.background;ctx.strokeText(data.label,x,y);ctx.fillStyle=graphTheme.label;ctx.fillText(data.label,x,y);
}
export function drawGraphHover(ctx:CanvasRenderingContext2D,data:LabelData){drawGraphLabel(ctx,{...data,highlighted:true});}
