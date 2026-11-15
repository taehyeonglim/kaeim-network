import type {Atlas} from '../types';
export const METHOD_VERSION='sna-1';
export type Weighting='papers'|'fractional';
export type SizeMetric='papers'|'degree'|'betweenness';
export type AnalysisOptions={weighting:Weighting;size:SizeMetric;color:'community'|'topic';layout:'reference'|'period'};
export const defaultOptions:AnalysisOptions={weighting:'papers',size:'degree',color:'community',layout:'reference'};
export function readAnalysisOptions(hash:string):AnalysisOptions{
 const p=new URLSearchParams(hash.replace(/^#/,''));
 return {weighting:p.get('weight')==='fractional'?'fractional':'papers',size:p.get('size')==='papers'?'papers':p.get('size')==='betweenness'?'betweenness':'degree',color:p.get('color')==='topic'?'topic':'community',layout:p.get('layout')==='period'?'period':'reference'};
}
export type AnalysisInput=Pick<Atlas,'meta'|'articles'|'researchers'>;
export type AnalysisNode={id:string;papers:number;articleIds:string[];degree:number;degreeCentrality:number;strength:number;betweenness:number;component:string;community:string|null;crossCommunityPartners:number;topic:string|null};
export type AnalysisEdge={source:string;target:string;articles:string[];paperCount:number;fractionalWeight:number;weight:number;distance:number};
export type Group={id:string;members:string[];articles:string[];topics:{id:string;count:number}[]};
export type AnalysisResult={dataVersion:string;methodVersion:string;from:number;to:number;weighting:Weighting;nodes:AnalysisNode[];edges:AnalysisEdge[];components:Group[];communities:Group[];summary:{papers:number;nodes:number;edges:number;density:number;components:number;largestComponent:number;largestComponentShare:number;isolates:number;communities:number;modularity:number|null};diagnostics:{resolution:number;seedRuns:{seed:number;modularity:number;partition:string}[];selectedSeed:number|null}};
export type Positions2D=Record<string,[number,number]>;
export type Positions3D=Record<string,[number,number,number]>;
export type LayoutResult={positions2d:Positions2D;positions3d:Positions3D};
export type Baseline={dataVersion:string;methodVersion:string;weighting:Weighting;result:AnalysisResult;layout:LayoutResult};
export type WorkerRequest={id:number;kind:'analysis';input:AnalysisInput;from:number;to:number;weighting:Weighting}|{id:number;kind:'layout';result:AnalysisResult};
export type WorkerResponse={id:number;kind:'progress';message:string}|{id:number;kind:'analysis';result:AnalysisResult}|{id:number;kind:'layout';result:LayoutResult}|{id:number;kind:'error';message:string};
