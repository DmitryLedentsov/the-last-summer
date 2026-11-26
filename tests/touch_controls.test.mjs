import assert from 'node:assert/strict';
import {stickVector,mergeMotion,stickIntent} from '../touch_controls.js';
import {createPlayerInput,playerMotion} from '../player_input.js';
assert.deepEqual(stickVector(0,0,50),{x:0,y:0});assert.equal(stickVector(2,0,50).x,0);assert.equal(stickVector(100,0,50).x,1);assert.equal(stickVector(0,-100,50).y,1);assert(Math.hypot(...Object.values(stickVector(100,100,50)))<=1.00001);assert.deepEqual(mergeMotion(0,0,{x:.5,y:.25}),{f:.25,r:.5});assert.deepEqual(mergeMotion(0,0,{x:1,y:.3},true),{f:.3,r:0});assert(Math.abs(Math.hypot(...Object.values(mergeMotion(1,1,null)))-1)<1e-8);const input=createPlayerInput();input.requestRoll(-1,1);assert.equal(input.rollAt(1.1),-1);input.consumeRoll();assert.equal(input.rollAt(1.2),0);input.requestRoll(1,2);assert.equal(input.rollAt(2.5),0);input.requestRoll(0,3);assert.equal(input.rollAt(3),0);input.down('Space',4);input.down('KeyD',4.1);assert.equal(input.rollAt(4.2),1);assert.equal(playerMotion(input.keys).r,0);

assert.deepEqual(stickIntent(0,.5,false),{sprint:false,rollSide:0});
assert.deepEqual(stickIntent(0,.9,false),{sprint:true,rollSide:0});
assert.equal(stickIntent(.8,0,false,{sprint:true,rollSide:0}).sprint,true);
assert.equal(stickIntent(.7,0,false,{sprint:true,rollSide:0}).sprint,false);
assert.deepEqual(stickIntent(-1,0,true),{sprint:false,rollSide:-1});
assert.deepEqual(stickIntent(1,0,true),{sprint:false,rollSide:1});
assert.equal(stickIntent(.65,.65,true).rollSide,0);
assert.equal(stickIntent(.5,0,true,{rollSide:1}).rollSide,1);
assert.equal(stickIntent(.2,0,true,{rollSide:1}).rollSide,0);
assert.equal(stickIntent(0,1,true).sprint,false);
console.log('PASS analog sprint and lateral roll hysteresis');
