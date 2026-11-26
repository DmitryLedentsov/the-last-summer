// A style changes only rendering and lighting, never authored mesh materials,
// texture assets, shader hooks, vertex attributes or material colors.
const legacy=Object.freeze({sun:1.06,fill:1.14,fog:.7,exposure:1,contact:.48});
export const LIGHT_PROFILES=Object.freeze({
 RETRO:Object.freeze({sun:1,fill:1,fog:1,exposure:1,contact:0}),
 'DIORAMA LEGACY':legacy,
 'DIORAMA LEGACY CLEAR':legacy,
 'DIORAMA LEGACY SOFT':legacy,
 'DIORAMA LEGACY VOLUME':Object.freeze({...legacy,contact:.60}),
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
 const contactMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{opacity:{value:.55}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec2 vUv;uniform float opacity;void main(){float r=length((vUv-.5)*2.0);float a=pow(max(0.0,1.0-r*r),2.5)*opacity;gl_FragColor=vec4(.055,.045,.032,a); #include <colorspace_fragment>\n}'.replace('; #include',';\n#include')});
 const plane=new T.PlaneGeometry(1.7,1.7,5,5);plane.rotateX(-Math.PI/2);
 const contact=actors.map(a=>{const mesh=new T.Mesh(plane.clone(),contactMaterial);mesh.visible=false;mesh.renderOrder=1;scene.add(mesh);return {a,mesh};});
 let active='RETRO';
 function apply(style){
  const cfg=lightingForStyle(original,style);active=style;
  // Always derive from the authored baseline, never from the preceding style.
  scene.background=original.background;
  scene.fog=style==='RETRO'||!original.fog?.isFogExp2?original.fog:new T.FogExp2(original.fog.color,cfg.fogDensity);
  sun.color.copy(original.sunColor);sun.intensity=cfg.sunIntensity;
  if(hemi){hemi.color.copy(original.hemiColor);hemi.groundColor.copy(original.groundColor);hemi.intensity=cfg.hemiIntensity;}
  renderer.toneMapping=original.tone;renderer.toneMappingExposure=cfg.exposure;
  contactMaterial.uniforms.opacity.value=cfg.contact;
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
