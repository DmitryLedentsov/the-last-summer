import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COURTYARD,isPaved,canScatter} from '../courtyard_layout.js';
import {hitsCollider} from '../tree_collision.js';
test('courtyard vegetation uses world bounds, paved surfaces and colliders',()=>{
 assert.ok(isPaved(0,25));
 assert.equal(canScatter(0,25,[],hitsCollider),false);
 assert.equal(canScatter(40,0,[],hitsCollider),false);
 assert.equal(canScatter(-15,-12,[],hitsCollider),true);
 assert.equal(canScatter(-15,-12,[{x:-15,z:-12,r:1}],hitsCollider),false);
});
test('spawn and center are connected by a clear path between planned houses',()=>{
 const boxes=COURTYARD.houses.map(h=>{const rot=Math.abs(Math.sin(h.rot))>.5,w=rot?h.d:h.w,d=rot?h.w:h.d;return {x0:h.x-w/2,x1:h.x+w/2,z0:h.z-d/2,z1:h.z+d/2};});
 for(let z=COURTYARD.spawn[1];z>=0;z-=.25)assert.ok(!boxes.some(c=>hitsCollider(c,COURTYARD.spawn[0],z,.48)));
});
test('scene builder has no reference to deleted first-person movement controller',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bwalkable\s*\(/);
 assert.doesNotMatch(source,/\bsetAnimationLoop\s*\(/);
 assert.match(source,/canScatter\(x,z,colliders,hitsCollider\)/);
 assert.match(source,/export const world=/);
});
