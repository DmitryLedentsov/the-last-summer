// Freeze only the corpse's cloned rig. Keep original shared materials/geometries intact.
export function bakeCorpse(T,root){
 root.updateMatrixWorld(true);const skinned=[];root.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});const skeletons=new Set();
 for(const src of skinned){const g=src.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();
 for(let i=0;i<p.count;i++){src.getVertexPosition(i,v);p.setXYZ(i,v.x,v.y,v.z);
 if(n){a.fromBufferAttribute(src.geometry.attributes.position,i);b.copy(a).add(new T.Vector3().fromBufferAttribute(src.geometry.attributes.normal,i));src.applyBoneTransform(i,a);src.applyBoneTransform(i,b);b.sub(a).normalize();n.setXYZ(i,b.x,b.y,b.z);}}
 p.needsUpdate=true;if(n)n.needsUpdate=true;g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.morphAttributes={};g.computeBoundingBox();g.computeBoundingSphere();
 const mesh=new T.Mesh(g,src.material);mesh.name=src.name;mesh.position.copy(src.position);mesh.quaternion.copy(src.quaternion);mesh.scale.copy(src.scale);mesh.castShadow=src.castShadow;mesh.receiveShadow=src.receiveShadow;mesh.visible=src.visible;mesh.renderOrder=src.renderOrder;mesh.layers.mask=src.layers.mask;mesh.userData.corpseGeometry=true;
 const parent=src.parent;parent.add(mesh);for(const child of [...src.children])mesh.add(child);src.removeFromParent();skeletons.add(src.skeleton);
 }for(const s of skeletons)s.dispose();root.updateMatrixWorld(true);
}
export function disposeCorpse(root){const skeletons=new Set();root.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);if(o.userData.corpseGeometry)o.geometry.dispose();});for(const s of skeletons)s.dispose();root.removeFromParent();}
