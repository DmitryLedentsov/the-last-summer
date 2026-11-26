import test from 'node:test';
import assert from 'node:assert/strict';
import {MALORIAN,socketPoint} from '../malorian_weapon.js';
test('grip and muzzle are in common socket space',()=>{assert.ok(socketPoint(MALORIAN.grip).every(v=>v===0));const [x,y,z]=socketPoint(MALORIAN.muzzle);assert.ok(x>.24&&x<.27);assert.ok(y>.05&&y<.08);assert.ok(Math.abs(z)<.01);});
