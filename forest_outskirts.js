import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {createHeightfield,buildTerrainGeometry} from './terrain.js';
import {createSpatialGrid} from './spatial_grid.js?v=068';
import {createWorldData} from './world_data.js?v=068';
import {createVegetationSystem,seededRandom} from './vegetation_system.js?v=076';
import {biomeAt,plantChance} from './hillside_biomes.js?v=068';
import {splitStaticInstances} from './duel_perf.js?v=070';
import {batchStaticProps} from './static_batch.js?v=069';
import {collectWoodTriangles,combatTreeCollider,hitsCollider} from './tree_collision.js?v=061';
import {HILLSIDE,SERPENTINE,groundHeight,roadAt,roadWeight,trailWeight,cityDistance,reserveTree,forestDensity} from './hillside_layout.js?v=067';

const level={...HILLSIDE,title:'Лес за городом'};
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xb4c3b9,.0048);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,340);camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1)*.8);renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdce9f0,0x8c9475,1.4));
const sun=new THREE.DirectionalLight(0xfff0ce,2.3);sun.position.set(-95,105,44);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-125,right:125,top:125,bottom:-125,near:1,far:340});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;scene.add(sun);
const root=new URL('./assets/',import.meta.url),asset=p=>new URL(p,root).href,manager=new THREE.LoadingManager(),paths=new Map();
for(let i=1;i<=6;i++)paths.set(i+'h.png','curated/houses/'+i+'h.png');for(let i=2;i<=7;i++)paths.set(i+'r.png','curated/street/'+i+'R.png');
for(const n of ['dirt.JPG','grass.jpg','ivy.JPG','leaf.JPG','rock.jpg','sky.JPG','stone.JPG','stonebuild.JPG','stonewall.JPG','treeleaf.jpg','water.jpg','wood.JPG','woodplank.JPG'])paths.set(n.toLowerCase(),'curated/nature/'+n);
for(const n of ['PSX_Bark2_128px.png','PSX_Bark3_128px.png','PSX_Bark5_128px.png','PSX_Bark6_128px.png','PSX_Bolder_128px.png','PSX_Dandelion_64px.png','PSX_Grass_128px.png','PSX_PINECone_64px.png','PSX_TreeCrown1_128px.png','PSX_TreeCrown2_128px.png','PSX_TreeCrown3_Tex_128px.png','PSX_TreeCrown4_Tex_128px.png','PSX_TreeEnd_64px.png','PSX_TreeInside_128px.png'])paths.set(n.toLowerCase(),'curated/forest/textures/'+n);
manager.setURLModifier(p=>{if(p.startsWith('blob:')||p.startsWith('data:'))return p;let n=p.split(/[\\/]/).pop();try{n=decodeURIComponent(n);}catch{}return paths.has(n.toLowerCase())?asset(paths.get(n.toLowerCase())):p;});
const tx=new THREE.TextureLoader(manager),fbx=new FBXLoader(manager);
async function load(p,loader){try{return await loader.loadAsync(asset(p));}catch(e){console.warn('Hillside asset unavailable',p,e);return null;}}
function tune(t){if(t){t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.anisotropy=2;}return t;}
const names=['house07','house03','house02','busstop','garage01','garage02','garage03','electricbox01','wall'];
const ground=n=>'curated/ground/PSX_Seamless_'+n+'_128px.png';
const [sky,grass,earth,gravel,stoneTex,woodTex,forest,nature,entries,...biomeMaps]=await Promise.all([
 load('curated/sky/DAYSKY.hdr',new RGBELoader(manager)),load(ground('WildForestGrass'),tx),load(ground('ForestEarthGround'),tx),load(ground('ForestGravel_Ground'),tx),load('curated/nature/stone.JPG',tx),load('curated/nature/woodplank.JPG',tx),load('curated/forest/forest_collection.fbx',fbx),load('curated/nature/nature_collection.fbx',fbx),
 Promise.all(names.map(async n=>[n,await load('curated/'+(n.startsWith('house')?'houses/':'street/')+n+'.fbx',fbx)])), ...['ShortForestGrass','WildForestClover','ForestWildGround','ForestDryGround'].map(n=>load(ground(n),tx))
]);
if(!grass||!earth||!gravel||!forest)throw Error('Hillside: required terrain/forest assets missing');
if(sky){sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;scene.backgroundIntensity=.88;}else scene.background=new THREE.Color(0xb7d2df);
const lib=Object.fromEntries(entries);for(const t of [grass,earth,gravel,stoneTex,woodTex,...biomeMaps])if(t){tune(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;}
const field=createHeightfield({size:level.size,segments:240,height:groundHeight}),height=field.sample;
const geometry=buildTerrainGeometry(THREE,field,trailWeight),positions=geometry.getAttribute('position'),roads=new Float32Array(positions.count),colors=new Float32Array(positions.count*3);
const biomes=new Float32Array(positions.count*4);
const green=new THREE.Color(0xd0d5b9),rockColor=new THREE.Color(0xbdb9a4),c=new THREE.Color();
for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),y=positions.getY(i);roads[i]=roadWeight(x,z);const slope=Math.hypot(height(x+.65,z)-height(x-.65,z),height(x,z+.65)-height(x,z-.65))/1.3;const b=biomeAt(x,z,y,slope);biomes.set([b.short,b.clover,b.forest,b.dry],i*4);const patch=.88+.12*Math.sin(x*.09+Math.cos(z*.13)*2);c.copy(green).lerp(rockColor,THREE.MathUtils.smoothstep(slope,.36,.95)*.75).multiplyScalar(patch);colors.set([c.r,c.g,c.b],i*3);}
geometry.setAttribute('biomeWeights',new THREE.BufferAttribute(biomes,4));
geometry.setAttribute('roadWeight',new THREE.BufferAttribute(roads,1));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
// Original authored ground maps plus a repeatable weathered asphalt material.
function asphaltTexture(){
 const cv=document.createElement('canvas');cv.width=cv.height=256;const ctx=cv.getContext('2d');let n=819;
 const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 const im=ctx.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,v=92+rand()*39+7*Math.sin(x*.043+y*.027);im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v-5;im.data[i+3]=255;}ctx.putImageData(im,0,0);
 for(let j=0;j<7;j++){let x=rand()*256,y=rand()*256;ctx.beginPath();ctx.moveTo(x,y);for(let k=0;k<8;k++){x+=rand()*23-11;y+=rand()*20-5;ctx.lineTo(x,y);}ctx.strokeStyle='rgba(33,34,29,.65)';ctx.lineWidth=.65+rand()*1.1;ctx.stroke();}
 const tex=tune(new THREE.CanvasTexture(cv));tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
}
const asphalt=asphaltTexture();
const terrainMat=new THREE.MeshStandardMaterial({map:grass,roughness:1,vertexColors:true});
terrainMat.onBeforeCompile=s=>{
 s.uniforms.trailMap={value:earth};s.uniforms.roadMap={value:asphalt};s.uniforms.gravelMap={value:gravel};
 for(const [i,name] of ['shortMap','cloverMap','woodsMap','dryMap'].entries())s.uniforms[name]={value:biomeMaps[i]||grass};
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float trailWeight; attribute float roadWeight; attribute vec4 biomeWeights; varying float vTrail; varying float vRoad; varying vec4 vBiome;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTrail=trailWeight; vRoad=roadWeight; vBiome=biomeWeights;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D trailMap, roadMap, gravelMap, shortMap, cloverMap, woodsMap, dryMap; varying float vTrail; varying float vRoad; varying vec4 vBiome;').replace('#include <map_fragment>',`
 vec4 groundColor=texture2D(map,vMapUv);
 if(vBiome.x>.015)groundColor=mix(groundColor,texture2D(shortMap,vMapUv),vBiome.x);
 if(vBiome.y>.015)groundColor=mix(groundColor,texture2D(cloverMap,vMapUv),vBiome.y);
 if(vBiome.z>.015)groundColor=mix(groundColor,texture2D(woodsMap,vMapUv),vBiome.z);
 if(vBiome.w>.015)groundColor=mix(groundColor,texture2D(dryMap,vMapUv),vBiome.w);
 groundColor=mix(groundColor,texture2D(trailMap,vMapUv),smoothstep(0.0,1.0,vTrail));
 if(vRoad>.001){
  groundColor=mix(groundColor,texture2D(gravelMap,vMapUv),smoothstep(0.0,.38,vRoad));
  groundColor=mix(groundColor,texture2D(roadMap,vMapUv*.27)*vec4(.92,.94,.92,1.),smoothstep(.20,1.0,vRoad));
 }
 diffuseColor*=groundColor;
 `);
};
const terrain=new THREE.Mesh(geometry,terrainMat);terrain.receiveShadow=true;scene.add(terrain);
const colliders=[],interactions=[],treeBatches=[],pavedPads=[];
// Maintain a dynamic index while building the map; preserve original insertion order and collision tests.
const placementGrid=createSpatialGrid(5,1.3);
function addCollider(c){colliders.push(c);placementGrid.insert(c);return c;}
let seed=4109;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function prepare(o){o.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;tune(m.map);if(m.map)m.color?.set(0xffffff);m.opacity=1;m.transparent=false;const cutout=/crown|corwn|grass|dandelion|leaf|bush|lavender|reed|plant/i.test(m.name+' '+n.name);if(cutout){m.alphaTest=.42;m.side=THREE.DoubleSide;m.alphaMap=null;}else m.alphaTest=0;if(m.specular)m.specular.setScalar(.025);m.needsUpdate=true;}});return o;}
function fit(o,h,correction=0,w=null,d=null){const wrapper=new THREE.Group(),inner=new THREE.Group(),pivot=new THREE.Group();pivot.add(o);pivot.rotation.y=correction;inner.add(pivot);wrapper.add(inner);wrapper.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(pivot,true),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),s=h/Math.max(.001,size.y);inner.scale.set(w==null?s:w/Math.max(.001,size.x),s,d==null?s:d/Math.max(.001,size.z));inner.position.set(-center.x*inner.scale.x,-b.min.y*s,-center.z*inner.scale.z);wrapper.updateMatrixWorld(true);return wrapper;}
function template(collection,name,h){if(!collection)return null;collection.updateMatrixWorld(true);let found;collection.traverse(n=>{if(n.isMesh&&n.name.trim().toLowerCase()===name.toLowerCase())found=n;});if(!found)return null;const c=found.clone();found.matrixWorld.decompose(c.position,c.quaternion,c.scale);return fit(prepare(c),h);}
function place(o,x,z,a=0,s=1){o.position.set(x,height(x,z),z);o.rotation.y=a;o.scale.setScalar(s);scene.add(o);o.updateMatrixWorld(true);return o;}
function aabb(o,pad=.05){const b=new THREE.Box3().setFromObject(o,true);addCollider({x0:b.min.x-pad,x1:b.max.x+pad,z0:b.min.z-pad,z1:b.max.z+pad,top:b.max.y});}
function free(x,z,r=.32){return !placementGrid.at(x,z).some(c=>hitsCollider(c,x,z,r));}
const mat=(color,map=null)=>new THREE.MeshStandardMaterial({color,map,roughness:1});
const concrete=mat(0xb3aea2,stoneTex),iron=mat(0x575e59),rust=mat(0x8e6957),wood=mat(0xa08c71,woodTex),dark=mat(0x353b38);
function box(w,h,d,m,x,y,z,parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function beam(a,b,r,m,parent=scene){const v=new THREE.Vector3().subVectors(b,a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),6),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function batch(t,points,shadow=false,isTree=false){if(!t||!points.length)return;t.updateMatrixWorld(true);const dummy=new THREE.Object3D();t.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld),m=new THREE.InstancedMesh(g,n.material,points.length);points.forEach(([x,z,s,a],i)=>{dummy.position.set(x,height(x,z)-.025,z);dummy.rotation.set(0,a,0);dummy.scale.setScalar(s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.instanceMatrix.needsUpdate=true;m.castShadow=shadow;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);if(isTree)treeBatches.push({mesh:m,points});});}
function inspect(x,z,prompt,message,radius=3){interactions.push({x,z,prompt:'E — '+prompt,message,radius});}
function bench(x,z,a=0){const g=new THREE.Group();for(const dx of [-.85,.85]){box(.12,.5,.5,iron,dx,.25,0,g);box(.08,.85,.08,iron,dx,.48,-.22,g);}for(let i=0;i<3;i++)box(2.1,.065,.15,wood,0,.52,-.18+i*.17,g);for(let i=0;i<2;i++)box(2.1,.15,.06,wood,0,.76+i*.17,-.23,g);place(g,x,z,a);aabb(g);}
function sign(x,z,a,line1,line2,message){const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');c.fillStyle='#b9b9a2';c.fillRect(0,0,256,128);c.strokeStyle='#4b5950';c.lineWidth=5;c.strokeRect(5,5,246,118);c.fillStyle='#35473d';c.font='bold 27px monospace';c.textAlign='center';c.fillText(line1,128,48);c.font='19px monospace';c.fillText(line2,128,88);const g=new THREE.Group();box(.12,1.9,.12,iron,0,.95,0,g);box(1.95,.85,.08,mat(0xffffff,tune(new THREE.CanvasTexture(cv))),0,1.65,0,g);place(g,x,z,a);addCollider({x,z,r:.11,top:height(x,z)+2.1});inspect(x,z,'прочитать',message);}
function prop(name,x,z,h,a=0,correction=-Math.PI/2,solid=true){const src=lib[name];if(!src)return null;const o=place(fit(prepare(src.clone(true)),h,correction),x,z,a);if(solid)aabb(o);return o;}
function flatPad(x,z,w,d,m){pavedPads.push([x,z,w,d]);const g=new THREE.PlaneGeometry(w,d,Math.ceil(w),Math.ceil(d));g.rotateX(-Math.PI/2);const p=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=0;i<p.count;i++){const xx=x+p.getX(i),zz=z+p.getZ(i);p.setY(i,height(xx,zz)+.035);uv.setXY(i,xx*.65,zz*.65);}g.computeVertexNormals();const o=new THREE.Mesh(g,m);o.position.set(x,0,z);o.receiveShadow=true;scene.add(o);}
for(const site of level.houses){const {model,x,z,w,d,h,rot,correction}=site;const src=lib[model];if(!src)throw Error('Hillside house missing: '+model);const o=place(fit(prepare(src.clone(true)),h,correction,w,d),x,z,rot);aabb(o,.09);const b=new THREE.Box3().setFromObject(o,true),size=b.getSize(new THREE.Vector3());flatPad(x,z,size.x+1.6,size.z+1.6,concrete);}
for(const [x,z,a] of [[-60,59,0],[-45,34,Math.PI],[-27,36,0],[-73,51,Math.PI/2],[-12,46,.2],[54,-64,.5]])bench(x,z,a);
for(const [i,x] of [-88,-83,-78,-73].entries())prop('garage0'+(1+i%3),x,82,2.7,Math.PI,-Math.PI/2);
prop('electricbox01',-73,35,1.25,Math.PI/2);prop('electricbox01',-19,64,1.25,0);
const stop=prop('busstop',-58,49,2.55,0,-Math.PI/2,false);if(stop){const b=new THREE.Box3().setFromObject(stop,true);addCollider({x0:b.min.x,x1:b.max.x,z0:b.min.z-.12,z1:b.min.z+.12,top:b.max.y});for(const x of [b.min.x+.12,b.max.x-.12])addCollider({x,z:b.max.z-.15,r:.12,top:b.max.y});}
inspect(-58,48,'осмотреть остановку','Последний автобус уходит в город. Дальше только лес.');
sign(-11,42,0,'РТПС','2 км','Выцветший указатель. Дорогу давно не ремонтировали.');
// Roadside posts and occasional steel rails follow the sampled terrain.
let traveled=0,next=6,previous=null;
for(let i=1;i<SERPENTINE.length;i++){const a=SERPENTINE[i-1],b=SERPENTINE[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);while(next<=traveled+len){const t=(next-traveled)/len,x=a[0]+dx*t-dz/len*3.1,z=a[1]+dz*t+dx/len*3.1,y=height(x,z);if(y>5){box(.13,.83,.13,concrete,x,y+.415,z);addCollider({x,z,r:.085,top:y+.83});box(.14,.17,.14,rust,x,y+.76,z);const p=new THREE.Vector3(x,y+.62,z);if(previous&&previous.distanceTo(p)<7.8&&y>12)beam(previous,p,.055,iron);previous=p;}else previous=null;next+=6;}traveled+=len;}
// Heat pipes terminate at a small district utility building; posts, not the whole overhead span, block movement.
function solid(w,h,d,m,x,z,y=0){const o=box(w,h,d,m,x,height(x,z)+y+h/2,z);aabb(o,.025);return o;}
const pipeMat=mat(0x77786c),pipeRust=mat(0x88664f);
const heatPoints=[[-95,57],[-76,57],[-76,42],[-76,23],[-68,12],[-48,12]];
for(let i=1;i<heatPoints.length;i++){
 const [ax,az]=heatPoints[i-1],[bx,bz]=heatPoints[i],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
 for(const off of [-.32,.32])beam(new THREE.Vector3(ax+nx*off,height(ax,az)+2.35,az+nz*off),new THREE.Vector3(bx+nx*off,height(bx,bz)+2.35,bz+nz*off),.18,i===2?pipeRust:pipeMat);
 for(let t=0;t<len;t+=5.8){const x=ax+dx*t/len,z=az+dz*t/len;for(const off of [-.63,.63])solid(.16,2.25,.16,iron,x+nx*off,z+nz*off);const cap=box(1.7,.12,.17,iron,x,height(x,z)+2.19,z);cap.rotation.y=-Math.atan2(nz,nx);}
}
solid(7,3.2,5,concrete,-44,9);box(2.2,2.5,.1,dark,-44,height(-44,9)+1.25,11.55);
inspect(-44,13,'осмотреть теплопункт','На трубе ещё осталась старая жёлтая краска.');
// The garage court is an actual destination with an open passage, not a row of isolated props.
for(const [i,x] of [-88,-83,-78,-73,-68,-63,-58].entries())if(i>3)prop('garage0'+(1+i%3),x,82,2.7,Math.PI,-Math.PI/2);
flatPad(-73,77,34,7,mat(0xb1b1a6,asphalt));
for(const x of [-91,-87,-83,-79,-75,-71,-67,-63,-59,-55])prop('wall',x,87,2.1,0,Math.PI/2);
for(const [x,z] of [[-60,42],[-39,47],[-23,42],[-69,61],[-21,66]]){
 const y=height(x,z);box(.15,5.1,.15,concrete,x,y+2.55,z);box(.9,.1,.14,iron,x+.35,y+4.9,z);box(.36,.22,.28,dark,x+.7,y+4.78,z);addCollider({x,z,r:.10,top:y+5.1});
}
// Remote buildings and a ridge continue beyond the playable area.
for(const site of [{model:'house07',x:-113,z:6,h:23,rot:Math.PI/2,correction:-22.444203*Math.PI/180},{model:'house03',x:-72,z:113,h:15,rot:0,correction:0},{model:'house02',x:-36,z:112,h:15,rot:0,correction:0}]){
 const src=lib[site.model];if(src)place(fit(prepare(src.clone(true)),site.h,site.correction),site.x,site.z,site.rot);
}
// Summit service compound, rather than a tourist viewpoint.
flatPad(60,-67,16,14,mat(0xb7b8ad,asphalt));
solid(6.6,3.1,4.5,concrete,59,-63);box(7,.17,4.9,dark,59,height(59,-63)+3.19,-63);box(1.05,2.1,.1,iron,57.4,height(59,-63)+1.05,-65.3);box(1.5,.65,.1,dark,60.5,height(59,-63)+2,-65.3);
// North access is deliberately open where the switchback reaches the compound.
for(const [x,z] of [[51,-60],[51,-64],[51,-68],[51,-72],[69,-72],[69,-68],[69,-64],[69,-60]])prop('wall',x,z,1.8,Math.PI/2,Math.PI/2);
sign(66,-72,0,'РТПС № 4','НЕ ВХОДИТЬ','На двери нет замка. Внутри тихо.');
const tower=new THREE.Group();for(const x of [-.9,.9])for(const z of [-.9,.9])beam(new THREE.Vector3(x,0,z),new THREE.Vector3(x*.25,8,z*.25),.055,iron,tower);for(let y=1;y<8;y+=1.4)for(const z of [-.6,.6])beam(new THREE.Vector3(-.7,y,z),new THREE.Vector3(.7,y+1.3,z),.035,rust,tower);box(.2,2,.2,iron,0,8.7,0,tower);place(tower,65,-69);aabb(tower,.08);
inspect(65,-69,'осмотреть вышку','Радиостанция давно молчит. Внизу видны крыши домов.',4);
const trees=['PSX_Tree1','PSX_Tree2','PSX_Tree3','PSX_Tree4'].map(n=>template(forest,n,8)),treePoints=trees.map(()=>[]),woodShapes=trees.map(t=>collectWoodTriangles(THREE,t)),centers=[];
for(let n=0;n<6300&&centers.length<440;n++){const x=(rnd()-.5)*208,z=(rnd()-.5)*208,y=height(x,z);if(reserveTree(x,z)||!free(x,z,1.2)||centers.some(p=>Math.hypot(x-p[0],z-p[1])<3.4))continue;const density=forestDensity(x,z,y);if(rnd()>density)continue;const j=Math.floor(rnd()*trees.length);if(!trees[j])continue;const s=.65+rnd()*.7,a=rnd()*Math.PI*2;centers.push([x,z]);treePoints[j].push([x,z,s,a]);addCollider(combatTreeCollider(woodShapes[j],x,z,s,a,y-.025));}
trees.forEach((t,i)=>batch(t,treePoints[i],true,true));
const grassTemplate=template(forest,'PSX_Grass',.42),flower=template(forest,'PSX_Dandelion',.32),bush=template(nature,'Bush',.85),rock=template(forest,'PSX_Rock',.85);
for(const [t,count,lo,hi,kind] of [[grassTemplate,9000,.55,1.45,'grass'],[flower,1000,.65,1.2,'flower'],[bush,420,.7,1.6,'bush'],[rock,310,.65,2.2,'rock']]){if(!t)continue;const points=[];for(let i=0;i<count*3&&points.length<count;i++){const x=(rnd()-.5)*210,z=(rnd()-.5)*210,y=height(x,z);if(Math.hypot(x-level.spawn[0],z-level.spawn[1])<3||roadAt(x,z).distance<3.6||trailWeight(x,z)>.5||!free(x,z,kind==='rock'?.55:.12)||Math.hypot(x-60,z+67)<6)continue;if(kind!=='rock'&&y>26&&rnd()<.7)continue;if(cityDistance(x,z)<1&&rnd()<.85)continue;if(kind==='grass'&&rnd()>.28+.72*forestDensity(x,z,y))continue;const s=lo+(hi-lo)*rnd(),a=rnd()*Math.PI*2;points.push([x,z,s,a]);if(kind==='rock'&&s>1.35)addCollider({x,z,r:.30*s,top:y+.7*s});}if(kind==='rock')batch(t,points,true);else if(kind==='bush')batch(t,points.filter((_,i)=>i%3!==0),false);}
// Separate visual seed: new density and quality cannot alter the physical rock/tree layout.
const staticBatchStats=batchStaticProps(THREE,scene);
const chunkedTrees=splitStaticInstances(THREE,scene,treeBatches,64);
const physics=createWorldData({id:'sunset',revision:'067-static',level,field,colliders});
const vegetation=createVegetationSystem(THREE,scene,height),plantRandom=seededRandom(680931);
const covers=[
 [grassTemplate,23000,.70,1.60,'grass'],[template(nature,'Grass',.40),10000,.65,1.4,'naturegrass'],
 [template(forest,'PSX_Reed',.85),8700,.62,1.25,'reed'],
 [flower,2300,.55,1.3,'flower'],[template(forest,'PSX_Lavender',.62),800,.6,1.25,'lavender']
];
for(const [t,count,lo,hi,kind] of covers){
 if(!t){console.warn('Ground cover mesh missing:',kind);continue;}
 const points=[];
 for(let i=0;i<count*9&&points.length<count;i++){
  const x=(plantRandom()-.5)*212,z=(plantRandom()-.5)*212,y=height(x,z);
  if(pavedPads.some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.1&&Math.abs(z-cz)<d/2+.1))continue;
  const slope=Math.hypot(height(x+.65,z)-height(x-.65,z),height(x,z+.65)-height(x,z-.65))/1.3,b=biomeAt(x,z,y,slope);
  // Only decorative cover: roads, trail cores and service pads stay clear.
  if(b.road<2.8||b.trail>.72||slope>1.2||!free(x,z,.09)||plantRandom()>plantChance(kind,b))continue;
  points.push([x,z,lo+(hi-lo)*plantRandom()**1.5,plantRandom()*Math.PI*2]);
 }
 vegetation.add(t,points);
}
scene.updateMatrixWorld(true);if(!free(...level.spawn,.48))throw Error('Hillside spawn obstructed');
for(const child of scene.children)child.traverse(o=>{o.matrixAutoUpdate=false;});
export const world={THREE,scene,camera,renderer,level,height,free,colliders,terrain,treeBatches:chunkedTrees,sun,extraTextures:[earth,gravel,asphalt,...biomeMaps],interactions,vegetation,physics,localShadowRadius:36,staticBatchStats};
