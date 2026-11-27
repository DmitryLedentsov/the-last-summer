// A style changes only rendering and lighting, never authored mesh materials,
// texture assets, shader hooks, vertex attributes or material colors.
const legacy=Object.freeze({sun:1.06,fill:1.14,fog:.7,exposure:1,contact:0});
export const LIGHT_PROFILES=Object.freeze({
 RETRO:Object.freeze({sun:1,fill:1,fog:1,exposure:1,contact:0}),
 'DIORAMA LEGACY':legacy,
 'DIORAMA LEGACY CLEAR':legacy,
 'DIORAMA LEGACY SOFT':legacy,
 'DIORAMA LEGACY VOLUME':Object.freeze({...legacy,contact:0}),
 'DIORAMA LEGACY AIR':Object.freeze({...legacy,fog:.52})
});
export function lightingForStyle(original,style){
 const p=LIGHT_PROFILES[style];if(!p)throw new Error('Unknown graphics style: '+style);
 return {sunIntensity:original.sunIntensity*p.sun,hemiIntensity:original.hemiIntensity*p.fill,
  fogDensity:original.fogDensity*p.fog,exposure:original.exposure*p.exposure,contact:p.contact};
}
export function createSceneStyles(T,{scene,renderer,sun,actors,height}){
 const hemi=scene.children.find(o=>o.isHemisphereLight);
 const original={background:scene.background,fog:scene.fog,fogDensity:scene.fog?.density??0,
  exposure:renderer.toneMappingExposure,tone:renderer.toneMapping,
  sunColor:sun.color.clone(),sunIntensity:sun.intensity,
  hemiColor:hemi?.color.clone(),groundColor:hemi?.groundColor.clone(),hemiIntensity:hemi?.intensity??0};
 function apply(style){
  const cfg=lightingForStyle(original,style);
  // Always derive from the authored baseline, never from the preceding style.
  scene.background=original.background;
  scene.fog=style==='RETRO'||!original.fog?.isFogExp2?original.fog:new T.FogExp2(original.fog.color,cfg.fogDensity);
  sun.color.copy(original.sunColor);sun.intensity=cfg.sunIntensity;
  if(hemi){hemi.color.copy(original.hemiColor);hemi.groundColor.copy(original.groundColor);hemi.intensity=cfg.hemiIntensity;}
  renderer.toneMapping=original.tone;renderer.toneMappingExposure=cfg.exposure;
  renderer.shadowMap.needsUpdate=true;
 }
 function update(){}
 return {apply,update};
}
