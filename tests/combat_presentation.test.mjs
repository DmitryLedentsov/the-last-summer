import test from 'node:test';
import assert from 'node:assert/strict';
import {IMPACT_TIME,impactMotion,recoilMotion,fallMotion,fallDirection,impactSurface} from '../combat_presentation.js';
test('directional response, finite recoil and smooth fall',()=>{const a=impactMotion(.05,1,0),b=impactMotion(.05,-1,0);assert.ok(a.roll<0&&b.roll>0);assert.equal(impactMotion(IMPACT_TIME,1,0).roll,0);assert.ok(recoilMotion(.045)>recoilMotion(.2));assert.equal(recoilMotion(.4),0);assert.ok(fallMotion(.3).drop<fallMotion(.5).drop);assert.ok(fallMotion(.8).settled);const d=fallDirection(1,0,0,2,0);assert.ok(d.x>0&&d.z>0);assert.equal(impactSurface({raySlices:[]}),'wood');assert.equal(impactSurface({surface:'metal'}),'metal');});
