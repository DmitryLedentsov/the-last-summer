import {inflateSync} from 'three/addons/libs/fflate.module.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {clone as cloneRig} from 'three/addons/utils/SkeletonUtils.js';
import {hitsCollider,hitsTreeRay} from './tree_collision.js?v=061';
import {RULES as R,newCombat,canFire,fire,roll,reload,tickCombat,rollProgress,spread,sphereHit} from './duel_rules.js?v=043';
import {createCombatFX} from './duel_fx.js?v=044';
import {makeSightCache,createHitFeedback,createProfiler,steeringChoice} from './duel_perf.js?v=045';
import {createPlayerInput,keyCode,playerMotion,reticleDiameter} from './player_input.js?v=047';
import {analogSpeed,approach,strideLength,gaitStride,movementFacing,sprintAvailable,createPoseLayer,locomotionMode,legacyLocomotion} from './character_motion.js?v=061';
import {createLegSolver} from './leg_ik.js?v=061';
import {IDLE_DELAY,idleActivity,advanceIdle,makeQuietIdle} from './idle_animation.js?v=061';
import {weaponPoseState,boundedAim,poseReach} from './weapon_pose.js?v=061';
import {createGraphics} from './graphics_presets.js?v=061';
import {createRenderPose} from './render_pose.js?v=048';
import {createTouchControls,mergeMotion} from './touch_controls.js?v=049';

export async function startSurvival({THREE:T,scene,camera,renderer,level,height,free,colliders,terrain,treeBatches,sun,extraTextures=[]}){
 const $=s=>document.querySelector(s), menu=$('#menu'), start=$('#start'), status=$('#status'), dot=$('#dot'), hud=$('#hud');
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), up=V(0,1,0), clamp=T.MathUtils.clamp;
 const dir=a=>V(Math.sin(a),0,Math.cos(a)), world=o=>o.getWorldPosition(V());
 const base=new URL('./assets/survival/',import.meta.url), url=p=>new URL(p,base).href;
 const paths=new Map();for(const n of ['body radition guy (1).png','guantelets radiation.png','mask radition (1).png','shoes radiation guy.png'])paths.set(n.toLowerCase(),url('hero/'+n));paths.set('monsterpsx_diffuse.png',url('monster/MonsterPSX_Diffuse.png'));
 const mgr=new T.LoadingManager();mgr.setURLModifier(p=>{if(p.startsWith('data:')||p.startsWith('blob:'))return p;let n=p.split(/[\\/]/).pop();try{n=decodeURIComponent(n)}catch{}return paths.get(n.toLowerCase())||p;});
 const fbx=new FBXLoader(mgr), obj=new OBJLoader(mgr), tx=new T.TextureLoader(mgr);
 function tune(t){if(t){t.colorSpace=T.SRGBColorSpace;t.magFilter=T.NearestFilter;t.minFilter=T.NearestMipmapLinearFilter;}return t;}
 status.textContent='Загрузка скелетов и оружия…';
 const [heroSrc,monsterSrc,gunSrc,gunTex,cylTex,monsterTex,...heroTex]=await Promise.all([(async()=>{const response=await fetch(url('hero/light hazmat suit.fbx.deflate'));if(!response.ok)throw Error('Hero asset: '+response.status);const bytes=inflateSync(new Uint8Array(await response.arrayBuffer()));return fbx.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),url('hero/'));})(),fbx.loadAsync(url('monster/MonsterPSX.fbx')),obj.loadAsync(url('revolver/38SpecialRevolver.obj')),tx.loadAsync(url('revolver/38-specialText.png')),tx.loadAsync(url('revolver/cylinderRefV2.jpg')),tx.loadAsync(url('monster/MonsterPSX_Diffuse.png')),...['body radition guy (1).png','shoes radiation guy.png','mask radition (1).png','guantelets radiation.png'].map(n=>tx.loadAsync(url('hero/'+n)))]);
 function prepare(o,monster=false){o.traverse(n=>{if(!n.isMesh)return;if(/^WGT_/i.test(n.name)){n.visible=false;return;}n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;for(const m of Array.isArray(n.material)?n.material:[n.material]){if(!m)continue;if(monster)m.map=monsterTex;else{const i=[/body/i,/pies|shoe/i,/mask/i,/mano|glove/i].findIndex(re=>re.test(m.name));if(i>=0)m.map=heroTex[i];}tune(m.map);m.color?.set(0xffffff);m.transparent=false;m.opacity=1;m.alphaTest=0;m.specular?.setScalar(.035);m.needsUpdate=true;}});return o;}
 prepare(heroSrc);prepare(monsterSrc,true);
 for(const source of [heroSrc,monsterSrc]){const extra=[];source.traverse(o=>{if(o.isCamera||o.isLight)extra.push(o);});extra.forEach(o=>o.removeFromParent());}
 // WGT geometry is the author's Blender rig UI, not a part of the creature.
 const widgets=[];monsterSrc.traverse(o=>{if(o.isMesh&&/^WGT_/i.test(o.name))widgets.push(o)});widgets.forEach(o=>o.removeFromParent());
 function findBone(o,name){let result;const k=name.toLowerCase().replace(/[^a-z0-9]/g,'');o.traverse(n=>{if(n.isBone&&n.name.toLowerCase().replace(/[^a-z0-9]/g,'').endsWith(k))result=n;});return result;}
 function actor(src,h,kind){const model=cloneRig(src),root=new T.Group(),inner=new T.Group();root.add(inner);inner.add(model);root.updateMatrixWorld(true);const bounds=new T.Box3();model.traverse(o=>{if(!o.isMesh||!o.visible)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});const size=bounds.getSize(V()),center=bounds.getCenter(V());if(!Number.isFinite(size.y)||size.y<.0001)throw Error('Invalid character geometry');const scale=h/size.y;inner.scale.setScalar(scale);inner.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);root.updateMatrixWorld(true);
 const mixer=new T.AnimationMixer(model),actions={};const clips=src.animations||[];
 // Lock horizontal root translation to the source rig. Gameplay controls actual movement.
 const rootBone=findBone(model,kind==='hero'?'hips':'root');const localUp=rootBone?up.clone().applyQuaternion(rootBone.parent.getWorldQuaternion(new T.Quaternion()).invert()).normalize():up;
 for(const c of clips){const clip=c.clone();for(const t of clip.tracks){if(t.name.endsWith('.position')&&rootBone&&t.name.slice(0,-9)===rootBone.name){for(let i=0;i<t.values.length;i+=3){const original=V(t.values[i],t.values[i+1],t.values[i+2]);const p=rootBone.position.clone().addScaledVector(localUp,original.sub(rootBone.position).dot(localUp));t.values[i]=p.x;t.values[i+1]=p.y;t.values[i+2]=p.z;}}}actions[c.name.toLowerCase()]=mixer.clipAction(clip);}
 if(kind==='hero'){const idle=Object.entries(actions).find(([k])=>k.includes('idle'))?.[1];if(idle)actions.__quiet=mixer.clipAction(makeQuietIdle(T,idle.getClip(),model));}
 const findAction=keyword=>actions[keyword]? [keyword,actions[keyword]]:Object.entries(actions).find(([k])=>k.includes(keyword));
 let active=null,fading=null,fadeUntil=0;function play(keyword,once=false,fade=.13){const entry=findAction(keyword);if(!entry)return null;const a=entry[1];if(fading&&mixer.time>=fadeUntil){fading.stop();fading=null;}if(a!==active){if(fading){fading.stop();fading=null;}if(active){if(fade>0){active.setEffectiveWeight(1).fadeOut(fade);fading=active;fadeUntil=mixer.time+fade;}else active.stop();}a.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);a.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);a.clampWhenFinished=once;if(active&&fade>0)a.fadeIn(fade);a.play();active=a;}return a;}
 const pivot=new T.Group();root.remove(inner);pivot.position.y=.88;inner.position.y-=.88;pivot.add(inner);root.add(pivot);return {root,model,inner,pivot,mixer,play,actions,hasClip:keyword=>!!findAction(keyword),resetAnimation(){active=null;fading=null;fadeUntil=0;}};}
 if(!heroSrc.animations.some(c=>/idle/i.test(c.name))||!heroSrc.animations.some(c=>/run/i.test(c.name)))throw Error('Анимации героя не прочитались');if(!monsterSrc.animations.some(c=>/attack/i.test(c.name))||!monsterSrc.animations.some(c=>/run/i.test(c.name)))throw Error('Анимации монстра не прочитались');
 // OBJ includes display ammunition and an exploded duplicate cylinder. Only assemble the actual revolver.
 const remove=[];gunSrc.traverse(o=>{if(o.isMesh){if(!/38SpecialBody|38SpecialCylinder$|38SpecialTrigger/i.test(o.name)||/\.001/.test(o.name)){remove.push(o);return;}o.material=new T.MeshStandardMaterial({map:tune(/Cylinder/.test(o.name)?cylTex:gunTex),roughness:.85,metalness:.08,side:T.DoubleSide});o.castShadow=true;}});remove.forEach(o=>o.removeFromParent());if(!gunSrc.children.length)throw Error('Модель револьвера пуста');

 function armed(){const hero=actor(heroSrc,1.78,'hero');hero.play('__quiet');hero.mixer.update(.001);
 const arm=findBone(hero.model,'rightarm'),fore=findBone(hero.model,'rightforearm'),hand=findBone(hero.model,'righthand'),index=findBone(hero.model,'righthandindex1'),thumb=findBone(hero.model,'righthandthumb1');if(!arm||!fore||!hand)throw Error('Right arm rig missing');
 const socket=new T.Group();hand.add(socket);const gun=new T.Group();socket.add(gun);const weapon=gunSrc.clone(true);gun.add(weapon);const gunScale=.118;weapon.scale.setScalar(gunScale);weapon.position.set(.67*gunScale,-.61*gunScale,0);const muzzle=new T.Object3D();muzzle.position.set((1.456+.67)*gunScale,(1.23-.61)*gunScale,0);socket.add(muzzle);
 const la=findBone(hero.model,'leftarm'),lf=findBone(hero.model,'leftforearm'),lh=findBone(hero.model,'lefthand');const poseBones=[arm,fore,hand,...[la,lf,lh].filter(Boolean)];const poseBase=poseBones.map(b=>b.quaternion.clone());
 function setWorldQ(b,q){const pq=b.parent.getWorldQuaternion(new T.Quaternion());b.quaternion.copy(pq.invert().multiply(q));b.updateMatrixWorld(true);}
 function pointBone(b,child,goal){const a=world(b),d=world(child).sub(a).normalize(),w=goal.clone().sub(a).normalize();if(d.lengthSq()&&w.lengthSq()){const q=new T.Quaternion().setFromUnitVectors(d,w).multiply(b.getWorldQuaternion(new T.Quaternion()));setWorldQ(b,q);}}
 // The gun is calibrated in right-hand space once; it is not reattached every tick.
 function handBasis(finger,thumb,fallback){const x=finger?finger.position.clone().normalize():fallback.clone();
  if(x.lengthSq()<.1)x.copy(fallback);let y=thumb?thumb.position.clone():V(1,0,0);
  y.addScaledVector(x,-y.dot(x));if(y.lengthSq()<1e-6){y=Math.abs(x.y)<.8?V(0,1,0):V(0,0,1);y.addScaledVector(x,-y.dot(x));}y.normalize();
  return new T.Matrix4().makeBasis(x,y,x.clone().cross(y).normalize());}
 const gripBasis=handBasis(index,thumb,V(0,1,0)),gripInverse=gripBasis.clone().invert();
 const leftBasis=lh?handBasis(findBone(hero.model,'lefthandindex1'),findBone(hero.model,'lefthandthumb1'),V(0,1,0)).invert():null;
 const gripScale=hand.getWorldScale(V());
 socket.quaternion.setFromRotationMatrix(gripBasis);
 socket.position.copy(V(.055,-.015,0).applyMatrix4(gripBasis)).divide(gripScale);
 socket.scale.set(1/gripScale.x,1/gripScale.y,1/gripScale.z);
 const secondaryGrip=new T.Object3D();secondaryGrip.position.set(-.020,-.050,-.055);socket.add(secondaryGrip);
 function solveArm(upper,lower,wrist,target,hint){
  const origin=world(upper),middle=world(lower),tip=world(wrist),l=origin.distanceTo(middle),m=middle.distanceTo(tip);
  const delta=target.clone().sub(origin);if(l<.001||m<.001||delta.lengthSq()<1e-8)return;
  const len=clamp(delta.length(),Math.abs(l-m)+.001,l+m-.001);delta.normalize();
  const along=(l*l-m*m+len*len)/(2*len),bend=Math.sqrt(Math.max(0,l*l-along*along));
  const pole=hint.clone().addScaledVector(delta,-hint.dot(delta));
  if(pole.lengthSq()<1e-6){pole.copy(middle).sub(origin).addScaledVector(delta,-middle.clone().sub(origin).dot(delta));}
  if(pole.lengthSq()<1e-6){pole.copy(Math.abs(delta.y)<.8?up:V(1,0,0)).addScaledVector(delta,-(Math.abs(delta.y)<.8?up:V(1,0,0)).dot(delta));}
  pole.normalize();pointBone(upper,lower,origin.clone().addScaledVector(delta,along).addScaledVector(pole,bend));
  pointBone(lower,wrist,origin.clone().addScaledVector(delta,len));
 }
 function poseGun(aim,recoil,pose={state:'aim',raise:1,support:0}){
  hero.root.updateMatrixWorld(true);
  const bodyQ=hero.pivot.getWorldQuaternion(new T.Quaternion()),bodyUp=V(0,1,0).applyQuaternion(bodyQ),bodyForward=V(0,0,1).applyQuaternion(bodyQ);
  const shoulder=world(arm),l1=shoulder.distanceTo(world(fore)),l2=world(fore).distanceTo(world(hand));
  const outward=la?shoulder.clone().sub(world(la)).normalize():bodyForward.clone().cross(bodyUp).normalize();
  const compact=pose.state==='roll'||pose.state==='recover'||pose.state==='reload';
  // Low ready and recovery are body-relative, not world-space targets at the player's feet.
  const low=bodyForward.clone().addScaledVector(bodyUp,compact?-.26:-.58).normalize();
  let aimDir=aim.clone().sub(shoulder);if(aimDir.lengthSq()<1e-6)aimDir.copy(bodyForward);else aimDir.normalize();
  if(!pose.fireNow&&!compact){
   const angle=boundedAim(hero.root.rotation.y,Math.atan2(aimDir.x,aimDir.z));
   const y=clamp(aimDir.y,-.85,.85),horizontal=Math.sqrt(1-y*y);aimDir.set(Math.sin(angle)*horizontal,y,Math.cos(angle)*horizontal);
  }
  const raise=compact?0:pose.raise,forward=low.clone().lerp(aimDir,raise);
  if(forward.lengthSq()<1e-6)forward.copy(bodyForward);forward.normalize();
  const target=shoulder.clone().addScaledVector(forward,Math.min(.50,(l1+l2)*poseReach(raise,pose.state))-recoil*.035)
   .addScaledVector(outward,.025*(1-raise)).addScaledVector(bodyUp,-.065+recoil*.06);
  solveArm(arm,fore,hand,target,bodyUp.clone().negate().addScaledVector(outward,.42));
  let handAim=aim.clone().sub(world(hand));if(handAim.lengthSq()<1e-6)handAim.copy(bodyForward);else handAim.normalize();
  if(!pose.fireNow&&!compact){const angle=boundedAim(hero.root.rotation.y,Math.atan2(handAim.x,handAim.z));const y=clamp(handAim.y,-.85,.85),horizontal=Math.sqrt(1-y*y);handAim.set(Math.sin(angle)*horizontal,y,Math.cos(angle)*horizontal);}
  const barrel=low.clone().lerp(handAim,raise);
  if(barrel.lengthSq()<1e-6)barrel.copy(bodyForward);
  barrel.addScaledVector(bodyUp,recoil*.16).normalize();
  let vertical=bodyUp.clone().addScaledVector(barrel,-bodyUp.dot(barrel));
  if(vertical.lengthSq()<1e-6)vertical=outward.clone().addScaledVector(barrel,-outward.dot(barrel));
  vertical.normalize();const side=barrel.clone().cross(vertical).normalize();
  const basis=new T.Matrix4().makeBasis(barrel,vertical,side);
  setWorldQ(hand,new T.Quaternion().setFromRotationMatrix(basis.clone().multiply(gripInverse)));
  socket.updateWorldMatrix(true,true);
  const support=compact?0:pose.support;
  if(support>.001&&la&&lf&&lh){
   const oldQ=lh.getWorldQuaternion(new T.Quaternion()),goal=world(lh).lerp(world(secondaryGrip),support);
   solveArm(la,lf,lh,goal,bodyUp.clone().negate().addScaledVector(outward,-.42));
   const gripQ=new T.Quaternion().setFromRotationMatrix(basis.clone().multiply(leftBasis));
   setWorldQ(lh,oldQ.slerp(gripQ,.75*support));
  }
 }


 const legs=['left','right'].map(side=>[findBone(hero.model,side+'upleg'),findBone(hero.model,side+'leg'),findBone(hero.model,side+'foot')]).filter(a=>a.every(Boolean));const legBones=legs.flat(),legBase=legBones.map(b=>b.quaternion.clone());
 const legSolver=createLegSolver(T,hero.root,legs),restFeet=legSolver.entries.map(e=>e.rest);
 const centerX=restFeet.reduce((sum,p)=>sum+p.x,0)/Math.max(1,restFeet.length),gaitDirection=V();
 function resetGait(){gaitDirection.set(0,0,0);}
 function locomotionPose(walkWeight,stanceWeight,phase,actual,speed,dt){
  const weight=Math.max(walkWeight,stanceWeight);if(weight<.001||!legs.length){resetGait();return;}
  hero.root.updateMatrixWorld(true);
  const bodyQ=hero.root.getWorldQuaternion(new T.Quaternion()),forward=dir(hero.root.rotation.y);
  const localMove=actual.clone().applyQuaternion(bodyQ.clone().invert());localMove.y=0;
  if(localMove.lengthSq()<1e-6)localMove.set(0,0,0);else localMove.normalize();
  // Keep the stride direction continuous through a body turn / reversal.
  localMove.x=clamp(localMove.x,-.30,.30);gaitDirection.lerp(localMove,1-Math.exp(-dt*12));
  const feet=legs.map(([, ,foot],i)=>{
   const current=world(foot),q=foot.getWorldQuaternion(new T.Quaternion()),step=gaitStride(phase+i*.5,strideLength(speed));
   const rest=restFeet[i],side=Math.sign(rest.x-centerX)|| (i===0?-1:1);
   const target=rest.clone().addScaledVector(gaitDirection,step.offset*walkWeight);
   target.x+=side*.045*stanceWeight;target.z+=(i===0?.065:-.065)*stanceWeight;
   target.x=side<0?Math.min(centerX-.035,target.x):Math.max(centerX+.035,target.x);
   const p=hero.root.localToWorld(target);
   p.y=height(p.x,p.z)+rest.y+step.lift*Math.min(1,speed/.75)*walkWeight;
   // Blend the target exactly once, before solving the chain.
   p.lerp(current,1-weight);
   return {p,q};
  });
  hero.pivot.position.y-=.11*stanceWeight+.025*walkWeight*(1-stanceWeight);hero.root.updateMatrixWorld(true);
  for(let i=0;i<legs.length;i++)legSolver.solve(i,feet[i].p,feet[i].q,bodyQ,weight);
  if(spine&&stanceWeight>.001){const side=dir(hero.root.rotation.y-Math.PI/2),q=new T.Quaternion().setFromAxisAngle(side,-.15*stanceWeight).multiply(spine.getWorldQuaternion(new T.Quaternion()));setWorldQ(spine,q);}
 }
 function tuckLegs(t){if(t<=0)return;const q=hero.pivot.getWorldQuaternion(new T.Quaternion());for(const [hip,knee,foot] of legs){const a=world(hip),b=world(knee),c=world(foot),l=a.distanceTo(b),m=b.distanceTo(c);const k=a.clone().addScaledVector(V(0,-.35,.94).normalize().applyQuaternion(q),l);pointBone(hip,knee,b.clone().lerp(k,t));const now=world(knee),old=world(foot),f=now.clone().addScaledVector(V(0,-.55,-.84).normalize().applyQuaternion(q),m);pointBone(knee,foot,old.lerp(f,t));}}
 // Preserve the animated foot positions, lower the pelvis, then solve the two-bone legs.
 const spine=findBone(hero.model,'spine'),spineBase=spine?.quaternion.clone();
 const quietHead=[];hero.model.traverse(b=>{if(b.isBone&&/(head|neck)\d*$/i.test(b.name.replace(/[^a-z0-9]/gi,'')))quietHead.push([b,b.quaternion.clone()]);});
 function stabilizeHead(){for(const [bone,q] of quietHead)bone.quaternion.copy(q);}
 const poseLayer=createPoseLayer([...poseBones,...legBones,spine,...quietHead.map(([b])=>b)]);
 return Object.assign(hero,{muzzle,poseGun,poseBones,poseBase,socket,legBones,legBase,tuckLegs,locomotionPose,resetGait,stabilizeHead,spine,spineBase,poseLayer});}

 const fx=createCombatFX(T,scene,height,camera), hero=armed(), pos=hero.root.position, actors=[], projectiles=[], corpses=[], noises=[];
 const input=createPlayerInput(),keys=input.keys,vel=V(),targetVel=V();
 const feedback=createHitFeedback(T,camera,$('#hitfeed')), profiler=createProfiler(renderer,$('#perfstats')), cachedSight=makeSightCache();
 let lastHUD=-Infinity;
 function cycleQuality(){graphics.cycleQuality();}
 function cycleStyle(){graphics.cycleStyle();}
 let locked=false,mode=1,yaw=level.yaw,pitch=-.12,retX=.5,retY=.5,aiming=false,trigger=false,fireBuffer=0,damage=0,kills=0,deaths=0,clock=0,camKick=0,seed=9293;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const flatDist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z), wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 // Grid broadphase: bullets, visibility and navigation share the map collision geometry.
 const grid=new Map(),cell=5,key=(x,z)=>`${Math.floor(x/cell)}:${Math.floor(z/cell)}`;
 for(const c of colliders){const bounds=c.rayBounds||c,x0=bounds.x0??c.x-c.r,x1=bounds.x1??c.x+c.r,z0=bounds.z0??c.z-c.r,z1=bounds.z1??c.z+c.r;for(let x=Math.floor((x0-.75)/cell);x<=Math.floor((x1+.75)/cell);x++)for(let z=Math.floor((z0-.75)/cell);z<=Math.floor((z1+.75)/cell);z++){const k=`${x}:${z}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(c);}}
 function allowed(x,z,r=.32){return Math.abs(x)<level.limit-.35&&Math.abs(z)<level.limit-.35&&!(grid.get(key(x,z))||[]).some(c=>hitsCollider(c,x,z,r));}
 function move(a,dx,dz,r=.32){
 if(dx===0&&dz===0)return 0;
 const p=a.root.position,oldX=p.x,oldZ=p.z,rr=(r+.30)**2;
 const ok=(x,z)=>{if(!allowed(x,z,r)||Math.abs(height(x,z)-height(p.x,p.z))>=Math.hypot(x-p.x,z-p.z)*1.7+.13)return false;
  for(const b of actors){if(b===a||!b.alive)continue;const q=b.root.position,n=(x-q.x)**2+(z-q.z)**2;if(n<rr&&(p.x-q.x)**2+(p.z-q.z)**2>n)return false;}return true;};
 if(dx!==0&&ok(p.x+dx,p.z))p.x+=dx;if(dz!==0&&ok(p.x,p.z+dz))p.z+=dz;p.y=height(p.x,p.z);return Math.hypot(oldX-p.x,oldZ-p.z);
 }
 function obstruction(o,d,max,step=.14){
 const steps=Math.max(1,Math.ceil(max/step)),stride=max/steps;
 let ix=Infinity,iz=Infinity,bucket=[];
 for(let i=0;i<=steps;i++){
  const t=Math.min(max,Math.max(.015,i*stride)),x=o.x+d.x*t,y=o.y+d.y*t,z=o.z+d.z*t,g=height(x,z);
  if(y<g+.025)return Math.max(0,Math.min(t,max-.0002));
  const gx=Math.floor(x/cell),gz=Math.floor(z/cell);
  if(gx!==ix||gz!==iz){ix=gx;iz=gz;bucket=grid.get(gx+':'+gz)||[];}
  for(const c of bucket){if(c.raySlices){if(hitsTreeRay(c,x,y,z,.035))return Math.max(0,Math.min(t,max-.0002));continue;}const top=c.top??(g+(!c.poly&&c.x0!==undefined&&c.x1-c.x0>15&&c.z1-c.z0>10?48:c.poly?3.3:'r'in c?1.3:2.8));if(y<top&&y>g-.1&&hitsCollider(c,x,z,.035))return Math.max(0,Math.min(t,max-.0002));}
 }
 return max;
}
 function clearLine(from,to){const d=to.clone().sub(from),l=d.length();return l<.12||obstruction(from,d.normalize(),l,.32)>=l-.15;}
 function sees(a,b){return !!b?.alive&&cachedSight(a,b,chest(a),chest(b),clock,clearLine);}
 function chest(a){return a.root.position.clone().add(V(0,a.c.roll>0?.56:a.kind==='monster'?.95:1.15-.14*(a.stanceWeight||0),0));}
 const aimCaster=new T.Raycaster(),aimNdc=new T.Vector2();
 function aimRay(){aimNdc.set(mode===1?0:retX*2-1,mode===1?0:1-retY*2);aimCaster.setFromCamera(aimNdc,camera);return aimCaster.ray;}
 function targetHit(o,d,max,owner){let target=null,t=max;for(const a of actors){if(a===owner||!a.alive)continue;const p=a.root.position, rolling=a.c.roll>0;const crouch=a.stanceWeight||0,shapes=rolling?[[.42,.38],[.72,.29]]:[[.43,.29],[.94-.10*crouch,.34],[1.42-.14*crouch,.30]];for(const [y,r] of shapes){const z=sphereHit(o.x,o.y,o.z,d.x,d.y,d.z,p.x,p.y+y,p.z,r,t);if(z<t){target=a;t=z;}}}return {target,t};}
 function getAim(){const ray=aimRay(),wall=obstruction(ray.origin,ray.direction,85,.22),hit=targetHit(ray.origin,ray.direction,wall,hero);return ray.at(hit.t,V());}
 function groundSpawn(a,initial=false){let best=null,bestScore=-Infinity;for(let i=0;i<240;i++){let x,z;if(initial&&a===hero&&i===0){[x,z]=level.spawn;}else if(initial&&a.kind==='bot'){const angle=a.slot*1.047+rnd()*.45,r=12+rnd()*19;x=level.spawn[0]+Math.sin(angle)*r;z=level.spawn[1]+Math.cos(angle)*r;}else if(a.kind==='monster'&&i<150){const angle=rnd()*6.28,r=25+rnd()*38;x=pos.x+Math.sin(angle)*r;z=pos.z+Math.cos(angle)*r;}else{x=(rnd()-.5)*(level.limit*2-5);z=(rnd()-.5)*(level.limit*2-5);}if(!allowed(x,z,.48))continue;const p=V(x,height(x,z),z);let min=100;for(const b of actors)if(b!==a&&b.alive)min=Math.min(min,flatDist(p,b.root.position));if(min<3)continue;let score=initial?-(a===hero?flatDist(p,V(level.spawn[0],0,level.spawn[1])):Math.abs(min-(a.kind==='monster'?17:9))):min;if(!initial){const d=flatDist(p,pos);score=Math.min(min,22)-Math.abs(d-(a===hero?30:a.kind==='monster'?36:29))*.7;if(d<15)score-=45;}if(!initial&&a!==hero&&flatDist(p,pos)<18)score-=45;if(!initial&&a!==hero&&clearLine(pos.clone().add(V(0,1.4,0)),p.clone().add(V(0,1,0))))score-=12;if(score>bestScore){best=p;bestScore=score;}if(initial&&a===hero&&i===0)break;}return best;}
 function reset(a,initial=false){const p=groundSpawn(a,initial);if(!p){a.respawn=1;return false;}a.generation=(a.generation||0)+1;a.poseElapsed=0;a.c=newCombat();a.alive=true;a.respawn=0;a.root.visible=true;a.root.position.copy(p);a.root.rotation.y=a===hero?yaw+Math.PI:rnd()*6.28;a.pivot.rotation.set(0,0,0);a.pivot.scale.setScalar(1);a.pivot.position.y=.88;a.poseLayer?.restore();a.mixer.stopAllAction();a.resetAnimation?.();a.play(a.kind==='monster'?'idle':'__quiet');a.mixer.update(.001);a.poseLayer?.capture();a.resetGait?.();a.sprintExhausted=false;a.idleSeconds=0;a.scanning=false;a.target=null;a.goal=null;a.think=0;a.attack=0;a.hitDone=false;a.alert=0;a.heard=null;a.turn=rnd()<.5?-1:1;a.stuck=0;a.velocity=V();a.rollYaw=0;a.aimPoint=p.clone().add(dir(a.root.rotation.y).multiplyScalar(10)).add(V(0,1.2,0));a.wantAim=false;a.stanceWeight=0;a.walkWeight=0;a.gaitPhase=0;a.gait='idle';a.weaponPose={state:'ready',raise:0,support:0};a.actualSpeed=0;a.actualMove=V();a.inv=0;a.lastAim=null;a.hitTime=0;a.lastNoise=clock;a.lastSeen=null;a.goalTime=0;a.wanderUntil=0;if(a.kind==='monster')a.c.hp=85;return true;}
 function register(a,kind,slot){if(kind==='bot'){const shades=[0xc2c1a0,0xb8c3b2,0xd1b8a6,0xb0c1ce,0xcac5b4,0xb6ba9d];a.model.traverse(o=>{if(!o.isMesh||!o.visible)return;const tint=m=>{if(!m||!/body/i.test(m.name))return m;const copy=m.clone();copy.color.set(shades[slot%shades.length]);return copy;};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);});}a.kind=kind;a.slot=slot;a.alive=false;a.respawn=0;actors.push(a);scene.add(a.root);reset(a,true);return a;}
 register(hero,'player',0);for(let i=0;i<R.botCount;i++)register(armed(),'bot',i);for(let i=0;i<R.monsterCount;i++)register(actor(monsterSrc,1.83,'monster'),'monster',i);
 const graphics=createGraphics(T,{renderer,scene,camera,sun,terrain,actors,height,extraTextures,onChange:label=>{$('#graphicsstatus').textContent=label;}});
 function cameraUpdate(dt,snap=false){const f=dir(yaw),right=f.clone().cross(up),anchor=pos.clone().add(V(0,1.45,0));let desired,look;
 if(mode===1){const distance=aiming?2.7:4.1;const shoulder=aiming?.53:.72;const sight=V(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));desired=anchor.clone().addScaledVector(sight,-distance).addScaledVector(right,-shoulder);desired.y+=.32;look=desired.clone().addScaledVector(sight,20);camera.fov=T.MathUtils.lerp(camera.fov,aiming?55:70,Math.min(1,dt*12));}else{const lens=graphics.overheadLens;look=pos.clone().addScaledVector(f,-1.8).add(V(0,.6,0));desired=look.clone().addScaledVector(f,11.6*lens).add(V(0,12.9*lens,0));const fov=2*Math.atan(Math.tan(47*Math.PI/360)/lens)*180/Math.PI;camera.fov=T.MathUtils.lerp(camera.fov,fov,Math.min(1,dt*10));}
 if(mode===1){const v=desired.clone().sub(anchor),len=v.length();v.normalize();const block=obstruction(anchor,v,len,.13);if(block<len){desired=anchor.clone().addScaledVector(v,Math.max(.7,block-.2));look=desired.clone().add(V(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(20));}}else{const big=colliders.filter(c=>!c.poly&&c.x0!==undefined&&c.x1-c.x0>15&&c.z1-c.z0>10);const inside=(x,z)=>big.some(c=>x>c.x0-1&&x<c.x1+1&&z>c.z0-1&&z<c.z1+1);while(inside(desired.x,desired.z)&&Math.hypot(desired.x-pos.x,desired.z-pos.z)>1){desired.x=T.MathUtils.lerp(desired.x,pos.x,.35);desired.z=T.MathUtils.lerp(desired.z,pos.z,.35);}}
 desired.y=Math.max(desired.y,height(desired.x,desired.z)+.45);if(snap)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*18));camera.lookAt(look);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
 const treeState=(treeBatches||[]).map(({mesh,points})=>({mesh,points,hidden:new Set(),matrices:points.map((_,i)=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);return m;})}));
 const zero=new T.Matrix4().makeTranslation(0,-1000,0);
 function overheadVisibility(){if(mode!==2&&!treeState.some(g=>g.hidden.size))return;const delta=camera.position.clone().sub(pos);const denom=delta.x*delta.x+delta.z*delta.z||1;for(const g of treeState){let dirty=false;for(let i=0;i<g.points.length;i++){const [x,z,s]=g.points[i],t=clamp(((x-pos.x)*delta.x+(z-pos.z)*delta.z)/denom,0,1),distance=Math.hypot(x-pos.x-delta.x*t,z-pos.z-delta.z*t),lineY=pos.y+1.1+(delta.y-1.1)*t;const hide=mode===2&&distance<2.6*s+.5&&lineY<height(x,z)+8.6*s&&lineY>height(x,z)+1.7;if(hide!==g.hidden.has(i)){if(hide){g.mesh.setMatrixAt(i,zero);g.hidden.add(i);}else{g.mesh.setMatrixAt(i,g.matrices[i]);g.hidden.delete(i);}dirty=true;}}if(dirty)g.mesh.instanceMatrix.needsUpdate=true;}}
 const tracerPool=[];
 const tracerGeo=new T.CylinderGeometry(1,1,1,5),tracerMat=new T.MeshBasicMaterial({color:0xffd79a,transparent:true,opacity:.91}),tailMat=new T.MeshBasicMaterial({color:0xe9a65c,transparent:true,opacity:.25,depthWrite:false}),tipGeo=new T.IcosahedronGeometry(.034,0),tipMat=new T.MeshBasicMaterial({color:0xfff4d2});
 function emitNoise(p,source,radius){noises.push({p:p.clone(),source,radius,t:clock});if(noises.length>80)noises.shift();}
 function spawnBullet(a){if(!canFire(a.c))return false;const origin=world(a.muzzle),toward=a.aimPoint.clone().sub(origin);if(toward.lengthSq()<.02)return false;toward.normalize();const focus=fire(a.c);if(focus===null)return false;const cone=spread(focus,a.wantAim,a.velocity.length()),theta=rnd()*Math.PI*2,r=Math.sqrt(rnd())*cone;const side=toward.clone().cross(up).normalize();if(side.lengthSq()<.1)side.set(1,0,0);const vertical=side.clone().cross(toward).normalize(),d=toward.clone().addScaledVector(side,Math.cos(theta)*r).addScaledVector(vertical,Math.sin(theta)*r).normalize();
 fx.muzzle(origin,d);emitNoise(origin,a,47);if(a===hero)camKick=1;
 // Prevent shots through a nearby wall when the gun model clips into it.
 const chestPoint=chest(a),muzzleDir=origin.clone().sub(chestPoint),muzzleDist=muzzleDir.length();if(muzzleDist>.1){const wall=obstruction(chestPoint,muzzleDir.normalize(),muzzleDist,.065);if(wall<muzzleDist-.03){fx.impact(chestPoint.addScaledVector(muzzleDir,wall),d);return true;}}
 let item=tracerPool.pop();if(!item){const g=new T.Group(),core=new T.Mesh(tracerGeo,tracerMat),tail=new T.Mesh(tracerGeo,tailMat),tip=new T.Mesh(tipGeo,tipMat);g.add(tail,core,tip);item={g,core,tail,tip};}const {g,core,tail}=item;g.position.copy(origin);g.quaternion.setFromUnitVectors(up,d);core.visible=tail.visible=false;scene.add(g);projectiles.push(Object.assign(item,{p:origin,d,owner:a,left:R.bulletRange,traveled:0}));return true;}
 function removeBullet(i){const item=projectiles[i];scene.remove(item.g);projectiles.splice(i,1);item.owner=null;if(tracerPool.length<32)tracerPool.push(item);}
 function leaveCorpse(a,d){a.root.updateMatrixWorld(true);const body=cloneRig(a.root);body.visible=true;const pivot=body.children[0];scene.add(body);corpses.push({root:body,pivot,t:0,side:d.dot(dir(a.root.rotation.y+Math.PI/2))>0?-1:1,back:d.dot(dir(a.root.rotation.y))>=0?1:-1,ground:body.position.y});if(corpses.length>22){const old=corpses.shift();scene.remove(old.root);old.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}}
 function kill(a,attacker,d){if(!a.alive)return;a.alive=false;a.c.hp=0;a.respawn=a===hero?5:a.kind==='bot'?10:20+rnd()*20;leaveCorpse(a,d);fx.stain(a.root.position,.46);fx.sound('death',a.root.position);a.root.visible=false;if(attacker===hero&&a!==hero)kills++;if(a===hero){deaths++;trigger=false;fireBuffer=0;aiming=false;reloadRequested=false;touch.reset();input.clear();vel.set(0,0,0);}}
 function hurt(a,amount,d,attacker,point){if(!a.alive||a.inv>0)return;a.c.hp=Math.max(0,a.c.hp-amount);a.c.focus=0;a.c.reload=0;a.c.stagger=a.kind==='monster'?.22:.16;a.hitDir=d.clone();a.hitTime=.28;a.think=0;if(a.kind==='monster'){a.alert=8;a.target=attacker?.alive?attacker:null;a.heard=attacker?.root.position.clone()||point.clone();a.attack=0;}else if(a.kind==='bot'&&attacker?.alive){a.target=attacker;a.alert=6;}
 if(a===hero)damage=1;if(attacker===hero&&a!==hero)feedback.show(a.root.position.clone().add(V(0,a.kind==='monster'?1.95:a.c.roll>0?1.05:1.88-.14*(a.stanceWeight||0),0)),a.c.hp===0);fx.impact(point,d,true);if(a.c.hp===0)kill(a,attacker,d);else if(a.c.roll<=0)move(a,d.x*.12,d.z*.12,.32);}
 function updateBullets(dt){for(let i=projectiles.length-1;i>=0;i--){const b=projectiles[i],dist=Math.min(b.left,R.bulletSpeed*dt),wall=obstruction(b.p,b.d,dist,.075),hit=targetHit(b.p,b.d,wall,b.owner);if(hit.target){const p=b.p.clone().addScaledVector(b.d,hit.t);hurt(hit.target,R.damage,b.d,b.owner,p);removeBullet(i);continue;}if(wall<dist-.0001){fx.impact(b.p.clone().addScaledVector(b.d,wall),b.d);removeBullet(i);continue;}b.p.addScaledVector(b.d,dist);b.left-=dist;b.traveled+=dist;if(b.left<=0){removeBullet(i);continue;}b.g.position.copy(b.p);const len=Math.min(1.25,b.traveled);b.core.visible=b.tail.visible=true;b.core.scale.set(.018,len*.48,.018);b.core.position.y=-len*.24;b.tail.scale.set(.033,len,.033);b.tail.position.y=-len*.5;}}
 function startRoll(a,side){if(!roll(a.c,side))return false;a.rollYaw=a.root.rotation.y;a.rollDir=dir(a.rollYaw-Math.PI/2).multiplyScalar(side);a.velocity.set(0,0,0);fx.sound('roll',a.root.position);return true;}
 function advanceArmed(a,dt,cmd){const c=a.c,oldYaw=a.root.rotation.y;let desired=cmd.aimPoint||a.aimPoint;const delta=desired.clone().sub(a.root.position);if(c.roll<=0&&c.recover<=0&&(Number.isFinite(cmd.faceYaw)||delta.x*delta.x+delta.z*delta.z>.03)){const angle=cmd.faceYaw??Math.atan2(delta.x,delta.z);a.root.rotation.y+=clamp(wrap(angle-oldYaw),-dt*8,dt*8);}a.aimPoint.copy(desired);if(cmd.roll&&(a!==hero||Math.abs(wrap((cmd.faceYaw??Math.atan2(delta.x,delta.z))-a.root.rotation.y))<.4)&&startRoll(a,cmd.roll)&&a===hero)input.consumeRoll();a.wantAim=!!cmd.aim&&!cmd.sprint&&!c.roll&&!c.recover;
 const blocked=c.roll>0||c.recover>0;const target=blocked?V():cmd.move.clone().multiplyScalar(c.stagger>0?.3:c.cd>.47?.52:1);if(a.wantAim&&target.length()>1.12)target.setLength(1.12);a.velocity.lerp(target,1-Math.exp(-dt*16));if(blocked)a.velocity.set(0,0,0);
 const aimDir=a.aimPoint.clone().sub(chest(a)).normalize(),turn=a.lastAim?Math.acos(clamp(a.lastAim.dot(aimDir),-1,1))/dt:0;a.lastAim=aimDir;
  const aimTurn=a===hero?cmd.turn:Math.max(turn,Math.abs(wrap(a.root.rotation.y-oldYaw))/dt);
 const beforeMove=a.root.position.clone();const {travel,loaded}=tickCombat(c,dt,{aim:a.wantAim,speed:a.velocity.length(),turn:aimTurn,sprint:cmd.sprint&&!blocked});if(travel>0){const moved=move(a,a.rollDir.x*travel,a.rollDir.z*travel,.33);/* A blocked step limits travel, not the roll animation or its recovery. */}else if(!blocked)move(a,a.velocity.x*dt,a.velocity.z*dt,.32);if(loaded)fx.sound('reload',a.root.position);if(cmd.reload)reload(c);if(cmd.fire&&canFire(c))c.reload=0;
 const rolling=c.roll>0,progress=rollProgress(c),tuck=rolling?Math.sin(progress*Math.PI):0;
  const actual=a.actualMove.copy(a.root.position).sub(beforeMove);actual.y=0;const measured=actual.length()/dt;a.actualSpeed=approach(a.actualSpeed,blocked?0:measured,dt,18);
  const desiredStance=a.wantAim&&!rolling&&!c.recover?1:0;a.stanceWeight=rolling?0:approach(a.stanceWeight,desiredStance,dt,15);
  const gait=locomotionMode(measured>.04?a.actualSpeed:0,a.wantAim,blocked,!!cmd.sprint);
  a.gait=gait;
  const motion=legacyLocomotion(gait,a.actualSpeed);
  a.walkWeight=a.wantAim&&!blocked&&!rolling?approach(a.walkWeight,motion.procedural?1:0,dt,12):0;
  if(motion.procedural)a.gaitPhase=(a.gaitPhase+.6*measured*dt/strideLength(a.actualSpeed))%1;
  if(!a.wantAim)a.resetGait();
  const activity=idleActivity({commandSpeed:cmd.move.length(),actualSpeed:measured,turnRate:Math.max(Math.abs(aimTurn),Math.abs(wrap(a.root.rotation.y-oldYaw))/dt),
   aim:cmd.aim,zoom:a===hero&&aiming,fire:cmd.fire||c.cd>0,reload:cmd.reload||c.reload>0,roll:rolling||!!cmd.roll,recover:blocked||c.recover>0,hit:c.stagger>0||a.hitTime>0});
  a.idleSeconds=advanceIdle(a.idleSeconds,dt,activity);
  const scanning=a.idleSeconds>=IDLE_DELAY&&!activity,wasScanning=a.scanning;
  a.scanning=scanning;
  const idle=scanning?'idle':'__quiet';
  a.poseLayer.restore();
  // Walk/run use the original run action. Sneak uses the v0.5.7 procedural gait over quiet idle.
  const action=a.play(motion.clip==='run'?'run':idle,false,wasScanning&&!scanning?0:.13);
  if(action)action.timeScale=motion.rate;
 a.hitTime=Math.max(0,(a.hitTime||0)-dt);
 {
 a.pivot.rotation.set(0,0,rolling?c.rollSide*progress*Math.PI*2:0);a.pivot.scale.setScalar(1-.27*tuck);a.pivot.position.y=.88-.33*tuck;
 if(a.hitTime&& !rolling){a.pivot.rotation.x=Math.sin(a.hitTime/.28*Math.PI)*.12;a.pivot.rotation.z=Math.sin(a.hitTime/.28*Math.PI)*.09;}
 a.mixer.update(dt);a.poseLayer.capture();if(!scanning&&!rolling)a.stabilizeHead();a.tuckLegs(tuck);if(!rolling&&!blocked&&a.wantAim)a.locomotionPose(a.walkWeight,a.stanceWeight,a.gaitPhase,actual,a.actualSpeed,dt);
 a.weaponPose=weaponPoseState(c,a.wantAim,a.weaponPose,dt,cmd.fire&&canFire(c)&&!blocked);
 a.poseGun(a.aimPoint,c.recoil,a.weaponPose);}

 if(cmd.fire&&!blocked){if(c.ammo>0){if(spawnBullet(a)&&a===hero)fireBuffer=0;}else{reload(c);if(a===hero)fireBuffer=0;}}}
 function nearestTarget(a,max,requireLOS=true){let best=null,dist=max;const p=chest(a);for(const b of actors){if(!b.alive||b===a||(a.kind==='monster'&&b.kind==='monster'))continue;const d=flatDist(a.root.position,b.root.position);if(d<dist&&(!requireLOS||sees(a,b))){best=b;dist=d;}}return best;}
 function randomGoal(a){const p=a.root.position;for(let i=0;i<36;i++){const angle=rnd()*6.28,r=7+rnd()*19,x=p.x+Math.sin(angle)*r,z=p.z+Math.cos(angle)*r;if(allowed(x,z,.45))return V(x,height(x,z),z);}return p.clone();}
 // Local obstacle steering. Re-evaluate heading to move around trunks, fences, houses.
 function steer(a,goal,speed,dt){if(!goal)return V();const p=a.root.position,dx=goal.x-p.x,dz=goal.z-p.z;if(dx*dx+dz*dz<.45**2)return V();
 const best=steeringChoice(Math.atan2(dx,dz),a.turn,a.stuck,a.velocity,Math.max(.6,speed*.55),p,a,actors,allowed);
 if(!best){a.stuck+=dt;return V();}return V(best.x*speed,0,best.z*speed);
 }
 function botCommand(a,dt){const c=a.c,p=a.root.position;a.think-=dt;a.alert=Math.max(0,a.alert-dt);a.goalTime=(a.goalTime||0)-dt;let target=a.target;
 if(a.think<=0){a.think=.18+rnd()*.14;const seen=nearestTarget(a,33);if(seen&&(!target?.alive||!sees(a,target)||flatDist(p,seen.root.position)<flatDist(p,target.root.position)*.72))target=a.target=seen;if(target?.alive&&sees(a,target)){a.lastSeen=target.root.position.clone();a.alert=4;}else if(!a.alert||!target?.alive)target=a.target=null;}
 const visible=target?.alive&&flatDist(p,target.root.position)<40&&sees(a,target);let motion=V(),aimPoint=p.clone().addScaledVector(dir(a.root.rotation.y),8).add(V(0,1.1,0)),wantAim=false,wantFire=false,wantReload=c.ammo===0,rollSide=0,sprint=false;
 if(visible){const range=flatDist(p,target.root.position),lead=target.velocity||V();aimPoint=chest(target).addScaledVector(lead,range/R.bulletSpeed*.72);wantAim=true;
 // Dodge an observed shot or threatening windup, never read input or teleport.
 if(c.roll<=0&&c.recover<=0&&c.stamina>=R.rollCost&&target.kind!=='monster'&&range<22&&target.c.flash>0&&rnd()<dt*16){rollSide=rnd()<.5?-1:1;}
 if(target.kind==='monster'&&range<5){motion=p.clone().sub(target.root.position);motion.y=0;wantAim=range>=3.5&&c.cd<=.26&&c.reload<=0&&c.ammo>0;motion.normalize().multiplyScalar(wantAim?1.0:2.2);if(target.attack>0&&range<2.4&&rnd()<dt*9)rollSide=rnd()<.5?-1:1;}
 else if(range>21){motion=steer(a,target.root.position,2.3,dt);wantAim=false;}else if(range<6){motion=p.clone().sub(target.root.position);motion.y=0;motion.normalize().multiplyScalar(1.0);}else if(c.cd>.26||c.reload>0){if(a.goalTime<=0){a.goal=p.clone().addScaledVector(dir(a.root.rotation.y+Math.PI/2),a.turn*(3+rnd()*4));a.goalTime=1.1;a.turn=rnd()<.5?-1:1;}motion=steer(a,a.goal,1.65,dt);wantAim=false;}
 wantFire=c.cd<=0&&c.reload<=0&&(c.focus>(range<8?.32:.75)||range<3.5)&&rnd()<dt*(range<6?12:7)&&clearLine(chest(a),chest(target));if(c.ammo<=2&&range>10&&c.cd<=0&&rnd()<dt*.55)wantReload=true;
 }else{if(target?.alive&&a.lastSeen&&a.alert>0){motion=steer(a,a.lastSeen,2.3,dt);}else{if(!a.goal||a.goalTime<=0||flatDist(p,a.goal)<1.4){a.goal=randomGoal(a);a.goalTime=6+rnd()*7;}motion=steer(a,a.goal,1.8,dt);}if(motion.lengthSq()>.1)aimPoint=p.clone().addScaledVector(motion.clone().normalize(),10).add(V(0,1.05,0));wantReload=c.ammo<6;}
 if(a.stuck>1.3){a.turn*=-1;a.goal=randomGoal(a);a.goalTime=2;a.stuck=0;}if(rollSide)wantAim=true;return {move:motion,aimPoint,aim:wantAim,fire:wantFire,reload:wantReload,roll:rollSide,sprint};}
 function updateMonster(a,dt){const c=a.c,p=a.root.position;a.think-=dt;a.alert=Math.max(0,a.alert-dt);c.stagger=Math.max(0,c.stagger-dt);a.hitTime=Math.max(0,(a.hitTime||0)-dt);if(a.think<=0){a.think=.23+rnd()*.15;const heard=noises.filter(n=>clock-n.t<2&&n.t>(a.lastNoise??-1)&&flatDist(p,n.p)<n.radius).sort((x,y)=>flatDist(p,x.p)-flatDist(p,y.p))[0];if(heard){a.lastNoise=heard.t;a.heard=heard.p.clone();a.alert=13;}const seen=nearestTarget(a,a.alert>0?18:5.5);if(seen){a.target=seen;a.alert=9;a.heard=seen.root.position.clone();}else if(!a.target?.alive||!a.alert)a.target=null;}
 let target=a.target,dist=target?.alive?flatDist(p,target.root.position):Infinity;const see=target?.alive&&dist<25&&sees(a,target);if(see)a.heard=target.root.position.clone();if(!a.alert){a.target=null;target=null;}const goal=see?target.root.position:a.alert>0?a.heard:null;
 if(c.stagger>0){a.attack=0;a.play('idle');a.velocity.set(0,0,0);}else if(a.attack>0){a.attack-=dt;a.velocity.set(0,0,0);if(a.attack<.43&&!a.hitDone){a.hitDone=true;if(target?.alive&&dist<1.9&&clearLine(chest(a),chest(target))){const d=target.root.position.clone().sub(p).normalize();hurt(target,21,d,a,chest(target));}}if(a.attack<=0)a.play('idle');}else if(see&&dist<1.45&&clearLine(chest(a),chest(target))){a.attack=.91;a.hitDone=false;a.root.rotation.y=Math.atan2(target.root.position.x-p.x,target.root.position.z-p.z);a.play('attack',true);fx.sound('monster',p);}else{if(!goal||flatDist(p,goal)<1.3){if(!a.goal||flatDist(p,a.goal)<1.5||clock>(a.wanderUntil||0)){a.goal=randomGoal(a);a.wanderUntil=clock+6+rnd()*7;}}const dest=goal&&flatDist(p,goal)>1.3?goal:a.goal;const speed=goal?2.65:.80,v=steer(a,dest,speed,dt);a.velocity.copy(v);const moved=move(a,v.x*dt,v.z*dt,.34);if(moved<.008&&v.length()>.1)a.stuck+=dt;else a.stuck=Math.max(0,a.stuck-dt);if(a.stuck>1.2){a.turn*=-1;a.stuck=0;a.goal=randomGoal(a);}if(v.lengthSq()>.1)a.root.rotation.y+=clamp(wrap(Math.atan2(v.x,v.z)-a.root.rotation.y),-dt*7,dt*7);a.play(moved>.003?(goal?'run':'walk'):'idle');}
 a.pivot.rotation.set(a.hitTime?Math.sin(a.hitTime/.28*Math.PI)*.12:0,0,0);a.mixer.update(dt);}
 let reloadRequested=false;
 function playerCommand(dt){const mobile=touch.active?touch.state:null,k=mobile?{stance:false,f:0,r:0,sprintKey:false}:playerMotion(keys),stance=mobile?mobile.stance:k.stance,rotate=mode===2?(Number(keys.has('KeyQ'))-Number(keys.has('KeyE'))+(mobile?.rotate||0))*1.45:0;yaw+=rotate*dt;const {f,r}=mergeMotion(k.f,k.r,mobile,stance),c=hero.c,energy=sprintAvailable(c.stamina,hero.sprintExhausted);hero.sprintExhausted=energy.exhausted;const canSprint=!stance&&energy.available&&fireBuffer<=0,magnitude=Math.hypot(f,r),sprint=canSprint&&k.sprintKey&&magnitude>0,speed=mobile?analogSpeed(magnitude,{stance,canSprint}):(sprint?4.7:stance?1.12:2.65)*magnitude;const scale=magnitude>0?speed/magnitude:0;targetVel.set((-Math.sin(yaw)*f+Math.cos(yaw)*r)*scale,0,(-Math.cos(yaw)*f-Math.sin(yaw)*r)*scale);if(!stance)input.consumeRoll();const req=input.rollAt(clock),turn=input.turnRate(dt,rotate),wantsFire=fireBuffer>0,wantsReload=keys.has('KeyR')||reloadRequested;fireBuffer=Math.max(0,fireBuffer-dt);if(wantsReload&&c.cd<=0&&c.roll<=0&&c.recover<=0&&c.stagger<=0)reloadRequested=false;return {move:targetVel,aimPoint:getAim(),faceYaw:mode===1?movementFacing(hero.root.rotation.y,targetVel.x,targetVel.z,stance||wantsFire||c.cd>.20||!!req,yaw+Math.PI):stance||wantsFire||c.cd>.20||req?undefined:movementFacing(hero.root.rotation.y,targetVel.x,targetVel.z,false,0),turn,aim:stance,fire:wantsFire,reload:wantsReload,roll:req,sprint:!!sprint||!!(mobile&&canSprint&&speed>2.65)};}
 function hudUpdate(){const c=hero.c;$('#hp').textContent=Math.ceil(c.hp)+'%';$('#hpfill').style.width=c.hp+'%';$('#staminafill').style.width=c.stamina+'%';$('#ammo').textContent=c.ammo+' / '+(Number.isFinite(c.reserve)?c.reserve:'∞');$('#rounds').textContent=Array.from({length:6},(_,i)=>i<c.ammo?'●':'○').join(' ');$('#score').textContent='Устранено '+kills+' · Смертей '+deaths;$('#wave').textContent='СВОБОДНЫЙ БОЙ / '+actors.filter(a=>a.kind==='bot'&&a.alive).length+' БОТОВ / '+actors.filter(a=>a.kind==='monster'&&a.alive).length+' СУЩЕСТВ';$('#mode').textContent=mode===1?'01 / ИЗ-ЗА ПЛЕЧА':'02 / СВЕРХУ · Q/E';$('#action').textContent=!hero.alive?'':c.roll>0?'УКЛОНЕНИЕ':c.recover>0?'ВОССТАНОВЛЕНИЕ':c.reload>0?'ЗАРЯЖАНИЕ…':c.cd>.1?'ОТДАЧА':hero.wantAim?(c.focus>.98?'ПРИЦЕЛ СВЕДЁН':'СВЕДЕНИЕ '+Math.round(c.focus*100)+'%'):'НАВСКИДКУ';$('#damage').style.opacity=damage*.72;dot.hidden=!locked||!hero.alive;dot.style.left=(mode===1?50:retX*100)+'%';dot.style.top=(mode===1?50:retY*100)+'%';const diameter=reticleDiameter(c,hero.wantAim,hero.velocity.length(),innerHeight,camera.fov);dot.style.width=dot.style.height=diameter+'px';dot.classList.toggle('focused',hero.wantAim&&c.focus>.96);dot.classList.toggle('aiming',hero.wantAim);$('#inputstate').textContent='06.1 · '+(hero.gait||'idle').toUpperCase()+' · '+((touch.active?touch.state.stance:keys.has('Space'))?'СТОЙКА ':hero.sprintExhausted?'ВОССТ. СИЛ ':'ХОДЬБА ')+(keys.has('ArrowLeft')||keys.has('KeyA')?'← ':keys.has('ArrowRight')||keys.has('KeyD')?'→ ':'')+' · '+Math.round(c.focus*100)+'% · '+(c.roll>0?'ПЕРЕКАТ':c.recover>0?'ВОССТ.':input.rollAt(clock)?'ОЖИДАНИЕ':'ГОТОВ');dot.style.setProperty('--focus',c.focus.toFixed(3));$('#respawn').hidden=hero.alive||!locked;$('#respawnTime').textContent=Math.ceil(Math.max(0,hero.respawn));}
 function pause(){hero.idleSeconds=0;locked=false;touch.stop();reloadRequested=false;feedback.clear();input.clear();trigger=aiming=false;fireBuffer=0;menu.hidden=false;hud.hidden=true;dot.hidden=true;$('#respawn').hidden=true;start.textContent='Продолжить';}
 start.onclick=()=>{fx.initAudio();if(touch.selected){if(document.pointerLockElement)document.exitPointerLock();input.clear();touch.start();touch.setView(mode);if(!touchQualityInitialized){if(!graphics.explicitQuality)graphics.setQuality(0);touchQualityInitialized=true;}locked=true;menu.hidden=true;hud.hidden=false;dot.hidden=!hero.alive;return;}try{renderer.domElement.requestPointerLock()?.catch?.(()=>status.textContent='Не удалось захватить мышь.');}catch{status.textContent='Захват мыши недоступен.';}};
 document.addEventListener('pointerlockchange',()=>{if(touch.active)return;locked=document.pointerLockElement===renderer.domElement;if(locked){menu.hidden=true;hud.hidden=false;dot.hidden=!hero.alive;}else pause();});document.addEventListener('pointerlockerror',()=>status.textContent='Браузер не разрешил захват мыши.');
 function lookBy(mx,my){if(!locked||!hero.alive)return;input.lookBy(mode===1?Math.hypot(mx,my)*.0021:Math.hypot(mx/innerWidth,my/innerHeight)*1.8);if(mode===1){yaw-=mx*.0021;pitch=clamp(pitch-my*.0021,-.8,.55);}else{retX=clamp(retX+mx/innerWidth,.025,.975);retY=clamp(retY+my/innerHeight,.025,.975);}}
 function setCamera(next){hero.idleSeconds=0;mode=next;retX=retY=.5;hero.c.focus=0;touch.setView(mode);cameraUpdate(.1,true);overheadVisibility();}
 let touchQualityInitialized=false;
 const touch=createTouchControls({menu,combat:true,onLook:(x,y)=>lookBy(x*1.8,y*1.8),onAction:(name,state)=>{if(name==='pause'){pause();return;}if(name==='camera'){setCamera(3-mode);return;}if(name==='quality'){cycleQuality();return;}if(name==='style'){cycleStyle();return;}if(name==='stats'){profiler.toggle();return;}if(!locked||!hero.alive)return;if(name==='fire')fireBuffer=.20;else if(name==='reload')reloadRequested=true;else if(name==='zoom')aiming=state.zoom;else if(name==='roll')input.requestRoll(state.rollSide,clock);}});
 document.addEventListener('mousemove',e=>{if(!touch.active)lookBy(e.movementX||0,e.movementY||0);});
 document.addEventListener('mousedown',e=>{if(touch.active||!locked||!hero.alive)return;if(e.button===0){trigger=true;fireBuffer=.20;}if(e.button===2){e.preventDefault();aiming=true;}});document.addEventListener('mouseup',e=>{if(touch.active)return;if(e.button===0)trigger=false;if(e.button===2)aiming=false;});document.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('keydown',e=>{if(!locked)return;const code=keyCode(e);if(code==='Escape'&&touch.active){pause();return;}if(['KeyW','KeyA','KeyS','KeyD','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyQ','KeyE'].includes(code))e.preventDefault();if(code==='F2'||code==='F3'||code==='F4'){e.preventDefault();if(!e.repeat){if(code==='F3')profiler.toggle();else if(code==='F2')cycleStyle();else cycleQuality();}return;}if(!hero.alive)return;input.down(code,clock,e.repeat);if(e.repeat)return;if(code==='KeyV'||code==='Digit1'||code==='Digit2'){setCamera(code==='Digit1'?1:code==='Digit2'?2:3-mode);}},true);
 document.addEventListener('keyup',e=>input.up(keyCode(e)),true);window.addEventListener('blur',()=>{if(document.pointerLockElement)document.exitPointerLock();pause();});window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();graphics.resize();});
 // A fixed simulation step keeps hit detection and action timings consistent across frame rates.
 function simulate(dt){clock+=dt;damage=Math.max(0,damage-dt*2.7);camKick=Math.max(0,camKick-dt*7.5);while(noises.length&&clock-noises[0].t>3)noises.shift();for(const a of actors){if(!a.alive){a.respawn-=dt;if(a.respawn<=0&&reset(a)){a.inv=1.5;if(a===hero){yaw=a.root.rotation.y-Math.PI;retX=retY=.5;cameraUpdate(.1,true);}}continue;}a.inv=Math.max(0,a.inv-dt);if(a.kind==='monster')updateMonster(a,dt);else{const old=a.root.position.clone(),cmd=a===hero?playerCommand(dt):botCommand(a,dt);advanceArmed(a,dt,cmd);if(a!==hero){if(flatDist(old,a.root.position)<.005&&cmd.move.length()>.1)a.stuck+=dt;else a.stuck=Math.max(0,a.stuck-dt);}}}
 updateBullets(dt);for(let i=corpses.length-1;i>=0;i--){const b=corpses[i];b.t+=dt;if(!b.settled){const f=clamp(b.t/.48,0,1),s=f*f*(3-2*f);b.pivot.rotation.set(b.back*s*1.40,0,b.side*s*.32);b.pivot.position.y=.88-.60*s;b.root.position.y=b.ground;if(f>=1){b.root.updateMatrixWorld(true);b.root.traverse(o=>{o.matrixAutoUpdate=false;});b.settled=true;}}if(b.t>65){scene.remove(b.root);b.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});corpses.splice(i,1);}}fx.update(dt);}
 const preview=new URLSearchParams(location.search).get('preview')==='1';if(preview&&new URLSearchParams(location.search).get('view')==='top')mode=2;
 cameraUpdate(.1,true);for(const a of actors)if(a.kind!=='monster')a.poseGun(a.aimPoint,0,a.weaponPose);status.textContent='Готово · сборка 06.1 · V — сменить камеру';start.disabled=false;hudUpdate();if(preview){menu.hidden=true;hud.hidden=false;dot.hidden=true;overheadVisibility();}
 const playerRenderPose=createRenderPose(hero.root);
 let last=performance.now(),acc=0;
 renderer.setAnimationLoop(now=>{
  const realDt=Math.max(0,(now-last)/1000),dt=Math.min(.10,realDt);last=now;
  const startSim=performance.now();
  if(locked){
   acc+=dt;cameraUpdate(dt);while(acc>=1/60){
    playerRenderPose.capturePrevious();const generation=hero.generation;
    simulate(1/60);acc-=1/60;
    if(hero.generation!==generation)playerRenderPose.capturePrevious();
   }
   const restorePose=hero.alive;if(restorePose)playerRenderPose.apply(acc*60);
   try {
   cameraUpdate(dt);overheadVisibility();
   if(now-lastHUD>=50){hudUpdate();lastHUD=now;}
   // Reticle stays responsive even while the text HUD updates at 20 Hz.
   const c=hero.c;dot.style.left=(mode===1?50:retX*100)+'%';dot.style.top=(mode===1?50:retY*100)+'%';
   dot.style.width=dot.style.height=reticleDiameter(c,hero.wantAim,hero.velocity.length(),innerHeight,camera.fov)+'px';
   dot.classList.toggle('aiming',hero.wantAim);dot.classList.toggle('focused',hero.wantAim&&c.focus>.96);dot.hidden=!hero.alive;
   $('#damage').style.opacity=damage*.72;
   const q=camera.quaternion.clone(),shake=camKick*camKick;
   camera.rotateX(shake*(mode===1?.025:.009));camera.rotateZ(Math.sin(now*.07)*shake*.007);camera.updateMatrixWorld(true);
   feedback.render(dt);
   const beforeRender=performance.now();profiler.beforeRender();graphics.render(mode,aiming);profiler.afterRender();profiler.sample(realDt,beforeRender-startSim,performance.now()-beforeRender,graphics.label);
   camera.quaternion.copy(q);camera.updateMatrixWorld(true);
   } finally {if(restorePose)playerRenderPose.restore();}
  }else{acc=0;playerRenderPose.capturePrevious();graphics.render(mode,aiming);}
 });
}
