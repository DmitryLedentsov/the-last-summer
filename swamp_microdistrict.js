import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {unzlibSync} from 'three/addons/libs/fflate.module.js';
import {createHeightfield,buildTerrainGeometry} from './terrain.js';
import {hitsCollider,collectWoodTriangles,combatTreeCollider} from './tree_collision.js?v=061';
import {createVegetationSystem,seededRandom} from './vegetation_system.js?v=070';
import {splitStaticInstances} from './duel_perf.js?v=070';
import {createSpatialGrid} from './spatial_grid.js?v=068';
import {createWorldData} from './world_data.js?v=068';
import {SWAMP,WATER,HOUSES,swampHeight,roadMask,roadDistance,buildingDistance,canWade,reserve} from './swamp_layout.js?v=071';
const level=SWAMP,scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x26373c,.023);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,300),renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1)*.8);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x9caec9,0x526653,1.15));
const sun=new THREE.DirectionalLight(0xa6c0df,.95);sun.position.set(-62,66,-36);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;Object.assign(sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:220});scene.add(sun);
const asset=p=>new URL('./assets/curated/'+p,import.meta.url).href,manager=new THREE.LoadingManager(),tx=new THREE.TextureLoader(manager),fbx=new FBXLoader(manager);
manager.setURLModifier(p=>{const n=p.split(/[\\/]/).pop();return /^[1-6]h\.png$/i.test(n)?asset('houses/'+n.toLowerCase()):p;});
function tune(t){t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;return t;}
const texNames=['Dirt','Grass','Tree','BirchTree','Bush','MossyRock','Misc','Signs1','LogCabbin','CabinProps'];
const [sky,textureEntries,houseEntries]=await Promise.all([new RGBELoader().loadAsync(asset('sky/PSX_NIGHTSKY.hdr')).catch(()=>null),Promise.all(texNames.map(async n=>[n,tune(await tx.loadAsync(asset('swamp/textures/'+n+'.png')))])),Promise.all(['house07','house03','house02'].map(async n=>[n,await fbx.loadAsync(asset('houses/'+n+'.fbx'))]))]);
if(sky){sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;scene.backgroundIntensity=.55;}else scene.background=new THREE.Color(0x17232b);
const textures=Object.fromEntries(textureEntries),houses=Object.fromEntries(houseEntries);
for(const n of ['Grass','Dirt'])textures[n].wrapS=textures[n].wrapT=THREE.RepeatWrapping;
const field=createHeightfield({size:level.size,segments:280,height:swampHeight}),height=field.sample;
const g=buildTerrainGeometry(THREE,field,roadMask),p=g.attributes.position,wet=new Float32Array(p.count),colors=new Float32Array(p.count*3);
for(let i=0;i<p.count;i++){wet[i]=1-THREE.MathUtils.smoothstep(p.getY(i),-.18,.35);const t=1-.28*wet[i];colors.set([t,t,t],i*3);}
g.setAttribute('wet',new THREE.BufferAttribute(wet,1));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
const terrainMat=new THREE.MeshStandardMaterial({map:textures.Grass,vertexColors:true,roughness:1});terrainMat.onBeforeCompile=s=>{s.uniforms.dirt={value:textures.Dirt};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float trailWeight; attribute float wet; varying float vPath; varying float vWet;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPath=trailWeight;vWet=wet;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D dirt; varying float vPath; varying float vWet;').replace('#include <map_fragment>','diffuseColor *= mix(texture2D(map,vMapUv),texture2D(dirt,vMapUv),max(vPath,vWet*.85));');};
const terrain=new THREE.Mesh(g,terrainMat);terrain.receiveShadow=true;scene.add(terrain);
// The single water sheet is clipped naturally by the actual terrain. No reflection render pass.
const waterMat=new THREE.MeshStandardMaterial({color:0x233d3a,roughness:.43,metalness:.1,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
const water=new THREE.Mesh(new THREE.PlaneGeometry(level.size,level.size),waterMat);water.rotation.x=-Math.PI/2;water.position.y=WATER;water.receiveShadow=true;water.renderOrder=2;scene.add(water);
const colliders=[],grid=createSpatialGrid(),treeBatches=[],interactions=[],rnd=seededRandom(193881),decor=seededRandom(8113);
const add=c=>{colliders.push(c);grid.insert(c);},free=(x,z,r=.32)=>!grid.at(x,z).some(c=>hitsCollider(c,x,z,r)),canEnter=(x,z)=>canWade(height,x,z);
function fit(o,h,correction=0,w=null,d=null){const wrapper=new THREE.Group(),inner=new THREE.Group(),pivot=new THREE.Group();pivot.add(o);pivot.rotation.y=correction;inner.add(pivot);wrapper.add(inner);wrapper.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(pivot,true),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),s=h/Math.max(.001,size.y);inner.scale.set(w==null?s:w/Math.max(.001,size.x),s,d==null?s:d/Math.max(.001,size.z));inner.position.set(-center.x*inner.scale.x,-b.min.y*s,-center.z*inner.scale.z);wrapper.updateMatrixWorld(true);return wrapper;}
function place(o,x,z,a=0,s=1){o.position.set(x,height(x,z),z);o.rotation.y=a;o.scale.setScalar(s);scene.add(o);o.updateMatrixWorld(true);return o;}
function aabb(o){const b=new THREE.Box3().setFromObject(o,true);add({x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,top:b.max.y});}
for(const h of HOUSES){const o=houses[h.model].clone(true);o.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material])if(m?.map)tune(m.map);}});aabb(place(fit(o,h.h,h.correction,h.w,h.d),h.x,h.z,h.rot));}
const specs={BirchTree1:['BirchTree',7.4],BirchTree2:['BirchTree',8.4],Tree1:['Tree',8],Tree2:['Tree',9],Tree3:['Tree',7],Tree4:['Tree',8.7],Tree5:['Tree',9.4],Bush1:['Bush',.85],Bush2:['Bush',1],Bush3:['Bush',.65],Grass1:['Grass',.47],Grass2:['Grass',.65],Rock1:['MossyRock',.85],Rock2:['MossyRock',1.25],Lantern:['Misc',.54],FaceLantern:['Misc',.65],Sign1:['Signs1',1.5],Sign2:['Signs1',1.5],Sign3:['Signs1',1.5],Sign4:['Signs1',1.5],Cabin:['LogCabbin',3.2],Mushroom1:['Misc',.24],Mushroom2:['Misc',.3],Mushroom3:['Misc',.27]};
async function swampModel(n,[map,h]){const r=await fetch(asset('swamp/meshes/'+n+'.fbx.deflate'));if(!r.ok)throw Error('Missing swamp model '+n);const raw=unzlibSync(new Uint8Array(await r.arrayBuffer())),o=fbx.parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');const cut=/Tree|Bush|Grass|Mushroom|Sign|Lantern/.test(n);
o.traverse(m=>{if(!m.isMesh)return;m.material=new THREE.MeshStandardMaterial({map:textures[map],roughness:1,alphaTest:cut?.4:0,side:cut?THREE.DoubleSide:THREE.FrontSide});m.castShadow=true;m.receiveShadow=true;});return fit(o,h);}
const models=Object.fromEntries(await Promise.all(Object.entries(specs).map(async ([n,s])=>[n,await swampModel(n,s)])));
function batch(t,points,shadow=false,trees=false){if(!points.length)return;t.updateMatrixWorld(true);const dummy=new THREE.Object3D();t.traverse(n=>{if(!n.isMesh)return;const m=new THREE.InstancedMesh(n.geometry.clone().applyMatrix4(n.matrixWorld),n.material,points.length);for(let i=0;i<points.length;i++){const [x,z,s,a]=points[i];dummy.position.set(x,height(x,z)-.018,z);dummy.scale.setScalar(s);dummy.rotation.set(0,a,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.instanceMatrix.needsUpdate=true;m.castShadow=shadow;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);if(trees)treeBatches.push({mesh:m,points});});}
const treeNames=Object.keys(specs).filter(n=>/Tree/.test(n)),pts=treeNames.map(()=>[]),wood=treeNames.map(n=>collectWoodTriangles(THREE,models[n]));
for(let i=0;i<8000&&pts.reduce((a,b)=>a+b.length,0)<530;i++){const x=(rnd()-.5)*254,z=(rnd()-.5)*254;if(reserve(x,z)||!free(x,z,1.5)||height(x,z)<-1.25)continue;const density=.53+.32*Math.sin(x*.045+z*.022)*Math.cos(z*.058);if(rnd()>density)continue;const j=Math.floor(rnd()*treeNames.length),s=.68+rnd()*.65,a=rnd()*Math.PI*2;const c=combatTreeCollider(wood[j],x,z,s,a,height(x,z));pts[j].push([x,z,s,a]);add(c);}
treeNames.forEach((n,i)=>batch(models[n],pts[i],true,true));
const vegetation=createVegetationSystem(THREE,scene,height),pendingVegetation=[];
for(const [n,count] of [['Grass1',6500],['Grass2',4800],['Bush1',250],['Bush2',240],['Bush3',200],['Mushroom1',110],['Mushroom2',80],['Mushroom3',80],['Rock1',180],['Rock2',130]]){const points=[];for(let i=0;i<count*5&&points.length<count;i++){const x=(decor()-.5)*254,z=(decor()-.5)*254,y=height(x,z);if(reserve(x,z)||!free(x,z,.24)||y<-.46||roadDistance(x,z)<3.8)continue;const s=.65+decor()*.65,a=decor()*Math.PI*2;points.push([x,z,s,a]);if(n.startsWith('Rock'))add({x,z,r:.25*s,top:y+specs[n][1]*s});}if(n.startsWith('Rock'))batch(models[n],points,true);else pendingVegetation.push([models[n],points]);}
const cabin=place(models.Cabin.clone(true),96,-63,.7);aabb(cabin);
for(const [i,x,z,a] of [[1,-49,66,.2],[2,44,31,1.1],[3,40,-15,-.5],[4,88,-43,.8]])place(models['Sign'+i].clone(true),x,z,a);
const glows=[];const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,1,32,32,31);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.24,'rgba(255,255,255,.55)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const halo=new THREE.CanvasTexture(glowCanvas);
function glow(x,z,y,color,wanders=false){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:halo,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));m.position.set(x,y,z);m.scale.setScalar(wanders?1.4:2.2);scene.add(m);glows.push({m,x,z,y,phase:rnd()*6.28,wanders});}
for(const [x,z,a] of [[-43,70,0],[-18,58,1],[43,32,0],[43,-13,.5],[96,-61,1]]){place(models.Lantern.clone(true),x,z,a);glow(x,z,height(x,z)+.43,0xffac55);}
for(const [x,z] of [[-13,11],[22,-3],[-71,-46],[80,-73],[-6,-75],[15,88]]){glow(x,z,Math.max(WATER+.3,height(x,z)+.4),0x6dc5ad,true);}
interactions.push({x:96,z:-61,radius:4,prompt:'E — осмотреть домик',message:'В домике горит фонарь. Здесь давно никто не живёт.'},{x:-18,z:58,radius:3,prompt:'E — осмотреть дорогу',message:'Вода поднялась выше дороги. Дальше только лес.'});
function updateEnvironment(dt,now){for(const o of glows){const t=now*.001+o.phase;o.m.material.opacity=.65+.23*Math.sin(t*1.7)+.09*Math.sin(t*9);if(o.wanders){o.m.position.x=o.x+Math.sin(t*.3)*2.1;o.m.position.z=o.z+Math.cos(t*.27)*1.5;o.m.position.y=o.y+Math.sin(t*.6)*.18;}}}
const chunkedTrees=splitStaticInstances(THREE,scene,treeBatches,64),physics=createWorldData({id:'swamp',revision:'071-static',level,field,colliders});
for(const [model,points] of pendingVegetation)vegetation.add(model,points);
if(!free(...level.spawn,.48)||!canEnter(...level.spawn))throw Error('Swamp spawn blocked');
export const world={THREE,scene,camera,renderer,level,height,free,canEnter,colliders,terrain,treeBatches:chunkedTrees,sun,extraTextures:Object.values(textures),interactions,vegetation,physics,localShadowRadius:36,updateEnvironment};
