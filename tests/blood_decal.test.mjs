import test from 'node:test';
import assert from 'node:assert/strict';
import {DECAL,decalMaskSize,decalRadial} from '../blood_decal.js';
test('archive decal grows from compact spot to irregular pool without exceeding patch',()=>{assert.equal(decalMaskSize(0),4);assert.ok(decalMaskSize(1)>decalMaskSize(2));assert.ok(Math.abs(decalMaskSize(4)-DECAL.endSize)<1e-8);assert.equal(decalRadial(.5,.5,DECAL.endSize),1);assert.equal(decalRadial(0,.5,DECAL.endSize),0);assert.ok(decalRadial(.69,.5,DECAL.endSize)>decalRadial(.69,.5,4));assert.equal(DECAL.capacity,100);assert.equal(DECAL.life,65);});
