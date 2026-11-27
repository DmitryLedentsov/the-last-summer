import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {unzlibSync} from 'three/addons/libs/fflate.module.js';
import {createHeightfield,buildTerrainGeometry} from './terrain.js';
import {hitsCollider,collectWoodTriangles,combatTreeCollider} from './tree_collision.js?v=061';
import {createVegetationSystem,seededRandom} from './vegetation_system.js?v=076';
import {splitStaticInstances} from './duel_perf.js?v=070';
import {createSpatialGrid} from './spatial_grid.js?v=068';
import {createWorldData} from './world_data.js?v=068';
import {SWAMP,WATER,HOUSES,swampHeight,roadMask,roadDistance,buildingDistance,canWade,reserve,marshCover,treeGrove} from './swamp_layout.js?v=074';
const level=SWAMP,scene=new THREE.Scene();scene.background=new THREE.Color(0x46534c);scene.fog=new THREE.FogExp2(0x46534c,.022);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,300),renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1)*.8);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.48;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xd0d5c2,0x73775d,2.1));
const sun=new THREE.DirectionalLight(0xc3cfbf,1.25);sun.position.set(-62,66,-36);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;Object.assign(sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:220});scene.add(sun);
const asset=p=>new URL('./assets/curated/'+p,import.meta.url).href,manager=new THREE.LoadingManager(),tx=new THREE.TextureLoader(manager),fbx=new FBXLoader(manager);
manager.setURLModifier(p=>{const n=p.split(/[\\/]/).pop();return /^[1-6]h\.png$/i.test(n)?asset('houses/'+n.toLowerCase()):p;});
function tune(t,pixelLock=false){t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=pixelLock?THREE.NearestMipmapNearestFilter:THREE.NearestMipmapLinearFilter;t.userData.lockPixelFilter=pixelLock;return t;}
const texNames=['Dirt','Grass','Bush','BirchTree','Tree','MossyRock','Misc','Signs1','LogCabbin'];
const [textureEntries,houseEntries]=await Promise.all([Promise.all(texNames.map(async n=>[n,tune(await tx.loadAsync(asset('swamp/textures/'+n+'.png')),true)])),Promise.all(['house07','house03','house02'].map(async n=>[n,await fbx.loadAsync(asset('houses/'+n+'.fbx'))]))]);
const textures=Object.fromEntries(textureEntries),houses=Object.fromEntries(houseEntries);
for(const n of ['Grass','Dirt'])textures[n].wrapS=textures[n].wrapT=THREE.RepeatWrapping;
const field=createHeightfield({size:level.size,segments:level.segments,height:swampHeight}),height=field.sample;
const g=buildTerrainGeometry(THREE,field,roadMask),p=g.attributes.position,uv=g.attributes.uv,wet=new Float32Array(p.count),colors=new Float32Array(p.count*3);
for(let i=0;i<p.count;i++){
 const x=p.getX(i),z=p.getZ(i),h=p.getY(i);
 const patch=marshCover(x,z);
 wet[i]=Math.max(1-THREE.MathUtils.smoothstep(h,WATER-.06,WATER+.20),THREE.MathUtils.smoothstep(patch,.63,.94)*.85);
 const t=.96+.04*Math.sin(x*.12+z*.16);colors.set([t,t,t],i*3);uv.setXY(i,x*.22,z*.22);
}
g.setAttribute('wet',new THREE.BufferAttribute(wet,1));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
const terrainMat=new THREE.MeshStandardMaterial({map:textures.Grass,vertexColors:true,roughness:1,toneMapped:false});
terrainMat.onBeforeCompile=s=>{s.uniforms.dirt={value:textures.Dirt};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float trailWeight; attribute float wet; varying float vPath; varying float vWet;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPath=trailWeight;vWet=wet;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D dirt; varying float vPath; varying float vWet;').replace('#include <map_fragment>','diffuseColor *= mix(texture2D(map,vMapUv),texture2D(dirt,vMapUv),smoothstep(.36,.68,max(vPath,vWet)));').replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,diffuseColor.rgb,.52);\n#include <opaque_fragment>');};
const terrain=new THREE.Mesh(g,terrainMat);terrain.receiveShadow=true;scene.add(terrain);
// The single water sheet is clipped naturally by the actual terrain. No reflection render pass.
const waterMat=new THREE.MeshStandardMaterial({color:0x444c36,roughness:.67,metalness:0,transparent:true,opacity:.66,depthWrite:false,side:THREE.DoubleSide});
const water=new THREE.Mesh(new THREE.PlaneGeometry(level.size,level.size),waterMat);water.rotation.x=-Math.PI/2;water.position.y=WATER;water.receiveShadow=true;water.renderOrder=2;scene.add(water);
const colliders=[],grid=createSpatialGrid(),treeBatches=[],interactions=[],rnd=seededRandom(193881),decor=seededRandom(8113);
const add=c=>{colliders.push(c);grid.insert(c);},free=(x,z,r=.32)=>!grid.at(x,z).some(c=>hitsCollider(c,x,z,r)),canEnter=(x,z)=>canWade(height,x,z);
function fit(o,h,correction=0,w=null,d=null){const wrapper=new THREE.Group(),inner=new THREE.Group(),pivot=new THREE.Group();pivot.add(o);pivot.rotation.y=correction;inner.add(pivot);wrapper.add(inner);wrapper.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(pivot,true),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),s=h/Math.max(.001,size.y);inner.scale.set(w==null?s:w/Math.max(.001,size.x),s,d==null?s:d/Math.max(.001,size.z));inner.position.set(-center.x*inner.scale.x,-b.min.y*s,-center.z*inner.scale.z);wrapper.updateMatrixWorld(true);return wrapper;}
function place(o,x,z,a=0,s=1){o.position.set(x,height(x,z),z);o.rotation.y=a;o.scale.setScalar(s);scene.add(o);o.updateMatrixWorld(true);return o;}
function aabb(o){const b=new THREE.Box3().setFromObject(o,true);add({x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,top:b.max.y});}
for(const h of HOUSES){const o=houses[h.model].clone(true);o.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material])if(m?.map)tune(m.map);}});aabb(place(fit(o,h.h,h.correction,h.w,h.d),h.x,h.z,h.rot));}
const specs={BirchTree1:['BirchTree',9.4],BirchTree2:['BirchTree',9.9],Tree1:['Tree',8.4],Tree2:['Tree',7.9],Tree4:['Tree',7.2],Bush1:['Bush',.74],Bush2:['Bush',.92],Bush3:['Bush',.78],Grass1:['Misc',.68],Grass2:['Misc',1.04],Rock1:['MossyRock',.42],Rock2:['MossyRock',.65],Lantern:['Misc',.54],Sign1:['Signs1',1.5],Sign2:['Signs1',1.5],Sign3:['Signs1',1.5],Sign4:['Signs1',1.5],Cabin:['LogCabbin',3.2],Mushroom1:['Misc',.21],Mushroom2:['Misc',.28],Mushroom3:['Misc',.23]};
async function swampModel(n,[map,h]){const r=await fetch(asset('swamp/meshes/'+n+'.fbx.deflate'));if(!r.ok)throw Error('Missing swamp model '+n);const raw=unzlibSync(new Uint8Array(await r.arrayBuffer())),o=fbx.parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');// Exported scene transforms are Z-up (despite FBX header). Normalize before measuring.
const oriented=new THREE.Group();oriented.rotation.x=-Math.PI/2;oriented.add(o);const cut=/Tree|Bush|Grass|Mushroom|Sign/.test(n);
o.traverse(m=>{if(!m.isMesh)return;m.material=new THREE.MeshStandardMaterial({map:textures[map],roughness:1,alphaTest:cut?.42:0,side:THREE.DoubleSide,toneMapped:false});m.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,diffuseColor.rgb,.78);\n#include <opaque_fragment>');};m.castShadow=true;m.receiveShadow=true;});const result=fit(oriented,h);
 // The bounding box centre can sit far from a leaning tree trunk. Anchor the model at the actual base.
 if(/Tree/.test(n)){const low=new THREE.Box3(),v=new THREE.Vector3();result.updateMatrixWorld(true);result.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);if(v.y<.24)low.expandByPoint(v);}});if(!low.isEmpty()){const c=low.getCenter(new THREE.Vector3());result.children[0].position.x-=c.x;result.children[0].position.z-=c.z;result.updateMatrixWorld(true);}const b=new THREE.Box3().setFromObject(result,true),size=b.getSize(new THREE.Vector3());if(size.y<h*.98||size.y>h*1.02||Math.max(size.x,size.z)>h*1.45)throw Error('Invalid swamp tree bounds '+n);}
 return result;}
const models=Object.fromEntries(await Promise.all(Object.entries(specs).map(async ([n,s])=>[n,await swampModel(n,s)])));
function batch(t,points,shadow=false,trees=false){if(!points.length)return;t.updateMatrixWorld(true);const dummy=new THREE.Object3D();t.traverse(n=>{if(!n.isMesh)return;const m=new THREE.InstancedMesh(n.geometry.clone().applyMatrix4(n.matrixWorld),n.material,points.length);for(let i=0;i<points.length;i++){const [x,z,s,a]=points[i];dummy.position.set(x,height(x,z)-.018,z);dummy.scale.setScalar(s);dummy.rotation.set(0,a,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.instanceMatrix.needsUpdate=true;m.castShadow=shadow;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);if(trees)treeBatches.push({mesh:m,points});});}
// Groves, not an uninterrupted forest: the marsh and its panel blocks remain visible.
// Use only the corrected upright originals and height-banded trunk collision.
const treeNames=['BirchTree1','BirchTree2','Tree1','Tree2','Tree4'],treePoints=treeNames.map(()=>[]),wood=treeNames.map(n=>collectWoodTriangles(THREE,models[n]));
const treeRandom=seededRandom(681137),centers=[];
for(let i=0;i<11000&&centers.length<270;i++){
 const x=(treeRandom()-.5)*250,z=(treeRandom()-.5)*250,y=height(x,z),grove=treeGrove(x,z);
 if(y<WATER-.04||buildingDistance(x,z)<5.0||roadDistance(x,z)<2.6||Math.hypot(x-level.spawn[0],z-level.spawn[1])<4.2||Math.hypot(x-96,z+63)<5.5)continue;
 if(grove<.48||treeRandom()>THREE.MathUtils.smoothstep(grove,.48,.78)*.85||centers.some(([u,v])=>Math.hypot(x-u,z-v)<3.7)||!free(x,z,1.2))continue;
 const j=treeRandom()<.67?Math.floor(treeRandom()*2):2+Math.floor(treeRandom()*3),scale=.78+treeRandom()*.44,angle=treeRandom()*Math.PI*2;
 const c=combatTreeCollider(wood[j],x,z,scale,angle,y-.018);
 if(!c.poly||!c.raySlices?.length)continue; // do not add a visible tree with unverified collision
 if(Math.max(c.x1-c.x0,c.z1-c.z0)>3.2)continue; // do not let wide alpha-cut foliage become a movement wall
 treePoints[j].push([x,z,scale,angle]);centers.push([x,z]);add(c);
}
treeNames.forEach((n,i)=>batch(models[n],treePoints[i],true,true));
const vegetation=createVegetationSystem(THREE,scene,height,{chunkSize:16}),pendingVegetation=[];
for(const [n,count] of [['Grass1',22000],['Grass2',15000],['Bush1',1050],['Bush2',900],['Bush3',700],['Mushroom1',260],['Mushroom2',170],['Mushroom3',140],['Rock1',120],['Rock2',90]]){
 const points=[],grass=n.startsWith('Grass'),rock=n.startsWith('Rock');
 for(let i=0;i<count*8&&points.length<count;i++){
  const x=(decor()-.5)*254,z=(decor()-.5)*254,y=height(x,z);
  if(reserve(x,z)||!free(x,z,rock?.35:.08)||y<(grass?WATER-.29:WATER-.05))continue;
  // Overlapping broad patches, taller grass beside water and the muddy footpaths.
  const patch=marshCover(x,z);
  const shore=1-THREE.MathUtils.smoothstep(Math.abs(y-WATER),.08,.38),edge=1-THREE.MathUtils.smoothstep(roadDistance(x,z),2,8);
  if(decor()>(grass?Math.min(1,.025+.90*THREE.MathUtils.smoothstep(patch,.30,.78)**2+.30*shore+.15*edge):.025+.75*THREE.MathUtils.smoothstep(patch,.30,.82)**2+.14*shore))continue;
  const scale=grass?(.75+.48*decor()+.12*shore):.72+.48*decor(),a=decor()*Math.PI*2;points.push([x,z,scale,a]);
  if(rock)add({x,z,r:.26*scale,top:y+specs[n][1]*scale});
 }
 if(rock)batch(models[n],points,true);else pendingVegetation.push([models[n],points]);
}
const cabin=place(models.Cabin.clone(true),96,-63,.7);aabb(cabin);
for(const [i,x,z,a] of [[1,-49,66,.2],[2,44,31,1.1],[3,40,-15,-.5],[4,88,-43,.8]])place(models['Sign'+i].clone(true),x,z,a);
const glows=[];const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const ctx=glowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,1,32,32,31);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.24,'rgba(255,255,255,.55)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const halo=new THREE.CanvasTexture(glowCanvas);
function glow(x,z,y,color,anomaly=false){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:halo,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));m.position.set(x,y,z);m.scale.setScalar(anomaly?1.4:2.2);scene.add(m);let light=null;if(anomaly){light=new THREE.PointLight(color,18,8,2);light.position.copy(m.position);light.castShadow=false;scene.add(light);}glows.push({m,light,phase:rnd()*6.28});}
for(const [x,z,a] of [[-43,70,0],[-18,58,1],[43,32,0],[43,-13,.5],[96,-61,1]]){place(models.Lantern.clone(true),x,z,a);glow(x,z,height(x,z)+.43,0xffac55);}
for(const [x,z,color] of [[-13,11,0x68dfae],[22,-3,0x8fa9ff],[-71,-46,0xff784d],[80,-73,0xd78bff],[-6,-75,0x8ff6f2],[15,88,0xe9ce63]]){glow(x,z,Math.max(WATER+.7,height(x,z)+.85),color,true);}
interactions.push({x:96,z:-61,radius:4,prompt:'E — осмотреть домик',message:'В домике горит фонарь. Здесь давно никто не живёт.'},{x:-18,z:58,radius:3,prompt:'E — осмотреть дорогу',message:'Вода поднялась выше дороги. Дальше только болото.'});
function updateEnvironment(dt,now){for(const o of glows){const t=now*.001+o.phase,pulse=.85+.15*Math.sin(t*1.7);o.m.material.opacity=pulse;if(o.light)o.light.intensity=18*pulse;}}
const chunkedTrees=splitStaticInstances(THREE,scene,treeBatches,64),physics=createWorldData({id:'swamp',revision:'074-static',level,field,colliders});
for(const [model,points] of pendingVegetation)vegetation.add(model,points);
if(!free(...level.spawn,.48)||!canEnter(...level.spawn))throw Error('Swamp spawn blocked');
export const world={THREE,scene,camera,renderer,level,height,free,canEnter,colliders,terrain,treeBatches:chunkedTrees,sun,extraTextures:Object.values(textures),interactions,vegetation,physics,localShadowRadius:36,updateEnvironment};
