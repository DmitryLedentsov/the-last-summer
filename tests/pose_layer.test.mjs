import assert from 'node:assert/strict';
import {createPoseLayer} from '../character_motion.js';
class Q{constructor(value){this.value=value}clone(){return new Q(this.value)}copy(q){this.value=q.value;return this}}
const bone={quaternion:new Q(0)},layer=createPoseLayer([bone,bone,null]);
bone.quaternion.value=1;layer.capture();bone.quaternion.value=8;layer.restore();assert.equal(bone.quaternion.value,1);
bone.quaternion.value=2;layer.capture();bone.quaternion.value=9;layer.restore();assert.equal(bone.quaternion.value,2);
console.log('PASS isolated mixer pose restores last captured FK, not rest pose or IK output');
