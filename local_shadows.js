// A local directional shadow frustum following the player. Keep sun direction unchanged.
export function shadowAnchor(x,y,z,step=2){return [Math.round(x/step)*step,Math.round(y/step)*step,Math.round(z/step)*step];}
export function createLocalShadows(T,scene,sun,radius=36){
 const cam=sun.shadow.camera,offset=sun.position.clone().sub(sun.target.position),last=new T.Vector3(Infinity,Infinity,Infinity);
 if(!sun.target.parent)scene.add(sun.target);
 Object.assign(cam,{left:-radius,right:radius,top:radius,bottom:-radius,near:1,far:offset.length()+radius*3});
 cam.updateProjectionMatrix();let moves=0;
 function update(position){
  const [x,y,z]=shadowAnchor(position.x,position.y,position.z);
  if(last.x===x&&last.y===y&&last.z===z)return;
  last.set(x,y,z);sun.target.position.copy(last);sun.position.copy(last).add(offset);
  // Static-world builders freeze auto-updates. Explicit matrices are essential here.
  sun.target.updateMatrix();sun.target.updateMatrixWorld(true);sun.updateMatrix();sun.updateMatrixWorld(true);sun.shadow.needsUpdate=true;moves++;
 }
 return {update,stats:()=>({radius,moves,resolution:sun.shadow.mapSize.x})};
}
