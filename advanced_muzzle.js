// BinbunVFX MuzzleFlash_02.tscn, base.gdshader, glow.gdshader and flash_02/03 materials.
// Original textures and layer counts; local +Z forward. Godot particle curves sampled on CPU.
// Browser adaptation: noise approximation, unlit emissive color and 2x source duration.
export const ADVANCED_FLASH=Object.freeze({life:.40,long:3,side:4,front:1,scale:.52,glowLife:.30});
const clamp=(x)=>Math.max(0,Math.min(1,x));
function curve(t,start,end,y0,y1,m0,m1){
 if(t<=start)return y0;if(t>=end)return y1;const u=(t-start)/(end-start),u2=u*u,u3=u2*u,d=end-start;
 return clamp((2*u3-3*u2+1)*y0+(u3-2*u2+u)*d*m0+(-2*u3+3*u2)*y1+(u3-u2)*d*m1);
}
export function flashParticle(layer,t){
 t=clamp(t);
 if(layer==='long')return curve(t,0,1,.191845,1,1.35258,.169788);
 if(layer==='side')return curve(t,0,1,.409091,1,.688372,1.01501);
 return curve(t,.240924,1,0,1,1.85571,.347757);
}
export function createAdvancedMuzzle(T,scene,load,front,side){
 const texLong=load('flash_long_02.png'),z=new T.Vector3(0,0,1),random=Math.random;
 const palette={primary:new T.Color().setRGB(1,1,.545098,T.SRGBColorSpace),secondary:new T.Color().setRGB(1,.533333,.352941,T.SRGBColorSpace)};
 function material(map,layer){
  const front=layer==='front',long=layer==='long';
  return new T.ShaderMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,toneMapped:false,
   uniforms:{map:{value:map},progress:{value:0},elapsed:{value:0},primary:{value:palette.primary},secondary:{value:palette.secondary},
    edge:{value:front?.30:.40},cutoff:{value:front?.10:.02},basic:{value:front?1:.121},direction:{value:front?0:1},noiseStrength:{value:long?.5:0},offset:{value:front?-.5:0},front:{value:front?1:0}},
   vertexShader:`
    uniform float offset; varying vec2 vUV;
    void main(){vUV=uv;vec3 p=position;float r=clamp(length(uv-.5)*2.,0.,1.);p.z+=offset*r*r;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
   `,
   fragmentShader:`
    uniform sampler2D map;uniform float progress,elapsed,edge,cutoff,basic,direction,noiseStrength,front;
    uniform vec3 primary,secondary;varying vec2 vUV;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){
     vec2 uv=vUV;vec2 aligned=vec2(uv.y,uv.x);
     float val=texture2D(map,aligned).r;
     val=clamp(val-clamp(uv.y-1.+progress*direction*1.3,0.,1.),0.,1.);
     val=mix(val,val*(1.-progress),basic);
     val*=1.-(1.-noise(uv*9.+vec2(0.,elapsed*6.)))*noiseStrength;
     float alpha=smoothstep(0.,edge,val)*step(cutoff,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
     if(alpha<.005)discard;
     vec3 col=mix(secondary,primary,smoothstep(0.,.6,val));
     gl_FragColor=vec4(col*2.,alpha);
     #include <colorspace_fragment>
    }`});
 }
 const quad=new T.PlaneGeometry(1,1,16,16);
 const hemi=new T.SphereGeometry(.15,16,8,0,Math.PI*2,0,Math.PI/2);
 hemi.scale(1,.4/.15,1);hemi.rotateX(Math.PI/2);
 const pool=Array.from({length:8},()=>{
  const group=new T.Group(),layers=[];
  function make(layer,count,map,size,center){for(let i=0;i<count;i++){
   const m=material(map,layer),mesh=new T.Mesh(quad,m),spin=new T.Group();
   mesh.scale.setScalar(size);if(layer!=='front'){mesh.rotation.x=Math.PI/2;mesh.position.z=center;}
   else mesh.position.z=.01;
   spin.add(mesh);group.add(spin);layers.push({layer,mesh,spin,m,size,delay:layer==='long'?i*.40*.2/count:0});
  }}
  make('long',3,texLong,1.5,.75);make('side',4,side,.8,.35);make('front',1,front,.5,0);
  const glowMat=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:T.FrontSide,
    uniforms:{alpha:{value:0},primary:{value:palette.primary},secondary:{value:palette.secondary}},
    vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float alpha;uniform vec3 primary,secondary;varying vec2 vUV;void main(){float mask=pow(clamp(vUV.y,0.,1.),2.);gl_FragColor=vec4(mix(secondary,primary,mask)*4.,mask*alpha);\n#include <colorspace_fragment>\n}'});
  const glow=new T.Mesh(hemi,glowMat);glow.position.z=.4;group.add(glow);group.visible=false;scene.add(group);return {group,layers,glow,age:Infinity};
 });
 let cursor=0;
 function muzzle(p,d){
  const shot=pool[cursor++%pool.length];shot.age=-1;shot.group.position.copy(p);shot.group.quaternion.setFromUnitVectors(z,d);shot.group.rotateZ(random()*Math.PI*2);shot.group.scale.setScalar(ADVANCED_FLASH.scale);
  for(const l of shot.layers){l.spin.rotation.z=random()*Math.PI*2;l.mesh.scale.setScalar(l.size*(.85+random()*.3));l.mesh.visible=l.delay===0;l.m.uniforms.progress.value=flashParticle(l.layer,0);l.m.uniforms.elapsed.value=0;}
  shot.glow.visible=true;shot.glow.material.uniforms.alpha.value=1;shot.group.visible=true;
 }
 function update(dt){for(const shot of pool){if(!shot.group.visible)continue;shot.age=shot.age<0?0:shot.age+Math.max(0,dt);
  for(const l of shot.layers){const age=shot.age-l.delay,t=age/ADVANCED_FLASH.life;l.mesh.visible=age>=0&&t<1;if(l.mesh.visible){l.m.uniforms.progress.value=flashParticle(l.layer,t);l.m.uniforms.elapsed.value=age;}}
  shot.glow.visible=shot.age<ADVANCED_FLASH.glowLife;shot.glow.material.uniforms.alpha.value=Math.pow(clamp(1-shot.age/ADVANCED_FLASH.glowLife),1.5);
  shot.group.visible=shot.glow.visible||shot.layers.some(l=>l.mesh.visible||shot.age<l.delay);
 }}
 function clear(){for(const shot of pool)shot.group.visible=false;}
 return {muzzle,update,clear};
}
