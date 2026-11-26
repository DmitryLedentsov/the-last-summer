import {createSceneStyles} from './scene_style.js?v=056';
import {createPipeline} from './graphics_pipeline_legacy.js?v=056';
import {STYLES,QUALITIES,graphicsSettings,findStyle,collectTextures,createTextureProfiles} from './graphics_settings.js?v=056';
export {STYLES,QUALITIES,graphicsSettings,findStyle,collectTextures,createTextureProfiles} from './graphics_settings.js?v=056';
export function createGraphics(T,{renderer,scene,camera,sun,terrain,actors,height,extraTextures=[],onChange=()=>{}}){
 let style=0,quality=2,postFailed=false,appliedStyle=-1;
 const query=new URLSearchParams(location.search);
 const requestedStyle=findStyle(query.get('style'));
 const requestedQuality=QUALITIES.findIndex(q=>q.name===query.get('quality')?.toUpperCase());
 if(requestedStyle>=0)style=requestedStyle;if(requestedQuality>=0)quality=requestedQuality;
 const bufferSize=new T.Vector2(),applyTextures=createTextureProfiles(T,collectTextures(scene,extraTextures),renderer.capabilities.getMaxAnisotropy());
 const looks=createSceneStyles(T,{scene,renderer,sun,actors,height});
 const pipeline=createPipeline(T,renderer,scene,camera);
 function resize(){
  const cfg=graphicsSettings(style,quality);
  const ratio=Math.min(globalThis.devicePixelRatio||1,cfg.s.retro?1:cfg.q.dpr)*cfg.scale;
  renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);
 }
 function label(){return STYLES[style].name+' / '+QUALITIES[quality].name+(postFailed&&!STYLES[style].retro&&quality>0?' · FX OFF':'');}
 function apply(){
  const cfg=graphicsSettings(style,quality);postFailed=!pipeline.supported;pipeline.dispose();
  if(appliedStyle!==style){looks.apply(cfg.s.name);appliedStyle=style;}renderer.domElement.style.imageRendering=cfg.s.retro?'pixelated':'auto';
  applyTextures(cfg.s.retro,cfg.q.anisotropy);
  const shadow=Math.min(cfg.q.shadow,renderer.capabilities.maxTextureSize);
  if(sun.shadow.mapSize.x!==shadow){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(shadow,shadow);}
  renderer.shadowMap.needsUpdate=true;resize();onChange(label());
 }
 function render(mode=1,zoom=false){
  looks.update();const cfg=graphicsSettings(style,quality,{mode,zoom});
  if(postFailed||cfg.s.retro||!(cfg.aa||cfg.blur||cfg.bloom||cfg.grade||cfg.ao)){renderer.render(scene,camera);return;}
  const oldAuto=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();
  try{renderer.getDrawingBufferSize(bufferSize);pipeline.render(cfg,bufferSize.x,bufferSize.y);}
  catch(error){console.warn('Graphics pipeline disabled:',error);postFailed=true;onChange(label());renderer.setRenderTarget(null);renderer.info.reset();renderer.render(scene,camera);}
  finally{renderer.setRenderTarget(null);renderer.info.autoReset=oldAuto;}
 }
 function setQuality(index){quality=(index+QUALITIES.length)%QUALITIES.length;apply();}
 function cycleQuality(){setQuality(quality+1);}
 function cycleStyle(){style=(style+1)%STYLES.length;apply();}
 apply();
 return {render,resize,setQuality,cycleQuality,cycleStyle,explicitQuality:requestedQuality>=0,get overheadLens(){return STYLES[style].lens||1;},get label(){return label();}};
}
