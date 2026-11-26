// Scene looks are independent of render resolution. Original materials are never edited.
const PALETTES={
 STYLIZED:{grass:0x788b46,path:0xd9b27e,leaf:0x54783b,bark:0x76513a,rock:0x879a9b,detail:.22},
 DIORAMA:{grass:0x739c48,path:0xc2a078,leaf:0x3c7b43,bark:0x805038,rock:0x8c949d,detail:.38},
 CINEMATIC:{grass:0x485b4d,path:0x88816e,leaf:0x35534c,bark:0x51483e,rock:0x65727a,detail:.85}
};
export function materialRole(material,objectRole=''){
 if(!material.map)return 'plain';
 const key=((material.name||'')+' '+(material.map.name||'')+' '+(material.map.image?.src||'')).toLowerCase();
 if(material.alphaTest>0){
  if(/flower|dandelion|lavender/.test(key+' '+objectRole))return 'detail';
  return 'leaf';
 }
 if(/bark|trunk|wood|timber/.test(key))return 'bark';
 if(/crown|corwn|leaf|grass|reed|plant|bush/.test(key))return 'leaf';
 if(/rock|stone/.test(key+' '+objectRole))return 'rock';
 if(/^(grass|naturegrass|reed|plant|bush)$/.test(objectRole))return 'leaf';
 return 'detail';
}
// Use Three's native vertex color path, with no custom GLSL or texture dependency.
// Same indexed geometry / heightfield / path mask; the original material ignores color.
export function terrainVertexColors(position,trail,grass,path){
 const colors=new Float32Array(position.count*3);
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),z=position.getZ(i);
  const t=Math.max(0,Math.min(1,trail.getX(i))),w=t*t*(3-2*t);
  const variation=Math.sin(x*.28+Math.sin(z*.31))*Math.cos(z*.23);
  const g=1+.10*variation,p=1+.06*variation;
  colors[i*3]=grass.r*g*(1-w)+path.r*p*w;
  colors[i*3+1]=grass.g*g*(1-w)+path.g*p*w;
  colors[i*3+2]=grass.b*g*(1-w)+path.b*p*w;
 }
 return colors;
}
function terrainMaterial(T){
 return new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.98,metalness:0});
}
function applyTerrainPalette(T,terrain,p){
 const geometry=terrain.geometry;
 const values=terrainVertexColors(geometry.attributes.position,geometry.attributes.trailWeight,new T.Color(p.grass),new T.Color(p.path));
 const existing=geometry.getAttribute('color');
 if(existing&&existing.count===values.length/3){existing.array.set(values);existing.needsUpdate=true;}
 else geometry.setAttribute('color',new T.BufferAttribute(values,3));
}
function alternateMaterial(T,source,role,p,style){
 const m=source.clone();
 // Keep cutout alpha, UVs and detail; tint only classified scenery.
 // The native shader also handles texture color space and all lighting correctly.
 if(m.map&&m.color&&p[role]!==undefined){
  const tint=new T.Color(p[role]);
  const normalized=tint.clone().multiplyScalar(1/Math.max(.001,tint.r,tint.g,tint.b));
  m.color.lerp(normalized,style==='CINEMATIC'?.24:.42);
 }
 if(m.isMeshStandardMaterial){m.roughness=style==='DIORAMA'?.8:style==='STYLIZED'?.96:.88;m.metalness=Math.min(m.metalness,.12);}
 if(m.isMeshPhongMaterial){m.shininess=style==='DIORAMA'?16:5;m.specular?.setScalar(style==='DIORAMA'?.07:.025);}
 return m;
}
export function createSceneStyles(T,{scene,renderer,sun,terrain,actors,height}){
 const hemi=scene.children.find(o=>o.isHemisphereLight);
 const original={background:scene.background,fog:scene.fog,exposure:renderer.toneMappingExposure,tone:renderer.toneMapping,
  sunColor:sun.color.clone(),sunIntensity:sun.intensity,hemiColor:hemi?.color.clone(),groundColor:hemi?.groundColor.clone(),hemiIntensity:hemi?.intensity};
 const originals=new WeakMap(),variants=new WeakMap(),generated=new Map();
 const contactMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{opacity:{value:.55}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec2 vUv;uniform float opacity;void main(){float r=length((vUv-.5)*2.0);float a=pow(max(0.0,1.0-r*r),2.5)*opacity;gl_FragColor=vec4(.055,.045,.032,a); #include <colorspace_fragment>\n}'.replace('; #include',';\n#include')});
 const plane=new T.PlaneGeometry(1.7,1.7,5,5);plane.rotateX(-Math.PI/2);
 const contact=actors.map(a=>{const mesh=new T.Mesh(plane.clone(),contactMaterial);mesh.visible=false;mesh.renderOrder=1;scene.add(mesh);return {a,mesh};});
 let active='RETRO';
 function variant(source,role,style,isTerrain){
  let map=variants.get(source);if(!map)variants.set(source,map=new Map());
  const key=style+':'+role;let m=map.get(key);
  if(!m){m=isTerrain?terrainMaterial(T):alternateMaterial(T,source,role,PALETTES[style],style);map.set(key,m);generated.set(m,source);}
  return m;
 }
 function applyObject(o){
  if(!o.isMesh||o.material===contactMaterial||(!o.material))return;
  // Only lit surfaces; particles, tracers, decals and contact shadows retain their own materials.
  if(!originals.has(o)){
   const current=Array.isArray(o.material)?o.material:[o.material];
   if(!current.every(m=>m.isMeshStandardMaterial||m.isMeshPhongMaterial||m.isMeshLambertMaterial))return;
   originals.set(o,Array.isArray(o.material)?current.map(m=>generated.get(m)||m):generated.get(o.material)||o.material);
  }
  const old=originals.get(o);if(active==='RETRO'){o.material=old;return;}
  const one=m=>variant(m,o===terrain?'terrain':materialRole(m,o.userData.lookRole),active,o===terrain);
  o.material=Array.isArray(old)?old.map(one):one(old);
 }
 function apply(style){
  active=style;if(style!=='RETRO')applyTerrainPalette(T,terrain,PALETTES[style]);scene.traverse(applyObject);
  const reset=style==='RETRO';
  if(reset){scene.background=original.background;scene.fog=original.fog;renderer.toneMappingExposure=original.exposure;renderer.toneMapping=original.tone;
   sun.color.copy(original.sunColor);sun.intensity=original.sunIntensity;
   if(hemi){hemi.color.copy(original.hemiColor);hemi.groundColor.copy(original.groundColor);hemi.intensity=original.hemiIntensity;}
  }else{
   const look=style==='STYLIZED'?{fog:0xc9a18b,density:.005,sun:0xffd5a5,power:2.1,hemi:0xf4e4d8,ground:0x9b9475,ambient:1.85,exposure:1.10,tone:T.ACESFilmicToneMapping}:
    style==='DIORAMA'?{fog:0xc5a99c,density:.004,sun:0xffdbad,power:2.25,hemi:0xe5edfa,ground:0xa39b81,ambient:2.05,exposure:1.10,tone:T.ACESFilmicToneMapping}:
    {fog:0x9c9b9b,density:.008,sun:0xffbc92,power:2.15,hemi:0xc8d3e2,ground:0x8c8275,ambient:1.55,exposure:1.10,tone:T.ACESFilmicToneMapping};
   // Preserve the authored sky panorama in every style; no flat pale background.
   scene.background=original.background;scene.fog=new T.FogExp2(look.fog,look.density);
   sun.color.setHex(look.sun);sun.intensity=look.power;
   if(hemi){hemi.color.setHex(look.hemi);hemi.groundColor.setHex(look.ground);hemi.intensity=look.ambient;}
   renderer.toneMapping=look.tone;renderer.toneMappingExposure=look.exposure;
  }
  contactMaterial.uniforms.opacity.value=style==='DIORAMA'?.72:style==='CINEMATIC'?.48:.35;
  for(const {mesh} of contact)mesh.visible=false;
  renderer.shadowMap.needsUpdate=true;
 }
 function update(){
  for(const {a,mesh} of contact){mesh.visible=active!=='RETRO'&&a.alive;if(!mesh.visible)continue;
   const p=a.root.position,attr=mesh.geometry.attributes.position,src=plane.attributes.position;
   mesh.position.set(p.x,p.y+.018,p.z);
   for(let i=0;i<attr.count;i++){const x=src.getX(i),z=src.getZ(i);attr.setXYZ(i,x,height(p.x+x,p.z+z)-p.y,z);}
   attr.needsUpdate=true;mesh.frustumCulled=false;
  }
 }
 return {apply,update};
}
