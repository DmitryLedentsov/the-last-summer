// Original 07.4 low-poly blood stamp (before BloodFX). One instanced draw, at most 100 marks.
export function createSimpleBloodDecals(T,scene,height){
 const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),rnd=Math.random,dummy=new T.Object3D(),marks=[],markMax=100;
 const stainMat=new T.MeshBasicMaterial({color:0x652520,transparent:true,opacity:.78,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
 const stamp=new T.BufferGeometry(),verts=[0,0,0];for(let i=0;i<13;i++){const a=i*Math.PI*2/12,r=.63+rnd()*.37;verts.push(Math.cos(a)*r,0,Math.sin(a)*r);}stamp.setAttribute('position',new T.Float32BufferAttribute(verts,3));stamp.setIndex(Array.from({length:12},(_,i)=>[0,i+1,i+2]).flat());stamp.computeVertexNormals();
 const stains=new T.InstancedMesh(stamp,stainMat,markMax);stains.count=0;stains.frustumCulled=false;stains.visible=false;scene.add(stains);
 function add(p,size=.35){if(marks.length>=markMax)marks.shift();const dx=(height(p.x+.2,p.z)-height(p.x-.2,p.z))/.4,dz=(height(p.x,p.z+.2)-height(p.x,p.z-.2))/.4;const q=new T.Quaternion().setFromUnitVectors(v(0,1,0),v(-dx,1,-dz).normalize());q.multiply(new T.Quaternion().setFromAxisAngle(v(0,1,0),rnd()*6));marks.push({p:v(p.x,height(p.x,p.z)+.022,p.z),s:size,q,t:65});if(stains.visible)sync();}
 function sync(){marks.forEach((p,i)=>{dummy.position.copy(p.p);dummy.quaternion.copy(p.q);dummy.scale.setScalar(p.s*Math.min(1,p.t/3));dummy.updateMatrix();stains.setMatrixAt(i,dummy.matrix);});stains.count=marks.length;stains.instanceMatrix.needsUpdate=true;}
 function update(dt){for(let i=marks.length-1;i>=0;i--){marks[i].t-=dt;if(marks[i].t<=0)marks.splice(i,1);}if(stains.visible)sync();}
 function setVisible(value){stains.visible=!!value;if(stains.visible)sync();}
 return {add,update,setVisible};
}
