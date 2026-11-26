import assert from 'node:assert/strict';
import {trunkBandFootprint,combatTreeCollider,hitsTreeRay,hitsCollider} from '../tree_collision.js';
// A trunk near x=0 and overhanging high branch near x=3.
const quad=(x,y0,y1,z)=>[[[x,y0,z],[x+.4,y0,z],[x+.4,y1,z]],[[x,y0,z],[x+.4,y1,z],[x,y1,z]]];
const wood=[...quad(-.2,0,4,-.2),...quad(-.2,0,4,.2),...quad(3,2.2,2.8,-.2),...quad(3,2.2,2.8,.2)];
const c=combatTreeCollider(wood,0,0,1,0,0);
assert(hitsCollider(c,0,0,.32));
assert(!hitsCollider(c,2,0,.32));
assert(hitsTreeRay(c,3.2,2.5,0));
assert(!hitsTreeRay(c,3.2,1.2,0));
const tall=combatTreeCollider(wood,0,0,1.5,0,0);
assert(!hitsCollider(tall,3,0,.32));
const short=combatTreeCollider(wood,0,0,.7,0,0);
assert(hitsCollider(short,2.2,0,.32));
const rotated=combatTreeCollider(wood,10,20,1,Math.PI/2,2);
assert(hitsCollider(rotated,10,20,.32));
assert(hitsTreeRay(rotated,10,4.5,16.8));
assert(!hitsTreeRay(rotated,10,3.2,16.8));
console.log('PASS scale-aware trunk collision and vertical ray bands');
