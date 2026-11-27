import assert from 'node:assert/strict';
import {physicalMuzzle} from '../physical_weapon.js';
const p={x:0,y:0,z:0},a=physicalMuzzle(p,0,{x:0,y:1.4,z:20}),b=physicalMuzzle(p,0,{x:0,y:1.4,z:20},1);assert.ok(a.z>.7&&a.z<.74);assert.ok(a.y>b.y);assert.ok(Number.isFinite(physicalMuzzle(p,0,{x:-.18,y:1.39,z:0}).z));console.log('PASS physical muzzle independent of rig');