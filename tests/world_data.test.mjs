import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialGrid} from '../spatial_grid.js';
import {hitsCollider} from '../tree_collision.js';
import {createWorldData,serializeWorldData} from '../world_data.js';
import {createHeightfield} from '../terrain.js';
test('spatial query agrees with brute-force colliders around negative and positive boundaries',()=>{const g=createSpatialGrid(),c=[{x:-5.2,z:0,r:.9},{x0:1,x1:9,z0:-4,z1:1},{x:10,z:10,r:1}];c.forEach(g.insert);for(let x=-12;x<15;x+=.19)for(let z=-7;z<13;z+=.23)assert.equal(g.at(x,z).some(o=>hitsCollider(o,x,z,.48)),c.some(o=>hitsCollider(o,x,z,.48)));});
test('ray bounds are indexed and insertion order is retained',()=>{const g=createSpatialGrid();const c={x0:0,x1:1,z0:0,z1:1,rayBounds:{x0:-6,x1:6,z0:0,z1:1}},b={x:0,z:0,r:1};g.insert(c);g.insert(b);assert.deepEqual(g.at(0,0),[c,b]);assert.deepEqual(g.at(-5.5,0),[c]);});
test('physical snapshot round trips exact sampled heights and collision data',()=>{const field=createHeightfield({size:8,segments:4,height:(x,z)=>Math.sin(x)+z});const colliders=[{x:1,z:2,r:.3,top:4}];const data=createWorldData({id:'sunset',revision:'x',level:{limit:4,spawn:[0,0],yaw:0},field,colliders});const snapshot=JSON.parse(JSON.stringify(serializeWorldData(data)));assert.deepEqual(snapshot.heightfield.values,Array.from(field.values));assert.deepEqual(snapshot.colliders,colliders);assert.notEqual(snapshot.colliders,colliders);assert.equal(snapshot.schema,1);});
