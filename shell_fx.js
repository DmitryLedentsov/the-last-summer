// Small pooled brass casings. Cosmetic only; no world colliders or gameplay RNG.
export function createShellFX(T,scene,height,sound){
 const count=40,mesh=new T.InstancedMesh(new T.CylinderGeometry(.0065,.007,.024,6),new T.MeshStandardMaterial({color:0xbba16a,metalness:.65,roughness:.36}),count),dummy=new T.Object3D();
 mesh.count=0;mesh.frustumCulled=false;mesh.name='brass casings';scene.add(mesh);
 const live=[];const random=Math.random;
 function eject(p,forward,side){if(live.length>=count)live.shift();const velocity=side.clone().multiplyScalar(1.5+random()*.8).addScaledVector(forward,-.35-random()*.3);velocity.y+=1.3+random()*.65;live.push({p:p.clone(),v:velocity,age:0,spin:random()*6.28,turn:10+random()*15,bounces:0,rest:false});}
 function update(dt){let n=0;for(let i=live.length-1;i>=0;i--){const a=live[i];a.age+=dt;if(a.age>9){live.splice(i,1);continue;}
 if(!a.rest){a.v.y-=9.8*dt;a.p.addScaledVector(a.v,dt);a.spin+=dt*a.turn;const y=height(a.p.x,a.p.z)+.009;if(a.p.y<=y){a.p.y=y;if(a.bounces===0)sound('casing',a.p);a.bounces++;a.v.x*=.45;a.v.z*=.45;a.v.y=Math.abs(a.v.y)*.27;if(a.bounces>=3||a.v.y<.22){a.rest=true;a.spin=Math.PI/2;}}}
 dummy.position.copy(a.p);dummy.rotation.set(a.spin,.7+a.turn,.4*a.spin);dummy.scale.setScalar(Math.min(1,(9-a.age)*2));dummy.updateMatrix();mesh.setMatrixAt(n++,dummy.matrix);}
 mesh.count=n;mesh.instanceMatrix.needsUpdate=true;}
 return {eject,update};
}
