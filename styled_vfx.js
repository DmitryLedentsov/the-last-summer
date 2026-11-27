import {createAdvancedMuzzle} from './advanced_muzzle.js?v=081';
// Texture-driven PSX effects: Binbun Muzzle Flash VFX and knowercoder BloodFX.
// Fixed world-space flash planes, bounded smoke and blood particle pools.
export const FLASH_LIFE=.40;
export const BLOOD_LIFE=1.20;
export const FLASH_SCALE=1.48;
export function flashFrame(age,dt){return age<0?0:age+Math.max(0,dt);}
export function createStyledVFX(T,scene,camera){
 const root=new URL('./assets/curated/vfx/',import.meta.url),loader=new T.TextureLoader(),rnd=Math.random;
 const load=(n,done)=>{const t=loader.load(new URL(n,root).href,done);t.magFilter=T.NearestFilter;t.minFilter=T.LinearMipmapLinearFilter;return t;};
 const front=[load('flash_front_02.png'),load('flash_front_03.png')],side=[load('flash_side_02.png'),load('flash_side_03.png')],smoke=load('Smoke.png'),blood=load('BloodSplat.png',()=>{for(const t of frames)t.needsUpdate=true;});
 const plane=new T.PlaneGeometry(1,1),v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),z=v(0,0,1);
 const flashMat=map=>{const m=new T.MeshBasicMaterial({color:0xffe6aa,alphaMap:map,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,fog:false});m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <alphamap_fragment>','diffuseColor.a *= smoothstep(0.015,0.42,texture2D(alphaMap,vAlphaMapUv).g);');};return m;};
 const shotLight=new T.PointLight(0xffb66e,0,4,2);scene.add(shotLight);let lightAge=Infinity;
 const flashes=Array.from({length:8},(_,i)=>{const g=new T.Group(),mats=[flashMat(front[i%2]),flashMat(side[i%2])];const a=new T.Mesh(plane,mats[0]);a.scale.set(.32,.32,1);a.position.z=.045;g.add(a);
 for(let j=0;j<3;j++){const b=new T.Mesh(plane,mats[1]);b.rotation.set(0,-Math.PI/2,0);b.scale.set(.58,.27,1);b.position.z=.28;const spin=new T.Group();spin.rotation.z=j*Math.PI/3;spin.add(b);g.add(spin);}
 g.visible=false;scene.add(g);return {g,mats,age:Infinity};});
 // Use only the first three compact splash frames; no elongated trailing droplets.
 const frames=Array.from({length:3},(_,i)=>{const t=blood.clone();t.repeat.set(1/3,1/3);t.offset.set((i%3)/3,1-(Math.floor(i/3)+1)/3);t.needsUpdate=true;return t;});
 // Clones share image source but must be uploaded again after asynchronous load.
 const cloudMat=color=>new T.MeshBasicMaterial({color,map:smoke,transparent:true,depthWrite:false,opacity:0,side:T.DoubleSide});
 const clouds=Array.from({length:56},()=>{const m=new T.Mesh(plane,cloudMat(0xb9b5aa));m.visible=false;scene.add(m);return {m,p:v(),vel:v(),t:0,total:1,s:.1,angle:0};});
 const splats=Array.from({length:18},()=>{const g=new T.Group(),mat=new T.MeshBasicMaterial({color:0xa32921,alphaMap:frames[0],transparent:true,depthWrite:false,side:T.DoubleSide,opacity:0});for(let j=0;j<3;j++){const m=new T.Mesh(plane,mat);m.rotation.y=j*Math.PI/3;g.add(m);}g.visible=false;scene.add(g);return {g,mat,p:v(),vel:v(),age:Infinity,total:BLOOD_LIFE,s:.3};});
 const advanced=createAdvancedMuzzle(T,scene,load,front[1],side[0]);let advancedEnabled=true;
 function setAdvanced(value){if(advancedEnabled===!!value)return;advancedEnabled=!!value;advanced.clear();for(const f of flashes)f.g.visible=false;lightAge=Infinity;shotLight.intensity=0;}
 let fi=0,ci=0,bi=0;
 function cloud(p,d){const c=clouds[ci++%clouds.length];c.p.copy(p);c.vel.copy(d).multiplyScalar(.48).add(v((rnd()-.5)*.24,.16+rnd()*.18,(rnd()-.5)*.24));c.t=c.total=.66+rnd()*.20;c.s=.13+rnd()*.045;c.angle=rnd()*Math.PI*2;c.m.material.color.set(0xc2bcb1);c.m.material.opacity=.49;c.m.position.copy(p);c.m.scale.setScalar(c.s);c.m.visible=true;}
 function muzzle(p,d,near=true){if(advancedEnabled&&near){advanced.muzzle(p,d);shotLight.position.copy(p);shotLight.intensity=10;lightAge=-1;for(let i=0;i<3;i++)cloud(p,d);return;}const f=flashes[fi++%flashes.length];f.age=-1;f.g.position.copy(p).addScaledVector(d,.035);f.g.quaternion.setFromUnitVectors(z,d);f.g.rotateZ(rnd()*6.28);f.g.scale.setScalar(FLASH_SCALE*(.9+rnd()*.24));f.g.visible=true;shotLight.position.copy(p);shotLight.intensity=10;lightAge=-1;for(const m of f.mats)m.opacity=1;for(let i=0;i<3;i++)cloud(p,d);}
 function hit(p,d){const b=splats[bi++%splats.length];b.p.copy(p);b.vel.copy(d).multiplyScalar(.26);b.age=-1;b.total=BLOOD_LIFE;b.s=.66+rnd()*.16;b.g.position.copy(p);b.g.quaternion.setFromUnitVectors(z,d);b.g.rotateZ(rnd()*6.28);b.g.scale.setScalar(b.s);b.mat.alphaMap=frames[0];b.mat.opacity=.9;b.g.visible=true;}
 function update(dt){
 advanced.update(dt);
 lightAge=flashFrame(lightAge,dt);shotLight.intensity=10*Math.max(0,1-lightAge/(advancedEnabled?.40:.20));
 for(const f of flashes)if(f.g.visible){f.age=flashFrame(f.age,dt);const k=Math.max(0,1-f.age/FLASH_LIFE);f.g.visible=k>0;for(const m of f.mats)m.opacity=Math.min(1,k*1.6);}

 for(const c of clouds)if(c.t>0){c.t=Math.max(0,c.t-dt);const k=c.t/c.total;c.m.visible=c.t>0;if(!c.t)continue;c.p.addScaledVector(c.vel,dt);c.m.position.copy(c.p);c.m.quaternion.copy(camera.quaternion);c.m.rotateZ(c.angle);c.m.scale.setScalar(c.s*(1+(1-k)*2));c.m.material.opacity=k*.49;}
 for(const b of splats)if(b.g.visible){const first=b.age<0;b.age=flashFrame(b.age,dt);const k=Math.max(0,1-b.age/b.total);b.g.visible=k>0;if(!k)continue;if(!first)b.p.addScaledVector(b.vel,dt*.65);b.g.position.copy(b.p);b.g.scale.setScalar(b.s*(1+(1-k)*.65));b.mat.alphaMap=frames[Math.min(2,Math.floor((1-k)*3))];b.mat.opacity=Math.min(1,k*2.7)*.95;}}
 return {muzzle,hit,update,setAdvanced,stats:()=>({flash:flashes.filter(f=>f.g.visible).length+advanced.count(),smoke:clouds.filter(c=>c.t>0).length,splats:splats.filter(b=>b.g.visible).length})};
}
