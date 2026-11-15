import fs from 'node:fs';
import {analyze} from '../src/sna/engine';
import {calculateLayout} from '../src/sna/layout';
import {METHOD_VERSION} from '../src/sna/types';
import type {Atlas} from '../src/types';
const root=new URL('../public/data/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',root),'utf8')) as Atlas;
for(const weighting of ['papers','fractional'] as const){
 const t=performance.now(),result=analyze(atlas,atlas.meta.minYear,atlas.meta.maxYear,weighting),analysisMs=performance.now()-t;
 const layout=calculateLayout(result);
 fs.writeFileSync(new URL(`sna-${weighting}.json`,root),JSON.stringify({dataVersion:atlas.meta.version,methodVersion:METHOD_VERSION,weighting,result,layout})+'\n');
 console.log(JSON.stringify({weighting,analysisMs:Math.round(analysisMs),totalMs:Math.round(performance.now()-t),...result.summary}));
}
