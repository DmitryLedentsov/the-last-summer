import assert from 'node:assert/strict';
import {weaponPoseState,boundedAim,poseReach} from '../weapon_pose.js';
const c={roll:0,recover:0,reload:0,cd:0},idle={raise:0,support:0};
const ready=weaponPoseState(c,false,idle,1/60);
assert.equal(ready.state,'ready');assert.equal(ready.raise,0);
const aim=weaponPoseState(c,true,idle,1/60);assert(aim.raise>0&&aim.raise<1);assert(aim.support>0&&aim.support<1);
const fired=weaponPoseState(c,true,aim,1/60,true);assert.equal(fired.state,'fire');assert.equal(fired.raise,1);assert.equal(fired.fireNow,true);assert.equal(aim.fireNow,false);
for(const [flag,state] of [['roll','roll'],['recover','recover'],['reload','reload']]){
 const result=weaponPoseState({...c,[flag]:1},true,fired,1/60);assert.equal(result.state,state);assert(result.support<fired.support);assert(poseReach(result.raise,state)<poseReach(1,'aim'));
}
assert(Math.abs(boundedAim(0,Math.PI))<=Math.PI*.42);
assert(Math.abs(boundedAim(Math.PI-.1,-Math.PI+.1)-(Math.PI+.1))<1e-8);
assert(poseReach(1,'aim')>poseReach(0,'ready'));
console.log('PASS ready/aim/fire/reload/roll transitions and bounded aim direction');
