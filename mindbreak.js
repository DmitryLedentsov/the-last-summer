import {createTouchControls,mergeMotion,applyTouchQuality} from './touch_controls.js?v=047';
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHeightfield,buildTerrainGeometry} from './terrain.js';
import {trunkFootprint,treeCollider,hitsCollider} from './tree_collision.js';
// Port of the repository's Mindbreak scene, master 283799f2e8bc2ff28484f7f4203afa9d43847bfe.
const $=s=>document.querySelector(s), menu=$('#menu'), start=$('#start'), hint=$('#hint'), dot=$('#dot'), status=$('#status');
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,360);
camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1)*.85);renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
scene.fog=new THREE.FogExp2(0x805b9c,.0105);
const hemi=new THREE.HemisphereLight(0xe2b9ff,0x52774d,1.65);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffcaac,2.0);sun.position.set(-45,62,30);sun.castShadow=true;
Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:230});sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.045;sun.shadow.bias=-.0002;scene.add(sun);
const rim=new THREE.DirectionalLight(0x67a9e9,.7);rim.position.set(40,12,-70);scene.add(rim);
let seed=78521;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>a+(b-a)*rnd(), pick=a=>a[Math.floor(rnd()*a.length)], TAU=Math.PI*2;
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{},vertexShader:'varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float noise(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);} void main(){vec3 d=normalize(vDir); float h=max(0.,d.y); vec3 c=mix(vec3(.50,.23,.53),vec3(.095,.028,.22),pow(h,.65)); float n=noise(d.xz*5.+d.y*2.)*.65+noise(d.xz*12.+d.y*4.)*.35; c+=vec3(.34,.10,.33)*smoothstep(.37,.8,n)*(1.-h*.45); float glow=pow(max(0.,dot(d,normalize(vec3(-.45,.13,-.9)))),6.); c+=vec3(.46,.18,.32)*glow; vec2 uv=vec2(atan(d.z,d.x),asin(d.y)); float s=hash(floor(uv*580.)); c+=vec3(.36,.25,.45)*step(.997,s)*smoothstep(.04,.4,h); gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(260,36,20),skyMat);sky.frustumCulled=false;scene.add(sky);
const root=new URL('./assets/',import.meta.url), url=p=>new URL(p,root).href;
const manager=new THREE.LoadingManager(), known=new Map();
for(const n of ['dirt.JPG','grass.jpg','ivy.JPG','leaf.JPG','rock.jpg','sky.JPG','stone.JPG','stonebuild.JPG','stonewall.JPG','treeleaf.jpg','water.jpg','wood.JPG','woodplank.JPG'])known.set(n.toLowerCase(),url('curated/nature/'+n));
for(const n of [8937,8970,9023,9024,9030,9034,9035,9036,9037])known.set('sam_'+n+'.jpg',url('curated/palast/SAM_'+n+'.JPG'));
for(let i=1;i<=6;i++)known.set(i+'h.png',url('curated/houses/'+i+'h.png'));
manager.setURLModifier(p=>p.startsWith('blob:')||p.startsWith('data:')?p:known.get(p.split(/[\\/]/).pop().toLowerCase())||p);
const tx=new THREE.TextureLoader(manager), fbx=new FBXLoader(manager), objLoader=new OBJLoader(manager), gltf=new GLTFLoader(manager);
function tune(t){if(t){t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapLinearFilter;t.anisotropy=2;}return t;}
async function load(p,loader){try{return await loader.loadAsync(url(p));}catch(e){console.warn('Asset unavailable',p,e);return null;}}
const [grassTex,stoneTex,woodTex,forest,nature,palast,house,runeTex]=await Promise.all([
 load('curated/ground/PSX_Seamless_WildForestGrass_128px.png',tx),load('curated/nature/stone.JPG',tx),load('curated/nature/wood.JPG',tx),load('curated/forest/forest_collection.fbx',fbx),load('curated/nature/nature_collection.fbx',fbx),load('curated/palast/palast_collection.fbx',fbx),load('curated/houses/house05.fbx',fbx),load('curated/skull/MagicRunes_Emission.png',tx)]);
for(const t of [grassTex,stoneTex,woodTex,runeTex])tune(t);
if(grassTex)grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping;
let extra={};try{const res=await fetch(url('mindbreak/models.json'));if(res.ok)extra=await res.json();}catch(e){console.warn('Optional model catalog unavailable',e);}
function prep(o,cutout=false){o.traverse(n=>{if(!n.isMesh)return;n.castShadow=true;n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;tune(m.map);if(m.map)m.color?.set(0xffffff);if(cutout||/crown|corwn|grass|leaf|bush|lavender|reed|plant/i.test(n.name+' '+m.name)){m.side=THREE.DoubleSide;m.alphaTest=Math.max(m.alphaTest||0,.35);m.transparent=false;}if(m.specular)m.specular.setScalar(.035);m.needsUpdate=true;}});return o;}
function normalize(o,h){const wrap=new THREE.Group(),inner=new THREE.Group();inner.add(o);wrap.add(inner);wrap.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o);if(b.isEmpty()||b.max.y-b.min.y<.001)return null;const s=h/(b.max.y-b.min.y);inner.scale.setScalar(s);inner.position.set(-(b.min.x+b.max.x)*s/2,-b.min.y*s,-(b.min.z+b.max.z)*s/2);wrap.updateMatrixWorld(true);return wrap;}
function named(o,name,h){if(!o)return null;o.updateMatrixWorld(true);let found;o.traverse(n=>{if(n.isMesh&&n.name.trim().toLowerCase()===name.toLowerCase())found=n;});if(!found)return null;const c=found.clone();found.matrixWorld.decompose(c.position,c.quaternion,c.scale);return normalize(prep(c),h);}
async function extraModels(category,h){const records=Array.isArray(extra[category])?extra[category].slice(0,12):[];return (await Promise.all(records.map(async e=>{if(!e||typeof e.path!=='string'||!e.path.startsWith('mindbreak/')||e.path.includes('..'))return null;const ext=e.path.split('.').pop().toLowerCase(),loader=ext==='fbx'?fbx:ext==='obj'?objLoader:ext==='glb'||ext==='gltf'?gltf:null;if(!loader)return null;let o=await load(e.path,loader);if(!o)return null;o=o.scene||o;if(e.texture&&typeof e.texture==='string'&&e.texture.startsWith('mindbreak/')&&!e.texture.includes('..')){const t=tune(await load(e.texture,tx));if(t)o.traverse(n=>{if(n.isMesh){n.material=new THREE.MeshStandardMaterial({map:t,roughness:1,side:category==='plants'?THREE.DoubleSide:THREE.FrontSide,alphaTest:category==='plants'?.4:0});}});}return normalize(prep(o,category==='plants'),Number.isFinite(e.height)&&e.height>0?e.height:h);}))).filter(Boolean);}
const [extraFungi,extraTrees,extraPlants,extraProps]=await Promise.all([extraModels('mushrooms',6),extraModels('trees',12),extraModels('plants',.85),extraModels('props',3)]);
const hill=(x,z,cx,cz,w,h)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(w*w));
const trail=z=>7*Math.sin(z*.055)+2.8*Math.sin(z*.105);
const loopDist=(x,z)=>Math.abs(Math.hypot(x/1.05,(z+13)/.78)-17);
const trailWeight=(x,z)=>Math.max(0,1-Math.min(Math.abs(x-trail(z)),loopDist(x,z))/2.25);
const groundHeight=(x,z)=>.48*Math.sin(x*.14+z*.08)+.65*Math.cos(z*.11-x*.10)+.22*Math.sin(x*.41+z*.27)+hill(x,z,-44,20,27,8)+hill(x,z,42,-38,28,11)+hill(x,z,-49,-56,26,13)-hill(x,z,42,35,25,5)-hill(x,z,0,-13,18,3);
const field=createHeightfield({size:190,segments:240,height:groundHeight}), height=field.sample;
const geo=buildTerrainGeometry(THREE,field,trailWeight), p=geo.getAttribute('position'), colors=new Float32Array(p.count*3), col=new THREE.Color(), a=new THREE.Color(0x738d44),b=new THREE.Color(0x436d5b),c=new THREE.Color(0x8b6a50),d=new THREE.Color(0x645b73);
for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n=.5+.5*Math.sin(x*.07+z*.10)*Math.cos(z*.11-x*.09);col.copy(a).lerp(b,n);col.lerp(d,Math.max(0,Math.sin(z*.07+x*.04))*.32);col.lerp(c,trailWeight(x,z)*.83);colors.set([col.r,col.g,col.b],i*3);}
geo.setAttribute('color',new THREE.BufferAttribute(colors,3));const floor=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:grassTex||null,vertexColors:true,roughness:1,color:0xffffff}));floor.receiveShadow=true;scene.add(floor);
const colliders=[],points=[],animated=[],lights=[];
const reserve=(x,z,r)=>colliders.push({x,z,r});
const free=(x,z,r=.35)=>!colliders.some(c=>hitsCollider(c,x,z,r));
function place(o,x,z,s=1,a=0,y=0){if(!o)return null;o.position.set(x,height(x,z)+y,z);o.scale.setScalar(s);o.rotation.y=a;scene.add(o);o.updateMatrixWorld(true);return o;}
function mesh(g,m,parent,x=0,y=0,z=0,shadow=true){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;}
function batch(template,list,shadow=false){if(!template||!list.length)return;template.updateMatrixWorld(true);const dummy=new THREE.Object3D();template.traverse(n=>{if(!n.isMesh||n.isSkinnedMesh)return;const geom=n.geometry.clone().applyMatrix4(n.matrixWorld),o=new THREE.InstancedMesh(geom,n.material,list.length);list.forEach(([x,z,s,r],i)=>{dummy.position.set(x,height(x,z)-.015,z);dummy.scale.setScalar(s);dummy.rotation.set(0,r,0);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);});o.instanceMatrix.needsUpdate=true;o.castShadow=shadow;o.receiveShadow=true;o.computeBoundingSphere();scene.add(o);});}
function material(color,map=null,extra={}){return new THREE.MeshStandardMaterial({color,map,roughness:1,...extra});}
// Original 128px texture generator and palettes from GitHub Mindbreak.
function pixelTex(palette){const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d'),data=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const f=.5+.25*Math.sin(x*.13+Math.cos(y*.15)*3.1)+.2*Math.cos(y*.2+Math.sin(x*.21)*4)+.14*Math.sin((x+y)*.63);const j=Math.min(palette.length-1,Math.max(0,Math.floor(f*palette.length)));const rgb=palette[j],k=(y*128+x)*4;const t=range(.62,1.18);for(let l=0;l<3;l++)data.data[k+l]=rgb[l]*t;data.data[k+3]=255;}
 ctx.putImageData(data,0,0);const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;return tune(t);}
const fungalTex=pixelTex([[27,29,61],[40,61,85],[36,101,78],[87,106,55],[151,104,68],[115,63,128]]);
const barkTex=pixelTex([[31,31,48],[47,67,65],[67,76,78],[103,73,88],[83,117,104]]);
const fungal=material(0xe0dce8,fungalTex,{emissive:0x152636,emissiveIntensity:.2}),gills=material(0x7385a6,woodTex,{emissive:0x313750,emissiveIntensity:.3}),bark=material(0xc7cbc0,barkTex),stone=material(0xb9a8af,stoneTex),gold=material(0x95754e,stoneTex,{emissive:0x73512f,emissiveIntensity:.35});
function tube(parent,coords,r,m){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coords.map(v=>new THREE.Vector3(...v))),10,r,5,false),m,parent);}
function mushroom(type){const g=new THREE.Group();const h=type===0?3.0:4.0;const r=type===0?2.9:2.1;
 const stem=mesh(new THREE.LatheGeometry([[0,0],[.48,0],[.39,.8],[.27,h*.72],[.45,h],[0,h]].map(v=>new THREE.Vector2(...v)),9),bark,g);
 const shape=type===0?[[0,-.16],[r*.50,-.12],[r*.90,.05],[r,.33],[r*.91,.62],[r*.63,1.03],[r*.22,1.18],[0,1.2]]:[[0,-.12],[r*.7,-.03],[r,.2],[r*.89,.6],[r*.55,1.48],[r*.27,2.32],[.16,2.65],[0,2.72]];
 const cap=mesh(new THREE.LatheGeometry(shape.map(v=>new THREE.Vector2(...v)),15),fungal,g,0,h,0);cap.rotation.z=type===0?.07:-.12;
 mesh(new THREE.LatheGeometry([[0,-.1],[r*.65,-.1],[r*.89,.01],[0,.05]].map(v=>new THREE.Vector2(...v)),15),gills,g,0,h-.08,0);
 for(let i=0;i<10;i++){const a=i*TAU/10;const spoke=mesh(new THREE.CylinderGeometry(.024,.024,r*.75,4),gills,g);spoke.position.set(Math.cos(a)*r*.42,h-.12,Math.sin(a)*r*.42);spoke.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),0,Math.sin(a)));}
 return g;}
const fungi=[mushroom(0),mushroom(1),...extraFungi],fungusLists=fungi.map(()=>[]);
function deadTree(){const g=new THREE.Group();const trunkPoints=[[0,-.1,0],[.35,3,.2],[-.3,7,.3],[.6,10,-.6],[.1,14,.1]];tube(g,trunkPoints,.49,bark);for(let i=0;i<6;i++){const a=i*2.4,h=4.5+i*1.1;const dx=Math.cos(a),dz=Math.sin(a);tube(g,[[0,h,0],[dx*1.5,h+1.3,dz*1.5],[dx*3.3,h+2.0,dz*3.3],[dx*4.5,h+2.4,dz*4.5]],.16,bark);}return g;}
const warped=[deadTree(),...extraTrees];const realTrees=[1,2,3,4].map(i=>named(forest,'PSX_Tree'+i,9)).filter(Boolean);
const plantTemplates=[named(forest,'PSX_Grass',.58),named(forest,'PSX_Lavender',.86),named(forest,'PSX_Reed',1.1),named(nature,'Bush',1.1),...extraPlants].filter(Boolean);
const rocks=named(forest,'PSX_Rock',1.4),obelisk=named(palast,'obelisk',6.5);
function rockModel(){const g=new THREE.Group();const o=mesh(new THREE.DodecahedronGeometry(1,0),stone,g,0,.8,0);o.scale.set(.8,1.1,.67);o.rotation.set(.25,.7,-.22);return g;}
const rockT=rocks||rockModel();
function marker(x,z,message,prompt='E — всмотреться'){points.push({x,z,message,prompt});}
function glow(x,z,y,color,power,dist){const l=new THREE.PointLight(color,power,dist,2);l.position.set(x,height(x,z)+y,z);scene.add(l);lights.push({l,power,phase:rnd()*TAU});return l;}
function fungusAt(x,z,s,i){if(!free(x,z,.8*s))return;fungusLists[i%fungi.length].push([x,z,s,range(-Math.PI,Math.PI)]);reserve(x,z,.55*s);}
const spawn=[trail(69),69];
fungusAt(-8,54,1.7,0);fungusAt(8,49,1.6,1);fungusAt(-16,40,2.25,1);fungusAt(17,31,1.8,0);
const familiar=house&&normalize(prep(house),13);
if(familiar){place(familiar,-28,57,.78,.12);const bb=new THREE.Box3().setFromObject(familiar),sz=bb.getSize(new THREE.Vector3());reserve(-28,57,Math.max(sz.x,sz.z)*.43);}
function addBench(x,z){const g=new THREE.Group(),w=material(0x797264,woodTex),metal=material(0x4d6268);for(const dx of [-.85,.85]){mesh(new THREE.BoxGeometry(.12,.48,.52),metal,g,dx,.24,0);mesh(new THREE.BoxGeometry(.08,.8,.08),metal,g,dx,.55,-.22);}for(let i=0;i<3;i++)mesh(new THREE.BoxGeometry(2.2,.055,.15),w,g,0,.49,-.16+i*.16);for(let i=0;i<2;i++)mesh(new THREE.BoxGeometry(2.2,.13,.06),w,g,0,.73+i*.14,-.25);place(g,x,z,1,.4);reserve(x,z,1.1);marker(x,z,'Я помню эту лавочку. Но она стояла совсем в другом месте.','E — вспомнить');}
addBench(trail(58)+3.2,58);
const shrineZ=-13, shrineX=0;
const shrine=new THREE.Group();mesh(new THREE.CylinderGeometry(4.1,4.4,.55,10),stone,shrine,0,.26,0);
mesh(new THREE.CylinderGeometry(2.8,3.3,.42,8),stone,shrine,0,.72,0);
for(let i=0;i<8;i++){const a=i*TAU/8;const x=Math.cos(a)*2.55,z=Math.sin(a)*2.55;const pillar=mesh(new THREE.CylinderGeometry(.3,.46,4.8,5),stone,shrine,x,3.18,z);pillar.rotation.z=Math.sin(a)*.065;mesh(new THREE.CylinderGeometry(.46,.46,.28,6),gold,shrine,x,5.62,z);tube(shrine,[[x,5.6,z],[x*1.32,7.2,z*1.32],[x*.65,10,z*.65],[x*.22,12.2,z*.22]],.16,bark);}
const core=mesh(new THREE.IcosahedronGeometry(1.22,0),material(0x63bda2,null,{emissive:0x49cc92,emissiveIntensity:.9,metalness:.15,roughness:.38}),shrine,0,3.6,0);
const ringMat=material(0x9cbf9a,null,{emissive:0xa97539,emissiveIntensity:.58});
for(let i=0;i<3;i++){const ring=mesh(new THREE.TorusGeometry(1.85+i*.28,.037,5,48),ringMat,shrine,0,3.6,0,false);ring.rotation.set(.4+i*.7,.2+i*.8,0);animated.push({o:ring,speed:.11+i*.045,axis:'y'});}
if(runeTex){const plane=mesh(new THREE.PlaneGeometry(7.4,7.4),new THREE.MeshBasicMaterial({map:runeTex,color:0xffbe83,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),shrine,0,1.0,0,false);plane.rotation.x=-Math.PI/2;}
place(shrine,shrineX,shrineZ);reserve(shrineX,shrineZ,4.6);glow(0,-13,3,0xffbc68,95,23);marker(0,-13,'Кажется, это было сердце места. Теперь оно бьётся отдельно от тебя.','E — прислушаться');points[points.length-1].radius=6.6;
for(let i=0;i<8;i++){const a=i*TAU/8+.2,x=Math.cos(a)*12,z=shrineZ+Math.sin(a)*9;if(!free(x,z,1))continue;const o=obelisk?obelisk.clone(true):rockModel();place(o,x,z,obelisk?range(.55,.85):2.7,a);reserve(x,z,.9);}
for(let i=0;i<20;i++){const x=range(-56,-25),z=range(-61,-29),s=range(.8,2.6);const o=rockT.clone(true);place(o,x,z,s,rnd()*TAU,range(3,15));o.rotation.x=range(-.7,.7);animated.push({o,speed:range(-.12,.12),axis:'y',base:o.position.y,phase:rnd()*TAU,amp:range(.2,.75)});}
marker(-40,-43,'Осколки не падают. Здесь даже тяжесть забыла, как работать.');glow(-40,-43,3,0x85b5ff,75,24);
const poolX=43,poolZ=34,poolY=height(poolX,poolZ)+.22;
const water=mesh(new THREE.CircleGeometry(9.0,48),new THREE.MeshStandardMaterial({color:0x243b5b,emissive:0x44376d,emissiveIntensity:.3,roughness:.42,metalness:.25,side:THREE.DoubleSide}),scene,poolX,poolY,poolZ,false);water.rotation.x=-Math.PI/2;
reserve(poolX,poolZ,8.5);marker(poolX,poolZ,'В отражении нет ни одного знакомого созвездия.','E — заглянуть в воду');points[points.length-1].radius=11;glow(43,34,1.4,0x9b5feb,54,23);
const gate=new THREE.Group();
for(const x of [-3.4,3.4]){mesh(new THREE.CylinderGeometry(.8,1.1,8,6),stone,gate,x,4,0);mesh(new THREE.CylinderGeometry(.95,.95,.3,6),gold,gate,x,8.1,0);}
for(let i=0;i<6;i++){const angle=Math.PI*i/5;const o=mesh(new THREE.BoxGeometry(1.2,1.15,1.0),stone,gate,Math.cos(angle)*3.4,8+Math.sin(angle)*3.4,0);o.rotation.z=angle-Math.PI/2;}
place(gate,trail(-66),-66,1,.1);reserve(trail(-66)-3.4,-66,.95);reserve(trail(-66)+3.4,-66,.95);marker(trail(-66),-66,'Дальше нет ничего. Или всё начинается заново.','E — заглянуть за предел');glow(trail(-66),-66,4,0xc8a2ff,65,24);
const clearZone=(x,z)=>Math.abs(x-trail(z))>3&&loopDist(x,z)>2.6&&Math.hypot(x,z+13)>10&&Math.hypot(x-spawn[0],z-spawn[1])>5&&Math.hypot(x-poolX,z-poolZ)>11;
const clusters=[[-21,32,13],[24,52,11],[-34,-3,15],[34,-8,14],[19,-47,13],[-62,-32,13],[57,-44,13],[-51,56,11],[65,6,10]];
for(const [cx,cz,r] of clusters){for(let i=0;i<10;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*r,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(clearZone(x,z)&&Math.abs(x)<83&&Math.abs(z)<83)fungusAt(x,z,range(.55,1.85),Math.floor(rnd()*fungi.length));}}
fungi.forEach((t,i)=>batch(t,fungusLists[i],true));
const treeTypes=[...realTrees,...warped],treeLists=treeTypes.map(()=>[]),treeFeet=treeTypes.map(t=>trunkFootprint(THREE,t));
for(let i=0;i<1100;i++){if(treeLists.reduce((n,a)=>n+a.length,0)>=172)break;const x=range(-88,88),z=range(-88,88);if(!clearZone(x,z)||!free(x,z,1.7))continue;
 const t=(z>20&&realTrees.length&&rnd()<.67)?Math.floor(rnd()*realTrees.length):realTrees.length+Math.floor(rnd()*warped.length);
 const s=t<realTrees.length?range(.8,1.6):range(.8,2.05),a=rnd()*TAU;treeLists[t].push([x,z,s,a]);colliders.push(treeCollider(treeFeet[t],x,z,s,a));}
treeTypes.forEach((t,i)=>batch(t,treeLists[i],true));
const plantLists=plantTemplates.map(()=>[]),rockList=[];
for(let i=0;i<18500&&plantLists.reduce((n,a)=>n+a.length,0)<8000;i++){const x=range(-88,88),z=range(-88,88);if(!clearZone(x,z)||!free(x,z,.08)||Math.sin(x*.22)*Math.cos(z*.18)<-.72)continue;if(plantLists.length){const n=Math.floor(rnd()*plantLists.length);plantLists[n].push([x,z,range(.55,1.5),rnd()*TAU]);}else break;}
plantTemplates.forEach((t,i)=>batch(t,plantLists[i]));
for(let i=0;i<600&&rockList.length<130;i++){const x=range(-84,84),z=range(-84,84);if(clearZone(x,z)&&free(x,z,1.2)){const s=range(.3,1.5);rockList.push([x,z,s,rnd()*TAU]);if(s>.9)reserve(x,z,.42*s);}}
batch(rockT,rockList,true);
extraProps.forEach((o,i)=>{const x=trail(-38)+5+i%3*5,z=-38-Math.floor(i/3)*6;if(free(x,z,1)){place(o,x,z,1,rnd()*TAU);reserve(x,z,.65);}});
const count=750, pp=new Float32Array(count*3), pc=new Float32Array(count*3);const particleColor=new THREE.Color();
for(let i=0;i<count;i++){const x=range(-88,88),z=range(-88,88);pp.set([x,height(x,z)+range(.5,12),z],i*3);particleColor.set(i%4===0?0xfbd694:0xc9a8ff);pc.set([particleColor.r,particleColor.g,particleColor.b],i*3);}
const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(pp,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(pc,3));const dust=new THREE.Points(particleGeo,new THREE.PointsMaterial({size:.085,vertexColors:true,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(dust);
const pos=new THREE.Vector3(spawn[0],height(...spawn)+1.68,spawn[1]);const keys=new Set(),vel=new THREE.Vector2(),target=new THREE.Vector2();let yaw=0,pitch=-.035,locked=false,bob=0,notice='',until=0;camera.position.copy(pos);camera.rotation.set(pitch,yaw,0);
function nearby(){return points.filter(v=>Math.hypot(v.x-pos.x,v.z-pos.z)<(v.radius||3)).sort((a,b)=>Math.hypot(a.x-pos.x,a.z-pos.z)-Math.hypot(b.x-pos.x,b.z-pos.z))[0];}
function walkable(x,z){return Math.abs(x)<87&&Math.abs(z)<87&&free(x,z,.31)&&Math.abs(height(x,z)-height(pos.x,pos.z))<Math.hypot(x-pos.x,z-pos.z)*1.45+.035;}
function pause(){locked=false;touch.stop();keys.clear();vel.set(0,0);menu.hidden=false;hint.hidden=true;dot.hidden=true;start.textContent='Продолжить';}
start.onclick=()=>{if(touch.selected){touch.start();if(!touchQualityInitialized){applyTouchQuality(renderer,scene);touchQualityInitialized=true;}locked=true;menu.hidden=true;dot.hidden=false;return;}try{const p=renderer.domElement.requestPointerLock();p?.catch?.(()=>status.textContent='Не удалось захватить мышь.');}catch{status.textContent='Захват мыши недоступен.';}};
document.addEventListener('pointerlockchange',()=>{if(touch.active)return;locked=document.pointerLockElement===renderer.domElement;if(locked){menu.hidden=true;dot.hidden=false;}else pause();});document.addEventListener('pointerlockerror',()=>status.textContent='Браузер не разрешил захват мыши.');
let touchQualityInitialized=false;
 function interact(){const n=nearby();if(n){notice=n.message;until=performance.now()+4000;}}
 function lookBy(x,y){if(locked){yaw-=x*.0021;pitch=THREE.MathUtils.clamp(pitch-y*.0021,-1.48,1.48);}}
 const touch=createTouchControls({menu,onLook:(x,y)=>lookBy(x*1.8,y*1.8),onAction:name=>{if(name==='pause')pause();else if(name==='interact')interact();}});
 document.addEventListener('mousemove',e=>{if(!touch.active)lookBy(e.movementX||0,e.movementY||0);});
document.addEventListener('keydown',e=>{if(!locked)return;keys.add(e.code);if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='Escape'&&touch.active)pause();});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();vel.set(0,0);if(touch.active)pause();else if(document.pointerLockElement)document.exitPointerLock();});window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
status.textContent='Готово · WASD, мышь, Shift, E, Esc';start.disabled=false;
let last=performance.now();
renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;
 if(locked){const {f,r}=mergeMotion(Number(keys.has('KeyW'))-Number(keys.has('KeyS')),Number(keys.has('KeyD'))-Number(keys.has('KeyA')),touch.active?touch.state:null);const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')||(touch.active&&touch.state.sprint)?5.5:3.1;target.set((-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed,(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed);vel.lerp(target,1-Math.exp(-12*dt));const x=pos.x+vel.x*dt,z=pos.z+vel.y*dt;if(walkable(x,pos.z))pos.x=x;else vel.x=0;if(walkable(pos.x,z))pos.z=z;else vel.y=0;pos.y=height(pos.x,pos.z)+1.68;bob+=vel.length()*dt*3.1;camera.position.set(pos.x,pos.y+Math.sin(bob)*Math.min(.026,vel.length()*.006),pos.z);camera.rotation.set(pitch,yaw,0);const v=nearby();hint.hidden=now>=until&&!v;hint.textContent=now<until?notice:v?.prompt||'';}
 sky.position.copy(camera.position);core.rotation.y+=dt*.13;core.position.y=3.6+Math.sin(now*.0012)*.25;
 for(const a of animated){a.o.rotation[a.axis]+=dt*a.speed;if(a.base!==undefined)a.o.position.y=a.base+Math.sin(now*.0008+a.phase)*a.amp;}
 for(const a of lights)a.l.intensity=a.power*(.94+.06*Math.sin(now*.0011+a.phase));dust.position.y=Math.sin(now*.00027)*.35;renderer.render(scene,camera);
});
