import assert from 'node:assert/strict';
import {IDLE_DELAY,idleActivity,advanceIdle,makeQuietIdle} from '../idle_animation.js';
let t=0;for(let i=0;i<119;i++)t=advanceIdle(t,1/60,false);assert(t<IDLE_DELAY);
t=advanceIdle(t,1/60,false);assert.equal(t,IDLE_DELAY);
for(const event of [{commandSpeed:.2},{actualSpeed:.2},{turnRate:.3},{aim:true},{zoom:true},{fire:true},{reload:true},{roll:true},{recover:true},{hit:true}]){
 assert(idleActivity(event));assert.equal(advanceIdle(t,1/60,idleActivity(event)),0);
}
assert.equal(idleActivity({}),false);
const track=(name,values,size)=>({name,values:new Float32Array(values),times:new Float32Array([0,.5]),getValueSize:()=>size,clone(){return track(name,values,size);}});
const head=track('RigHead.quaternion',[0,.5,0,.866,0,-.5,0,.866],4),hip=track('hips.position',[0,1,0,0,1.1,0],3);
const T={AnimationClip:class{constructor(name,duration,tracks){Object.assign(this,{name,duration,tracks});}}};
const clip=makeQuietIdle(T,{tracks:[head,hip]},{getObjectByName:name=>name==='RigHead'?{name,quaternion:{toArray:()=>[0,0,0,1]}}:null},null);
assert.equal(clip.name,'__quiet');assert.equal(clip.tracks[0].values[1],0);assert.equal(clip.tracks[0].values[7],1);
assert.equal(clip.tracks[1].values[1],1);assert.equal(clip.tracks[1].values[4],1);assert.equal(head.values[1],.5);
console.log('PASS two-second idle gate, activity cancellation, static neutral pose, source clips unchanged');
