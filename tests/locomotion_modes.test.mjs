import assert from 'node:assert/strict';
import {locomotionMode,legacyLocomotion,analogSpeed,sprintAvailable} from '../character_motion.js';
for(const [stance,sprint,speed,mode,clip,procedural] of [[false,true,4.7,'run','run',false],[false,false,2.65,'walk','run',false],[true,false,1.12,'sneak','idle',true],[true,false,0,'idle','idle',false],[false,false,0,'idle','idle',false],[false,false,.3,'walk','run',false]]){
 const gait=locomotionMode(speed,stance,false,sprint),motion=legacyLocomotion(gait,speed);
 assert.equal(gait,mode);assert.equal(motion.clip,clip);assert.equal(motion.procedural,procedural);
}
assert.equal(locomotionMode(4.7,true,true),'idle');
const exhausted=sprintAvailable(0,false);
const speed=analogSpeed(1,{canSprint:exhausted.available});
assert.equal(locomotionMode(speed,false),'walk');assert.equal(legacyLocomotion('walk',speed).clip,'run');
assert(legacyLocomotion('run',4.7).rate>legacyLocomotion('walk',2.65).rate);
assert.equal(legacyLocomotion('sneak',1.12).rate,1);
console.log('PASS sneak is procedural over idle, never run; walk/run remain original FBX run');
