// Graphics only: no simulation, camera transforms, input or collision changes.
export const STYLES=Object.freeze([
 {name:'RETRO',retro:true,blur:0,bloom:0,grade:0,exposure:1.15},
 {name:'SMOOTH',retro:false,blur:0,bloom:0,grade:0,exposure:1.15},
 {name:'DIORAMA',retro:false,blur:1,bloom:0,grade:.15,exposure:1.16},
 {name:'CINEMATIC',retro:false,blur:.7,bloom:1,grade:.65,exposure:1.12}
]);
export const QUALITIES=Object.freeze([
 {name:'LOW',scale:.6,shadow:512,aa:0,blur:0,bloom:0,anisotropy:2,dpr:1},
 {name:'MEDIUM',scale:.8,shadow:1024,aa:1,blur:.55,bloom:0,anisotropy:4,dpr:1},
 {name:'HIGH',scale:1,shadow:2048,aa:1,blur:1,bloom:.65,anisotropy:8,dpr:1},
 {name:'ULTRA',scale:1,shadow:4096,aa:1,blur:1.25,bloom:1,anisotropy:16,dpr:1.5}
]);
export function graphicsSettings(styleIndex,qualityIndex,{mode=1,zoom=false}={}){
 const s=STYLES[styleIndex],q=QUALITIES[qualityIndex];
 return {s,q,scale:s.retro?[.5,.65,.8,1][qualityIndex]:q.scale,
  aa:s.retro?0:q.aa,blur:s.blur*q.blur*(mode===2?1.35:zoom?.45:1),
  bloom:s.bloom*q.bloom,grade:q.aa?s.grade:0,
  near:mode===2?23:zoom?42:25,far:mode===2?65:zoom?115:95};
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
const vertexShader='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const fragmentShader=/* glsl */ `varying vec2 vUv;
uniform sampler2D tColor,tDepth;
uniform vec2 pixel;
uniform float cameraNear,cameraFar,blurStart,blurEnd,blurRadius,aa,bloom,grade;
float depthAt(vec2 uv){
 float d=texture2D(tDepth,clamp(uv,vec2(0.),vec2(1.))).x;
 return cameraNear*cameraFar/max(.00001,cameraFar-d*(cameraFar-cameraNear));
}
vec3 colorAt(vec2 uv){return texture2D(tColor,clamp(uv,vec2(0.),vec2(1.))).rgb;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 antialias(vec2 uv,vec3 center){
 vec3 nw=colorAt(uv+pixel*vec2(-1.,1.)),ne=colorAt(uv+pixel*vec2(1.,1.));
 vec3 sw=colorAt(uv+pixel*vec2(-1.,-1.)),se=colorAt(uv+pixel*vec2(1.,-1.));
 float a=luma(nw),b=luma(ne),c=luma(sw),d=luma(se),m=luma(center);
 float lo=min(m,min(min(a,b),min(c,d))),hi=max(m,max(max(a,b),max(c,d)));
 if(hi-lo<max(.025,hi*.12))return center;
 vec2 dir=vec2(-((a+b)-(c+d)),(a+c)-(b+d));
 float reduce=max((a+b+c+d)*.03125,.0078125);
 dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-5.),vec2(5.))*pixel;
 vec3 x=.5*(colorAt(uv-dir/6.)+colorAt(uv+dir/6.));
 vec3 y=.5*x+.25*(colorAt(uv-dir*.5)+colorAt(uv+dir*.5));
 float ly=luma(y);return ly<lo||ly>hi?x:y;
}
void blurTap(vec2 delta,float z,inout vec3 sum,inout float weights){
 vec2 uv=clamp(vUv+delta,vec2(0.),vec2(1.));
 float sampleZ=depthAt(uv);
 float w=smoothstep(blurStart-4.,blurStart+4.,sampleZ)*smoothstep(z-max(4.,z*.14),z,sampleZ);
 sum+=colorAt(uv)*w;weights+=w;
}
void main(){
 vec3 center=colorAt(vUv),col=center;
 float z=depthAt(vUv),strength=smoothstep(blurStart,blurEnd,z);
 if(blurRadius>0.0&&strength>.001){
  vec2 r=pixel*blurRadius*strength;vec3 sum=center;float w=1.;
  blurTap(r*vec2(1.,0.),z,sum,w);blurTap(r*vec2(-1.,0.),z,sum,w);
  blurTap(r*vec2(0.,1.),z,sum,w);blurTap(r*vec2(0.,-1.),z,sum,w);
  blurTap(r*vec2(.707,.707),z,sum,w);blurTap(r*vec2(-.707,.707),z,sum,w);
  blurTap(r*vec2(.707,-.707),z,sum,w);blurTap(r*vec2(-.707,-.707),z,sum,w);
  blurTap(r*vec2(.33,0.),z,sum,w);blurTap(r*vec2(-.33,0.),z,sum,w);
  blurTap(r*vec2(0.,.33),z,sum,w);blurTap(r*vec2(0.,-.33),z,sum,w);
  col=mix(aa>.5?antialias(vUv,center):center,sum/w,strength);
 }else if(aa>.5){col=antialias(vUv,center);}
 if(bloom>0.){
  vec2 r=pixel*7.;
  vec3 glow=max(colorAt(vUv+vec2(r.x,0.))-.85,vec3(0.))+max(colorAt(vUv-vec2(r.x,0.))-.85,vec3(0.))
   +max(colorAt(vUv+vec2(0.,r.y))-.85,vec3(0.))+max(colorAt(vUv-vec2(0.,r.y))-.85,vec3(0.));
  col+=glow*(.10*bloom);
 }
 float vignette=smoothstep(.22,.72,length((vUv-.5)*vec2(1.,.85)));
 col=mix(col,col*vec3(1.045,1.012,.965),grade)*(1.-.13*grade*vignette);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function createGraphics(T,{renderer,scene,camera,sun,extraTextures=[],onChange=()=>{}}){
 let style=0,quality=2,target=null,screen=null,material=null,screenCamera=null,postFailed=false;
 const bufferSize=new T.Vector2(),applyTextures=createTextureProfiles(T,collectTextures(scene,extraTextures),renderer.capabilities.getMaxAnisotropy());
 const initialExposure=renderer.toneMappingExposure;
 const hdr=renderer.extensions.has('EXT_color_buffer_float');
 function resize(){
  const cfg=graphicsSettings(style,quality);
  const ratio=Math.min(globalThis.devicePixelRatio||1,cfg.s.retro?1:cfg.q.dpr)*cfg.scale;
  renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);
  if(target){renderer.getDrawingBufferSize(bufferSize);target.setSize(bufferSize.x,bufferSize.y);}
 }
 function notify(){
  const cfg=graphicsSettings(style,quality);onChange(cfg.s.name+' / '+cfg.q.name+(postFailed&&!cfg.s.retro?' · FX OFF':''));
 }
 function apply(){
  const cfg=graphicsSettings(style,quality);
  renderer.domElement.style.imageRendering=cfg.s.retro?'pixelated':'auto';
  renderer.toneMappingExposure=cfg.s.retro?initialExposure:cfg.s.exposure;
  applyTextures(cfg.s.retro,cfg.q.anisotropy);
  const max=renderer.capabilities.maxTextureSize,shadow=Math.min(cfg.q.shadow,max);
  if(sun.shadow.mapSize.x!==shadow){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(shadow,shadow);}
  renderer.shadowMap.needsUpdate=true;
  if(target&&(cfg.s.retro||quality===0)){target.dispose();target=null;screen?.children[0]?.geometry.dispose();material?.dispose();screen=null;material=null;screenCamera=null;}
  resize();notify();
 }
 function ensurePost(){
  if(target)return;
  renderer.getDrawingBufferSize(bufferSize);
  target=new T.WebGLRenderTarget(bufferSize.x,bufferSize.y,{type:hdr?T.HalfFloatType:T.UnsignedByteType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false});
  target.depthTexture=new T.DepthTexture(bufferSize.x,bufferSize.y,T.UnsignedIntType);
  target.depthTexture.minFilter=target.depthTexture.magFilter=T.NearestFilter;
  material=new T.ShaderMaterial({vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:true,uniforms:{
   tColor:{value:target.texture},tDepth:{value:target.depthTexture},pixel:{value:new T.Vector2()},
   cameraNear:{value:camera.near},cameraFar:{value:camera.far},blurStart:{value:25},blurEnd:{value:95},blurRadius:{value:0},aa:{value:0},bloom:{value:0},grade:{value:0}
  }});
  screen=new T.Scene();screenCamera=new T.Camera();const mesh=new T.Mesh(new T.PlaneGeometry(2,2),material);mesh.frustumCulled=false;screen.add(mesh);
 }
 function render(mode=1,zoom=false){
  const cfg=graphicsSettings(style,quality,{mode,zoom});
  const usePost=!postFailed&&!cfg.s.retro&&(cfg.aa||cfg.blur||cfg.bloom||cfg.grade);
  if(!usePost){renderer.render(scene,camera);return;}
  const oldAuto=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();
  try{
   ensurePost();
   const u=material.uniforms;u.pixel.value.set(1/target.width,1/target.height);
   u.cameraNear.value=camera.near;u.cameraFar.value=camera.far;
   u.blurStart.value=cfg.near;u.blurEnd.value=cfg.far;
   u.blurRadius.value=cfg.blur*7*Math.min(1.5,target.height/720);
   u.aa.value=cfg.aa;u.bloom.value=hdr?cfg.bloom:0;u.grade.value=cfg.grade;
   renderer.setRenderTarget(target);renderer.render(scene,camera);
   renderer.setRenderTarget(null);renderer.render(screen,screenCamera);
  }catch(error){
   console.warn('Graphics post-processing disabled:',error);postFailed=true;notify();
   renderer.setRenderTarget(null);renderer.info.reset();renderer.render(scene,camera);
  }finally{renderer.setRenderTarget(null);renderer.info.autoReset=oldAuto;}
 }
 function setQuality(index){quality=(index+QUALITIES.length)%QUALITIES.length;apply();}
 function cycleQuality(){setQuality(quality+1);}
 function cycleStyle(){style=(style+1)%STYLES.length;apply();}
 apply();
 return {render,resize,setQuality,cycleQuality,cycleStyle,get label(){return STYLES[style].name+' / '+QUALITIES[quality].name+(postFailed&&!STYLES[style].retro?' · FX OFF':'');}};
}
