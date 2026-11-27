import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionPlants,distanceToChunk,densityFor,seededRandom,createVegetationSystem} from '../vegetation_system.js';
test('partition retains negative coordinates and every point',()=>{const p=[[-1,-1,1,0],[0,0,1,0],[24,0,1,0],[1,1,1,0]];const chunks=partitionPlants(p);assert.equal(chunks.length,3);assert.equal(chunks.flatMap(c=>c.points).length,4);assert.equal(distanceToChunk(0,0,chunks[0]),0);});
test('low preserves 06.9; higher presets grow distance monotonically with stable near density',()=>{
 const ranges=[[12,20,.35],[18,34,.35],[24,46,.45],[30,60,.60]];
 for(let q=0;q<4;q++){const [near,far,mid]=ranges[q];assert.equal(densityFor(0,q,0),1);assert.equal(densityFor(near+.5,q,1),1);assert.equal(densityFor(near+.5,q,0),mid);assert.equal(densityFor(far+1,q,mid),mid);assert.equal(densityFor(far+1,q,0),0);assert.equal(densityFor(far+3,q,1),0);}
});
test('decorative seed is deterministic',()=>{const a=seededRandom(9),b=seededRandom(9);for(let i=0;i<100;i++)assert.equal(a(),b());});
test('LOD changes draw count, not the instance transforms',()=>{
 let uploads=0;const T={Object3D:class{position={set(){}};scale={setScalar(){}};rotation={set(){}};updateMatrix(){}},InstancedMesh:class{constructor(g,m,count){this.count=count;this.instanceMatrix={};}setMatrixAt(){uploads++;}computeBoundingSphere(){}}},meshes=[];
 const v=createVegetationSystem(T,{add(m){meshes.push(m);}},()=>0);
 const template={updateMatrixWorld(){},traverse(fn){fn({isMesh:true,geometry:{clone(){return {applyMatrix4(){return this;}};}},material:{}});}};
 v.add(template,Array.from({length:10},(_,i)=>[i,0,1,0]));
 assert.equal(uploads,10);v.update({x:0,z:0},0);assert.equal(meshes[0].count,10);v.update({x:23,z:6},0);assert.equal(meshes[0].count,3);v.update({x:200,z:0},0);assert.equal(meshes[0].visible,false);assert.equal(uploads,10);
 v.update({x:42,z:6},0);assert.equal(meshes[0].visible,false);
 v.update({x:42,z:6},2);assert.equal(meshes[0].count,4);assert.equal(meshes[0].visible,true);
 v.update({x:42,z:6},0);assert.equal(meshes[0].visible,false);assert.equal(uploads,10);
});
