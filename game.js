import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {collectWoodTriangles,combatTreeCollider,hitsCollider} from './tree_collision.js?v=061';
import {COURTYARD,canScatter} from './courtyard_layout.js?v=064';

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x18202d,.026);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,180);
camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1)*.8);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
const colliders=[],interactions=[],treeBatches=[];
const loading=new THREE.LoadingManager(),root=new URL('./assets/',import.meta.url),asset=p=>new URL(p,root).href;
const paths=new Map();
for(let i=1;i<=6;i++)paths.set(i+'h.png','curated/houses/'+i+'h.png');
for(let i=2;i<=7;i++)paths.set(i+'r.png','curated/street/'+i+'R.png');
for(const n of ['dirt.JPG','grass.jpg','ivy.JPG','leaf.JPG','rock.jpg','sky.JPG','stone.JPG','stonebuild.JPG','stonewall.JPG','treeleaf.jpg','water.jpg','wood.JPG','woodplank.JPG'])paths.set(n.toLowerCase(),'curated/nature/'+n);
for(const n of ['PSX_Bark2_128px.png','PSX_Bark3_128px.png','PSX_Bark5_128px.png','PSX_Bark6_128px.png','PSX_Bolder_128px.png','PSX_Dandelion_64px.png','PSX_Grass_128px.png','PSX_PINECone_64px.png','PSX_TreeCrown1_128px.png','PSX_TreeCrown2_128px.png','PSX_TreeCrown3_Tex_128px.png','PSX_TreeCrown4_Tex_128px.png','PSX_TreeEnd_64px.png','PSX_TreeInside_128px.png'])paths.set(n.toLowerCase(),'curated/forest/textures/'+n);
loading.setURLModifier(p=>{if(p.startsWith('blob:')||p.startsWith('data:'))return p;let n=p.split(/[\\/]/).pop();try{n=decodeURIComponent(n);}catch{}return paths.has(n.toLowerCase())?asset(paths.get(n.toLowerCase())):p;});
const texLoader=new THREE.TextureLoader(loading),fbxLoader=new FBXLoader(loading),hdrLoader=new RGBELoader(loading);
function srgb(texture) {
  if (!texture) return texture;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = 1;
  return texture;
}

function repeatTexture(texture, rx, ry) {
  if (!texture) return texture;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(rx, ry);
  return texture;
}

function box(w, h, d, material, x = 0, y = 0, z = 0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(rt, rb, h, material, x = 0, y = 0, z = 0, parent = scene, radial = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, radial), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function plane(w, h, material, x = 0, y = 0, z = 0, rx = -Math.PI / 2, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addColliderFromObject(object, padding = 0) {
  object.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(object);
  colliders.push({
    x0: box3.min.x - padding,
    x1: box3.max.x + padding,
    z0: box3.min.z - padding,
    z1: box3.max.z + padding,
    top: box3.max.y,
  });
}

function prepareObject(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.map) srgb(material.map);
      const cutout = /crown|corwn|grass|dandelion|leaf|bush|lavender|reed|plant|skeleton/i.test(material.name + ' ' + node.name) && !/^(Tree[1-4]|Tree|Wood)$/i.test(material.name);
      material.transparent = false;
      material.opacity = 1;
      if (cutout) { material.alphaTest = 0.42; material.side = THREE.DoubleSide; material.alphaMap = null; }
      else { material.alphaTest = 0; }
      if (material.map && material.color) material.color.set(0xffffff);
      if (material.specular) material.specular.setScalar(0.035);
      material.needsUpdate = true;
    }
  });
  return object;
}

function normalize(object, targetHeight = 3) {
  const wrapper = new THREE.Group();
  const root = new THREE.Group();
  root.add(object);
  wrapper.add(root);
  const box3 = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box3.getSize(size);
  const scale = targetHeight / Math.max(size.y, 0.001);
  root.scale.setScalar(scale);
  root.position.set(
    -(box3.min.x + box3.max.x) * 0.5 * scale,
    -box3.min.y * scale,
    -(box3.min.z + box3.max.z) * 0.5 * scale,
  );
  return wrapper;
}

function place(object, x, z, y = 0, rot = 0, scale = 1, parent = scene) {
  object.position.set(x, y, z);
  object.rotation.y = rot;
  object.scale.multiplyScalar(scale);
  parent.add(object);
  return object;
}

function cloneNamed(collection, patterns) {
  if (!collection) return null;
  const names = Array.isArray(patterns) ? patterns : [patterns];
  let found = null;
  collection.traverse((node) => {
    if (found || !node.isMesh) return;
    const n = (node.name || '').toLowerCase();
    if (names.some((p) => n.includes(p.toLowerCase()))) {
      found = node;
    }
  });
  if (!found) return null;
  const clone = found.clone();
  found.updateWorldMatrix(true, false);
  found.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
  return clone;
}


const height=()=>.07;
let seed=8401;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
async function load(path,loader){try{return await loader.loadAsync(asset(path));}catch(e){console.warn('Courtyard asset unavailable',path,e);return null;}}
const models=['house07','house03','house02','house06','garage01','garage02','garage03','busstop','electricbox01','electricbox02','wall','went'];
const groundName=n=>'curated/ground/PSX_Seamless_'+n+'_128px.png';
const [sky,forest,nature,grass,gravel,dirt,stone,wood,modelEntries]=await Promise.all([
 load('curated/sky/PSX_NIGHTSKY.hdr',hdrLoader),load('curated/forest/forest_collection.fbx',fbxLoader),load('curated/nature/nature_collection.fbx',fbxLoader),
 load(groundName('ShortForestGrass'),texLoader),load(groundName('ForestGravel_Ground'),texLoader),load(groundName('ForestEarthGround'),texLoader),load('curated/nature/stonewall.JPG',texLoader),load('curated/nature/woodplank.JPG',texLoader),
 Promise.all(models.map(async n=>[n,await load('curated/'+(n.startsWith('house')?'houses/':'street/')+n+'.fbx',fbxLoader)]))
]);
const library=Object.fromEntries(modelEntries);
if(sky){sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;scene.backgroundIntensity=.46;}else scene.background=new THREE.Color(0x101725);
const hemi=new THREE.HemisphereLight(0x9caec9,0x535348,.85);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xa6bde1,.78);moon.position.set(-38,45,24);moon.castShadow=true;
Object.assign(moon.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:150});moon.shadow.mapSize.set(2048,2048);moon.shadow.bias=-.0002;moon.shadow.normalBias=.035;scene.add(moon);
function mat(color,map=null,roughness=1){return new THREE.MeshStandardMaterial({color,map:srgb(map),roughness});}
function tiled(t,w,d){if(!t)return null;return repeatTexture(srgb(t.clone()),w,d);}
const concrete=mat(0x92928d,stone),iron=mat(0x424d50),rust=mat(0x72574c),blue=mat(0x526d7d),fadedRed=mat(0x80504a),sand=mat(0x8e8165,dirt),planks=mat(0x95816a,wood),dark=mat(0x242b2d);
const terrain=plane(COURTYARD.size,COURTYARD.size,mat(0x8a9281,tiled(grass,42,42)),0,0,0);
const surfaces=[];
for(const [x,z,w,d,kind] of COURTYARD.paving){
 const source=kind==='sand'?dirt:kind==='path'?stone:gravel;
 const tint=kind==='sand'?0x999077:kind==='path'?0xaaa9a1:0x62666c;
 const m=mat(tint,tiled(source,w/2,d/2),kind==='road'?.83:1);
 surfaces.push(plane(w,d,m,x,.018+surfaces.length*.0015,z));
}
function fits(source,w,h,d,correction=0){
 const pivot=new THREE.Group(),wrapper=new THREE.Group();pivot.add(prepareObject(source.clone(true)));pivot.rotation.y=correction;wrapper.add(pivot);wrapper.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(pivot,true),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
 const inner=new THREE.Group();wrapper.remove(pivot);inner.add(pivot);wrapper.add(inner);inner.scale.set(w/Math.max(.001,size.x),h/Math.max(.001,size.y),d/Math.max(.001,size.z));
 inner.position.set(-center.x*inner.scale.x,-b.min.y*inner.scale.y,-center.z*inner.scale.z);wrapper.updateMatrixWorld(true);return wrapper;
}
function fallbackHouse(w,h,d){
 const g=new THREE.Group();box(w,h,d,concrete,0,h/2,0,g);
 const windowDark=mat(0x252f3a),windowWarm=new THREE.MeshBasicMaterial({color:0x99805b});
 for(let y=2.2;y<h-1;y+=2.8)for(let x=-w/2+1.6;x<w/2-1;x+=3.1){box(1.25,1.35,.025,rand()<.035?windowWarm:windowDark,x,y,d/2+.015,g);box(1.25,1.35,.025,windowDark,x,y,-d/2-.015,g);}
 return g;
}
function building(site,solid=true){
 const {model,x,z,w,d,h,rot,correction}=site;
 const o=library[model]?fits(library[model],w,h,d,correction):fallbackHouse(w,h,d);
 place(o,x,z,0,rot);o.updateMatrixWorld(true);
 if(solid)addColliderFromObject(o,.08);
 return new THREE.Box3().setFromObject(o,true);
}
const buildings=COURTYARD.houses.map(h=>building(h));
// Distant slabs are outside the playable border: silhouettes, not a floating island.
for(const [x,z,w,d,h,rot] of [[-60,-4,45,10,26,Math.PI/2],[54,-37,38,10,26,Math.PI/2],[-17,-56,46,11,29,0],[22,57,38,10,23,0]]){
 building({model:x===54?'house06':'house07',x,z,w:x===54?17:w,d,h:x===54?38:h,rot,correction:(x===54?-28.798584:-22.444203)*Math.PI/180},false);
}
function solidBox(w,h,d,m,x,y,z,parent=scene){const o=box(w,h,d,m,x,y,z,parent);if(parent===scene)addColliderFromObject(o,.02);return o;}
function beam(a,b,r,m,parent=scene){const v=new THREE.Vector3().subVectors(b,a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),6),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const at=(x,y,z)=>new THREE.Vector3(x,y,z);
function prop(name,x,z,h,rot=0,correction=-Math.PI/2,solid=true){
 const src=library[name];if(!src)return null;
 const pivot=new THREE.Group();pivot.add(prepareObject(src.clone(true)));pivot.rotation.y=correction;pivot.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(pivot,true),size=bounds.getSize(new THREE.Vector3()),scale=h/Math.max(.001,size.y);
 const o=fits(src,size.x*scale,h,size.z*scale,correction);place(o,x,z,0,rot);o.updateMatrixWorld(true);if(solid)addColliderFromObject(o,.04);return o;
}
function inspect(x,z,prompt,message,radius=3){interactions.push({x,z,prompt:'E — '+prompt,message,radius});}
function bench(x,z,a){
 const b=new THREE.Group();for(const dx of [-.85,.85]){box(.12,.5,.5,iron,dx,.25,0,b);box(.08,.85,.08,iron,dx,.48,-.22,b);}
 for(let i=0;i<3;i++)box(2.1,.065,.15,planks,0,.52,-.18+i*.17,b);
 for(let i=0;i<2;i++)box(2.1,.15,.06,planks,0,.76+i*.17,-.23,b);
 place(b,x,z,0,a);addColliderFromObject(b,.025);
}
for(const [x,z,a] of [[-11,9,0],[-3,9,0],[9,17,Math.PI],[19,-14,Math.PI/2],[-26,14,Math.PI/2],[-13,29,Math.PI]])bench(x,z,a);
inspect(-7,9,'осмотреть лавочки','На досках ещё видны имена. Ни одного знакомого.');
// Playground: individual post collisions leave gaps through the equipment.
for(const [x,z] of [[-11,-1],[-8,-1],[-11,3],[-8,3]]){solidBox(.12,2.65,.12,blue,x,1.325,z);}
for(const z of [-1,3])beam(at(-11,2.6,z),at(-8,2.6,z),.055,blue);
beam(at(-9.5,2.6,-1),at(-9.5,2.6,3),.055,blue);
for(const z of [0,2]){for(const dz of [-.35,.35])beam(at(-9.5,2.58,z+dz),at(-9.5,.9,z+dz),.019,dark);box(.66,.055,.95,planks,-9.5,.9,z);}
for(const [x,z,w,d] of [[-5,0,3,.14],[-5,3,3,.14],[-6.5,1.5,.14,3],[-3.5,1.5,.14,3]])solidBox(w,.21,d,fadedRed,x,.105,z);
plane(2.85,2.85,sand,-5,.045,1.5);
for(const [x,z] of [[-8,5],[-5,5],[-8,7],[-5,7]])solidBox(.1,1.6,.1,rust,x,.8,z);
for(const x of [-8,-5])beam(at(x,1.6,5),at(x,1.6,7),.045,rust);
for(const z of [5,7])beam(at(-8,1.6,z),at(-5,1.6,z),.045,rust);
inspect(-7,4,'осмотреть площадку','Качели неподвижны. Кажется, только что кто-то был здесь.',4.2);
// Garage alley and utility props, sourced from the existing street pack.
for(const [i,x] of COURTYARD.garages.entries()){
 if(!prop('garage0'+(1+i%3),x,35,2.7,Math.PI,-Math.PI/2))solidBox(3.55,2.7,4.5,concrete,x,1.35,35);
}
inspect(19,31,'осмотреть гаражи','На воротах ещё остались номера. За последним гаражом темно.');
for(const [name,x,z,h,a] of [['electricbox01',-26,-8,1.25,Math.PI/2],['electricbox02',28,25,1.65,-Math.PI/2],['electricbox02',-19,-29,1.65,0]]){if(!prop(name,x,z,h,a))solidBox(.95,h,.55,blue,x,h/2,z);inspect(x,z,'осмотреть щиток','Гул трансформатора слышен, хотя весь подъезд погас.');}
for(const x of [-34,-30,-26,-22,-18])if(!prop('wall',x,38,1.9,0,Math.PI/2))solidBox(3.8,1.9,.26,concrete,x,.95,38);
const stop=prop('busstop',-16,33,2.55,Math.PI,-Math.PI/2,false);
if(stop){const b=new THREE.Box3().setFromObject(stop,true);colliders.push({x0:b.min.x,x1:b.max.x,z0:b.max.z-.14,z1:b.max.z+.1,top:2.55});for(const x of [b.min.x+.12,b.max.x-.12])colliders.push({x,z:b.min.z+.15,r:.12,top:2.55});}
else{solidBox(4,2.4,.15,concrete,-16,1.2,34);box(4.4,.16,2.1,blue,-16,2.4,33);for(const x of [-18,-14])solidBox(.12,2.4,.12,iron,x,1.2,32);}
inspect(-16,31,'прочитать расписание','Последний автобус: 23:48. Стрелки на часах давно не движутся.');
for(const [x,z,a] of [[-28,22,0],[27,-19,Math.PI/2]])for(let i=0;i<3;i++){const xx=x+Math.cos(a)*i*.87,zz=z+Math.sin(a)*i*.87;solidBox(.74,.9,.67,blue,xx,.45,zz);box(.8,.08,.72,dark,xx,.94,zz);}
function signTexture(line1,line2){
 const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');c.fillStyle='#414f5d';c.fillRect(0,0,256,128);c.strokeStyle='#c1c2b9';c.lineWidth=4;c.strokeRect(5,5,246,118);c.fillStyle='#ddd8c8';c.textAlign='center';c.font='bold 27px monospace';c.fillText(line1,128,45);c.font='22px monospace';c.fillText(line2,128,85);return srgb(new THREE.CanvasTexture(cv));
}
function sign(x,y,z,a,line1,line2){const m=new THREE.MeshStandardMaterial({map:signTexture(line1,line2),roughness:1});const o=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.75),m);o.position.set(x,y,z);o.rotation.y=a;scene.add(o);}
sign(buildings[0].max.x+.025,2.6,5,Math.PI/2,'ЛЕТНЯЯ','12');sign(7,2.6,buildings[1].max.z+.025,0,'ЛЕТНЯЯ','14');
inspect(-25,5,'осмотреть подъезд','Дверь закрыта. За стеклом лестничной клетки горит свет.');
for(const [x,z,a] of [[buildings[0].max.x+.26,-10,Math.PI/2],[buildings[1].max.x-5,buildings[1].max.z+.26,0]]){const unit=prop('went',x,z,.63,a,-Math.PI/2,false);if(unit)unit.position.y=3.6;}
// Street lamps provide real local light and a soft, inexpensive ground halo.
const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;const hc=haloCanvas.getContext('2d'),grad=hc.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,255,255,.55)');grad.addColorStop(.4,'rgba(255,255,255,.23)');grad.addColorStop(1,'rgba(255,255,255,0)');hc.fillStyle=grad;hc.fillRect(0,0,128,128);const halo=new THREE.CanvasTexture(haloCanvas);
const lampGlow=new THREE.MeshBasicMaterial({color:0xffd5a0}),lampOff=mat(0x3c4041),animatedLamps=[];
function lamp(x,z,on){
 const g=new THREE.Group(),h=5.1;box(.12,h,.12,iron,0,h/2,0,g);box(.88,.09,.13,iron,.38,h-.18,0,g);box(.55,.16,.34,on?lampGlow:lampOff,.75,h-.27,0,g);place(g,x,z);colliders.push({x,z,r:.095,top:h});
 if(!on)return;
 const l=new THREE.PointLight(0xffc28a,92,15,2);l.position.set(x+.75,h-.42,z);scene.add(l);
 const m=new THREE.MeshBasicMaterial({map:halo,color:0xe6a45e,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending});const pool=plane(11,11,m,x+.75,.065,z);pool.receiveShadow=false;
 animatedLamps.push({l,m,base:l.intensity,phase:rand()*Math.PI*2});
}
for(const [x,z,on] of COURTYARD.lamps)lamp(x,z,on);
// Small warm porch lights, aligned to the measured facade bounds.
for(const [x,z] of [[buildings[0].max.x+.45,5],[7,buildings[1].max.z+.45],[buildings[2].min.x-.45,-9]]){
 const l=new THREE.PointLight(0xffc185,29,7,2);l.position.set(x,2.8,z);scene.add(l);box(.23,.18,.23,lampGlow,x,2.9,z);
}
// Trees retain the actual trunk footprint for movement, bullets and camera.
function fallbackTree(){
 const g=new THREE.Group();cylinder(.16,.24,4.8,mat(0x504b43),0,2.4,0,g,6);
 for(let i=0;i<3;i++){const o=new THREE.Mesh(new THREE.ConeGeometry(1.45-i*.23,2.2,6),mat(0x394d43));o.position.y=3.0+i*.95;o.castShadow=true;g.add(o);}return g;
}
const templates=[cloneNamed(forest,['psx_tree1']),cloneNamed(forest,['psx_tree3'])].map((src,i)=>src?normalize(prepareObject(src),6.8+i*.8):fallbackTree());
function batch(template,points,isTree=false){
 if(!template||!points.length)return;template.updateMatrixWorld(true);const dummy=new THREE.Object3D();
 template.traverse(n=>{if(!n.isMesh)return;const geometry=n.geometry.clone().applyMatrix4(n.matrixWorld),mesh=new THREE.InstancedMesh(geometry,n.material,points.length);
 points.forEach(([x,z,s,a],i)=>{dummy.position.set(x,0,z);dummy.scale.setScalar(s);dummy.rotation.set(0,a,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
 mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=isTree;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);if(isTree)treeBatches.push({mesh,points});});
}
const treePoints=[[],[]],woodShapes=templates.map(t=>collectWoodTriangles(THREE,t));
for(const [i,[x,z]] of COURTYARD.trees.entries()){
 if(colliders.some(c=>hitsCollider(c,x,z,.65)))continue;
 const j=i%2,s=.86+rand()*.28,a=rand()*Math.PI*2;
 treePoints[j].push([x,z,s,a]);colliders.push(combatTreeCollider(woodShapes[j],x,z,s,a,0));
}
templates.forEach((t,i)=>batch(t,treePoints[i],true));
function scatter(source,count,h){if(!source)return;const template=normalize(prepareObject(source),h),points=[];
 for(let i=0;i<count;i++){const x=(rand()-.5)*76,z=(rand()-.5)*76;if(!canScatter(x,z,colliders,hitsCollider))continue;if(Math.hypot(x-COURTYARD.spawn[0],z-COURTYARD.spawn[1])<2)continue;points.push([x,z,.55+rand()*.7,rand()*Math.PI*2]);}
 batch(template,points);
}
scatter(cloneNamed(forest,['psx_grass']),2200,.38);scatter(cloneNamed(forest,['dandelion']),130,.25);scatter(cloneNamed(nature,['bush']),65,.8);
function updateEnvironment(dt,now){for(const a of animatedLamps){const pulse=.96+.04*Math.sin(now*.0016+a.phase);a.l.intensity=a.base*pulse;a.m.opacity=.18*pulse;}}
if(colliders.some(c=>hitsCollider(c,...COURTYARD.spawn,.48)))throw Error('Courtyard spawn intersects a collider');
scene.updateMatrixWorld(true);
export const world={THREE,scene,camera,renderer,level:{title:'Забытый двор',limit:COURTYARD.limit,spawn:COURTYARD.spawn,yaw:COURTYARD.yaw},height,colliders,terrain,treeBatches,sun:moon,interactions,updateEnvironment};
