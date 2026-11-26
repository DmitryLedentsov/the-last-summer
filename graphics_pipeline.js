import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
// Downsampled blur pyramid inspired by Ballistica. The sharp beauty buffer is retained.
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const down=
 'varying vec2 vUv;uniform sampler2D source;uniform vec2 pixel;void main(){vec3 c=texture2D(source,vUv).rgb*4.0;'+
 'c+=texture2D(source,vUv+pixel*vec2(1.,1.)).rgb; c+=texture2D(source,vUv+pixel*vec2(-1.,1.)).rgb;'+
 'c+=texture2D(source,vUv+pixel*vec2(1.,-1.)).rgb;c+=texture2D(source,vUv+pixel*vec2(-1.,-1.)).rgb;gl_FragColor=vec4(c*.125,1.);}';
const composite=[
 'varying vec2 vUv;uniform sampler2D sharp,soft,medium,wide,depth;uniform float nearPlane,farPlane,focusEnd,blurEnd,amount,glow,grade,foreground,contrast;',
 'float linearDepth(float d){return nearPlane*farPlane/max(.00001,farPlane-d*(farPlane-nearPlane));}',
 'void main(){vec3 c=texture2D(sharp,vUv).rgb;float z=linearDepth(texture2D(depth,vUv).r);',
 'float b=max(smoothstep(focusEnd,blurEnd,z),foreground>0.0?1.0-smoothstep(foreground*.45,foreground,z):0.0)*amount;',
 'vec3 s=texture2D(soft,vUv).rgb,m=texture2D(medium,vUv).rgb,w=texture2D(wide,vUv).rgb;',
 'vec3 blurred=mix(mix(s,m,smoothstep(.15,.55,b)),w,smoothstep(.55,1.,b));',
 'vec3 col=mix(c,blurred,clamp(b,0.,1.)); col=max(vec3(0.),col+(c-s)*contrast);',
 'col+=max(w-vec3(.85),vec3(0.))*glow;',
 'float v=smoothstep(.25,.72,length((vUv-.5)*vec2(1.,.85)));',
 'col=mix(col,col*vec3(.98,1.01,1.045),grade)*(1.-.12*v*grade);gl_FragColor=vec4(col,1.);}'
].join('\n');
export function createPipeline(T,renderer,scene,camera){
 let width=0,height=0,beauty,combined,aaTarget,aoTarget,pyramid=[],smaa,output,ao,downMat,mixMat,quad,screen,screenCamera;
 const hdr=renderer.extensions.has('EXT_color_buffer_float');
 function target(w,h,depth=false){
  const r=new T.WebGLRenderTarget(w,h,{type:hdr?T.HalfFloatType:T.UnsignedByteType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:depth,stencilBuffer:false});
  if(depth){r.depthTexture=new T.DepthTexture(w,h,T.UnsignedIntType);r.depthTexture.minFilter=r.depthTexture.magFilter=T.NearestFilter;}
  return r;
 }
 function dispose(){
  ao?.dispose();smaa?.dispose();output?.dispose();downMat?.dispose();mixMat?.dispose();quad?.geometry.dispose();
  for(const r of [beauty,combined,aaTarget,aoTarget,...pyramid])r?.dispose();
  beauty=combined=aaTarget=aoTarget=smaa=output=ao=downMat=mixMat=quad=screen=screenCamera=null;pyramid=[];width=height=0;
 }
 function init(w,h){
  if(beauty&&width===w&&height===h)return;
  dispose();width=w;height=h;
  beauty=target(w,h,true);combined=target(w,h);aaTarget=target(w,h);
  pyramid=[2,4,8].map(n=>target(Math.max(1,Math.floor(w/n)),Math.max(1,Math.floor(h/n))));
  downMat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:down,uniforms:{source:{value:null},pixel:{value:new T.Vector2()}},depthTest:false,depthWrite:false,toneMapped:false});
  const u={};for(const key of ['sharp','soft','medium','wide','depth'])u[key]={value:null};
  for(const key of ['nearPlane','farPlane','focusEnd','blurEnd','amount','glow','grade','foreground','contrast'])u[key]={value:0};
  mixMat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:composite,uniforms:u,depthTest:false,depthWrite:false,toneMapped:false});
  screen=new T.Scene();screenCamera=new T.Camera();quad=new T.Mesh(new T.PlaneGeometry(2,2),downMat);quad.frustumCulled=false;screen.add(quad);
  output=new OutputPass();output.renderToScreen=true;
 }
 function pass(mat,dest){quad.material=mat;renderer.setRenderTarget(dest);renderer.render(screen,screenCamera);}
 function render(cfg,w,h){
  init(w,h);renderer.setRenderTarget(beauty);renderer.render(scene,camera);
  let src=beauty;
  // Use real scene depth (including foliage alpha cutouts) instead of re-rendering an opaque normal prepass.
  if(cfg.ao&&hdr){
   if(!ao){
    const aw=Math.max(1,Math.floor(w/2)),ah=Math.max(1,Math.floor(h/2));
    ao=new GTAOPass(scene,camera,aw,ah);ao.setGBuffer(beauty.depthTexture);
    ao.updateGtaoMaterial({radius:.45,distanceExponent:1.5,thickness:.35,distanceFallOff:1,scale:1,samples:8,screenSpaceRadius:false});
    ao.blendIntensity=.55;aoTarget=target(w,h);
   }
   ao.render(renderer,aoTarget,beauty);src=aoTarget;
  }
  if(cfg.blur||cfg.bloom||cfg.grade||cfg.contrast){
   let previous=src;
   for(const r of pyramid){downMat.uniforms.source.value=previous.texture;downMat.uniforms.pixel.value.set(1/previous.width,1/previous.height);pass(downMat,r);previous=r;}
   const u=mixMat.uniforms;
   u.sharp.value=src.texture;u.soft.value=pyramid[0].texture;u.medium.value=pyramid[1].texture;u.wide.value=pyramid[2].texture;u.depth.value=beauty.depthTexture;
   u.nearPlane.value=camera.near;u.farPlane.value=camera.far;u.focusEnd.value=cfg.near;u.blurEnd.value=cfg.far;u.amount.value=cfg.blur;u.glow.value=hdr?cfg.bloom:0;u.grade.value=cfg.grade;u.foreground.value=cfg.foreground;u.contrast.value=cfg.contrast;
   pass(mixMat,combined);src=combined;
  }
  if(cfg.aa){if(!smaa)smaa=new SMAAPass(w,h);if(smaa.areaTexture.image?.complete&&smaa.searchTexture.image?.complete&&smaa.areaTexture.image.naturalWidth&&smaa.searchTexture.image.naturalWidth){smaa.render(renderer,aaTarget,src);src=aaTarget;}}
  output.render(renderer,null,src);
 }
 return {render,dispose,supported:hdr};
}
