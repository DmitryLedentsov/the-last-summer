import assert from 'node:assert/strict';
import {bakeBloodNoise} from '../noise_tile.js';
const a=bakeBloodNoise(64),b=bakeBloodNoise(64);assert.equal(a.length,4096);assert.deepEqual(a,b);assert.ok(Math.max(...a)<=224&&Math.max(...a)>100);console.log('PASS deterministic bounded baked noise');