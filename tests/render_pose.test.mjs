import assert from 'node:assert/strict';
import {createRenderPose} from '../render_pose.js';
class Value{
 constructor(v){this.v=v} clone(){return new Value(this.v)} copy(x){this.v=x.v;return this} lerp(x,a){this.v+=(x.v-this.v)*a;return this} slerp(x,a){return this.lerp(x,a)}
}
const makeNode=()=>({matrixAutoUpdate:true,position:new Value(0),quaternion:new Value(0),scale:new Value(1)});
const root=makeNode(),bone=makeNode();root.traverse=fn=>{fn(root);fn(bone)};root.updateMatrixWorld=()=>{};
const pose=createRenderPose(root);
pose.capturePrevious();root.position.v=2;bone.quaternion.v=1;bone.scale.v=.8;
pose.apply(.25);assert.equal(root.position.v,.5);assert.equal(bone.quaternion.v,.25);assert(Math.abs(bone.scale.v-.95)<1e-8);
pose.restore();assert.equal(root.position.v,2);assert.equal(bone.quaternion.v,1);assert.equal(bone.scale.v,.8);
pose.capturePrevious();root.position.v=4;pose.apply(.5);assert.equal(root.position.v,3);pose.restore();assert.equal(root.position.v,4);
pose.capturePrevious();pose.apply(0);assert.equal(root.position.v,4);pose.restore();
console.log('PASS render interpolation, restore simulation transforms, reset');
