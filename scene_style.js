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
function terrainMaterial(T,original,p){
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.98});
 const grass=new T.Color(p.grass),path=new T.Color(p.path);
 m.onBeforeCompile=s=>{
  s.uniforms.lookGrass={value:grass};s.uniforms.lookPath={value:path};
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float trailWeight; varying float lookTrail; varying vec3 lookPos;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nlookTrail=trailWeight; lookPos=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 lookGrass,lookPath; varying float lookTrail; varying vec3 lookPos;')
   .replace('#include <map_fragment>',[
    'float patch=sin(lookPos.x*.28+sin(lookPos.z*.31))*cos(lookPos.z*.23);',
    'float detail=sin(lookPos.x*3.1+lookPos.z*1.8)*sin(lookPos.z*2.7-lookPos.x*1.3);',
    'vec3 baseGrass=lookGrass*(1.0+.12*patch+.025*detail);',
    'vec3 basePath=lookPath*(1.0+.07*patch+.018*detail);',
    'diffuseColor.rgb *= mix(baseGrass,basePath,smoothstep(0.0,1.0,lookTrail));'
   ].join('\n'));
 };
 m.customProgramCacheKey=()=> 'terrain-look-v1';
 return m;
}
function alternateMaterial(T,source,role,p,style){
 const m=source.clone();
 // Keep the original texture alpha, UVs and identifying details (characters, windows, signs).
 if(m.map&&m.color&&role!=='plain'){
  const tint=new T.Color(p[role]??0xffffff);
  const detail=role==='detail'?(style==='STYLIZED'?.65:style==='DIORAMA'?.78:1):p.detail;
  m.onBeforeCompile=s=>{
   s.uniforms.lookTint={value:tint};s.uniforms.lookDetail={value:detail};
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 lookTint; uniform float lookDetail;')
    .replace('#include <map_fragment>',[
     '#ifdef USE_MAP',
     'vec4 sampledDiffuseColor=texture2D(map,vMapUv);',
     'float lum=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));',
     role==='detail'?'vec3 base=mix(vec3(lum),sampledDiffuseColor.rgb,.78);':'vec3 base=lookTint*(.83+.34*lum);',
     role==='detail'?'diffuseColor.rgb *= mix(vec3(.48),base,lookDetail);':'diffuseColor.rgb *= mix(base,sampledDiffuseColor.rgb,lookDetail);',
     'diffuseColor.a *= sampledDiffuseColor.a;',
     '#endif'
    ].join('\n'));
  };
  m.customProgramCacheKey=()=> 'look-v1-'+role;
 }
 if(m.isMeshStandardMaterial){m.roughness=style==='DIORAMA'?.72:style==='STYLIZED'?.96:.88;m.metalness=Math.min(m.metalness,.12);}
 if(m.isMeshPhongMaterial){m.shininess=style==='DIORAMA'?18:5;m.specular?.setScalar(style==='DIORAMA'?.09:.025);}
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
  if(!m){m=isTerrain?terrainMaterial(T,source,PALETTES[style]):alternateMaterial(T,source,role,PALETTES[style],style);map.set(key,m);generated.set(m,source);}
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
  active=style;scene.traverse(applyObject);
  const reset=style==='RETRO';
  if(reset){scene.background=original.background;scene.fog=original.fog;renderer.toneMappingExposure=original.exposure;renderer.toneMapping=original.tone;
   sun.color.copy(original.sunColor);sun.intensity=original.sunIntensity;
   if(hemi){hemi.color.copy(original.hemiColor);hemi.groundColor.copy(original.groundColor);hemi.intensity=original.hemiIntensity;}
  }else{
   const look=style==='STYLIZED'?{sky:0xf1ba85,fog:0xe9b58e,density:.0035,sun:0xffe3b2,power:2.6,hemi:0xd5e9ff,ground:0x706044,ambient:1.55,exposure:1.04,tone:T.NeutralToneMapping}:
    style==='DIORAMA'?{sky:0xbad3de,fog:0xbad3de,density:.002,sun:0xffe9bd,power:3.1,hemi:0xc5ddff,ground:0x6a6653,ambient:1.1,exposure:1.03,tone:T.ACESFilmicToneMapping}:
    {sky:null,fog:0x82949c,density:.006,sun:0xffc7a0,power:2.7,hemi:0x8faec4,ground:0x514d43,ambient:.65,exposure:1.07,tone:T.ACESFilmicToneMapping};
   scene.background=look.sky===null?original.background:new T.Color(look.sky);scene.fog=new T.FogExp2(look.fog,look.density);
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
