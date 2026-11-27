import test from 'node:test';
import assert from 'node:assert/strict';
import {splitStaticInstances} from '../duel_perf.js';
test('spatial split preserves all instances and associated tree points, including distant trees and negative cells',()=>{
 class M{constructor(x=0,z=0){this.elements=Array(16).fill(0);this.elements[12]=x;this.elements[14]=z;}clone(){return new M(this.elements[12],this.elements[14]);}}
 const transform=()=>({copy(){}});class Mesh{constructor(g,m,count){Object.assign(this,{geometry:g,material:m,count,isInstancedMesh:true,instanceMatrix:{},position:transform(),quaternion:transform(),scale:transform(),layers:{mask:1},values:[],colors:[]});}setMatrixAt(i,m){this.values[i]=m.clone();}getMatrixAt(i,m){m.elements=[...this.values[i].elements];}getColorAt(i,c){c.value=this.colors[i];}setColorAt(i,c){this.colors[i]=c.value;}computeBoundingSphere(){this.bounded=true;}dispose(){this.disposed=true;}}
 const T={Matrix4:M,InstancedMesh:Mesh,Color:class{}},old=new Mesh({}, {},40);
 old.castShadow=true;old.receiveShadow=true;old.visible=true;old.frustumCulled=true;old.customDepthMaterial={id:1};old.instanceColor={};old.layers.mask=3;
 const points=Array.from({length:40},(_,i)=>[i*6-120,i%2?70:-70,1,i]);
 points.forEach(([x,z],i)=>{old.setMatrixAt(i,new M(x,z));old.colors[i]=i;});
 const scene={children:[old],add(m){this.children.push(m);},remove(m){this.children=this.children.filter(x=>x!==m);}};
 const batches=splitStaticInstances(T,scene,[{mesh:old,points}],64);
 assert.ok(old.disposed);assert.equal(batches.flatMap(b=>b.points).length,40);
 const seen=[];for(const {mesh,points:ps} of batches){assert.ok(mesh.bounded&&mesh.castShadow&&mesh.frustumCulled&&mesh.visible);assert.equal(mesh.customDepthMaterial,old.customDepthMaterial);assert.equal(mesh.layers.mask,3);ps.forEach((p,i)=>{assert.equal(mesh.values[i].elements[12],p[0]);assert.equal(mesh.values[i].elements[14],p[1]);assert.equal(mesh.colors[i],p[3]);seen.push(p[3]);});}
 assert.deepEqual(seen.sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i));
});
