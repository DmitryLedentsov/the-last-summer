import {createTouchControls,mergeMotion,applyTouchQuality} from './touch_controls.js?v=046';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const $ = (s) => document.querySelector(s);
const statusEl = $('#status');
const menuEl = $('#menu');
const startEl = $('#start');
const hintEl = $('#hint');
const dotEl = $('#dot');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x172932, 0.022);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 220);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1) * 0.85);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.display = 'block';
document.body.prepend(renderer.domElement);

const clock = new THREE.Clock();
const loading = new THREE.LoadingManager();
loading.setURLModifier(url => {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  const basename = url.split(/[\\/]/).pop();
  if (/^[1-6]h\.png$/i.test(basename)) return './assets/curated/houses/' + basename;
  return url;
});
const texLoader = new THREE.TextureLoader(loading);
const fbxLoader = new FBXLoader(loading);
const hdrLoader = new RGBELoader(loading);
const colliders = [];
const interactions = [];

let pointerLocked = false;
let touchQualityInitialized=false;
const touch=createTouchControls({menu:menuEl,onLook:(x,y)=>{if(pointerLocked){player.yaw-=x*.00387;player.pitch=THREE.MathUtils.clamp(player.pitch-y*.00387,-1.45,1.45);}},onAction:name=>{if(name==='pause')pauseGame();else if(name==='interact'){const hit=nearInteraction();if(hit){currentMessage=hit.message;messageUntil=performance.now()+3200;}}}});
let messageUntil = 0;
let currentMessage = '';
let swingTime = 0;
let swingKick = 0;

const keys = new Set();
const player = {
  pos: new THREE.Vector3(0, 1.68, 9),
  vel: new THREE.Vector2(),
  yaw: 0,
  pitch: -0.05,
  bob: 0,
};

camera.rotation.order = 'YXZ';

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
  });
}

function nearInteraction() {
  return interactions.find((i) => Math.hypot(i.x - player.pos.x, i.z - player.pos.z) < (i.radius || 2.25));
}

function pauseGame() {
  pointerLocked=false;touch.stop();
  keys.clear();
  player.vel.set(0, 0);
  menuEl.hidden = false;
  dotEl.hidden = true;
  hintEl.hidden = true;
  startEl.textContent = 'Продолжить';
}

function makeFallbackSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#020307');
  grad.addColorStop(0.35, '#052a28');
  grad.addColorStop(0.72, '#0c1716');
  grad.addColorStop(1, '#020406');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.7;
    const a = 0.3 + Math.random() * 0.7;
    const s = Math.random() < 0.9 ? 1 : 2;
    ctx.fillStyle = `rgba(180,255,245,${a})`;
    ctx.fillRect(x, y, s, s);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

function createFallbackTree() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x355b63, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x0fb37b, roughness: 1, side: THREE.DoubleSide });
  cylinder(0.22, 0.26, 5.4, trunkMat, 0, 2.7, 0, group, 6);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(1.1 + Math.random() * 0.45, 1.8 + Math.random() * 0.8, 4), leafMat);
    m.position.set((Math.random() - 0.5) * 1.2, 3.6 + Math.random() * 2.2, (Math.random() - 0.5) * 1.2);
    m.rotation.y = Math.random() * Math.PI;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
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

function makeRuneDisc(runeTexture) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: 0x31474b, roughness: 1, metalness: 0.05 }),
  );
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 3.1),
    new THREE.MeshBasicMaterial({
      map: runeTexture || null,
      color: 0x79fff3,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.18;
  group.add(glow);
  const light = new THREE.PointLight(0x53fff3, 24, 10, 2);
  light.position.y = 0.95;
  group.add(light);
  group.userData.glow = glow;
  group.userData.light = light;
  return group;
}

async function loadAsset(path, kind = 'fbx') {
  try {
    if (kind === 'fbx') return await fbxLoader.loadAsync(path);
    if (kind === 'hdr') return await hdrLoader.loadAsync(path);
    if (kind === 'texture') return await texLoader.loadAsync(path);
  } catch (error) {
    console.warn('Asset load failed:', path, error);
  }
  return null;
}

async function main() {
  const assets = {
    skyNight: './assets/curated/sky/PSX_NIGHTSKY.hdr',
    skyDay: './assets/curated/sky/DAYSKY.hdr',
    forest: './assets/curated/forest/forest_collection.fbx',
    nature: './assets/curated/nature/nature_collection.fbx',
    palast: './assets/curated/palast/palast_collection.fbx',
    skeleton: './assets/curated/skull/PS1_Skeleton.fbx',
    skull: './assets/curated/skull/PS1_Skull.fbx',
    sword: './assets/curated/skull/ps1_Sword.fbx',
    rune: './assets/curated/skull/MagicRunes_Emission.png',
    groundGrass: './assets/curated/ground/PSX_Seamless_ShortForestGrass_128px.png',
    groundWild: './assets/curated/ground/PSX_Seamless_WildForestGrass_128px.png',
    groundEarth: './assets/curated/ground/PSX_Seamless_ForestEarthGround_128px.png',
    groundClover: './assets/curated/ground/PSX_Seamless_WildForestClover_128px.png',
    house1: './assets/curated/houses/house03.fbx',
    house2: './assets/curated/houses/house07.fbx',
  };

  const [nightHDR, forestCollection, natureCollection, palastCollection, skeletonModel, skullModel, swordModel, runeTexture, tGrass, tWild, tEarth, tClover, houseA, houseB, wallTex, skullTex] = await Promise.all([
    loadAsset(assets.skyNight, 'hdr'),
    loadAsset(assets.forest, 'fbx'),
    loadAsset(assets.nature, 'fbx'),
    loadAsset(assets.palast, 'fbx'),
    loadAsset(assets.skeleton, 'fbx'),
    loadAsset(assets.skull, 'fbx'),
    loadAsset(assets.sword, 'fbx'),
    loadAsset(assets.rune, 'texture'),
    loadAsset(assets.groundGrass, 'texture'),
    loadAsset(assets.groundWild, 'texture'),
    loadAsset(assets.groundEarth, 'texture'),
    loadAsset(assets.groundClover, 'texture'),
    loadAsset(assets.house1, 'fbx'),
    loadAsset(assets.house2, 'fbx'),
    loadAsset('./assets/curated/nature/stonewall.JPG', 'texture'),
    loadAsset('./assets/curated/skull/ps1_skull_256x256.png', 'texture'),
  ]);

  scene.background = nightHDR ? (nightHDR.mapping = THREE.EquirectangularReflectionMapping, nightHDR) : makeFallbackSky();

  scene.backgroundIntensity = 1.05;
  const hemi = new THREE.HemisphereLight(0xa3c9df, 0x5a6550, 1.25);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xa5ccff, 1.6);
  moon.position.set(-18, 23, 18);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -25;
  moon.shadow.camera.right = 25;
  moon.shadow.camera.top = 25;
  moon.shadow.camera.bottom = -25;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 90;
  moon.shadow.bias = -0.0003;
  scene.add(moon);
  const tealLight = new THREE.PointLight(0x35ffd8, 85, 22, 2);
  tealLight.position.set(-3, 3, 2);
  scene.add(tealLight);

  srgb(runeTexture);
  srgb(tGrass); srgb(tWild); srgb(tEarth); srgb(tClover);
  repeatTexture(tGrass, 18, 18);
  repeatTexture(tWild, 8, 8);
  repeatTexture(tEarth, 6, 6);
  repeatTexture(tClover, 12, 12);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0xc1cbb2, map: tGrass || null, roughness: 1 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xb0b4ad, map: tEarth || null, roughness: 1 });
  const cloverMat = new THREE.MeshStandardMaterial({ color: 0xb1c7a3, map: tClover || tWild || null, roughness: 1 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x374346, roughness: 1, metalness: 0.03 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb8b7ad, map: srgb(wallTex) || null, roughness: 1 });

  const island = box(36, 2.2, 36, stoneMat, 0, -1.1, 0);
  island.receiveShadow = true;
  const courtyard = plane(28, 28, groundMat, 0, 0.03, 0);
  const path = plane(8, 15, pathMat, 0, 0.05, 6);
  const backPath = plane(12, 6, pathMat, 0, 0.051, -7);
  const cloverPatch = plane(10, 8, cloverMat, -7, 0.06, 3);
  const rightPatch = plane(8, 8, cloverMat, 7, 0.06, 1);
  void courtyard; void path; void backPath; void cloverPatch; void rightPatch;

  // Separate wall colliders, never the bounding box of the entire courtyard.
  const border = new THREE.Group(); scene.add(border);
  for (const [w,h,d,x,z] of [[28,1.2,0.55,0,-14],[0.65,1.5,28,-14,0],[0.65,1.5,28,14,0],[28,0.6,0.65,0,14]]) {
    addColliderFromObject(box(w,h,d,concreteMat,x,h/2,z,border));
  }
  // A single authentic panel building, aligned by its actual bounding box.
  const house = houseA || houseB;
  if (house) {
    const obj=normalize(prepareObject(house), 13);
    const bounds = new THREE.Box3().setFromObject(obj), size=bounds.getSize(new THREE.Vector3());
    const fit=Math.min(1,24/Math.max(size.x,.01),7/Math.max(size.z,.01));
    place(obj,0,-6-size.z*fit/2,0,0,fit);
    addColliderFromObject(obj,0.1);
  }

  // Tree / forest elements.
  const fallbackTree = createFallbackTree();
  const treeBase = cloneNamed(forestCollection, ['psx_tree1']);
  const treeAlt = cloneNamed(forestCollection, ['psx_tree3']) || treeBase;
  const grassBlade = cloneNamed(forestCollection, ['psx_grass']);
  const flower = cloneNamed(forestCollection, ['dandelion', 'flower']) || cloneNamed(forestCollection, ['grass']);
  const rock = cloneNamed(forestCollection, ['rock']);
  const bush = cloneNamed(natureCollection, ['bush']) || cloneNamed(natureCollection, ['ivy']);

  function placeNature(source, height, x, z, scale = 1, rot = Math.random() * Math.PI * 2, collider = false) {
    let obj = source ? normalize(prepareObject(source.clone()), height) : createFallbackTree();
    place(obj, x, z, 0, rot, scale);
    if (collider) colliders.push({x0:x-.38*scale,x1:x+.38*scale,z0:z-.38*scale,z1:z+.38*scale});
    return obj;
  }

  // Main mystical tree.
  const centralTree = placeNature(treeAlt || treeBase, 7.4, -4.5, -1.5, 1.25, 0.4, true);
  const trunkGlow = new THREE.PointLight(0x19ffd7, 40, 12, 2);
  trunkGlow.position.set(-3.4, 2.4, -0.5);
  scene.add(trunkGlow);

  const treePositions = [
    [-9.5, 6], [-11.2, -4], [10.5, 5.5], [11.8, -2], [7.5, 10.5], [-7.5, 10.8], [-10.8, 11], [10.2, 10.4]
  ];
  treePositions.forEach(([x, z], i) => placeNature((i % 2 ? treeAlt : treeBase) || null, 6 + (i % 3) * 0.6, x, z, 0.95 + (i % 4) * 0.03, i * 0.8, true));

  let seed=8401;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function scatterClones(source, count, areaMin, areaMax, height, y = 0) {
    if (!source) return;
    const template=normalize(prepareObject(source.clone()),height);
    template.updateMatrixWorld(true);
    const points=[];
    for(let i=0;i<count;i++){
      const x=areaMin+rand()*(areaMax-areaMin), z=areaMin+rand()*(areaMax-areaMin);
      if(z < -5.6 || Math.abs(x)<1.8 && z>1.8 || Math.hypot(x,z)<2.5 || !walkable(x,z)) continue;
      points.push([x,z,.65+rand()*.85,rand()*Math.PI*2]);
    }
    if(!points.length)return;
    const dummy=new THREE.Object3D();
    template.traverse(n=>{if(!n.isMesh)return;
      const geometry=n.geometry.clone().applyMatrix4(n.matrixWorld);
      const mesh=new THREE.InstancedMesh(geometry,n.material,points.length);
      points.forEach(([x,z,scale,angle],i)=>{dummy.position.set(x,y,z);dummy.scale.setScalar(scale);dummy.rotation.set(0,angle,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
    });
  }

  // Central altar with rune disc.
  const altar = new THREE.Group();
  scene.add(altar);
  box(3.5, 0.7, 3.5, concreteMat, 0, 0.35, 0, altar);
  box(2.4, 0.45, 2.4, concreteMat, 0, 0.95, 0, altar);
  const runeDisc = makeRuneDisc(runeTexture);
  runeDisc.position.set(0, 1.16, 0);
  altar.add(runeDisc);
  addColliderFromObject(altar, 0.05);
  interactions.push({ x: 0, z: 0, radius: 3.2, prompt: 'E — прислушаться к рунам', message: 'Руны пульсируют, как далёкий радиосигнал.' });

  // Sword.
  let swordObj = swordModel ? normalize(prepareObject(swordModel), 2.7) : null;
  if (!swordObj) {
    swordObj = new THREE.Group();
    cylinder(0.03, 0.03, 2.2, new THREE.MeshStandardMaterial({ color: 0x7de0ff, metalness: 0.8, roughness: 0.25 }), 0, 1.1, 0, swordObj, 6);
    box(0.6, 0.08, 0.08, new THREE.MeshStandardMaterial({ color: 0x7de0ff, metalness: 0.8, roughness: 0.25 }), 0, 0.6, 0, swordObj);
  }
  place(swordObj, -3.7, 2.2, 0.2, 0.15, 1);
  interactions.push({ x: -3.7, z: 2.2, prompt: 'E — прикоснуться к мечу', message: 'Металл ледяной, будто лежал здесь вечность.' });

  // Skull on stone.
  const skullPedestal = new THREE.Group();
  scene.add(skullPedestal);
  box(1.1, 1.1, 1.1, concreteMat, 0, 0.55, 0, skullPedestal);
  const skullObj = skullModel ? normalize(prepareObject(skullModel), 0.9) : null;
  if (skullObj) { skullObj.traverse(n=>{if(n.isMesh&&skullTex){for(const m of Array.isArray(n.material)?n.material:[n.material]){m.map=srgb(skullTex);m.color?.set(0xffffff);m.needsUpdate=true;}}}); skullPedestal.add(skullObj); skullObj.position.y=1.14; }
  else box(0.55, 0.42, 0.68, new THREE.MeshStandardMaterial({ color: 0xc7c1a8, roughness: 1 }), 0, 1.18, 0, skullPedestal);
  place(skullPedestal, 4.8, 2.7, 0, -0.3, 1);
  interactions.push({ x: 4.8, z: 2.7, prompt: 'E — посмотреть на череп', message: 'Пустые глазницы будто следят за каждым движением.' });
  addColliderFromObject(skullPedestal, 0.05);

  // Skeleton watcher.
  let skeletonObj = skeletonModel ? normalize(prepareObject(skeletonModel), 1.95) : null;
  if (!skeletonObj) {
    skeletonObj = new THREE.Group();
    cylinder(0.08, 0.08, 2.2, new THREE.MeshStandardMaterial({ color: 0xe4a872, roughness: 1 }), 0, 1.1, 0, skeletonObj, 6);
  }
  place(skeletonObj, 6.5, -1.8, 0, -2.4, 1);
  interactions.push({ x: 6.5, z: -1.8, prompt: 'E — посмотреть на сторожа', message: 'Он молчит. Кажется, он просто ждёт.' });
  addColliderFromObject(skeletonObj, 0.12);
  const watcherLight=new THREE.PointLight(0xff8740,65,13,2); watcherLight.position.set(5.2,2.8,0);scene.add(watcherLight);

  // Individual meshes, not the entire asset showcase.
  for(const [name,height,x,z,rot] of [['obelisk',3.4,8,4,-0.3],['shrine',2.2,-8,2,0.15],['AngelWall',3.1,10,-4,-0.6],['Devilsface',1.6,-10,-3,0.5]]){
    const source=cloneNamed(palastCollection,[name]);
    if(!source)continue;
    const obj=normalize(prepareObject(source),height);place(obj,x,z,0,rot);addColliderFromObject(obj,.08);
    interactions.push({x,z,radius:2.6,prompt:'E — осмотреть',message:'Этого здесь не было.'});
  }
  scatterClones(grassBlade, 1750, -12.8, 12.8, 0.48, 0.045);
  scatterClones(flower, 190, -12, 12, 0.3, 0.045);
  scatterClones(bush, 65, -12, 12, 0.85, 0.045);
  scatterClones(rock, 28, -12, 12, 0.42, 0.045);
  scatterClones(cloneNamed(natureCollection,['plant']), 150, -12,12,.65,.045);

  // A strange courtyard lamp.
  const lamp = new THREE.Group();
  scene.add(lamp);
  cylinder(0.07, 0.08, 3.6, concreteMat, 0, 1.8, 0, lamp, 6);
  box(0.38, 0.38, 0.38, new THREE.MeshStandardMaterial({ color: 0x8df2ff, emissive: 0x42c9de, emissiveIntensity: 0.65 }), 0, 3.75, 0, lamp);
  const lampLight = new THREE.PointLight(0x58f4ff, 50, 14, 2);
  lampLight.position.set(0, 3.75, 0);
  lamp.add(lampLight);
  place(lamp, -7.8, 7.8, 0, 0, 1);

  // Familiar courtyard details against the impossible scene.
  const benchMat=new THREE.MeshStandardMaterial({color:0x988061,roughness:1});
  const iron=new THREE.MeshStandardMaterial({color:0x56766e,roughness:1});
  for(const [x,z,a] of [[-5.4,6.5,.4],[5.4,7.3,-.7]]){
    const b=new THREE.Group();place(b,x,z,0,a);
    for(const dx of [-.85,.85]){box(.12,.5,.5,iron,dx,.25,0,b);box(.08,.85,.08,iron,dx,.47,-.22,b);}
    for(let i=0;i<3;i++)box(2.1,.06,.15,benchMat,0,.52,-.18+i*.17,b);
    for(let i=0;i<2;i++)box(2.1,.15,.06,benchMat,0,.75+i*.17,-.23,b);
    addColliderFromObject(b,.04);
  }
  const warm=new THREE.PointLight(0xffad63,55,15,2);warm.position.set(2,3,-4.8);scene.add(warm);
  const lampFace=new THREE.MeshBasicMaterial({color:0xffb56d});box(.35,.24,.12,lampFace,2,3,-5.75);

  // Void particles / fireflies.
  const particleCount = 220;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const radius = 5 + Math.random() * 18;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3 + 0] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.random() * 12 + 0.7;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    const t = Math.random();
    colors[i * 3 + 0] = 0.2 + t * 0.25;
    colors[i * 3 + 1] = 0.65 + t * 0.35;
    colors[i * 3 + 2] = 0.6 + t * 0.4;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const particleMat = new THREE.PointsMaterial({ size: 0.08, transparent: true, opacity: 0.95, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Validate spawn against every individual collider before enabling controls.
  if(!walkable(player.pos.x,player.pos.z)){
    let found=false;
    for(let z=10;z>=2&&!found;z-=.5)for(let x=-2;x<=2;x+=.5)if(walkable(x,z)){player.pos.set(x,1.68,z);found=true;break;}
    if(!found)throw new Error('No valid spawn in courtyard');
  }
  camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0);
  // Interaction status.
  const count=[nightHDR,forestCollection,natureCollection,palastCollection,skeletonModel,skullModel,swordModel,houseA].filter(Boolean).length;
  statusEl.textContent = `Готово · основные ресурсы ${count}/8`; 
  startEl.disabled = false;

  function walkable(x, z) {
    if (x < -12.8 || x > 12.8 || z < -12.8 || z > 12.8) return false;
    for (const c of colliders) {
      if (x + .25 > c.x0 && x - .25 < c.x1 && z + .25 > c.z0 && z - .25 < c.z1) return false;
    }
    return true;
  }

  document.addEventListener('pointerlockchange', () => {
    if(touch.active)return;
    pointerLocked = document.pointerLockElement === renderer.domElement;
    if (pointerLocked) {
      menuEl.hidden = true;
      dotEl.hidden = false;
    } else {
      pauseGame();
    }
  });

  startEl.addEventListener('click', async () => {
    if(touch.selected){touch.start();if(!touchQualityInitialized){applyTouchQuality(renderer,scene);touchQualityInitialized=true;}pointerLocked=true;menuEl.hidden=true;dotEl.hidden=false;return;}
    try {
      await renderer.domElement.requestPointerLock();
    } catch (error) {
      console.warn(error);
      statusEl.textContent = 'Браузер не дал захватить мышь.';
    }
  });

  document.addEventListener('mousemove', (event) => {
    if (!pointerLocked||touch.active) return;
    player.yaw -= event.movementX * 0.00215;
    player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * 0.00215, -1.45, 1.45);
  });

  document.addEventListener('keydown', (event) => {
    if (!pointerLocked) return;
    keys.add(event.code);
    if (event.code === 'KeyE' && !event.repeat) {
      const hit = nearInteraction();
      if (hit) {
        currentMessage = hit.message;
        messageUntil = performance.now() + 3200;
      }
    }
  });
  document.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); player.vel.set(0, 0); if(touch.active)pauseGame();else if(document.pointerLockElement)document.exitPointerLock(); });

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();

    if (pointerLocked) {
      const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
      const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
      const {f,r}=mergeMotion(forward,right,touch.active?touch.state:null);
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') || (touch.active&&touch.state.sprint) ? 4.6 : 2.6;
      const vx = (-Math.sin(player.yaw) * f + Math.cos(player.yaw) * r) * speed;
      const vz = (-Math.cos(player.yaw) * f - Math.sin(player.yaw) * r) * speed;
      player.vel.lerp(new THREE.Vector2(vx, vz), 1 - Math.exp(-10 * dt));
      const nx = player.pos.x + player.vel.x * dt;
      const nz = player.pos.z + player.vel.y * dt;
      if (walkable(nx, player.pos.z)) player.pos.x = nx; else player.vel.x = 0;
      if (walkable(player.pos.x, nz)) player.pos.z = nz; else player.vel.y = 0;

      player.bob += player.vel.length() * dt * 3.4;
      camera.position.set(player.pos.x, 1.68 + Math.sin(player.bob) * Math.min(0.03, player.vel.length() * 0.008), player.pos.z);
      camera.rotation.set(player.pitch, player.yaw, 0);

      const focus = nearInteraction();
      if (now < messageUntil) {
        hintEl.hidden = false;
        hintEl.textContent = currentMessage;
      } else if (focus) {
        hintEl.hidden = false;
        hintEl.textContent = focus.prompt;
      } else {
        hintEl.hidden = true;
      }
    }

    swingTime += dt;
    swingKick *= Math.exp(-dt * 0.7);
    runeDisc.userData.glow.rotation.z += dt * 0.33;
    runeDisc.userData.glow.material.opacity = 0.55 + Math.sin(swingTime * 2.0) * 0.18;
    runeDisc.userData.light.intensity = 24 + Math.sin(swingTime * 2.7) * 5;
    trunkGlow.intensity = 40 + Math.sin(swingTime * 1.8) * 6;
    particles.rotation.y += dt * 0.015;

    renderer.render(scene, camera);
  }

  animate();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && pointerLocked) {
    if(touch.active)pauseGame();else if(document.pointerLockElement)document.exitPointerLock();
  }
});

main().catch((error) => {
  console.error(error);
  statusEl.textContent = 'Ошибка подготовки сцены. См. консоль.';
});
