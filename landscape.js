import {createTouchControls,mergeMotion,applyTouchQuality} from './touch_controls.js?v=047';
import * as THREE from 'three';
import {trunkFootprint,treeCollider,hitsCollider} from './tree_collision.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {levels,trailMask} from './levels.js';
import {createHeightfield,buildTerrainGeometry} from './terrain.js';

const id=new URLSearchParams(location.search).get('level');
const level=Object.hasOwn(levels,id)?levels[id]:levels.sunset;
const $=s=>document.querySelector(s), menu=$('#menu'), start=$('#start'), status=$('#status'), hint=$('#hint'), dot=$('#dot');
$('#title').textContent=level.title;$('#subtitle').textContent=level.subtitle;document.title=level.title+' — Последнее лето';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1)*.8);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,185);camera.rotation.order='YXZ';scene.fog=new THREE.FogExp2(level.fog,level.density);
const hemi=new THREE.HemisphereLight(level.hemi,level.ground,level.ambient);scene.add(hemi);
const sun=new THREE.DirectionalLight(level.sun,level.sunPower);sun.position.set(...level.sunPos);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:145});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;scene.add(sun);
const root=new URL('./assets/',import.meta.url), asset=p=>new URL(p,root).href;
const manager=new THREE.LoadingManager();const texturePaths=new Map();for(const name of ['dirt.JPG','grass.jpg','ivy.JPG','leaf.JPG','rock.jpg','sky.JPG','stone.JPG','stonebuild.JPG','stonewall.JPG','treeleaf.jpg','water.jpg','wood.JPG','woodplank.JPG'])texturePaths.set(name.toLowerCase(),'curated/nature/'+name);for(const n of [8937,8970,9023,9024,9030,9034,9035,9036,9037])texturePaths.set('sam_'+n+'.jpg','curated/palast/SAM_'+n+'.JPG');for(let i=1;i<=6;i++)texturePaths.set(i+'h.png','curated/houses/'+i+'h.png');
manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const name=url.split(/[\\/]/).pop().toLowerCase();return texturePaths.has(name)?asset(texturePaths.get(name)):url;});
const textures=new THREE.TextureLoader(manager), fbx=new FBXLoader(manager), failures=[];
function tune(t){if(!t)return t;t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.anisotropy=2;return t;}
async function load(p,loader){try{return await loader.loadAsync(asset(p));}catch(e){console.warn('Asset unavailable',p,e);failures.push(p);return null;}}
const groundPath=s=>'curated/ground/PSX_Seamless_'+s+'_128px.png';
const [sky,grass,earth,forest,nature,palast,house]=await Promise.all([
 load('derived/'+level.sky+'.jpg',textures),load(groundPath(level.grass),textures),load(groundPath(level.path),textures),load('curated/forest/forest_collection.fbx',fbx),load('curated/nature/nature_collection.fbx',fbx),id==='twilight'?load('curated/palast/palast_collection.fbx',fbx):null,id==='sunset'||id==='mist'?load('curated/houses/house05.fbx',fbx):null]);
if(!sky||!grass||!earth||!forest){status.textContent='Не загрузились основные ассеты. Проверь папку assets и консоль.';throw new Error('Required landscape assets missing');}
sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;
for(const t of [grass,earth]){tune(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;}
const field=createHeightfield({size:level.size,segments:160,height:level.height});const height=field.sample;
const terrainMat=new THREE.MeshStandardMaterial({map:grass,roughness:1,color:0xe0ddce});
terrainMat.onBeforeCompile=s=>{s.uniforms.trailMap={value:earth};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float trailWeight; varying float vTrail;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTrail=trailWeight;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D trailMap; varying float vTrail;').replace('#include <map_fragment>','diffuseColor *= mix(texture2D(map,vMapUv),texture2D(trailMap,vMapUv),smoothstep(0.0,1.0,vTrail));');};
const terrain=new THREE.Mesh(buildTerrainGeometry(THREE,field,(x,z)=>trailMask(level,x,z)),terrainMat);terrain.receiveShadow=true;scene.add(terrain);
let seed=level.seed;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const colliders=[],interactions=[];
function prepare(obj){obj.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;tune(m.map);if(m.map)m.color?.set(0xffffff);m.opacity=1;m.transparent=false;const cutout=/crown|corwn|grass|dandelion|leaf|bush|lavender|reed|plant/i.test(m.name+' '+n.name);if(cutout){m.alphaTest=.42;m.side=THREE.DoubleSide;m.alphaMap=null;}else m.alphaTest=0;if(m.specular)m.specular.setScalar(.025);m.needsUpdate=true;}});return obj;}
function normalized(o,h){const wrapper=new THREE.Group(),inner=new THREE.Group();inner.add(o);wrapper.add(inner);wrapper.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o),s=h/Math.max(.001,b.max.y-b.min.y);inner.scale.setScalar(s);inner.position.set(-(b.min.x+b.max.x)*s/2,-b.min.y*s,-(b.min.z+b.max.z)*s/2);wrapper.updateMatrixWorld(true);return wrapper;}
function template(collection,name,h){if(!collection)return null;collection.updateMatrixWorld(true);let found;collection.traverse(n=>{if(n.isMesh&&n.name.trim().toLowerCase()===name.toLowerCase())found=n;});if(!found){console.warn('Missing model',name);return null;}const c=found.clone();found.matrixWorld.decompose(c.position,c.quaternion,c.scale);return normalized(prepare(c),h);}
function groundPlace(o,x,z,rot=0,s=1,offset=0){o.position.set(x,height(x,z)+offset,z);o.rotation.y=rot;o.scale.setScalar(s);scene.add(o);o.updateMatrixWorld(true);return o;}
function aabb(o,pad=.05){const b=new THREE.Box3().setFromObject(o);colliders.push({x0:b.min.x-pad,x1:b.max.x+pad,z0:b.min.z-pad,z1:b.max.z+pad});}
function trunk(x,z,r){colliders.push({x,z,r});}
function free(x,z,r=.28){return !colliders.some(c=>hitsCollider(c,x,z,r));}
function batch(t,points,shadow=false){if(!t||!points.length)return;t.updateMatrixWorld(true);const dummy=new THREE.Object3D();t.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld),m=new THREE.InstancedMesh(g,n.material,points.length);points.forEach(([x,z,s,a],i)=>{dummy.position.set(x,height(x,z)-.025,z);dummy.rotation.set(0,a,0);dummy.scale.setScalar(s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.instanceMatrix.needsUpdate=true;m.castShadow=shadow;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);});}
const trees=level.treeSpecies.map(n=>template(forest,n,8)).filter(Boolean);if(!trees.length)throw new Error('Forest collection has no matching trees');
const treePoints=trees.map(()=>[]),treeFeet=trees.map(t=>trunkFootprint(THREE,t)),treeReplacements=[];function addTree(x,z,s,i){if(!free(x,z,1.7)||Math.abs(x-level.trail(z))<level.trailWidth+1.9||Math.hypot(x-level.spawn[0],z-level.spawn[1])<2.6)return;const j=i%trees.length,a=rnd()*Math.PI*2;treePoints[j].push([x,z,s,a]);treeReplacements.push([colliders.length,treeCollider(treeFeet[j],x,z,s,a)]);trunk(x,z,.36*s);}
// The opening view is framed by trunks, with the horizon visible over the far ridge.
if(level.sky==='sunset')for(const [i,p] of [[-5,23], [5.7,21],[-9,14],[9,10],[-6,-6],[8,-10]].entries())addTree(...p,1.0+i%3*.2,i);
for(let n=0;n<level.trees*6&&treePoints.reduce((a,p)=>a+p.length,0)<level.trees;n++){
 const x=(rnd()-.5)*(level.size-4),z=(rnd()-.5)*(level.size-4);if(level.sky==='sunset'&&z<-23&&Math.abs(x)<12)continue;if(level.sky==='mist'&&Math.abs(x)<13&&z<-5&&z>-26)continue;addTree(x,z,.7+rnd()*.8,n);
}
trees.forEach((t,i)=>batch(t,treePoints[i],true));
const grassT=template(forest,'PSX_Grass',.43), flowers=template(forest,level.flowers,.68), reed=template(forest,'PSX_Reed',.65), rocks=template(forest,'PSX_Rock',.65), bush=template(nature,'Bush',1.2), trunkT=template(forest,'PSX_Treetrunk',1.1);
function scatter(t,count,min,max,condition,shadow=false){const points=[];for(let n=0;n<count*4&&points.length<count;n++){const x=(rnd()-.5)*(level.size-5),z=(rnd()-.5)*(level.size-5);if(condition(x,z)&&free(x,z,.12))points.push([x,z,min+rnd()*(max-min),rnd()*Math.PI*2]);}batch(t,points,shadow);}
const offPath=(x,z)=>trailMask(level,x,z)<.16;
scatter(grassT,level.grassCount,.55,1.5,offPath);scatter(flowers,level.sky==='sunset'?330:170,.65,1.4,(x,z)=>offPath(x,z)&&Math.sin(x*.33+z*.25)>.1);scatter(bush,level.sky==='mist'?80:125,.6,1.4,offPath,true);scatter(rocks,level.sky==='twilight'?180:65,.55,1.8,offPath,true);scatter(trunkT,18,.65,1.3,offPath,true);if(level.sky==='mist')scatter(reed,260,.8,1.5,(x,z)=>offPath(x,z)&&height(x,z)<.4);
const stone=new THREE.MeshStandardMaterial({color:0x9c9c87,map:tune(await load('curated/nature/stone.JPG',textures)),roughness:1});const wood=new THREE.MeshStandardMaterial({color:0x887255,roughness:1}), iron=new THREE.MeshStandardMaterial({color:0x545b58,roughness:1});
function box(w,h,d,m,x,y,z,parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function bench(x,z,a){const b=new THREE.Group();for(const xx of [-.85,.85]){box(.12,.5,.5,iron,xx,.25,0,b);box(.08,.85,.08,iron,xx,.48,-.22,b);}for(let i=0;i<3;i++)box(2.1,.06,.15,wood,0,.52,-.18+i*.17,b);for(let i=0;i<2;i++)box(2.1,.15,.06,wood,0,.75+i*.17,-.23,b);groundPlace(b,x,z,a);aabb(b);interactions.push({x,z,message:'Кажется, кто-то ещё недавно сидел здесь.',prompt:'E — осмотреть лавочку'});}
function sign(x,z,msg){const g=new THREE.Group();box(.1,1.7,.1,wood,0,.85,0,g);box(.95,.42,.08,wood,0,1.55,0,g);groundPlace(g,x,z,.15);trunk(x,z,.15);interactions.push({x,z,message:msg,prompt:'E — осмотреть указатель'});}
if(level.sky==='sunset'){
 bench(level.trail(-18)+2.1,-18,.1);sign(level.trail(13)+2,13,'До города — 3 км. Дорога больше никуда не ведёт.');
 if(house){const base=normalized(prepare(house),14);groundPlace(base,30,-41,0,1,-1.5);aabb(base);}
}else if(level.sky==='mist'){
 bench(level.trail(4)+2.6,4,0);sign(level.trail(-13)+2.5,-13,'Расписание выцвело. Следующий поезд никогда не придёт.');
 // A tiny forgotten shelter, deliberately distinct from the mystical courtyard.
 const g=new THREE.Group();box(3.4,.18,2.6,stone,0,2.4,0,g);box(3.4,2.4,.15,stone,0,1.2,-1.2,g);for(const x of [-1.5,1.5])box(.12,2.4,.12,iron,x,1.2,1.1,g);groundPlace(g,level.trail(-17)+3.4,-17,.1);aabb(g);
}else{
 const monuments=[['obelisk',4.1,-7,-9],['shrine',2.6,4,-15],['AngelWall',3.2,8,-21],['Devilsface',1.5,-6,4]];
 for(const [n,h,x,z] of monuments){const t=template(palast,n,h);if(t){groundPlace(t,x,z,rnd()*.7);aabb(t);interactions.push({x,z,prompt:'E — осмотреть камень',message:'На камне нет ни одной знакомой буквы.'});}}
 const x=level.trail(-28)+2.4,z=-28;const t=template(palast,'obelisk',6);if(t){groundPlace(t,x,z,.4);aabb(t);const l=new THREE.PointLight(0x56d9c7,38,12,2);l.position.set(x,height(x,z)+1.6,z+1.5);scene.add(l);}
 sign(level.trail(13)+2,13,level.message);
}
for(const [index,shape] of treeReplacements)colliders[index]=shape;
// Choose a collision-free spawn and sample the same terrain triangles as the ground mesh.
const pos=new THREE.Vector3(level.spawn[0],0,level.spawn[1]);if(!free(pos.x,pos.z)){let found=false;for(let dz=-4;dz<=4&&!found;dz+=.5)for(let dx=-4;dx<=4;dx+=.5)if(free(pos.x+dx,pos.z+dz)){pos.x+=dx;pos.z+=dz;found=true;break;}if(!found)throw new Error('Spawn obstructed');}pos.y=height(pos.x,pos.z)+1.68;
const keys=new Set(),vel=new THREE.Vector2(),target=new THREE.Vector2();let yaw=level.yaw,pitch=-.04,locked=false,bob=0,notice='',until=0;camera.position.copy(pos);camera.rotation.set(pitch,yaw,0);
function pause(){locked=false;touch.stop();keys.clear();vel.set(0,0);menu.hidden=false;dot.hidden=true;hint.hidden=true;start.textContent='Продолжить';}
function nearby(){return interactions.filter(i=>Math.hypot(i.x-pos.x,i.z-pos.z)<2.6).sort((a,b)=>Math.hypot(a.x-pos.x,a.z-pos.z)-Math.hypot(b.x-pos.x,b.z-pos.z))[0];}
function walkable(x,z){if(Math.abs(x)>level.limit||Math.abs(z)>level.limit||!free(x,z))return false;const d=Math.hypot(x-pos.x,z-pos.z);return Math.abs(height(x,z)-height(pos.x,pos.z))<=d*1.5+.035;}
start.onclick=()=>{if(touch.selected){touch.start();if(!touchQualityInitialized){applyTouchQuality(renderer,scene);touchQualityInitialized=true;}locked=true;menu.hidden=true;dot.hidden=false;return;}try{const p=renderer.domElement.requestPointerLock();p?.catch?.(()=>{status.textContent='Не удалось захватить мышь.';});}catch{status.textContent='Захват мыши недоступен.';}};
document.addEventListener('pointerlockchange',()=>{if(touch.active)return;locked=document.pointerLockElement===renderer.domElement;if(locked){menu.hidden=true;dot.hidden=false;}else pause();});
document.addEventListener('pointerlockerror',()=>status.textContent='Браузер не разрешил захват мыши. Нажми ещё раз.');
let touchQualityInitialized=false;
 function interact(){const n=nearby();if(n){notice=n.message;until=performance.now()+3600;}}
 function lookBy(x,y){if(locked){yaw-=x*.0021;pitch=THREE.MathUtils.clamp(pitch-y*.0021,-1.48,1.48);}}
 const touch=createTouchControls({menu,onLook:(x,y)=>lookBy(x*1.8,y*1.8),onAction:name=>{if(name==='pause')pause();else if(name==='interact')interact();}});
 document.addEventListener('mousemove',e=>{if(!touch.active)lookBy(e.movementX||0,e.movementY||0);});
document.addEventListener('keydown',e=>{if(!locked)return;keys.add(e.code);if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='Escape'&&touch.active)pause();});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();vel.set(0,0);if(touch.active)pause();else if(document.pointerLockElement)document.exitPointerLock();});window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
status.textContent=failures.length?'Готово · не загружены некоторые дополнительные ресурсы':'Готово · WASD, мышь, Shift, E, Esc';start.disabled=false;
let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(locked){const {f,r}=mergeMotion(Number(keys.has('KeyW'))-Number(keys.has('KeyS')),Number(keys.has('KeyD'))-Number(keys.has('KeyA')),touch.active?touch.state:null);const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')||(touch.active&&touch.state.sprint)?4.8:2.7;target.set((-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed,(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed);vel.lerp(target,1-Math.exp(-12*dt));const x=pos.x+vel.x*dt,z=pos.z+vel.y*dt;if(walkable(x,pos.z))pos.x=x;else vel.x=0;if(walkable(pos.x,z))pos.z=z;else vel.y=0;pos.y=height(pos.x,pos.z)+1.68;bob+=vel.length()*dt*3.3;camera.position.set(pos.x,pos.y+Math.sin(bob)*Math.min(.027,vel.length()*.007),pos.z);camera.rotation.set(pitch,yaw,0);const n=nearby();hint.hidden=now>=until&&!n;hint.textContent=now<until?notice:n?.prompt||'';}renderer.render(scene,camera);});
