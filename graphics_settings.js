// Legacy is a frozen v0.5.2 reference; all experimental looks preserve authored assets.
export const STYLES=Object.freeze([
 {name:'RETRO',retro:true,blur:0,bloom:0,grade:0},
 {name:'DIORAMA LEGACY',retro:false,blur:1,bloom:0,grade:0,legacy:true},
 {name:'DIORAMA MINIATURE',retro:false,blur:.42,bloom:0,grade:0,lens:1.2},
 {name:'DIORAMA CONTRAST',retro:false,blur:0,bloom:0,grade:0,contrast:.10,ao:true},
 {name:'DIORAMA DREAM',retro:false,blur:.12,bloom:.32,grade:.42},
 {name:'DIORAMA TOYBOX',retro:false,blur:.16,bloom:0,grade:0,contrast:.035}
].map(Object.freeze));
export const QUALITIES=Object.freeze([
 {name:'LOW',scale:.7,shadow:512,aa:0,blur:0,bloom:0,anisotropy:2,dpr:1},
 {name:'MEDIUM',scale:.9,shadow:1024,aa:1,blur:.58,bloom:0,anisotropy:4,dpr:1},
 {name:'HIGH',scale:1,shadow:2048,aa:1,blur:.9,bloom:.65,anisotropy:8,dpr:1},
 {name:'ULTRA',scale:1,shadow:4096,aa:1,blur:1,bloom:1,anisotropy:16,dpr:1.5}
]);
export function graphicsSettings(styleIndex,qualityIndex,{mode=1,zoom=false,focusDepth=16}={}){
 const s=STYLES[styleIndex],q=QUALITIES[qualityIndex],mini=s.name==='DIORAMA MINIATURE',top=mode===2;
 // Exact v0.5.2 DOF formula for legacy, including its original zoom and overhead behavior.
 const legacy=s.legacy===true;
 const depth=Number.isFinite(focusDepth)?Math.max(1,focusDepth):16;
 const near=legacy?(top?23:zoom?42:25):mini&&top?Math.max(26,depth+10):zoom?60:42;
 const far=legacy?(top?53:zoom?115:85):near+(mini&&top?42:85);
 return {s,q,legacy,scale:s.retro?[.5,.65,.8,1][qualityIndex]:q.scale,
  aa:s.retro?0:q.aa,
  blur:legacy?Math.min(1,s.blur*q.blur*(top?1.25:zoom?.35:.85)):s.blur*q.blur*(zoom?.3:top?1:.65),
  bloom:s.bloom*q.bloom,grade:q.aa?s.grade:0,contrast:q.aa?(s.contrast||0):0,
  ao:!!s.ao&&qualityIndex===3,near,far,
  foreground:mini&&top&&!zoom?Math.max(0,depth-9):0,
  radius:mini?3:1.5,lens:top?(s.lens||1):1};
}
export function findStyle(name){
 const key=String(name||'').toUpperCase();
 return STYLES.findIndex(s=>s.name===(key==='DIORAMA'?'DIORAMA LEGACY':key));
}
export function collectTextures(scene,extras=[]){
 const textures=new Set(extras.filter(t=>t?.isTexture));
 scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(!m)continue;for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
 }});
 if(scene.background?.isTexture)textures.add(scene.background);
 if(scene.environment?.isTexture)textures.add(scene.environment);
 return textures;
}
export function createTextureProfiles(T,textures,maxAnisotropy){
 const original=new Map([...textures].map(t=>[t,{magFilter:t.magFilter,minFilter:t.minFilter,anisotropy:t.anisotropy}]));
 return (retro,anisotropy)=>{
  for(const [t,o] of original){
   const mag=retro?o.magFilter:T.LinearFilter;
   const min=retro?o.minFilter:(!t.generateMipmaps&&!(t.mipmaps?.length)?T.LinearFilter:T.LinearMipmapLinearFilter);
   const aniso=retro?o.anisotropy:Math.min(maxAnisotropy,anisotropy);
   if(t.magFilter!==mag||t.minFilter!==min||t.anisotropy!==aniso){
    t.magFilter=mag;t.minFilter=min;t.anisotropy=aniso;t.needsUpdate=true;
   }
  }
 };
}

