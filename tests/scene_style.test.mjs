import assert from 'node:assert/strict';
import {materialRole,terrainVertexColors} from '../scene_style.js';
assert.equal(materialRole({map:{name:'wood'}}),'bark');
assert.equal(materialRole({map:{name:'stone'}}),'rock');
assert.equal(materialRole({map:{},alphaTest:.4},'grass'),'leaf');
assert.equal(materialRole({map:{},alphaTest:.4},'lavender'),'detail');
assert.equal(materialRole({map:{name:'character'}}),'detail');
assert.equal(materialRole({}),'plain');
console.log('PASS material classification');

const position={count:3,getX:()=>0,getZ:()=>0},trail={getX:i=>[0,.5,1][i]};
const colors=terrainVertexColors(position,trail,{r:.1,g:.4,b:.2},{r:.6,g:.3,b:.1});
for(const [i,v] of [.1,.4,.2,.35,.35,.15,.6,.3,.1].entries())assert(Math.abs(colors[i]-v)<1e-6);
assert(colors.every(Number.isFinite));
console.log('PASS native terrain vertex colors, grass / transition / path');
