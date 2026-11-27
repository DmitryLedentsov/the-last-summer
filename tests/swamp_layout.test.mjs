import test from 'node:test';
import assert from 'node:assert/strict';
import {SWAMP,HOUSES,WATER,swampHeight,canWade,reserve} from '../swamp_layout.js';
import {createHeightfield} from '../terrain.js';
const field=createHeightfield({size:SWAMP.size,segments:SWAMP.segments,height:swampHeight});
test('dry spawn and building foundations, wet and deep terrain exist',()=>{assert.ok(canWade(field.sample,...SWAMP.spawn));assert.ok(reserve(...SWAMP.spawn));for(const h of HOUSES)assert.ok(field.sample(h.x,h.z)>WATER);assert.ok(field.values.some(y=>y<WATER-.62));assert.ok(field.values.some(y=>y>WATER+.3));});

test('peat hills rise well above water while broad wet areas remain',()=>{let high=0,low=0;for(const h of field.values){if(h>WATER+1.2)high++;if(h<WATER)low++;}assert.ok(high>field.values.length*.01);assert.ok(low>field.values.length*.19);assert.ok(low<field.values.length*.65);});
