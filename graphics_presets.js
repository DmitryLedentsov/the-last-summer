import {createSceneStyles} from './scene_style.js?v=056';
import {createPipeline} from './graphics_pipeline_legacy.js?v=069';
import {createLocalShadows} from './local_shadows.js?v=069';
import {STYLES,QUALITIES,graphicsSettings,findStyle,collectTextures,createTextureProfiles} from './graphics_settings.js?v=073';
export {STYLES,QUALITIES,graphicsSettings,findStyle,collectTextures,createTextureProfiles} from './graphics_settings.js?v=073';
export function createGraphics(T,{renderer,scene,camera,sun,terrain,actors,height,extraTextures=[],vegetation=null,vegetationOrigin=null,localShadowRadius=0,onChange=()=>{}}){
 let style=0,quality=2,postFailed=false,appliedStyle=-1;
 const query=new URLSearchParams(location.search);
 const requestedStyle=findStyle(query.get('style'));
 const requestedQuality=QUALITIES.findIndex(q=>q.name===query.get('quality')?.toUpperCase());
 if(requestedStyle>=0)style=requestedStyle;if(requestedQuality>=0)quality=requestedQuality;
 const bufferSize=new T.Vector2(),applyTextures=createTextureProfiles(T,collectTextures(scene,extraTextures),renderer.capabilities.getMaxAnisotropy());
 const looks=createSceneStyles(T,{scene,renderer,sun,actors,height});
 const pipeline=createPipeline(T,renderer,scene,camera),localShadows=localShadowRadius?createLocalShadows(T,scene,sun,localShadowRadius):null;
 let renderStats=null;
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
 function render(mode=1,zoom=false,debug=false){
  const t=debug?performance.now():0;
  vegetation?.update(vegetationOrigin||camera.position,quality);localShadows?.update(vegetationOrigin||camera.position);looks.update();
  const cfg=graphicsSettings(style,quality,{mode,zoom}),prep=debug?performance.now()-t:0;
  let sceneMs=0,sceneCalls=0,sceneTriangles=0,shadowMs=0,shadowCalls=0,shadowTriangles=0;
  const markScene=debug?ms=>{sceneMs=ms;sceneCalls=renderer.info.render.calls;sceneTriangles=renderer.info.render.triangles;}:null;
  const oldAuto=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();
  const start=debug?performance.now():0;
  const shadowMap=renderer.shadowMap,originalShadowRender=debug&&typeof shadowMap.render==='function'?shadowMap.render:null;
  if(originalShadowRender)shadowMap.render=function(...args){const t=performance.now(),calls=renderer.info.render.calls,tri=renderer.info.render.triangles;try{return originalShadowRender.apply(this,args);}finally{shadowMs+=performance.now()-t;shadowCalls+=renderer.info.render.calls-calls;shadowTriangles+=renderer.info.render.triangles-tri;}};
  try{
   if(postFailed||cfg.s.retro||!(cfg.aa||cfg.blur||cfg.bloom||cfg.grade||cfg.ao)){
    renderer.render(scene,camera);if(markScene)markScene(performance.now()-start);
   }else{
    renderer.getDrawingBufferSize(bufferSize);pipeline.render(cfg,bufferSize.x,bufferSize.y,markScene);
   }
  }catch(error){if(postFailed||cfg.s.retro)throw error;console.warn('Graphics pipeline disabled:',error);postFailed=true;onChange(label());renderer.setRenderTarget(null);renderer.info.reset();const fallback=debug?performance.now():0;renderer.render(scene,camera);if(markScene)markScene(performance.now()-fallback);}
  finally{if(originalShadowRender)shadowMap.render=originalShadowRender;renderer.setRenderTarget(null);renderer.info.autoReset=oldAuto;}
  if(debug){renderer.getDrawingBufferSize(bufferSize);renderStats={prep,sceneMs,shadowMs,shadowCalls,shadowTriangles,postMs:Math.max(0,performance.now()-start-sceneMs),sceneCalls,sceneTriangles,postCalls:Math.max(0,renderer.info.render.calls-sceneCalls),width:bufferSize.x,height:bufferSize.y};}
 }
 function diagnostics(){return {...renderStats,vegetation:vegetation?.stats(),shadow:localShadows?.stats()||{radius:0,resolution:sun.shadow.mapSize.x}};}
 function setQuality(index){quality=(index+QUALITIES.length)%QUALITIES.length;apply();}
 function cycleQuality(){setQuality(quality+1);}
 function cycleStyle(){style=(style+1)%STYLES.length;apply();}
 apply();
 return {render,diagnostics,resize,setQuality,cycleQuality,cycleStyle,explicitQuality:requestedQuality>=0,get overheadLens(){return STYLES[style].lens||1;},get label(){return label();}};
}
