import test from 'node:test';
import assert from 'node:assert/strict';
import {SWAMP,HOUSES,WATER,swampHeight,canWade,reserve} from '../swamp_layout.js';
import {createHeightfield} from '../terrain.js';
const field=createHeightfield({size:SWAMP.size,segments:280,height:swampHeight});
test('dry spawn and building foundations, wet and deep terrain exist',()=>{assert.ok(canWade(field.sample,...SWAMP.spawn));assert.ok(reserve(...SWAMP.spawn));for(const h of HOUSES)assert.ok(field.sample(h.x,h.z)>WATER);assert.ok(field.values.some(y=>y<WATER-.62));assert.ok(field.values.some(y=>y>WATER+.3));});
