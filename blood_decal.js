// Three.js port of knowercoder BloodFX WorldPosDecal.shadergraph + WorldPosDecal.mat.
// MIT; attribution and original license: assets/curated/vfx/BloodFX-LICENSE.txt.
// The original graph multiplies a UV radial mask by two 3-octave noise masks:
// world-XZ for alpha, local UV for the light/dark color mix. No decal PNG exists.
export const DECAL=Object.freeze({capacity:100,life:65,delay:.3,spread:2.5,startSize:4,endSize:1.4984058,segments:8,halfExtent:1.8});
export function decalMaskSize(age){return DECAL.startSize+(DECAL.endSize-DECAL.startSize)*Math.max(0,Math.min(1,(age-DECAL.delay)/DECAL.spread));}
export function decalRadial(u,v,maskSize){return Math.max(0,1-Math.hypot(u-.5,v-.5)*2*maskSize);}
export function createBloodDecals(T,scene,height){
 const {capacity,segments,life,delay,spread,startSize,endSize,halfExtent}=DECAL;
 const side=segments+1,per=side*side,positions=new Float32Array(capacity*per*3),uvs=new Float32Array(capacity*per*2),births=new Float32Array(capacity*per),indices=[];
 births.fill(-10000);
 for(let slot=0;slot<capacity;slot++){
  const first=slot*per;
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
   const k=first+j*side+i;uvs[k*2]=i/segments;uvs[k*2+1]=j/segments;
   if(i<segments&&j<segments)indices.push(k,k+side,k+1,k+1,k+side,k+side+1);
  }
 }
 const geo=new T.BufferGeometry(),pos=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage),birth=new T.BufferAttribute(births,1).setUsage(T.DynamicDrawUsage);
 geo.setAttribute('position',pos);geo.setAttribute('uv',new T.BufferAttribute(uvs,2));geo.setAttribute('born',birth);geo.setIndex(indices);geo.setDrawRange(0,0);
 const uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{clock:{value:0},darkColor:{value:new T.Color().setRGB(.5176471,.01568626,.020405116,T.SRGBColorSpace)},lightColor:{value:new T.Color().setRGB(.8784314,.047627717,.023529427,T.SRGBColorSpace)}}]);
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:T.DoubleSide,fog:true,toneMapped:false,
 vertexShader:`
 attribute float born;
 varying vec2 vDecalUv;varying vec2 vGroundXZ;varying float vBorn;
 #include <fog_pars_vertex>
 void main(){vDecalUv=uv;vGroundXZ=(modelMatrix*vec4(position,1.0)).xz;vBorn=born;
 vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
 }`,
 fragmentShader:`
 uniform float clock;uniform vec3 darkColor;uniform vec3 lightColor;
 varying vec2 vDecalUv;varying vec2 vGroundXZ;varying float vBorn;
 #include <fog_pars_fragment>
 float randomValue(vec2 p){return fract(sin(dot(mod(p,289.0),vec2(12.9898,78.233)))*43758.5453);}
 float valueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(randomValue(i),randomValue(i+vec2(1.,0.)),f.x),mix(randomValue(i+vec2(0.,1.)),randomValue(i+vec2(1.,1.)),f.x),f.y);}
 // Unity Simple Noise's three octaves, normalized by neither layer nor sum.
 float simpleNoise(vec2 uv){vec2 p=uv*40.0;return .125*valueNoise(p)+.25*valueNoise(p/2.0)+.5*valueNoise(p/4.0);}
 void main(){float age=clock-vBorn;if(age<${delay}||age>=${life}.0)discard;
 float maskSize=mix(${startSize}.0,${endSize},clamp((age-${delay})/${spread},0.,1.));
 float radial=max(0.,1.-length(vDecalUv-0.5)*2.*maskSize);
 float a=smoothstep(.153,.27,radial*simpleNoise(vDecalUv+vGroundXZ));
 float light=smoothstep(.2,.35,radial*simpleNoise(vDecalUv));
 // Keep the original two-tone noisy mask; omit Unity's expensive normal/metallic decal passes.
 a*=smoothstep(${delay},${delay+.18},age)*(1.-smoothstep(${life-3}.0,${life}.0,age));
 if(a<.018)discard;
 gl_FragColor=vec4(mix(darkColor,lightColor,light),a*.88);
 #include <colorspace_fragment>
 #include <fog_fragment>
 }`});
 const mesh=new T.Mesh(geo,material);mesh.frustumCulled=false;mesh.name='BloodFX ground decals';mesh.renderOrder=1;scene.add(mesh);
 let cursor=0,count=0,time=0;
 function add(p,size=.35){const slot=cursor++%capacity,first=slot*per,angle=Math.random()*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),extent=size*halfExtent;
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
   const k=first+j*side+i,u=(i/segments*2-1)*extent,v=(j/segments*2-1)*extent,x=p.x+c*u-s*v,z=p.z+s*u+c*v;
   positions[k*3]=x;positions[k*3+1]=height(x,z)+.035;positions[k*3+2]=z;births[k]=time;
  }
  pos.needsUpdate=birth.needsUpdate=true;count=Math.min(capacity,count+1);geo.setDrawRange(0,count*segments*segments*6);
 }
 function update(dt){time+=Math.max(0,dt);uniforms.clock.value=time;}
 return {add,update};
}
