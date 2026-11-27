import {createVegetationSystem} from './vegetation_system.js?v=076';
import * as THREE from 'three';
import {collectWoodTriangles,combatTreeCollider,hitsCollider} from './tree_collision.js?v=061';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {levels,pathWeight} from './panel_levels.js?v=038';
import {createHeightfield,buildTerrainGeometry} from './terrain.js';

const id=new URLSearchParams(location.search).get('map')||new URLSearchParams(location.search).get('level');
const level=Object.hasOwn(levels,id)?levels[id]:levels.yard;
const $=s=>document.querySelector(s), menu=$('#menu'), start=$('#start'), status=$('#status'), hint=$('#hint'), dot=$('#dot');
$('#title').textContent=level.title;$('#subtitle').textContent=level.subtitle;document.title=level.title+' — Последнее лето';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1)*.8);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,280);camera.rotation.order='YXZ';scene.fog=new THREE.FogExp2(level.fog,level.density);
const hemi=new THREE.HemisphereLight(level.hemi,level.ground,level.ambient);scene.add(hemi);
const sun=new THREE.DirectionalLight(level.sun,level.sunPower);sun.position.set(...level.sunPos);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:260});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.04;scene.add(sun);
const root=new URL('./assets/',import.meta.url), asset=p=>new URL(p,root).href;
const manager=new THREE.LoadingManager();const texturePaths=new Map();for(const name of ['dirt.JPG','grass.jpg','ivy.JPG','leaf.JPG','rock.jpg','sky.JPG','stone.JPG','stonebuild.JPG','stonewall.JPG','treeleaf.jpg','water.jpg','wood.JPG','woodplank.JPG'])texturePaths.set(name.toLowerCase(),'curated/nature/'+name);for(let i=1;i<=6;i++)texturePaths.set(i+'h.png','curated/houses/'+i+'h.png');for(let i=2;i<=7;i++)texturePaths.set(i+'r.png','curated/street/'+i+'R.png');
manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const name=url.split(/[\\/]/).pop().toLowerCase();return texturePaths.has(name)?asset(texturePaths.get(name)):url;});
const textures=new THREE.TextureLoader(manager), fbx=new FBXLoader(manager), failures=[];
function tune(t){if(!t)return t;t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.anisotropy=2;return t;}
async function load(p,loader){try{return await loader.loadAsync(asset(p));}catch(e){console.warn('Asset unavailable',p,e);failures.push(p);return null;}}
const groundPath=s=>'curated/ground/PSX_Seamless_'+s+'_128px.png';
const uniqueHouseModels=[...new Set(level.houses.map(h=>h.model))];
const houseLoads=await Promise.all(uniqueHouseModels.map(name=>load('curated/houses/'+name,fbx)));
const houseMap=Object.fromEntries(uniqueHouseModels.map((name,i)=>[name,houseLoads[i]]));
const streetNames=['busstop','electricbox01','electricbox02','garage01','garage02','garage03','wall','went'];
const streetMap=Object.fromEntries(await Promise.all(streetNames.map(async n=>[n,await load('curated/street/'+n+'.fbx',fbx)])));
const [sky,grass,earth,forest,nature,stoneTex,woodTex,plankTex,roadTex]=await Promise.all([
  load('derived/'+level.sky+'.jpg',textures),
  load(groundPath(level.grass),textures),
  load(groundPath(level.path),textures),
  load('curated/forest/forest_collection.fbx',fbx),
  load('curated/nature/nature_collection.fbx',fbx),
  load('curated/nature/stone.JPG',textures),
  load('curated/nature/wood.JPG',textures),
  load('curated/nature/woodplank.JPG',textures),load(groundPath('ForestGravel_Ground'),textures)
]);
if(!sky||!grass||!earth||!forest||!nature||!roadTex||houseLoads.some(x=>!x)||Object.values(streetMap).some(x=>!x)){status.textContent='Не загрузились основные ассеты. Проверь папку assets и консоль.';throw new Error('Required panel assets missing');}
sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;
for(const t of [grass,earth,stoneTex,woodTex,plankTex,roadTex])if(t)tune(t);
for(const t of [grass,earth,roadTex]){t.wrapS=t.wrapT=THREE.RepeatWrapping;}

const field=createHeightfield({size:level.size,segments:220,height:level.height.bind(level)}), height=field.sample;
const terrainMat=new THREE.MeshStandardMaterial({map:grass,roughness:1,color:0xe0ddce});
const roadBlend=(x,z)=>1-THREE.MathUtils.smoothstep(level.road(x,z),level.roadWidth-.2,level.roadWidth+.65);
const geo=buildTerrainGeometry(THREE,field,(x,z)=>pathWeight(level,x,z));
const positions=geo.getAttribute('position'),roads=new Float32Array(positions.count);for(let i=0;i<roads.length;i++)roads[i]=roadBlend(positions.getX(i),positions.getZ(i));geo.setAttribute('roadWeight',new THREE.BufferAttribute(roads,1));
terrainMat.onBeforeCompile=s=>{s.uniforms.trailMap={value:earth};s.uniforms.roadMap={value:roadTex};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float trailWeight; attribute float roadWeight; varying float vTrail; varying float vRoad;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTrail=trailWeight; vRoad=roadWeight;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D trailMap; uniform sampler2D roadMap; varying float vTrail; varying float vRoad;').replace('#include <map_fragment>','diffuseColor *= mix(mix(texture2D(map,vMapUv),texture2D(trailMap,vMapUv),smoothstep(0.0,1.0,vTrail)),texture2D(roadMap,vMapUv)*vec4(.48,.51,.53,1.),smoothstep(0.0,1.0,vRoad));');};
const terrain=new THREE.Mesh(geo,terrainMat);terrain.receiveShadow=true;scene.add(terrain);
let seed=level.seed;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const colliders=[],interactions=[];
function prepare(obj){obj.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;tune(m.map);if(m.map)m.color?.set(0xffffff);m.opacity=1;m.transparent=false;const cutout=/crown|corwn|grass|dandelion|leaf|bush|lavender|reed|plant/i.test(m.name+' '+n.name);if(cutout){m.alphaTest=.42;m.side=THREE.DoubleSide;m.alphaMap=null;}else m.alphaTest=0;if(m.specular)m.specular.setScalar(.025);m.needsUpdate=true;}});return obj;}
function normalized(o,h,correction=0){const wrapper=new THREE.Group(),inner=new THREE.Group(),pivot=new THREE.Group();pivot.add(o);pivot.rotation.y=correction;inner.add(pivot);wrapper.add(inner);wrapper.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(pivot,true),s=h/Math.max(.001,b.max.y-b.min.y);inner.scale.setScalar(s);inner.position.set(-(b.min.x+b.max.x)*s/2,-b.min.y*s,-(b.min.z+b.max.z)*s/2);wrapper.updateMatrixWorld(true);return wrapper;}
function template(collection,name,h){if(!collection)return null;collection.updateMatrixWorld(true);let found;collection.traverse(n=>{if(n.isMesh&&n.name.trim().toLowerCase()===name.toLowerCase())found=n;});if(!found){console.warn('Missing model',name);return null;}const c=found.clone();found.matrixWorld.decompose(c.position,c.quaternion,c.scale);return normalized(prepare(c),h);}
function groundPlace(o,x,z,rot=0,s=1,offset=0){o.position.set(x,height(x,z)+offset,z);o.rotation.y=rot;o.scale.setScalar(s);scene.add(o);o.updateMatrixWorld(true);return o;}
function aabb(o,pad=.05){const b=new THREE.Box3().setFromObject(o,true);colliders.push({x0:b.min.x-pad,x1:b.max.x+pad,z0:b.min.z-pad,z1:b.max.z+pad,top:b.max.y});}
function trunk(x,z,r){colliders.push({x,z,r});}
function free(x,z,r=.28){return !colliders.some(c=>hitsCollider(c,x,z,r));}
function at(x,z,y=0){return new THREE.Vector3(x,height(x,z)+y,z);}
function box(w,h,d,m,x,y,z,parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function beam(a,b,r,m,parent=scene){const v=new THREE.Vector3().subVectors(b,a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),7),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const treeBatches=[],vegetation=createVegetationSystem(THREE,scene,(x,z)=>height(x,z));
function batch(t,points,shadow=false,isTree=false){if(!t||!points.length)return;t.updateMatrixWorld(true);const dummy=new THREE.Object3D();t.traverse(n=>{if(!n.isMesh)return;const g=n.geometry.clone().applyMatrix4(n.matrixWorld),m=new THREE.InstancedMesh(g,n.material,points.length);points.forEach(([x,z,s,a],i)=>{dummy.position.set(x,height(x,z)-.025,z);dummy.rotation.set(0,a,0);dummy.scale.setScalar(s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.instanceMatrix.needsUpdate=true;m.castShadow=shadow;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);if(isTree)treeBatches.push({mesh:m,points});});}
function labelTexture(text,sub=''){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#c6c5ab';c.fillRect(0,0,256,128);c.strokeStyle='#5d6258';c.lineWidth=5;c.strokeRect(6,6,244,116);c.fillStyle='#35463e';c.textAlign='center';c.font='bold 28px monospace';c.fillText(text,128,54);c.font='18px monospace';c.fillText(sub,128,90);const t=new THREE.CanvasTexture(canvas);return tune(t);}

const stone=new THREE.MeshStandardMaterial({color:0xa2a097,map:stoneTex||null,roughness:1});
const timber=new THREE.MeshStandardMaterial({color:0x7c6b54,map:woodTex||null,roughness:1});
const planks=new THREE.MeshStandardMaterial({color:0x938677,map:plankTex||null,roughness:1});
const iron=new THREE.MeshStandardMaterial({color:0x565c59,roughness:1});
const concrete=new THREE.MeshStandardMaterial({color:0xb0ada6,map:stoneTex||null,roughness:1});
const dark=new THREE.MeshStandardMaterial({color:0x343a35,roughness:1});
const rusty=new THREE.MeshStandardMaterial({color:0x6d4f44,roughness:.95});
const fadedBlue=new THREE.MeshStandardMaterial({color:0x6a7b83,roughness:1});
const fadedRed=new THREE.MeshStandardMaterial({color:0x875853,roughness:1});

function board(x,z,a,text,sub,msg){const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({map:labelTexture(text,sub),roughness:1});box(.12,1.85,.12,timber,0,.925,0,g);box(1.8,.88,.08,m,0,1.68,0,g);groundPlace(g,x,z,a);trunk(x,z,.12);interactions.push({x,z,prompt:'E — прочитать',message:msg});}
function bench(x,z,a){const g=new THREE.Group();for(const xx of [-.85,.85]){box(.12,.5,.5,iron,xx,.25,0,g);box(.08,.85,.08,iron,xx,.48,-.22,g);}for(let i=0;i<3;i++)box(2.1,.06,.15,planks,0,.52,-.18+i*.17,g);for(let i=0;i<2;i++)box(2.1,.15,.06,planks,0,.75+i*.17,-.23,g);groundPlace(g,x,z,a);aabb(g);interactions.push({x,z,message:'Сырая древесина пахнет дождём и пылью.',prompt:'E — осмотреть лавочку'});}
function lamp(x,z,h=5.2){const g=new THREE.Group();box(.16,h,.16,iron,0,h/2,0,g);box(.72,.12,.22,iron,.2,h-.35,0,g);box(.42,.3,.32,concrete,.35,h-.55,0,g);groundPlace(g,x,z);trunk(x,z,.14);}
function fence(points,{broken=false}={}){for(let i=0;i<points.length;i++){const [x,z]=points[i];if(!broken||i%6!==4){box(.12,1.22,.12,timber,x,height(x,z)+.61,z);trunk(x,z,.10);}if(i&&(!broken||i%6!==4&&i%6!==5)){const [px,pz]=points[i-1];for(const y of [.42,.88])beam(at(px,pz,y),at(x,z,y-.03),.042,timber);}}}
function postLine(points){for(let i=0;i<points.length;i++){const [x,z]=points[i],g=new THREE.Group();box(.23,6.6,.23,timber,0,3.3,0,g);box(1.8,.14,.17,timber,0,6.2,0,g);groundPlace(g,x,z);trunk(x,z,.2);if(i){const [px,pz]=points[i-1];for(const k of [-.6,0,.6]){let prev=at(px+k,pz,6.22);for(let j=1;j<=8;j++){const t=j/8,next=new THREE.Vector3(THREE.MathUtils.lerp(px,x,t)+k,THREE.MathUtils.lerp(height(px,pz),height(x,z),t)+6.22-Math.sin(t*Math.PI)*.45,THREE.MathUtils.lerp(pz,z,t));beam(prev,next,.012,dark);prev=next;}}}}}
// All street models retain their FBX transforms and UVs. Only a uniform size and yaw are applied.
const streetTemplates={};
function street(name,h,correction=0){const key=name+':'+h+':'+correction;if(!streetTemplates[key])streetTemplates[key]=normalized(prepare(streetMap[name].clone(true)),h,correction);return streetTemplates[key].clone(true);}
function prop(name,x,z,h,a=0,correction=0,solid=true){const o=groundPlace(street(name,h,correction),x,z,a);if(solid)aabb(o,.04);return o;}
function garageRow(x,z,count,a=0){for(let i=0;i<count;i++){const xx=x+Math.cos(a)*i*3.45,zz=z-Math.sin(a)*i*3.45;prop('garage0'+(1+i%3),xx,zz,2.65,a,-Math.PI/2);}interactions.push({x:x+Math.cos(a)*3.45,z:z+3.1,prompt:'E — гаражи',message:'На ржавых воротах больше нет номеров.'});}
function wallRow(x,z,count,a=0,gap=-1){for(let i=0;i<count;i++){if(i===gap)continue;prop('wall',x+Math.cos(a)*i*3.63,z-Math.sin(a)*i*3.63,2.2,a,Math.PI/2);}}
function cabinet(name,x,z,a=0){prop(name,x,z,name==='electricbox01'?1.25:1.65,a,-Math.PI/2);interactions.push({x,z,prompt:'E — электрощит',message:'Старые наклейки и следы краски. Электричества давно нет.'});}
function aircon(x,y,z,a=0){const o=street('went',.63,-Math.PI/2);o.position.set(x,y,z);o.rotation.y=a;scene.add(o);}
function clothesline(x,z,a=0){const g=new THREE.Group();for(const xx of [-2.3,2.3])box(.11,2.15,.11,iron,xx,1.07,0,g);beam(new THREE.Vector3(-2.25,1.95,0),new THREE.Vector3(2.25,1.86,0),.022,dark,g);for(const [dx,w,h,m] of [[-1.25,.8,.55,fadedBlue],[-.18,.65,.48,concrete],[.82,.92,.6,fadedRed]])box(w,h,.025,m,dx,1.90-h/2,0,g);groundPlace(g,x,z,a);interactions.push({x,z,prompt:'E — посмотреть',message:'Бельё никто не снимал уже очень давно.'});trunk(x,z,.2);}
function playground(x,z){
 const gy=height(x,z);
 box(5.8,.12,4.4,concrete,x,gy+.06,z);
 box(3.2,.18,2.1,fadedBlue,x-1.1,gy+.15,z+.4); // sandbox rim
 for(const dx of [-1.1,1.1])for(const dz of [-1.35,1.35])box(.1,2.3,.1,iron,x+3.2+dx,gy+1.15,z+dz);
 beam(new THREE.Vector3(x+2.1,gy+2.15,z-1.35),new THREE.Vector3(x+4.3,gy+2.15,z-1.35),.05,iron);
 beam(new THREE.Vector3(x+2.1,gy+2.15,z+1.35),new THREE.Vector3(x+4.3,gy+2.15,z+1.35),.05,iron);
 for(const dz of [-.8,.8]){beam(new THREE.Vector3(x+3.2,gy+2.05,z+dz),new THREE.Vector3(x+3.2,gy+1.1,z+dz),.025,dark);box(.56,.05,.22,planks,x+3.2,gy+1.0,z+dz);} 
 for(const dx of [-1.4,1.4]){box(.08,1.1,.08,rusty,x-3.1+dx,gy+.55,z-1.5);box(.08,1.1,.08,rusty,x-3.1+dx,gy+.55,z+1.5);} beam(new THREE.Vector3(x-4.5,gy+1.1,z-1.5),new THREE.Vector3(x-1.7,gy+1.1,z+1.5),.05,rusty);beam(new THREE.Vector3(x-4.5,gy+1.1,z+1.5),new THREE.Vector3(x-1.7,gy+1.1,z-1.5),.05,rusty);
 interactions.push({x,z,prompt:'E — осмотреть площадку',message:'Песочница заросла травой. Качели молчат.'});
 colliders.push({x0:x-5.1,x1:x+4.8,z0:z-2.2,z1:z+2.2});
}
function stopShelter(x,z,a=0){const o=prop('busstop',x,z,2.55,a,-Math.PI/2,false);const b=new THREE.Box3().setFromObject(o,true); // block rear and posts, not the entire covered area
 const back=a===0?b.min.z:b.max.z;colliders.push({x0:b.min.x,x1:b.max.x,z0:back-.12,z1:back+.12});for(const xx of [b.min.x+.12,b.max.x-.12])trunk(xx,a===0?b.max.z-.15:b.min.z+.15,.13);interactions.push({x,z,prompt:'E — остановка',message:'На стекле старые надписи. Последний автобус уже ушёл.'});}
function boilerHouse(x,z){const g=new THREE.Group();box(8.5,3.3,5.4,concrete,0,1.65,0,g);box(2.6,2.4,.12,fadedBlue,-1.7,1.2,2.72,g);box(1.4,.8,.12,dark,2.3,2.0,2.72,g);for(const xx of [2.2,3.2])box(.46,5.8,.46,rusty,xx,4.7,-1.7,g);groundPlace(g,x,z);aabb(g,.08);interactions.push({x,z:z+3.2,prompt:'E — осмотреть котельную',message:'Внутри пусто. Только запах сырости и мазута.'});}
function footballGoal(x,z,a=0){const g=new THREE.Group();for(const xx of [-1.6,1.6])box(.1,1.9,.1,iron,xx,.95,0,g);box(3.3,.1,.1,iron,0,1.9,0,g);groundPlace(g,x,z,a);for(const dx of [-1.6,1.6])trunk(x+Math.cos(a)*dx,z-Math.sin(a)*dx,.08);}
function placeHouse(site){const src=houseMap[site.model];const base=normalized(prepare(src.clone(true)),site.height,site.correction);groundPlace(base,site.x,site.z,site.rot);const b=new THREE.Box3().setFromObject(base,true),dims=b.getSize(new THREE.Vector3());aabb(base,.10);box(dims.x+.7,.12,dims.z+.7,concrete,site.x,height(site.x,site.z)-.035,site.z);return b;}
// Thin paved slabs follow the terrain and do not create a raised invisible obstacle.
const pavingTex=stoneTex?.clone();if(pavingTex){pavingTex.wrapS=pavingTex.wrapT=THREE.RepeatWrapping;pavingTex.needsUpdate=true;}const paving=new THREE.MeshStandardMaterial({color:0xaaa79b,map:pavingTex||null,roughness:1});
function slab(x,z,w,d,mat=paving){const g=new THREE.PlaneGeometry(w,d,Math.ceil(w*2),Math.ceil(d*2));g.rotateX(-Math.PI/2);const p=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=0;i<p.count;i++){p.setY(i,height(x+p.getX(i),z+p.getZ(i))+.025);if(mat===paving)uv.setXY(i,p.getX(i)*.65,p.getZ(i)*.65);}g.computeVertexNormals();const o=new THREE.Mesh(g,mat);o.position.set(x,0,z);o.receiveShadow=true;scene.add(o);}
function curb(x,z,len,a=0){for(let i=0;i<len;i+=1.0){const xx=x+Math.cos(a)*i,zz=z-Math.sin(a)*i;const o=box(.97,.09,.16,concrete,xx,height(xx,zz)+.035,zz);o.rotation.y=a;}}
function waste(x,z,a=0){const g=new THREE.Group();for(let i=0;i<3;i++){const xx=i*.93;box(.77,.89,.69, fadedBlue,xx,.47,0,g);box(.82,.08,.74,dark,xx,.96,0,g);}groundPlace(g,x,z,a);aabb(g);}
function court(x,z){slab(x,z,16,10,stone);for(const dx of [-7,7]){footballGoal(x+dx,z,Math.PI/2);}for(const dz of [-4.9,4.9]){curb(x-7.5,z+dz,15);}}
const buildingBounds=level.houses.map(placeHouse);
// Faded painted address plaques, kept separate from the authored facade materials.
function address(x,y,z,a,street,num){const m=new THREE.MeshStandardMaterial({map:labelTexture(street,num),roughness:1});const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.67),m);sign.position.set(x,y,z);sign.rotation.y=a;scene.add(sign);}
const paint=new THREE.MeshStandardMaterial({color:0xa5a49a,roughness:1});
function roadMark(x,z,w,d){const g=new THREE.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);const p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,height(x+p.getX(i),z+p.getZ(i))+.035);g.computeVertexNormals();const o=new THREE.Mesh(g,paint);o.position.set(x,0,z);scene.add(o);}

if(level.sceneType==='yard'){
  // Entrance view: the long slab on the left, a small square and two lower blocks ahead.
  board(-8,53,0,'КВАРТАЛ 7','ул. Летняя','Знакомый адрес. Только ты не помнишь, в каком доме жил.');
  slab(-23,0,2.2,66);curb(-21.9,31,62,Math.PI/2);
  for(const z of [-25,-8,10,27]){bench(-22.6,z+2,Math.PI/2);lamp(-20.6,z+3,4.7);}
  for(const z of [-23,12]){slab(20,z,12,2.2);bench(15,z,0);}
  for(const z of [45,19,-15,-42])lamp(-14.5,z,5.1);
  for(const z of [-22,7,26])lamp(30,z,5.1);
  playground(-1,2);bench(7,8,Math.PI);bench(-9,9,.6);clothesline(8,-11,0);clothesline(4,20,.12);
  garageRow(38,51,8);slab(50,46.4,27,3.0);wallRow(35,55,10);wallRow(66,50,4,Math.PI/2,2);board(35,45,0,'ГАРАЖИ','ряд Б','За гаражами всегда был какой-то другой двор.');
  cabinet('electricbox01',-23,-13,Math.PI/2);cabinet('electricbox02',31,-37,0);cabinet('electricbox01',39,42,0);
  waste(26,27);waste(-13,-35,Math.PI/2);court(49,20);wallRow(40,13,5,0,2);
  postLine([[36,-37],[36,-18],[36,4],[36,24],[36,43]]);
  address(buildingBounds[0].max.x+.015,2.6,-22,Math.PI/2,'ЛЕТНЯЯ','7');address(20,2.6,buildingBounds[1].max.z+.015,0,'ЛЕТНЯЯ','9');
  for(const [i,b] of buildingBounds.entries()){if(i===0)for(const z of [-23,4,22])aircon(b.max.x+.23,3.4,z,Math.PI/2);else if(i===1||i===2)aircon((b.min.x+b.max.x)/2+2,3.3,b.max.z+.23,0);}
  interactions.push({x:7,z:8,prompt:'E — оглянуться',message:'В этом дворе всегда было лето. Даже когда никого не осталось.'});
}else{
  board(20,56,.2,'КОЛЬЦО','маршрут 17','Когда-то это была последняя остановка перед домом.');
  slab(8,25,19,4.5);stopShelter(10,25,Math.PI);bench(3,25,Math.PI);board(15,25,Math.PI,'17','КОНЕЧНАЯ','На табличке осталось только два времени: 06:10 и 23:48.');
  for(let i=0;i<48;i++){const a=i*Math.PI/24;const x=4+16.2*Math.cos(a),z=8+9.1*Math.sin(a);const o=box(1.08,.10,.17,concrete,x,height(x,z)+.035,z);o.rotation.y=-Math.atan2(9.1*Math.cos(a),-16.2*Math.sin(a));}
  for(let x=-70;x<72;x+=7)if(Math.abs(x-4)>9)roadMark(x,-12,2.0,.12);
  for(let i=0;i<6;i++)roadMark(35.9+i*.42,-12,.23,3.4);
  address(-13,2.6,buildingBounds[0].min.z-.015,Math.PI,'ПОЛЕВАЯ','12');
  for(const [x,z] of [[-18,9],[5,25],[28,8],[4,-8],[36,26],[36,46],[-32,-8],[63,-8]])lamp(x,z,5.6);
  boilerHouse(-49,-31);wallRow(-62,-22,9,0,5);wallRow(-62,-26,5,Math.PI/2);wallRow(-33,-26,5,Math.PI/2,1);cabinet('electricbox02',-38,-24);cabinet('electricbox01',-33,-41,Math.PI/2);board(-38,-19,0,'КОТЕЛЬНАЯ','№ 4','Трубы давно остыли.');
  garageRow(43,26,8);wallRow(42,30,9);slab(54,21.5,24,3.0);cabinet('electricbox02',35,19,Math.PI/2);waste(30,46);bench(-12,31,0);
  for(const [x,z] of [[-25,30],[-7,30],[-49,30]])slab(x,z,2,4);
  for(const x of [-55,-35,-15])aircon(x,3.7,buildingBounds[0].min.z-.23,Math.PI);
  postLine([[-68,-17],[-47,-17],[-25,-17],[-4,-17],[18,-17],[40,-17],[64,-17]]);
  board(39,-26,0,'УЛ. ПОЛЕВАЯ','дом 14','За домами уже не город.');bench(42,-26,Math.PI);cabinet('electricbox01',43,-24);
  interactions.push({x:2,z:25,prompt:'E — прислушаться',message:'Ты помнишь, как здесь разворачивался автобус. Сейчас дорога пуста.'});
}

const trees=['PSX_Tree1','PSX_Tree2','PSX_Tree3','PSX_Tree4'].map(n=>template(forest,n,8));
const treePoints=trees.map(()=>[]),treeCenters=[],treeFeet=trees.map(t=>collectWoodTriangles(THREE,t)),treeReplacements=[];
function plantTree(x,z,i,s){if(!trees[i]||level.reserved(x,z)||level.distance(x,z)<2.5||!free(x,z,1.0)||Math.hypot(x-level.spawn[0],z-level.spawn[1])<4||treeCenters.some(p=>Math.hypot(x-p[0],z-p[1])<2.4))return false;const a=rnd()*Math.PI*2;treePoints[i].push([x,z,s,a]);treeCenters.push([x,z]);treeReplacements.push([colliders.length,combatTreeCollider(treeFeet[i],x,z,s,a,height(x,z)-.025)]);trunk(x,z,.34*s);return true;}
const framing=level.sceneType==='yard'?[[-7,45,1,.8],[6,39,0,.75],[-5,18,2,.82],[9,-6,3,.9],[-26,-49,1,.86],[27,43,0,.8],[-21,13,2,.9],[-20,-14,1,.8]]:[[-8,27,2,.8],[18,32,0,.76],[-20,-2,3,.82],[16,-42,1,.88],[-41,17,2,.78],[61,-48,0,.83]];
for(const [x,z,i,s] of framing)plantTree(x,z,i,s);
for(let n=0;n<level.trees*50&&treeCenters.length<level.trees;n++){
  const x=(rnd()-.5)*(level.size-5),z=(rnd()-.5)*(level.size-5);
  if(rnd()>Math.pow(level.treeZone(x,z),1.65))continue;
  const i=Math.floor(rnd()*trees.length);plantTree(x,z,i,.7+rnd()*.7);
}
trees.forEach((t,i)=>batch(t,treePoints[i],true,true));
for(const [idx,shape] of treeReplacements)colliders[idx]=shape;

const plantTemplates={
  grass:template(forest,'PSX_Grass',.42),
  dandelion:template(forest,'PSX_Dandelion',.36),
  lavender:template(forest,'PSX_Lavender',.72),
  naturegrass:template(nature,'Grass',.35),
  plant:template(nature,'Plant',.46),
  bush:template(nature,'Bush',1.05),
  rock:template(forest,'PSX_Rock',.58),
  stump:template(forest,'PSX_Treetrunk',.70)
};
const plantConfigs=level.sceneType==='yard' ? [
  ['grass',level.grassCount,.55,1.45],['dandelion',950,.6,1.3],['lavender',320,.55,1.2],['naturegrass',1400,.5,1.2],['plant',650,.5,1.2],['bush',120,.65,1.4],['rock',65,.45,1.6],['stump',20,.7,1.35]
] : [
  ['grass',level.grassCount,.55,1.45],['dandelion',540,.6,1.25],['lavender',160,.55,1.15],['naturegrass',1600,.55,1.25],['plant',720,.5,1.25],['bush',100,.65,1.45],['rock',80,.45,1.7],['stump',18,.7,1.35]
];
const clusters={};for(const [key] of plantConfigs){clusters[key]=Array.from({length:key==='grass'?90:34},()=>[(rnd()-.5)*(level.size-10),(rnd()-.5)*(level.size-10),3+rnd()*8]);}
const focus=level.sceneType==='yard'?{grass:[[-9,49,6],[-3,26,5],[11,-3,6],[-25,-27,5],[40,-29,5]],dandelion:[[-5,46,4],[-9,14,4],[13,-12,4]],lavender:[[0,31,4],[-17,-19,4],[24,24,5]],plant:[[-14,38,4],[8,6,5]],bush:[[-48,26,5],[45,46,5]]}:{grass:[[-6,53,6],[0,27,6],[9,-4,6],[15,-39,5],[-20,18,5]],dandelion:[[-4,41,4],[8,8,4]],lavender:[[-14,36,4],[21,28,4]],plant:[[12,18,5],[34,-9,5]],bush:[[-55,48,6],[58,-48,6]]};
for(const [key,points] of Object.entries(focus))clusters[key].push(...points);
function patch(x,z){return .5+.25*Math.sin(x*.33+z*.17)+.18*Math.cos(z*.4-x*.21)+.09*Math.sin(x*.83+z*.52);}
function plantChance(key,x,z){const d=level.distance(x,z),edge=Math.exp(-((d-2.2)**2)/10),road=Math.exp(-((level.road(x,z)-4.5)**2)/12),woods=level.treeZone(x,z),p=patch(x,z);
 if(key==='dandelion')return (.1+.65*edge+.18*p)*(1-woods*.68);
 if(key==='lavender')return .02+.42*(1-woods)+.22*Math.max(0,p-.35);
 if(key==='naturegrass')return .18+.35*woods+.32*(1-p)+.1*road;
 if(key==='plant')return .14+.45*woods+.12*road;
 if(key==='bush'||key==='stump')return .08+.65*woods;
 if(key==='rock')return .18+.35*(1-p)+.16*road;
 return .16+.55*p+.2*edge+.05*road;
}
for(const [key,count,min,max] of plantConfigs){const t=plantTemplates[key],points=[];if(!t)continue;for(let n=0;n<count*16&&points.length<count;n++){
  let x,z;if(rnd()<.76){const [cx,cz,r]=clusters[key][Math.floor(rnd()*clusters[key].length)],a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*r;x=cx+Math.cos(a)*d;z=cz+Math.sin(a)*d;}else{x=(rnd()-.5)*(level.size-5);z=(rnd()-.5)*(level.size-5);} 
  if(Math.abs(x)>level.size/2-1||Math.abs(z)>level.size/2-1||level.distance(x,z)<.8||level.road(x,z)<level.roadWidth+.2||!free(x,z,key==='bush'?.6:.08)||level.reserved(x,z))continue;
  if(level.sceneType==='yard'&&Math.abs(x+23)<1.1&&Math.abs(z)<33)continue;
  if(level.sceneType==='outskirts'&&Math.abs(x-8)<9.5&&Math.abs(z-25)<2.25)continue;
  if(rnd()>plantChance(key,x,z))continue;
  const s=min+(max-min)*rnd()**1.7;points.push([x,z,s,rnd()*Math.PI*2]);if(key==='bush'||key==='stump')trunk(x,z,.28*s);
}
 if(['grass','dandelion','lavender','reed','naturegrass','plant'].includes(key))vegetation.add(t,points);else batch(t,points,['bush','rock','stump'].includes(key));}

function batchStaticProps(){
 scene.updateMatrixWorld(true);const groups=new Map();
 scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;const g=o.geometry,p=g.parameters;let key,scale;
  if(g.type==='BoxGeometry'){key='box';scale=new THREE.Vector3(p.width,p.height,p.depth);} else if(g.type==='CylinderGeometry'&&p.radiusTop===p.radiusBottom&&p.heightSegments===1&&p.thetaLength===Math.PI*2){key='cylinder-'+p.radialSegments;scale=new THREE.Vector3(p.radiusTop,p.height,p.radiusTop);} else return;
  key+=':'+o.material.uuid+':'+o.castShadow+':'+o.receiveShadow; if(!groups.has(key))groups.set(key,[]); groups.get(key).push({o,scale});});
 for(const list of groups.values()){if(list.length<3)continue;const first=list[0].o,g=first.geometry.type==='BoxGeometry'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,first.geometry.parameters.radialSegments); const m=new THREE.InstancedMesh(g,first.material,list.length),matrix=new THREE.Matrix4(); list.forEach(({o,scale},i)=>{matrix.copy(o.matrixWorld).scale(scale);m.setMatrixAt(i,matrix);o.removeFromParent();o.geometry.dispose();});m.castShadow=first.castShadow;m.receiveShadow=first.receiveShadow;m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();scene.add(m);} }
batchStaticProps();

scene.updateMatrixWorld(true);
export const world={THREE,scene,camera,renderer,vegetation,level,height,free,colliders,terrain,treeBatches,sun,extraTextures:[earth,roadTex],interactions};
