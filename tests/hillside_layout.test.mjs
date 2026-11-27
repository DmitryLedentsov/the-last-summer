import test from 'node:test';
import assert from 'node:assert/strict';
import {HILLSIDE,SERPENTINE,groundHeight,roadWeight,reserveTree} from '../hillside_layout.js';
import {createHeightfield} from '../terrain.js';
import {MAPS} from '../map_registry.js';
const field=createHeightfield({size:HILLSIDE.size,segments:240,height:groundHeight});
test('sunset and original demo use distinct builders',()=>{assert.equal(MAPS.sunset.builder,'hillside');assert.equal(MAPS.demo.builder,'forest');assert.equal(MAPS.mist.builder,'forest');});
test('neighborhood is flat and mountain is at least 30m above spawn',()=>{assert.ok(Math.abs(field.sample(...HILLSIDE.spawn)-.65)<.1);assert.ok(field.sample(...HILLSIDE.summit)-field.sample(...HILLSIDE.spawn)>30);for(const h of HILLSIDE.houses)assert.ok(Math.abs(field.sample(h.x,h.z)-.65)<.1);});
test('switchback stays within play area, is graded into the actual terrain and keeps trees off the road',()=>{let rise=0,length=0;for(let i=1;i<SERPENTINE.length;i++){const a=SERPENTINE[i-1],b=SERPENTINE[i],dist=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(dist/.4);length+=dist;let prev;for(let j=0;j<=n;j++){const t=j/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,h=field.sample(x,z);assert.ok(Math.abs(x)<HILLSIDE.limit&&Math.abs(z)<HILLSIDE.limit);assert.ok(roadWeight(x,z)>.95);assert.ok(reserveTree(x,z));assert.ok(Math.abs(h-(a[2]+(b[2]-a[2])*t))<1.5);if(prev!==undefined)assert.ok(Math.abs(h-prev)/(dist/n)<.45);prev=h;}}assert.ok(length>300);});
