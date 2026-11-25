import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
const run = async function run(THREE,FBXLoader,RGBELoader){
  const $=s=>document.querySelector(s), status=$('#status'), menu=$('#menu'), start=$('#start'), hint=$('#hint'), dot=$('#dot');
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,180);
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1)*.8);
  renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);
  scene.fog=new THREE.FogExp2(0xb8c6c6,.0135);
  const ambient=new THREE.HemisphereLight(0xd6e3f3,0x7b7853,2.0);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffe3b5,2.15);sun.position.set(-33,43,19);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:125});
  sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;scene.add(sun);
  let seed=3317;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const asset=p=>new URL('./assets/'+p,import.meta.url).href;
  const canvasTexture=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;};
  const sky=canvasTexture(1024,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#678ab0');g.addColorStop(.46,'#c6d4d3');g.addColorStop(.58,'#d0d7ce');g.addColorStop(1,'#919582');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<95;i++){const x=rnd()*w,y=45+rnd()*170,r=15+rnd()*75;const a=c.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,'rgba(245,242,225,.26)');a.addColorStop(1,'rgba(245,242,225,0)');c.fillStyle=a;c.fillRect(x-r,y-r,r*2,r*2);}});
  sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;
  let pack=false;try{const r=await fetch(asset('manifest.json'));pack=r.ok&&((await r.json()).version===1);}catch{}
  const manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const name=url.split(/[\\/]/).pop();if(/^[1-6]h\.png$/i.test(name))return asset('houses/'+name);return url;});
  const fbx=new FBXLoader(manager),textures=new THREE.TextureLoader(manager);
  const load=async(path,loader)=>{if(!pack)return null;try{return await loader.loadAsync(asset(path));}catch(e){console.warn('Asset fallback:',path,e);return null;}};
  const tune=t=>{t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;return t;};
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:1,...extra});
  const concrete=mat(0xaaa394),metal=mat(0x567368),rust=mat(0x855548),wood=mat(0x887c54),rubber=mat(0x393b32);
  const colliders=[],interactions=[];
  const box=(w,h,d,m,x,y,z,parent=scene,shadow=true)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;};
  const pipe=(a,b,r,m,parent=scene)=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),7),m);o.position.copy(new THREE.Vector3(...a).addScaledVector(v,.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;parent.add(o);return o;};
  const bounds=o=>{o.updateMatrixWorld(true);return new THREE.Box3().setFromObject(o);};
  const solid=o=>{const b=bounds(o);colliders.push({x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z});};
  const patch=(w,d,x,z,m,y=.012)=>{const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);o.rotation.x=-Math.PI/2;o.position.set(x,y,z);o.receiveShadow=true;scene.add(o);return o;};
  const noiseTex=(color,range)=>canvasTexture(128,128,(c,w,h)=>{const a=c.createImageData(w,h);for(let i=0;i<w*h;i++){const n=(rnd()-.5)*range;for(let j=0;j<3;j++)a.data[i*4+j]=color[j]+n;a.data[i*4+3]=255;}c.putImageData(a,0,0);});
  const tile=(t,x,y)=>{tune(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);return t;};
  const [grass,gravel,dirt,hdr,forest,nature,...houses]=await Promise.all([
    load('ground/PSX_Seamless_ShortForestGrass_128px.png',textures),load('ground/PSX_Seamless_ForestGravel_Ground_128px.png',textures),load('ground/PSX_Seamless_ForestEarthGround_128px.png',textures),
    load('sky/DAYSKY.hdr',new RGBELoader()),load('forest/forest.fbx',fbx),load('nature/nature.fbx',fbx),
    ...[3,5,6,7].map(n=>load('houses/house0'+n+'.fbx',fbx))
  ]);
  if(hdr){hdr.mapping=THREE.EquirectangularReflectionMapping;scene.background=hdr;scene.backgroundIntensity=.85;}
  patch(180,180,0,0,mat(0xa4a68d,{map:tile(grass||noiseTex([110,126,80],52),90,90)}),0);
  const roadTex=gravel||noiseTex([139,137,123],37);
  const road=(w,d,x,z)=>patch(w,d,x,z,mat(0xb8b2a0,{map:tile(roadTex.clone(),w/2,d/2)}));
  road(5,71,0,0);road(70,5,0,-9);road(62,3.5,0,25);
  patch(15,12,10,4,mat(0xbcb298,{map:tile(dirt||noiseTex([139,120,91],42),8,6)}),.022);
  const prepare=(o,foliage=false)=>{o.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;if(m.map)tune(m.map);m.opacity=1;m.transparent=false;if(foliage&&/crown|corwn|grass|dandelion|leaf|bush|lavender|reed/i.test(m.name+' '+n.name)){m.side=THREE.DoubleSide;m.alphaMap=null;m.alphaTest=.45;}else{m.alphaTest=0;}if(m.specular)m.specular.setScalar(.05);m.needsUpdate=true;}});return o;};
  const normalized=(obj,height)=>{const wrapper=new THREE.Group(),inner=new THREE.Group();inner.add(obj);wrapper.add(inner);const b=bounds(obj),s=height/Math.max(.001,b.max.y-b.min.y);inner.scale.setScalar(s);inner.position.set(-(b.min.x+b.max.x)*s/2,-b.min.y*s,-(b.min.z+b.max.z)*s/2);return wrapper;};
  const facade=canvasTexture(128,128,(c,w,h)=>{c.fillStyle='#a5a298';c.fillRect(0,0,w,h);for(let i=0;i<1600;i++){c.fillStyle=rnd()<.5?'#88877c22':'#e1d4ba25';c.fillRect(rnd()*w,rnd()*h,2+rnd()*3,1+rnd()*3);}c.strokeStyle='#777971';c.strokeRect(1,1,126,126);for(let x=17;x<116;x+=53){c.fillStyle='#d2c9b8';c.fillRect(x,17,38,74);c.fillStyle='#424f52';c.fillRect(x+4,21,30,65);c.fillStyle='#9ba4a0';c.fillRect(x+18,21,2,65);c.fillStyle='#888e86';c.fillRect(x+4,50,30,2);c.fillStyle='#716c61';c.fillRect(x-2,91,42,5);}});
  function fallbackHouse(w,h,d){const g=new THREE.Group();const wall=mat(0xc4beb0,{map:tile(facade.clone(),Math.max(1,Math.round(w/5)),Math.max(1,Math.round(h/3)))}),side=mat(0xbcb8a9,{map:tile(facade.clone(),Math.max(1,Math.round(d/5)),Math.max(1,Math.round(h/3)))});box(w,h,d,[side,side,concrete,concrete,wall,wall],0,h/2,0,g);box(w+.4,.3,d+.4,concrete,0,h,0,g);box(2.2,2.6,.12,metal,0,1.3,d/2+.08,g);return g;}
  const buildings=[[-27,-12,27,.15,26,23],[0,-34,13,0,17,10],[28,-13,27,-.08,17,15],[-29,29,15,0,25,12]];
  const houseOrder=[houses[1],houses[0],houses[2],houses[3]];
  buildings.forEach(([x,z,h,rot,w,d],i)=>{const o=houseOrder[i]?normalized(prepare(houseOrder[i]),h):fallbackHouse(w,h,d);o.rotation.y=rot;o.position.set(x,0,z);scene.add(o);solid(o);});
  const isolated=(collection,name,height)=>{if(!collection)return null;collection.updateMatrixWorld(true);let found;collection.traverse(n=>{if(n.isMesh&&n.name.trim()===name)found=n;});if(!found)return null;const clone=found.clone();found.matrixWorld.decompose(clone.position,clone.quaternion,clone.scale);return normalized(prepare(clone,true),height);};
  const treeTemplates=[1,2,3,4].map(i=>isolated(forest,'PSX_Tree'+i,8));
  const grassTemplate=isolated(forest,'PSX_Grass',.55),flowerTemplate=isolated(forest,'PSX_Dandelion',.36),rockTemplate=isolated(forest,'PSX_Rock',.65);
  const bushTemplate=isolated(nature,'Bush',1.25);
  function fallbackTree(){const g=new THREE.Group();pipe([0,0,0],[.12,6,0],.19,wood,g);for(let i=0;i<5;i++){const o=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),mat([0x607b48,0x768b51,0x506b42][i%3]));o.position.set((rnd()-.5)*2,4.2+rnd()*2.5,(rnd()-.5)*2);o.scale.set(1.5,1.8,1.5);g.add(o);}return g;}
  for(let i=0;i<4;i++)if(!treeTemplates[i])treeTemplates[i]=fallbackTree();
  const clear=(x,z,r)=>!colliders.some(b=>x+r>b.x0&&x-r<b.x1&&z+r>b.z0&&z-r<b.z1);
  const onPath=(x,z)=>Math.abs(x)<3.8||Math.abs(z+9)<3.4||Math.abs(z-25)<2.6||(x>1&&x<19&&z>-3&&z<11);
  const place=(template,x,z,s=1,rot=0)=>{const o=template.clone(true);o.position.set(x,0,z);o.scale.setScalar(s);o.rotation.y=rot;scene.add(o);return o;};
  const treeAt=(x,z,s,i)=>{if(!clear(x,z,1.2)||onPath(x,z))return;place(treeTemplates[i%4],x,z,s,rnd()*Math.PI*2);colliders.push({x0:x-.32*s,x1:x+.32*s,z0:z-.32*s,z1:z+.32*s});};
  [[-8,12],[6,16],[-9,-2],[17,-1],[-15,18],[23,20],[-12,-23],[13,-22],[9,30],[-5,32]].forEach(([x,z],i)=>treeAt(x,z,.9+rnd()*.4,i));
  for(let i=0;i<125;i++){const edge=i%4;let x=(rnd()-.5)*100,z=(rnd()-.5)*100;if(edge===0)x=-44-rnd()*13;if(edge===1)x=44+rnd()*13;if(edge===2)z=-44-rnd()*13;if(edge===3)z=44+rnd()*13;treeAt(x,z,.75+rnd()*.65,i);}
  function instanceScatter(template,points){if(!template||!points.length)return;template.updateMatrixWorld(true);const tmp=new THREE.Object3D();template.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld);const mesh=new THREE.InstancedMesh(g,n.material,points.length);points.forEach(([x,z,s,a],i)=>{tmp.position.set(x,0,z);tmp.scale.setScalar(s);tmp.rotation.set(0,a,0);tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);});mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);});}
  const scatter=[[],[],[],[]];for(let i=0;i<1000;i++){const x=(rnd()-.5)*88,z=(rnd()-.5)*88;if(!onPath(x,z)&&clear(x,z,.4))scatter[i%4].push([x,z,.6+rnd()*.8,rnd()*Math.PI*2]);}
  instanceScatter(grassTemplate,scatter[0].concat(scatter[1]));instanceScatter(flowerTemplate,scatter[2]);instanceScatter(bushTemplate,scatter[3].slice(0,25));instanceScatter(rockTemplate,scatter[3].slice(25,48));
  function bench(x,z,a){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=a;for(const dx of [-.82,.82]){box(.12,.48,.48,concrete,dx,.24,0,g);box(.09,.8,.09,metal,dx,.52,-.22,g);}for(let i=0;i<3;i++)box(2.1,.055,.13,wood,0,.49,-.17+i*.15,g);for(let i=0;i<2;i++)box(2.1,.13,.055,wood,0,.72+i*.15,-.27,g);scene.add(g);solid(g);interactions.push({x,z,prompt:'E — вспомнить',message:'Мы сидели здесь до самого вечера.'});}
  bench(-4.5,7,Math.PI/2);bench(16,11,Math.PI);bench(-5,-13,0);
  const swing=new THREE.Group();swing.position.set(10,0,3);scene.add(swing);
  for(const x of [-1.65,1.65]){pipe([x,0,-.85],[x,2.6,0],.065,metal,swing);pipe([x,0,.85],[x,2.6,0],.065,metal,swing);}
  pipe([-1.8,2.6,0],[1.8,2.6,0],.07,rust,swing);
  const pivot=new THREE.Group();pivot.position.y=2.53;swing.add(pivot);for(const x of [-.35,.35])pipe([x,0,0],[x,-1.95,0],.018,metal,pivot);box(.88,.07,.29,wood,0,-1.95,0,pivot);
  let swingKick=0;interactions.push({x:10,z:3,prompt:'E — качнуть качели',action:()=>{swingKick=.53;},message:'Тихий скрип.'});
  for(const x of [-1.65,1.65])colliders.push({x0:10+x-.15,x1:10+x+.15,z0:2.05,z1:3.95});
  const sand=new THREE.Group();sand.position.set(13,0,7);scene.add(sand);box(2.7,.1,2.7,mat(0xb6a17c),0,.05,0,sand);for(const z of [-1.35,1.35])box(2.9,.3,.16,rust,0,.15,z,sand);for(const x of [-1.35,1.35])box(.16,.3,2.7,metal,x,.15,0,sand);solid(sand);
  for(const [x,z] of [[-3,19],[3,-18],[18,-5],[-17,24]]){pipe([x,0,z],[x,4.4,z],.075,metal);pipe([x,4.4,z],[x+.6,4.4,z],.045,metal);box(.45,.12,.25,concrete,x+.6,4.35,z);}
  // First-person movement. Collision is deliberately simple for this outdoor prototype.
  const keys=new Set(), pos=new THREE.Vector3(0,1.68,18), velocity=new THREE.Vector2();let yaw=0,pitch=0,phase=0,noticeUntil=0,notice='',locked=false;
  camera.rotation.order='YXZ';camera.position.copy(pos);
  function pause(){keys.clear();velocity.set(0,0);menu.hidden=false;dot.hidden=true;hint.hidden=true;start.textContent='Продолжить';}
  document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;if(locked){menu.hidden=true;dot.hidden=false;}else pause();});
  document.addEventListener('pointerlockerror',()=>{status.textContent='Браузер не разрешил захват мыши. Нажми кнопку ещё раз.';});
  start.onclick=()=>{try{const p=renderer.domElement.requestPointerLock();if(p?.catch)p.catch(()=>{status.textContent='Не удалось захватить мышь.';});}catch{status.textContent='Захват мыши недоступен.';}};
  document.addEventListener('mousemove',e=>{if(!locked)return;yaw-=e.movementX*.0021;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0021,-1.48,1.48);});
  const near=()=>interactions.find(v=>Math.hypot(v.x-pos.x,v.z-pos.z)<2.6);
  document.addEventListener('keydown',e=>{if(!locked)return;keys.add(e.code);if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyE'&&!e.repeat){const v=near();if(v){v.action?.();notice=v.message;noticeUntil=performance.now()+3500;}}});
  document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();velocity.set(0,0);if(locked)document.exitPointerLock();});
  const canWalk=(x,z)=>Math.abs(x)<43&&Math.abs(z)<43&&clear(x,z,.32);
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  const loaded=[...houseOrder,forest,grass,gravel,hdr].filter(Boolean).length;
  status.textContent=pack?'Локация 01 / загружено ключевых ассетов: '+loaded+'/8':'Локация 01 / резервные модели. Для оригинальных ассетов распакуй пакет в корень проекта.';
  start.disabled=false;
  let last=performance.now();
  renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;
    if(locked){let f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),r=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));const l=Math.hypot(f,r)||1;f/=l;r/=l;const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?4.8:2.65;
      const vx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed,vz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed;
      velocity.lerp(new THREE.Vector2(vx,vz),1-Math.exp(-12*dt));const dx=velocity.x*dt,dz=velocity.y*dt;
      if(canWalk(pos.x+dx,pos.z))pos.x+=dx;else velocity.x=0;if(canWalk(pos.x,pos.z+dz))pos.z+=dz;else velocity.y=0;
      phase+=velocity.length()*dt*3.2;camera.position.set(pos.x,1.68+Math.sin(phase)*Math.min(.025,velocity.length()*.007),pos.z);camera.rotation.set(pitch,yaw,0);
      const v=near();hint.hidden=now>=noticeUntil&&!v;hint.textContent=now<noticeUntil?notice:(v?.prompt||'');
    }
    swingKick*=Math.exp(-dt*.35);pivot.rotation.x=Math.sin(now*.0021)*(.025+swingKick);renderer.render(scene,camera);
  });
};
await run(THREE, FBXLoader, RGBELoader);
