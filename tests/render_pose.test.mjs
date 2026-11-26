import assert from 'node:assert/strict';
import {createRenderPose} from '../render_pose.js';
class Value{
 constructor(v){this.v=v} clone(){return new Value(this.v)} copy(x){this.v=x.v;return this} lerp(x,a){this.v+=(x.v-this.v)*a;return this} slerp(x,a){return this.lerp(x,a)}
}
const makeNode=()=>({matrixAutoUpdate:true,position:new Value(0),rotation:new Value(0),quaternion:new Value(0),scale:new Value(1)});
const root=makeNode(),bone=makeNode();root.traverse=fn=>{fn(root);fn(bone)};root.updateMatrixWorld=()=>{};
const pose=createRenderPose(root);
pose.capturePrevious();root.position.v=2;bone.quaternion.v=1;bone.scale.v=.8;
pose.apply(.25);assert.equal(root.position.v,.5);assert.equal(bone.quaternion.v,.25);assert(Math.abs(bone.scale.v-.95)<1e-8);
pose.restore();assert.equal(root.position.v,2);assert.equal(bone.quaternion.v,1);assert.equal(bone.scale.v,.8);
pose.capturePrevious();root.position.v=4;pose.apply(.5);assert.equal(root.position.v,3);pose.restore();assert.equal(root.position.v,4);
pose.capturePrevious();pose.apply(0);assert.equal(root.position.v,4);pose.restore();
console.log('PASS render interpolation, restore simulation transforms, reset');

// Model Three.js' XYZ Euler canonicalization when writing a quaternion.
// A pure Y turn beyond PI/2 may be represented as (PI, PI-y, PI).
const heading=makeNode();heading.traverse=fn=>fn(heading);heading.updateMatrixWorld=()=>{};
class Euler {
 constructor(x,y,z){Object.assign(this,{x,y,z})}
 clone(){return new Euler(this.x,this.y,this.z)}
 copy(e){Object.assign(this,{x:e.x,y:e.y,z:e.z});return this}
}
heading.rotation=new Euler(0,Math.PI,0);
const write=heading.quaternion.copy.bind(heading.quaternion);
heading.quaternion.copy=q=>{write(q);heading.rotation.copy(new Euler(Math.PI,0,Math.PI));return heading.quaternion;};
const headingPose=createRenderPose(heading);
headingPose.capturePrevious();heading.rotation.y=3.4;heading.quaternion.v=3.4;
headingPose.apply(.5);assert.equal(heading.rotation.x,Math.PI);
headingPose.restore();assert.equal(heading.rotation.x,0);assert.equal(heading.rotation.y,3.4);assert.equal(heading.rotation.z,0);
headingPose.capturePrevious();heading.rotation.y+=.1;headingPose.apply(.25);headingPose.restore();
assert.equal(heading.rotation.y,3.5);
console.log('PASS root heading survives render interpolation without Euler canonicalization');
