// Texture-driven PSX effects: Binbun Muzzle Flash VFX and knowercoder BloodFX.
// Fixed world-space flash planes, bounded smoke and blood particle pools.
export function createStyledVFX(T,scene,camera){
 const root=new URL('./assets/curated/vfx/',import.meta.url),loader=new T.TextureLoader(),rnd=Math.random;
 const load=(n,done)=>{const t=loader.load(new URL(n,root).href,done);t.magFilter=T.NearestFilter;t.minFilter=T.LinearMipmapLinearFilter;return t;};
 const front=[load('flash_front_02.png'),load('flash_front_03.png')],side=[load('flash_side_02.png'),load('flash_side_03.png')],smoke=load('Smoke.png'),blood=load('BloodSplat.png',()=>{for(const t of frames)t.needsUpdate=true;});
 const plane=new T.PlaneGeometry(1,1),v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),z=v(0,0,1);
 const flashMat=map=>new T.MeshBasicMaterial({color:0xffb95b,alphaMap:map,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
 const shotLight=new T.PointLight(0xffb66e,0,4,2);scene.add(shotLight);let lightTime=0;
 const flashes=Array.from({length:8},(_,i)=>{const g=new T.Group(),mats=[flashMat(front[i%2]),flashMat(side[i%2])];const a=new T.Mesh(plane,mats[0]);a.scale.set(.24,.24,1);a.position.z=.025;g.add(a);
 for(let j=0;j<3;j++){const b=new T.Mesh(plane,mats[1]);b.rotation.set(0,Math.PI/2,0);b.scale.set(.38,.19,1);b.position.z=.16;const spin=new T.Group();spin.rotation.z=j*Math.PI/3;spin.add(b);g.add(spin);}
 g.visible=false;scene.add(g);return {g,mats,t:0};});
 // Blood atlas is a 3x3 grayscale mask, played as successive short frames.
 const frames=Array.from({length:9},(_,i)=>{const t=blood.clone();t.repeat.set(1/3,1/3);t.offset.set((i%3)/3,1-(Math.floor(i/3)+1)/3);t.needsUpdate=true;return t;});
 // Clones share image source but must be uploaded again after asynchronous load.
 const cloudMat=color=>new T.MeshBasicMaterial({color,map:smoke,transparent:true,depthWrite:false,opacity:0,side:T.DoubleSide});
 const clouds=Array.from({length:56},()=>{const m=new T.Mesh(plane,cloudMat(0xb9b5aa));m.visible=false;scene.add(m);return {m,p:v(),vel:v(),t:0,total:1,s:.1,angle:0,blood:false};});
 const splats=Array.from({length:18},()=>{const g=new T.Group(),mat=new T.MeshBasicMaterial({color:0xa32921,alphaMap:frames[0],transparent:true,depthWrite:false,side:T.DoubleSide,opacity:0});for(let j=0;j<3;j++){const m=new T.Mesh(plane,mat);m.rotation.y=j*Math.PI/3;g.add(m);}g.visible=false;scene.add(g);return {g,mat,p:v(),vel:v(),t:0,total:.24,s:.3};});
 let fi=0,ci=0,bi=0;
 function cloud(p,d,isBlood){const c=clouds[ci++%clouds.length];c.p.copy(p);c.vel.copy(d).multiplyScalar(isBlood?.35:.48).add(v((rnd()-.5)*.24,.16+rnd()*.18,(rnd()-.5)*.24));c.t=c.total=isBlood?.24+rnd()*.12:.44+rnd()*.18;c.s=isBlood?.16:.085+rnd()*.035;c.angle=rnd()*Math.PI*2;c.blood=isBlood;c.m.material.color.set(isBlood?0x7d201a:0xc2bcb1);c.m.material.opacity=isBlood?.42:.34;c.m.position.copy(p);c.m.scale.setScalar(c.s);c.m.visible=true;}
 function muzzle(p,d){const f=flashes[fi++%flashes.length];f.t=.055;f.g.position.copy(p);f.g.quaternion.setFromUnitVectors(z,d);f.g.rotateZ(rnd()*6.28);f.g.scale.setScalar(.85+rnd()*.24);f.g.visible=true;shotLight.position.copy(p);shotLight.intensity=10;lightTime=.055;for(const m of f.mats)m.opacity=1;for(let i=0;i<3;i++)cloud(p,d,false);}
 function hit(p,d){const b=splats[bi++%splats.length];b.p.copy(p);b.vel.copy(d).multiplyScalar(.7);b.t=b.total=.23;b.s=.26+rnd()*.1;b.g.position.copy(p);b.g.quaternion.setFromUnitVectors(z,d);b.g.rotateZ(rnd()*6.28);b.g.scale.setScalar(b.s);b.mat.alphaMap=frames[0];b.mat.opacity=.9;b.g.visible=true;for(let i=0;i<2;i++)cloud(p,d,true);}
 function update(dt){lightTime=Math.max(0,lightTime-dt);shotLight.intensity=10*lightTime/.055;for(const f of flashes)if(f.t>0){f.t=Math.max(0,f.t-dt);const k=f.t/.055;f.g.visible=f.t>0;for(const m of f.mats)m.opacity=k;}
 for(const c of clouds)if(c.t>0){c.t=Math.max(0,c.t-dt);const k=c.t/c.total;c.m.visible=c.t>0;if(!c.t)continue;c.p.addScaledVector(c.vel,dt);c.m.position.copy(c.p);c.m.quaternion.copy(camera.quaternion);c.m.rotateZ(c.angle);c.m.scale.setScalar(c.s*(1+(1-k)*2));c.m.material.opacity=k*(c.blood?.42:.34);}
 for(const b of splats)if(b.t>0){b.t=Math.max(0,b.t-dt);const k=b.t/b.total;b.g.visible=b.t>0;if(!b.t)continue;b.p.addScaledVector(b.vel,dt);b.g.position.copy(b.p);b.g.scale.setScalar(b.s*(1+(1-k)*.9));b.mat.alphaMap=frames[Math.min(8,Math.floor((1-k)*9))];b.mat.opacity=Math.min(1,k*2)*.9;}}
 return {muzzle,hit,update};
}
