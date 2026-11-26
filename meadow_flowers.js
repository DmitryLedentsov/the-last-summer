export function addMeadowFlowers(THREE,scene,level,height,free){
 // Separate deterministic seed: flower patches do not reshuffle the forest.
 let seed=915061;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const types=[{petal:'#ded4b3',shade:'#b8b39d',center:'#c7a344',h:.31},{petal:'#c17b66',shade:'#8c4945',center:'#543f35',h:.38},{petal:'#a39ac8',shade:'#6d6b9f',center:'#d1bda1',h:.43}];
 const patches=[[-6,40,3.5,90],[3,35,3.3,80],[-7,28,3.6,80],[5,21,4.8,105],[-9,14,4,80],[-3,5,4,75],[-16,-5,5,105],[-4,-22,5,85],[13,-28,3.6,95],[22,-27,4.1,90],[36,-29,4.7,95],[48,-29,4,65],[18,6,7,135],[-27,-10,6,105]];
 for(let type=0;type<types.length;type++){
  const {petal,shade,center,h}=types[type],cv=document.createElement('canvas');cv.width=cv.height=32;const ctx=cv.getContext('2d');
  const rect=(c,x,y,w=1,k=1)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,k);};
  const flower=(x,y)=>{rect(shade,x-4,y-1,9,3);rect(shade,x-1,y-4,3,9);rect(petal,x-3,y-2,7,4);rect(petal,x-2,y-3,5,7);rect(center,x-1,y-1,3,3);};
  rect('#465f35',15,8,2,24);rect('#6b7945',16,12,1,18);rect('#526d3c',10,20,5,2);rect('#526d3c',8,18,4,2);rect('#536b3e',17,23,5,2);rect('#6e8050',21,21,4,2);rect('#526d3c',12,12,2,10);flower(16,7);if(type===2){flower(9,12);rect('#4e683a',9,16,1,6);}
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestMipmapLinearFilter;
  const geo=new THREE.BufferGeometry(),w=h*.78;geo.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,0,0,w/2,0,0,w/2,h,0,-w/2,h,0,0,0,-w/2,0,0,w/2,0,h,w/2,0,h,-w/2],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1],2));geo.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);geo.computeVertexNormals();
  const points=[];for(let j=0;j<patches.length;j++){const [cx,cz,r,n]=patches[j];const count=Math.round(n*(type===j%3?.62:.19));for(let i=0;i<count*4&&points.length<4000;i++){if(i>=count&&rnd()<.7)continue;const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*r,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(level.distance(x,z)<1.15||level.road(x,z)<2.4||level.reserved(x,z)||!free(x,z,.07))continue;points.push([x,z,.7+rnd()*.65,rnd()*Math.PI]);}}
  if(!points.length)continue;const mat=new THREE.MeshLambertMaterial({map:tex,alphaTest:.5,side:THREE.DoubleSide}),mesh=new THREE.InstancedMesh(geo,mat,points.length),o=new THREE.Object3D();points.forEach(([x,z,s,a],i)=>{o.position.set(x,height(x,z)-.015,z);o.rotation.y=a;o.scale.setScalar(s);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
 }
}
