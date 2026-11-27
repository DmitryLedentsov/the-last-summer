// Batch simple authored props once, with bounded spatial groups. No collider changes.
export function batchStaticProps(T,scene,size=64){
 scene.updateMatrixWorld(true);const groups=new Map();
 scene.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||Array.isArray(o.material)||!o.material||!o.visible)return;
  const g=o.geometry,p=g.parameters;if(!p)return;let shape,scale;
  if(g.type==='BoxGeometry'&&p.widthSegments===1&&p.heightSegments===1&&p.depthSegments===1){shape='box';scale=new T.Vector3(p.width,p.height,p.depth);}
  else if(g.type==='CylinderGeometry'&&p.radiusTop===p.radiusBottom&&p.heightSegments===1&&p.thetaLength===Math.PI*2&&p.thetaStart===0&&!p.openEnded){shape='cylinder-'+p.radialSegments;scale=new T.Vector3(p.radiusTop,p.height,p.radiusTop);}
  else return;
  if(o.matrixWorld.determinant()<=0)return;
  const e=o.matrixWorld.elements,k=shape+':'+o.material.uuid+':'+o.castShadow+':'+o.receiveShadow+':'+o.renderOrder+':'+o.layers.mask+':'+Math.floor(e[12]/size)+':'+Math.floor(e[14]/size);
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push({o,scale});
 });
 let source=0,batches=0;
 for(const list of groups.values()){
  if(list.length<2)continue;
  const first=list[0].o,g=first.geometry.type==='BoxGeometry'?new T.BoxGeometry(1,1,1):new T.CylinderGeometry(1,1,1,first.geometry.parameters.radialSegments);
  const mesh=new T.InstancedMesh(g,first.material,list.length),m=new T.Matrix4();
  mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;mesh.name='static-props';
  list.forEach(({o,scale},i)=>{m.copy(o.matrixWorld).scale(scale);mesh.setMatrixAt(i,m);o.removeFromParent();});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);source+=list.length;batches++;
 }
 return {source,batches,saved:source-batches};
}
