// Visual-only ground cover: deterministic placement, spatial batches and density LOD.
// No colliders, no wind, no per-frame instance matrix uploads.
export const VEGETATION_PROFILE=Object.freeze({near:12,far:20,mid:.35});
export const VEGETATION_PROFILES=Object.freeze(Array(4).fill(VEGETATION_PROFILE));
export function seededRandom(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function partitionPlants(points,size=24){
 const chunks=new Map();
 for(const p of points){const x=Math.floor(p[0]/size),z=Math.floor(p[1]/size),k=x+':'+z;let c=chunks.get(k);if(!c)chunks.set(k,c={x:x*size,z:z*size,size,points:[]});c.points.push(p);}
 return [...chunks.values()];
}
export function distanceToChunk(x,z,c){return Math.hypot(Math.max(c.x-x,0,x-c.x-c.size),Math.max(c.z-z,0,z-c.z-c.size));}
export function densityFor(distance,quality=1,previous=1){
 const p=VEGETATION_PROFILE,h=1.5;
 // Keep the entire near-field density identical across quality presets.
 if(distance<=p.near+(previous===1?h:0))return 1;
 if(distance<=p.far+(previous>0?h:0))return p.mid;
 return 0;
}
export function createVegetationSystem(T,scene,height,{chunkSize=12}={}){
 const chunks=[],dummy=new T.Object3D();let lastX=Infinity,lastZ=Infinity,lastQuality=-1,active=0,total=0,activeChunks=0,activeMeshes=0;
 function add(template,points){
  if(!template||!points.length)return;
  template.updateMatrixWorld(true);
  const parts=[];template.traverse(n=>{if(n.isMesh){const g=n.geometry.clone().applyMatrix4(n.matrixWorld);parts.push({geometry:g,material:n.material});}});
  if(!parts.length)return;
  for(const c of partitionPlants(points,chunkSize)){
   const meshes=parts.map(({geometry,material})=>{const m=new T.InstancedMesh(geometry,material,c.points.length);
    c.points.forEach(([x,z,s,a],i)=>{dummy.position.set(x,height(x,z)-.018,z);dummy.scale.setScalar(s);dummy.rotation.set(0,a,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});
    m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();m.castShadow=false;m.receiveShadow=true;m.matrixAutoUpdate=false;m.name='ground-cover';m.visible=false;scene.add(m);return m;});
   chunks.push({...c,points:undefined,capacity:c.points.length,meshes,density:0});total+=c.points.length;
  }
  lastQuality=-1;
 }
 function update(position,quality=1){
  const {x,z}=position;if(lastQuality!==-1&&Math.hypot(x-lastX,z-lastZ)<1.5)return;
  lastX=x;lastZ=z;lastQuality=quality;active=activeChunks=activeMeshes=0;
  for(const c of chunks){const d=densityFor(Math.hypot(x-c.x-c.size/2,z-c.z-c.size/2),quality,c.density),count=d>0?Math.max(1,Math.floor(c.capacity*d)):0;
   if(d!==c.density){for(const m of c.meshes){m.count=count;m.visible=count>0;}c.density=d;}active+=count;if(count){activeChunks++;activeMeshes+=c.meshes.length;}
  }
 }
 return {add,update,stats:()=>({chunks:chunks.length,total,active,activeChunks,activeMeshes})};
}
