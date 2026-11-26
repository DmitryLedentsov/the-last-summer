// Legacy is a frozen v0.5.2 reference; all experimental looks preserve authored assets.
// Every Diorama uses exactly the frozen v0.5.2 renderer; variations are small optical and lighting adjustments.
export const STYLES=Object.freeze([
 {name:'RETRO',retro:true,blur:0,bloom:0,grade:0},
 {name:'DIORAMA LEGACY',retro:false,blur:1,bloom:0,grade:0,legacy:true},
 {name:'LEGACY CLEAR',retro:false,blur:.74,bloom:0,grade:0,legacy:true,nearOffset:8,farOffset:24},
 {name:'LEGACY SOFT',retro:false,blur:.92,bloom:0,grade:0,legacy:true,nearOffset:4,farOffset:15},
 {name:'LEGACY VOLUME',retro:false,blur:1,bloom:0,grade:0,legacy:true},
 {name:'LEGACY AIR',retro:false,blur:.88,bloom:0,grade:0,legacy:true,nearOffset:4,farOffset:12}
].map(Object.freeze));
export const QUALITIES=Object.freeze([
 {name:'LOW',scale:.7,shadow:512,aa:0,blur:0,bloom:0,anisotropy:2,dpr:1},
 {name:'MEDIUM',scale:.9,shadow:1024,aa:1,blur:.58,bloom:0,anisotropy:4,dpr:1},
 {name:'HIGH',scale:1,shadow:2048,aa:1,blur:.9,bloom:.65,anisotropy:8,dpr:1},
 {name:'ULTRA',scale:1,shadow:4096,aa:1,blur:1,bloom:1,anisotropy:16,dpr:1.5}
]);
export function graphicsSettings(styleIndex,qualityIndex,{mode=1,zoom=false}={}){
 const s=STYLES[styleIndex],q=QUALITIES[qualityIndex],top=mode===2;
 return {s,q,legacy:!!s.legacy,scale:s.retro?[.5,.65,.8,1][qualityIndex]:q.scale,
  aa:s.retro?0:q.aa,blur:Math.min(1,s.blur*q.blur*(top?1.25:zoom?.35:.85)),
  bloom:s.bloom*q.bloom,grade:q.aa?s.grade:0,ao:false,
  near:(top?23:zoom?42:25)+(s.nearOffset||0),far:(top?53:zoom?115:85)+(s.farOffset||0),
  lens:1};
}
export function findStyle(name){
 const key=String(name||'').toUpperCase();
 const aliases={'DIORAMA':'DIORAMA LEGACY','DIORAMA MINIATURE':'LEGACY CLEAR','DIORAMA CONTRAST':'LEGACY VOLUME','DIORAMA DREAM':'LEGACY SOFT','DIORAMA TOYBOX':'LEGACY AIR'};
 return STYLES.findIndex(s=>s.name===(aliases[key]||key));
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

