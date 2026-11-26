import {startSurvival} from './survival_combat.js?v=042';
import * as THREE from 'three';
import {addMeadowFlowers} from './meadow_flowers.js';
import {trunkFootprint,treeCollider,hitsCollider} from './tree_collision.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {levels,pathWeight,pond,pondDistance,houseSite} from './alive_levels.js';
import {createHeightfield,buildTerrainGeometry} from './terrain.js';

const id='sunset';
const level=Object.hasOwn(levels,id)?levels[id]:levels.sunset;
const $=s=>document.querySelector(s), menu=$('#menu'), start=$('#start'), status=$('#status'), hint=$('#hint'), dot=$('#dot');
$('#title').textContent='До темноты';$('#subtitle').textContent='THE LAST SUMMER / PVPVE SANDBOX';document.title='До темноты — Последнее лето';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1)*.8);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,260);camera.rotation.order='YXZ';scene.fog=new THREE.FogExp2(level.fog,level.density);
const hemi=new THREE.HemisphereLight(level.hemi,level.ground,level.ambient);scene.add(hemi);
const sun=new THREE.DirectionalLight(level.sun,level.sunPower);sun.position.set(...level.sunPos);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:230});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;scene.add(sun);
const root=new URL('./assets/',import.meta.url), asset=p=>new URL(p,root).href;
const manager=new THREE.LoadingManager();const texturePaths=new Map();for(const name of ['dirt.JPG','grass.jpg','ivy.JPG','leaf.JPG','rock.jpg','sky.JPG','stone.JPG','stonebuild.JPG','stonewall.JPG','treeleaf.jpg','water.jpg','wood.JPG','woodplank.JPG'])texturePaths.set(name.toLowerCase(),'curated/nature/'+name);for(const n of [8937,8970,9023,9024,9030,9034,9035,9036,9037])texturePaths.set('sam_'+n+'.jpg','curated/palast/SAM_'+n+'.JPG');for(let i=1;i<=6;i++)texturePaths.set(i+'h.png','curated/houses/'+i+'h.png');
manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const name=url.split(/[\\/]/).pop().toLowerCase();return texturePaths.has(name)?asset(texturePaths.get(name)):url;});
const textures=new THREE.TextureLoader(manager), fbx=new FBXLoader(manager), failures=[];
function tune(t){if(!t)return t;t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.anisotropy=2;return t;}
async function load(p,loader){try{return await loader.loadAsync(asset(p));}catch(e){console.warn('Asset unavailable',p,e);failures.push(p);return null;}}
const groundPath=s=>'curated/ground/PSX_Seamless_'+s+'_128px.png';
const [sky,grass,earth,forest,nature,house]=await Promise.all([
 load('derived/'+level.sky+'.jpg',textures),load(groundPath(level.grass),textures),load(groundPath(level.path),textures),load('curated/forest/forest_collection.fbx',fbx),load('curated/nature/nature_collection.fbx',fbx),level.sky==='sunset'?load('curated/houses/house05.fbx',fbx):null]);
if(!sky||!grass||!earth||!forest){status.textContent='Не загрузились основные ассеты. Проверь папку assets и консоль.';throw new Error('Required landscape assets missing');}
sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;
for(const t of [grass,earth]){tune(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;}
const field=createHeightfield({size:level.size,segments:220,height:level.height.bind(level)});const height=field.sample;
const terrainMat=new THREE.MeshStandardMaterial({map:grass,roughness:1,color:0xe0ddce});
terrainMat.onBeforeCompile=s=>{s.uniforms.trailMap={value:earth};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float trailWeight; varying float vTrail;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTrail=trailWeight;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D trailMap; varying float vTrail;').replace('#include <map_fragment>','diffuseColor *= mix(texture2D(map,vMapUv),texture2D(trailMap,vMapUv),smoothstep(0.0,1.0,vTrail));');};
const terrain=new THREE.Mesh(buildTerrainGeometry(THREE,field,(x,z)=>Math.max(pathWeight(level,x,z),1-THREE.MathUtils.smoothstep(level.road(x,z),level.sky==='mist'?1.4:1.7,level.sky==='mist'?2.7:3.1))),terrainMat);terrain.receiveShadow=true;scene.add(terrain);
let seed=level.seed;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const colliders=[],interactions=[],walkSurfaces=[];
function walkHeight(x,z){let h=height(x,z);for(const a of walkSurfaces){if(x>=a.x0&&x<=a.x1&&z>=a.z0&&z<=a.z1)h=Math.max(h,typeof a.y==='function'?a.y(x,z):a.y);}return h;}
const dockZone=(x,z)=>x>=6.8&&x<=15.2&&Math.abs(z-10)<.79;
function prepare(obj){obj.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;tune(m.map);if(m.map)m.color?.set(0xffffff);m.opacity=1;m.transparent=false;const cutout=/crown|corwn|grass|dandelion|leaf|bush|lavender|reed|plant/i.test(m.name+' '+n.name);if(cutout){m.alphaTest=.42;m.side=THREE.DoubleSide;m.alphaMap=null;}else m.alphaTest=0;if(m.specular)m.specular.setScalar(.025);m.needsUpdate=true;}});return obj;}
function normalized(o,h){const wrapper=new THREE.Group(),inner=new THREE.Group();inner.add(o);wrapper.add(inner);wrapper.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o),s=h/Math.max(.001,b.max.y-b.min.y);inner.scale.setScalar(s);inner.position.set(-(b.min.x+b.max.x)*s/2,-b.min.y*s,-(b.min.z+b.max.z)*s/2);wrapper.updateMatrixWorld(true);return wrapper;}
function template(collection,name,h){if(!collection)return null;collection.updateMatrixWorld(true);let found;collection.traverse(n=>{if(n.isMesh&&n.name.trim().toLowerCase()===name.toLowerCase())found=n;});if(!found){console.warn('Missing model',name);return null;}const c=found.clone();found.matrixWorld.decompose(c.position,c.quaternion,c.scale);return normalized(prepare(c),h);}
function groundPlace(o,x,z,rot=0,s=1,offset=0){o.position.set(x,height(x,z)+offset,z);o.rotation.y=rot;o.scale.setScalar(s);scene.add(o);o.updateMatrixWorld(true);return o;}
function aabb(o,pad=.05){const b=new THREE.Box3().setFromObject(o);colliders.push({x0:b.min.x-pad,x1:b.max.x+pad,z0:b.min.z-pad,z1:b.max.z+pad,top:b.max.y});}
function trunk(x,z,r){colliders.push({x,z,r});}
function free(x,z,r=.28){return !colliders.some(c=>hitsCollider(c,x,z,r));}
const treeBatches=[];
function batch(t,points,shadow=false,isTree=false){if(!t||!points.length)return;t.updateMatrixWorld(true);const dummy=new THREE.Object3D();t.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld),m=new THREE.InstancedMesh(g,n.material,points.length);points.forEach(([x,z,s,a],i)=>{dummy.position.set(x,height(x,z)-.025,z);dummy.rotation.set(0,a,0);dummy.scale.setScalar(s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.instanceMatrix.needsUpdate=true;m.castShadow=shadow;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);if(isTree)treeBatches.push({mesh:m,points});});}
const stone=new THREE.MeshStandardMaterial({color:0x9c9c87,map:tune(await load('curated/nature/stone.JPG',textures)),roughness:1});const wood=new THREE.MeshStandardMaterial({color:0x887255,roughness:1}), iron=new THREE.MeshStandardMaterial({color:0x545b58,roughness:1});
function box(w,h,d,m,x,y,z,parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function bench(x,z,a){const b=new THREE.Group();for(const xx of [-.85,.85]){box(.12,.5,.5,iron,xx,.25,0,b);box(.08,.85,.08,iron,xx,.48,-.22,b);}for(let i=0;i<3;i++)box(2.1,.06,.15,wood,0,.52,-.18+i*.17,b);for(let i=0;i<2;i++)box(2.1,.15,.06,wood,0,.75+i*.17,-.23,b);groundPlace(b,x,z,a);aabb(b);interactions.push({x,z,message:'Кажется, кто-то ещё недавно сидел здесь.',prompt:'E — осмотреть лавочку'});}
function sign(x,z,msg){const g=new THREE.Group();box(.1,1.7,.1,wood,0,.85,0,g);box(.95,.42,.08,wood,0,1.55,0,g);groundPlace(g,x,z,.15);trunk(x,z,.15);interactions.push({x,z,message:msg,prompt:'E — осмотреть указатель'});}
// All landmark positions are fixed, before vegetation; nothing grows through buildings or props.
const timber=new THREE.MeshStandardMaterial({color:0x7c6b54,map:tune(await load('curated/nature/wood.JPG',textures)),roughness:1});
const planks=new THREE.MeshStandardMaterial({color:0x938677,map:tune(await load('curated/nature/woodplank.JPG',textures)),roughness:1});
const rusty=new THREE.MeshStandardMaterial({color:0x6a5140,roughness:.93});
const concrete=new THREE.MeshStandardMaterial({color:0xa5a39a,map:stone.map,roughness:1});
const dark=new THREE.MeshStandardMaterial({color:0x343a35,roughness:1});
const waterTex=tune(await load('curated/nature/water.jpg',textures));if(waterTex){waterTex.wrapS=waterTex.wrapT=THREE.RepeatWrapping;waterTex.repeat.set(10,8);}
function beam(a,b,r,m,parent=scene){const v=new THREE.Vector3().subVectors(b,a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),7),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function at(x,z,y=0){return new THREE.Vector3(x,height(x,z)+y,z);}
function fence(points,{broken=false}={}){for(let i=0;i<points.length;i++){const [x,z]=points[i];if(!broken||i%7!==4){box(.13,1.24,.13,timber,x,height(x,z)+.62,z);trunk(x,z,.10);}if(i&&(!broken||i%7!==4&&i%7!==5)){const [px,pz]=points[i-1];for(const y of [.38,.91])beam(at(px,pz,y),at(x,z,y-.03),.045,timber);const dist=Math.hypot(x-px,z-pz);for(let j=0;j<dist;j+=.55)trunk(px+(x-px)*j/dist,pz+(z-pz)*j/dist,.07);}}}
function postLine(points){for(let i=0;i<points.length;i++){const [x,z]=points[i],g=new THREE.Group();box(.23,7.1,.23,timber,0,3.55,0,g);box(2,.14,.17,timber,0,6.85,0,g);for(const k of [-.74,0,.74])box(.16,.22,.16,concrete,k,7.03,0,g);groundPlace(g,x,z);trunk(x,z,.2);if(i){const [px,pz]=points[i-1];for(const k of [-.74,0,.74]){let prev=at(px+k,pz,7.08);for(let j=1;j<=10;j++){const t=j/10,next=new THREE.Vector3(THREE.MathUtils.lerp(px,x,t)+k,THREE.MathUtils.lerp(height(px,pz),height(x,z),t)+7.08-Math.sin(t*Math.PI)*.62,THREE.MathUtils.lerp(pz,z,t));beam(prev,next,.014,dark);prev=next;}}}}}
function labelTexture(text,sub=''){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#c6c5ab';c.fillRect(0,0,256,128);c.strokeStyle='#5d6258';c.lineWidth=5;c.strokeRect(6,6,244,116);c.fillStyle='#35463e';c.textAlign='center';c.font='bold 29px monospace';c.fillText(text,128,56);c.font='18px monospace';c.fillText(sub,128,92);const t=new THREE.CanvasTexture(canvas);return tune(t);}
function board(x,z,a,text,sub,msg){const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({map:labelTexture(text,sub),roughness:1});box(.12,1.85,.12,timber,0,.925,0,g);box(1.8,.88,.08,m,0,1.68,0,g);groundPlace(g,x,z,a);trunk(x,z,.12);interactions.push({x,z,prompt:'E — прочитать',message:msg});}
function log(x,z,a,len=3.4){const g=new THREE.Group();beam(new THREE.Vector3(-len/2,.27,0),new THREE.Vector3(len/2,.27,0),.27,timber,g);groundPlace(g,x,z,a);for(let i=-len/2;i<len/2;i+=.48)trunk(x+Math.cos(a)*i,z-Math.sin(a)*i,.19);}
const sunset=level.sky==='sunset';
if(sunset){
 if(house){const base=normalized(prepare(house),houseSite.h);const dims=new THREE.Box3().setFromObject(base).getSize(new THREE.Vector3());base.scale.set(43/dims.x,1,23/dims.z); // footprint: one residential slab, not a miniature cube
  base.position.set(houseSite.x,houseSite.y-.08,houseSite.z);scene.add(base);base.updateMatrixWorld(true);aabb(base,.12);
  // Building meets a paved foundation, not the undulating hillside.
  box(44,.24,24.2,concrete,houseSite.x,houseSite.y-.08,houseSite.z);
  const hx=houseSite.x,hz=houseSite.z;for(const xx of [hx-13,hx+1,hx+14]){box(3.3,.19,2.1,concrete,xx,houseSite.y+.05,hz+12);box(3.7,.13,.75,concrete,xx,houseSite.y+.015,hz+13.3);}
  bench(hx-14,hz+17,Math.PI);bench(hx+10,hz+17,Math.PI);
  fence(Array.from({length:15},(_,i)=>[13+i*2,-26]),{broken:true});fence([[13,-26],[13,-28],[13,-30],[13,-32]],{broken:true});fence([[13,-38],[13,-40],[13,-42],[13,-44]],{broken:true});
  board(13,-22,.5,'ЛЕСНАЯ','ул. 12','Номера домов ещё различимы. В окнах отражается небо.');
 }
 postLine([[-69,-7],[-49,-7],[-29,-9],[-9,-10],[11,-12],[31,-11],[51,-11],[71,-11]]);
 board(-6,29,.25,'ДО ГОРОДА','3 км','Когда-то сюда ходили пешком по вечерам.');
 bench(-14,13,1.2);log(-22,8,.6,4.4);log(-28,-28,-.9,3.7);
 // A weathered picnic spot, left as if someone will return.
 const gx=-14.5,gz=15.8,gy=height(gx,gz);for(const [dx,dz] of [[-.5,-.26],[.5,-.26],[-.5,.26],[.5,.26]])box(.09,.72,.09,timber,gx+dx,gy+.36,gz+dz);box(1.45,.09,.78,planks,gx,gy+.75,gz);trunk(gx,gz,.65);
 const enamel=new THREE.MeshStandardMaterial({color:0xb8b7a0,roughness:.82});const mug=new THREE.Mesh(new THREE.CylinderGeometry(.055,.048,.10,7),enamel);mug.position.set(gx+.32,gy+.845,gz-.18);scene.add(mug);
 // A narrow side path ends at a small, half-forgotten viewpoint.
 const vx=-36,vz=-34;bench(vx,vz,.65);board(vx+1.8,vz-.6,.65,'ЛЕС','', 'Вдалеке ещё виден последний свет.');

 fence([[-18,13],[-20,11],[-22,9],[-24,7],[-26,5],[-28,3]],{broken:true});
 // A culvert and old roadside markers connect the forest footpath to the settlement.
 for(const x of [-34,-25,-16,9,18,27,36,45]){const z=-9.7+(x>0?-1:0);box(.14,.65,.14,concrete,x,height(x,z)+.325,z);box(.15,.12,.15,dark,x,height(x,z)+.59,z);}
}else{
 // The halt is built around a real, continuous rail line, with a gravel bed and a crossing.
 const railY=.45;const sleepers=new THREE.InstancedMesh(new THREE.BoxGeometry(.22,.13,2.75),planks,200);const temp=new THREE.Object3D();for(let i=0;i<200;i++){temp.position.set(-69+i*.69,railY+.035,-25);temp.updateMatrix();sleepers.setMatrixAt(i,temp.matrix);}sleepers.castShadow=true;sleepers.receiveShadow=true;scene.add(sleepers);
 for(const zz of [-25-.76,-25+.76]){box(140,.11,.10,rusty,0,railY+.135,zz);box(140,.035,.12,iron,0,railY+.204,zz);}
 for(let i=0;i<9;i++)box(.28,.105,2.85,planks,-12.5+i*.28,railY+.125,-25);
 // Platform, weathered wooden shelter, timetable, a lamp and a signal create a destination.
 const px=-21,pz=-21.4;box(13,.27,2.7,concrete,px,railY+.02,pz);box(13,.09,.17,stone,px,railY+.18,pz-1.3);
 walkSurfaces.push({x0:px-6.5,x1:px+6.5,z0:pz-1.35,z1:pz+1.35,y:railY+.155});
 // Flat crossing deck, approached from both sides of the tracks.
 walkSurfaces.push({x0:-12.65,x1:-9.9,z0:-26.45,z1:-23.55,y:railY+.17});
 const white=new THREE.MeshStandardMaterial({color:0xbcb9a4,roughness:1}),red=new THREE.MeshStandardMaterial({color:0x86453b,roughness:1});
 for(const [x,z,a] of [[-13.8,-22.8,0],[-9.0,-27.2,Math.PI]]){const cross=new THREE.Group();box(.13,2.6,.13,iron,0,1.3,0,cross);for(const angle of [-Math.PI/4,Math.PI/4]){const arm=new THREE.Group();arm.rotation.z=angle;arm.position.y=2.28;cross.add(arm);box(1.15,.19,.075,white,0,0,0,arm);for(const off of [-.41,.41])box(.29,.193,.081,red,off,0,0,arm);}groundPlace(cross,x,z,a);trunk(x,z,.13);}

 const g=new THREE.Group();box(5.5,.17,2.7,planks,0,2.65,0,g);box(5.25,2.47,.13,planks,0,1.26,.99,g);box(.14,2.42,2.05,planks,-2.55,1.22,0,g);for(const xx of [-2.5,2.5])box(.13,2.6,.13,timber,xx,1.30,-1.05,g);
 box(3.2,.09,.42,planks,0,.52,.68,g);for(const xx of [-1.25,1.25])box(.10,.52,.1,timber,xx,.26,.68,g);
 const placard=new THREE.MeshStandardMaterial({map:labelTexture('НИЗИНА','платформа 8'),roughness:1});box(2.2,.64,.09,placard,.1,1.94,.91,g);groundPlace(g,px,pz,.02,.95,.18); // open front faces track
 // only back and side walls block movement; the shelter can be entered from the platform.
 colliders.push({x0:px-2.6,x1:px+2.6,z0:pz+.84,z1:pz+1.12},{x0:px-2.7,x1:px-2.35,z0:pz-1.1,z1:pz+1.05});
 interactions.push({x:px,z:pz-1,prompt:'E — расписание',message:'Последний поезд: 06:14. Дата выцвела.'});
 board(-13.9,-19.4,.15,'ОСТАНОВКА','06:14','В расписании осталась всего одна строчка.');
 for(const x of [-30,-14]){const z=-22.7;box(.16,4.1,.16,iron,x,height(x,z)+2.05,z);box(.64,.11,.25,iron,x+.21,height(x,z)+4.03,z);box(.45,.12,.28,concrete,x+.34,height(x,z)+3.91,z);trunk(x,z,.15);}
 const sx=12,sz=-27.7;box(.18,3.8,.18,iron,sx,height(sx,sz)+1.9,sz);box(.49,1.03,.35,dark,sx,height(sx,sz)+3.5,sz);for(let i=0;i<3;i++){const m=new THREE.MeshStandardMaterial({color:i===0?0x9f392d:0x353a33,emissive:i===0?0x4a150b:0,emissiveIntensity:.8});const o=new THREE.Mesh(new THREE.SphereGeometry(.12,8,5),m);o.position.set(sx,height(sx,sz)+3.2+i*.28,sz+.20);scene.add(o);}trunk(sx,sz,.17);
 postLine([[-54,-31],[-32,-31],[-10,-31],[12,-31],[34,-31],[56,-31]]);
 const waterMat=new THREE.MeshStandardMaterial({map:waterTex,color:0x54746b,roughness:.64,metalness:.07,transparent:true,opacity:.91,depthWrite:true});const w=new THREE.Mesh(new THREE.CircleGeometry(1,96),waterMat);w.rotation.x=-Math.PI/2;w.scale.set(pond.rx,pond.rz,1);w.position.set(pond.x,pond.y+.025,pond.z);scene.add(w);w.receiveShadow=true;
 // A small fishing landing, half-sunken posts and reeds mark the shore.
 const dockZ=10,dockStart=6.8,dockEnd=15.2,deckY=pond.y+.34;
 const bankY=height(dockStart,dockZ)+.045;
 const dockTop=x=>THREE.MathUtils.lerp(bankY,deckY,THREE.MathUtils.clamp((x-dockStart)/3.7,0,1));
 for(let x=dockStart+.135;x<dockEnd;x+=.27){const t=box(.265,.10,1.65,planks,x,dockTop(x)-.05,dockZ);t.rotation.y=(rnd()-.5)*.018;}
 for(const x of [8.3,10.6,12.7,14.85])for(const z of [dockZ-.69,dockZ+.69]){const low=height(x,z)-.25,top=dockTop(x)+.16;box(.15,Math.max(.2,top-low),.15,timber,x,(top+low)/2,z);}
 walkSurfaces.push({x0:dockStart,x1:dockEnd,z0:dockZ-.79,z1:dockZ+.79,y:dockTop});
 interactions.push({x:14.1,z:10,prompt:'E — посмотреть на воду',message:'Вода хранит цвет неба. На другом берегу ничего не движется.'});

 bench(7,12,-1.5);board(7,8,-.8,'ОЗЕРО','', 'Вода неподвижна. Даже камыш почти не шелестит.');
 log(-25,21,-.7,4.1);log(1,-10,.4,2.6);
 fence([[-11,10],[-13,8],[-14,6],[-16,4],[-18,2],[-20,0],[-22,-2]],{broken:true});
 // Low masonry remains in the woods, not a second fantasy level.
 const wall=template(nature,'Stonewall',.95);if(wall)for(const [x,z,a] of [[-33,-7,0],[-31,-7,.15],[-29.4,-7.3,.4],[-34,-9,1.4]]){const o=groundPlace(wall.clone(),x,z,a);aabb(o);}
}
// Plant distribution follows clearings, wet shores, woods and worn tracks rather than uniform noise.
const trees=['PSX_Tree1','PSX_Tree2','PSX_Tree3','PSX_Tree4'].map(n=>template(forest,n,8));
const treePoints=trees.map(()=>[]),treeCenters=[],treeFeet=trees.map(t=>trunkFootprint(THREE,t)),treeReplacements=[];
function plantTree(x,z,i,s,forced=false){if(!trees[i]||level.reserved(x,z)||level.distance(x,z)<2.8||!free(x,z,1.1)||Math.hypot(x-level.spawn[0],z-level.spawn[1])<3.8||treeCenters.some(p=>Math.hypot(x-p[0],z-p[1])<2.5))return false;const a=rnd()*Math.PI*2;treePoints[i].push([x,z,s,a]);treeCenters.push([x,z]);treeReplacements.push([colliders.length,treeCollider(treeFeet[i],x,z,s,a)]);trunk(x,z,.36*s);return true;}
const framing=sunset?[[-7,38,2,.85],[5,35,0,.87],[-11,25,3,.88],[7,16,1,.9],[-15,3,2,1.03],[13,3,0,.78],[-4,-24,1,.9],[-18,-30,3,.8]]:[[-11,32,1,.87],[4,32,0,.72],[-14,16,2,.82],[2,-5,1,.85],[-17,-8,3,.81],[4,-18,0,.76],[14,-14,2,.9]];
for(const [x,z,i,s] of framing)plantTree(x,z,i,s,true);
for(let n=0;n<level.trees*45&&treeCenters.length<level.trees;n++){const x=(rnd()-.5)*(level.size-5),z=(rnd()-.5)*(level.size-5);if(rnd()>Math.pow(level.treeZone(x,z),1.7))continue;if(sunset&&z<18&&z>-33&&x>0&&x<27&&rnd()<.85)continue;if(!sunset&&z>-31&&z<-14&&x>-16&&x<18&&rnd()<.85)continue;const i=Math.floor(rnd()*trees.length);plantTree(x,z,i,.7+rnd()*.8);}
trees.forEach((t,i)=>batch(t,treePoints[i],true,true));
const plantSpecs=[
 ['grass',forest,'PSX_Grass',.43,level.grassCount,.55,1.5],['dandelion',forest,'PSX_Dandelion',.36,sunset?1450:650,.62,1.45],['lavender',forest,'PSX_Lavender',.74,sunset?1000:450,.55,1.38],['reed',forest,'PSX_Reed',1.05,sunset?280:1900,.65,1.42],['naturegrass',nature,'Grass',.35,2200,.55,1.28],['plant',nature,'Plant',.46,1000,.5,1.35],['bush',nature,'Bush',1.1,220,.55,1.55],['rock',forest,'PSX_Rock',.58,150,.38,1.9],['stone',nature,'Stone',.33,180,.4,1.6],['pinecone',forest,'PSX_PineConre',.10,500,.55,1.5],['stump',forest,'PSX_Treetrunk',.70,42,.65,1.55]
];
const clusters={};for(const [key] of plantSpecs){clusters[key]=Array.from({length:key==='grass'?110:45},()=>[(rnd()-.5)*(level.size-6),(rnd()-.5)*(level.size-6),3+rnd()*9]);}
const closePatches=sunset?{grass:[[-5,38,6],[3,32,7],[-9,19,6],[9,3,8],[17,-29,5],[25,-29,5],[40,-30,7],[48,-31,5]],dandelion:[[2,38,4],[-7,23,5],[-5,-7,5],[12,-28,5],[31,-29,4]],lavender:[[-8,35,5],[5,18,5],[-17,-3,6]],reed:[[9,-23,5],[14,-21,4]],plant:[[-9,35,5],[-12,15,7]]}:{grass:[[-9,31,6],[3,29,6],[-3,10,5],[10,10,6]],dandelion:[[-9,31,4],[2,13,5]],reed:[[12,8,6],[17,19,5],[24,22,6],[38,14,6],[27,-3,5]],plant:[[5,24,5],[13,13,6],[-15,6,5]],lavender:[[-12,26,5],[-18,7,5]]};
for(const [key,points] of Object.entries(closePatches))for(let j=0;j<4;j++)clusters[key].push(...points);
function patch(x,z){return .5+.25*Math.sin(x*.47+z*.21)+.16*Math.cos(z*.58-x*.19)+.08*Math.sin(x*1.13+z*.7);}
function plantChance(key,x,z){const d=level.distance(x,z),edge=Math.exp(-((d-2.5)**2)/11),p=patch(x,z),woods=level.treeZone(x,z),wet=sunset?Math.max(0,1-(height(x,z)+.2)/2):Math.exp(-(((pondDistance(x,z)-1.07)/.24)**2));
 if(key==='reed')return sunset?.015+.75*wet:.006+.98*wet;
 if(key==='dandelion')return (.12+.67*edge+.2*p)*(1-woods*.7);
 if(key==='lavender')return Math.max(.015,p-.32)*(.4+edge)*(1-wet*.8);
 if(key==='naturegrass')return .20+.45*woods+.35*(1-p);
 if(key==='plant')return .12+.50*woods+.3*wet;
 if(key==='bush'||key==='stump'||key==='pinecone')return .10+.8*woods;
 if(key==='rock'||key==='stone')return .22+.45*(1-p)+.2*edge;
 return .18+.61*p+.20*edge;
}
for(const [key,collection,name,h,count,min,max] of plantSpecs){const t=template(collection,name,h),points=[];if(!t)continue;for(let n=0;n<count*16&&points.length<count;n++){let x,z;if(rnd()<.74){const [cx,cz,r]=clusters[key][Math.floor(rnd()*clusters[key].length)],a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*r;x=cx+Math.cos(a)*d;z=cz+Math.sin(a)*d;}else{x=(rnd()-.5)*(level.size-5);z=(rnd()-.5)*(level.size-5);}if(Math.abs(x)>level.size/2-1||Math.abs(z)>level.size/2-1||level.distance(x,z)<.72||level.road(x,z)<(sunset?2.0:1.6)||!free(x,z,key==='bush'?.6:.08))continue;if(sunset&&Math.abs(x-houseSite.x)<22.2&&Math.abs(z-houseSite.z)<12.5)continue;if(!sunset&&((x>6.4&&x<15.5&&Math.abs(z-10)<1.15)||pondDistance(x,z)<(key==='reed'?.94:.99)||(x>-27.5&&x<-13.5&&z>-24.3&&z<-19.8)))continue;if(rnd()>plantChance(key,x,z))continue;const s=min+(max-min)*rnd()**1.7;points.push([x,z,s,rnd()*Math.PI*2]);if(key==='bush'||key==='stump')trunk(x,z,.28*s);}
 batch(t,points,['bush','rock','stone','stump'].includes(key));}
for(const [index,shape] of treeReplacements)colliders[index]=shape;
if(sunset)addMeadowFlowers(THREE,scene,level,height,free);
// Batch repeated hand-built props (rails, fences, dock planks, wires) by material.
// Preserve world transforms, shadows and already-recorded collision bounds.
function batchStaticProps(){
 scene.updateMatrixWorld(true);const groups=new Map();
 scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;const g=o.geometry,p=g.parameters;let key,scale;
 if(g.type==='BoxGeometry'){key='box';scale=new THREE.Vector3(p.width,p.height,p.depth);}
 else if(g.type==='CylinderGeometry'&&p.radiusTop===p.radiusBottom&&p.heightSegments===1&&p.thetaLength===Math.PI*2){key='cylinder-'+p.radialSegments;scale=new THREE.Vector3(p.radiusTop,p.height,p.radiusTop);}
 else return;
 key+=':'+o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;
 if(!groups.has(key))groups.set(key,[]);groups.get(key).push({o,scale});});
 for(const list of groups.values()){if(list.length<3)continue;const first=list[0].o,g=first.geometry.type==='BoxGeometry'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,first.geometry.parameters.radialSegments);
 const m=new THREE.InstancedMesh(g,first.material,list.length),matrix=new THREE.Matrix4();list.forEach(({o,scale},i)=>{matrix.copy(o.matrixWorld).scale(scale);m.setMatrixAt(i,matrix);o.removeFromParent();o.geometry.dispose();});m.castShadow=first.castShadow;m.receiveShadow=first.receiveShadow;m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();scene.add(m);}
}
batchStaticProps();

await startSurvival({THREE,scene,camera,renderer,level,height,free,colliders,terrain,treeBatches});
