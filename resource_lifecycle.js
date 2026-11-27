// Dispose each shared object exactly once, including textures referenced by shader uniforms.
export function disposeResources(roots,extras=[]){
 const geometries=new Set(),materials=new Set(),textures=new Set(extras.filter(t=>t?.isTexture)),skeletons=new Set(),instances=new Set(),targets=new Set();
 function inspectMaterial(m){if(!m||materials.has(m))return;materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const u of Object.values(m.uniforms||{})){if(u?.value?.isTexture)textures.add(u.value);}}
 for(const root of roots){if(!root)continue;for(const v of [root.background,root.environment])if(v?.isTexture)textures.add(v);
 root.traverse?.(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])inspectMaterial(m);inspectMaterial(o.customDepthMaterial);inspectMaterial(o.customDistanceMaterial);if(o.skeleton)skeletons.add(o.skeleton);if(o.isInstancedMesh)instances.add(o);if(o.shadow?.map)targets.add(o.shadow.map);});}
 for(const list of [instances,skeletons,geometries,materials,textures,targets])for(const item of list)item.dispose?.();
 return {geometries:geometries.size,materials:materials.size,textures:textures.size,skeletons:skeletons.size};
}
