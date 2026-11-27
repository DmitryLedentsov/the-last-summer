import assert from 'node:assert/strict';
import {ADVANCED_FLASH,flashParticle} from '../advanced_muzzle.js';
assert.equal(ADVANCED_FLASH.long,3);assert.equal(ADVANCED_FLASH.side,4);assert.equal(ADVANCED_FLASH.front,1);for(const l of ['long','side','front']){assert.ok(flashParticle(l,0)<flashParticle(l,.7));assert.equal(flashParticle(l,1),1);for(let i=0;i<=100;i++){const a=flashParticle(l,i/100);assert.ok(a>=0&&a<=1);}}console.log('PASS source particle curves and counts');
