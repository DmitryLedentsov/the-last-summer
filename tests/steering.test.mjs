import assert from 'node:assert/strict';
import {steeringChoice} from '../duel_perf.js';
function reference(h,t,stuck,v,d,p,a,actors,allowed){let best=null,score=-Infinity;for(const off of [0,.45,-.45,.9,-.9,1.4,-1.4,2,-2,2.7,-2.7,Math.PI]){const x=Math.sin(h+off*t),z=Math.cos(h+off*t),lx=p.x+x*d,lz=p.z+z*d;if(!allowed(lx,lz,.42)||!allowed(p.x+x*.32,p.z+z*.32,.39))continue;let s=-Math.abs(off)*.65;if(stuck>.55&&off===0)s-=2;for(const b of actors)if(b!==a&&b.alive&&Math.hypot(lx-b.root.position.x,lz-b.root.position.z)<.9)s-=2;s+=(x*v.x+z*v.z)*.06;if(s>score){score=s;best={x,z};}}return best;}
let seed=82,r=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
for(let i=0;i<5000;i++){const a={},p={x:r()*8,z:r()*8},v={x:r()*8-4,z:r()*8-4},h=r()*6.28,t=r()<.5?-1:1,stuck=r(),d=.6+r()*2,actors=Array.from({length:12},()=>({alive:r()>.2,root:{position:{x:p.x+r()*4-2,z:p.z+r()*4-2}}})),allowed=(x,z,rr)=>Math.sin(x*4.3+z*1.7)>-.65&&Math.cos(z*4.1-x*2.7)>-.85;assert.deepEqual(steeringChoice(h,t,stuck,v,d,p,a,actors,allowed),reference(h,t,stuck,v,d,p,a,actors,allowed));}
console.log('PASS 5000 deterministic steering equivalence cases');
