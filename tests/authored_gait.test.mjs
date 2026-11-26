import assert from 'node:assert/strict';
import {GAITS,footCycle} from '../authored_gait.js';
assert(GAITS.walk.span>GAITS.sneak.span);
assert(GAITS.walk.lift>GAITS.sneak.lift);
assert(GAITS.walk.lower<GAITS.sneak.lower);
assert(GAITS.sneak.support>GAITS.walk.support);
for(const profile of Object.values(GAITS)){
 for(let i=0;i<1000;i++){
  const p=i/1000,a=footCycle(p,profile),b=footCycle(p+.5,profile);
  assert(a.lift>=0&&a.lift<=profile.lift+1e-8);
  assert(a.lift<1e-8||b.lift<1e-8); // never an aerial phase, unlike running
  if(p<profile.support)assert.equal(a.lift,0);
 }
 assert.equal(footCycle(0,profile).z,footCycle(1,profile).z);
}
console.log('PASS distinct authored gait profiles and continuous ground support');
