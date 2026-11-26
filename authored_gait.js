// Original, rig-specific locomotion. No third-party motion clips.
// Bake at authoring time (or use on a dedicated clone of the hero FBX).
import {createLegSolver,legReach} from './leg_ik.js';
export const GAITS=Object.freeze({
 walk:Object.freeze({duration:1.04,support:.62,span:.83,lift:.065,lower:.025,bob:.012,pitch:.055,swing:.16}),
 sneak:Object.freeze({duration:1.42,support:.73,span:.49,lift:.040,lower:.15,bob:.004,pitch:.15,swing:.035})
});
export function footCycle(phase,profile){
 const p=((phase%1)+1)%1,s=profile.support;
 if(p<s)return {z:profile.span*(.5-p/s),lift:0,pitch:0};
 const t=(p-s)/(1-s);
 // Swing: quintic easing, zero lift and pitch at either contact.
 const e=t*t*t*(10+t*(-15+6*t)),h=Math.sin(Math.PI*t);
 return {z:profile.span*(e-.5),lift:profile.lift*h*h,pitch:.20*Math.sin(2*Math.PI*t)*h};
}
export function bakeAuthoredGaits(T,model){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion(),W=o=>o.getWorldPosition(V()),G=o=>o.getWorldQuaternion(Q());
 const all=[];let skin;model.traverse(b=>{if(b.isBone)all.push(b);if(b.isSkinnedMesh&&!skin)skin=b;});
 if(!skin)throw Error('Missing hero skeleton');
 const original=all.map(b=>({p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
 const idle=model.animations.find(c=>/idle/i.test(c.name));if(!idle)throw Error('Missing original idle');
 // The FBX loads in an asymmetrical animated pose, not the bind pose.
 skin.skeleton.pose();model.updateMatrixWorld(true);
 const bind=all.map(b=>b.quaternion.clone());
 const restore=(neutral=false)=>{all.forEach((b,i)=>{b.position.copy(original[i].p);b.quaternion.copy(neutral?bind[i]:original[i].q);b.scale.copy(original[i].s)});model.updateMatrixWorld(true);};
 restore(true);
 const bone=n=>model.getObjectByName('mixamorig'+n),hip=bone('Hips'),spine=bone('Spine'),spine1=bone('Spine1'),spine2=bone('Spine2');
 const legs=['Left','Right'].map(s=>[bone(s+'UpLeg'),bone(s+'Leg'),bone(s+'Foot')]),toes=['Left','Right'].map(s=>bone(s+'ToeBase'));
 const hipScale=hip.parent.getWorldScale(V()).y;
 const L=legs[0].slice(0,2).reduce((n,b,i)=>n+W(b).distanceTo(W(legs[0][i+1])),0);
 hip.position.y-=Math.min(...toes.map(b=>W(b).y))/hipScale;model.updateMatrixWorld(true);
 const neutralHip=hip.position.clone(),feet=legs.map(l=>W(l[2])),footQ=legs.map(l=>G(l[2])),toeOffsets=toes.map((t,i)=>W(t).sub(feet[i]));
 const center=feet[0].clone().add(feet[1]).multiplyScalar(.5);
 // Calibrate on neutral rig; constrain each knee to the forward sagittal plane.
 const solver=createLegSolver(T,model,legs,{forwardOnly:true});
 const swingArm=bone('LeftArm'),fore=bone('LeftForeArm'),hand=bone('LeftHand');
 const controlled=[hip,spine,spine1,spine2,...legs.flat(),...toes,swingArm,fore,hand].filter(Boolean);
 const baseArm=[swingArm,fore,hand].map(b=>original[all.indexOf(b)].q.clone());
 const out=[],metrics=[];
 for(const [name,profile] of Object.entries(GAITS)){
  const N=Math.ceil(profile.duration*48),times=Array.from({length:N+1},(_,i)=>i/N*profile.duration),rot=new Map(controlled.map(b=>[b.name,[]])),pos=[];
  let minPole=1,minBend=180,maxBend=0,minGap=Infinity,minToe=Infinity,maxToe=0,maxDelta=0,minHip=Infinity,maxHip=-Infinity,previous=null;
  for(let f=0;f<=N;f++){
   const phase=f===N?0:f/N;
   restore(true);hip.position.copy(neutralHip);
   hip.position.y+=L*(-profile.lower+profile.bob*Math.cos(4*Math.PI*phase))/hipScale;
   const hipYaw=.035*Math.sin(2*Math.PI*phase),hipRoll=.018*Math.sin(2*Math.PI*phase);
   hip.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(0,hipYaw,hipRoll)));
   spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),profile.pitch));
   spine2.quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),-hipYaw*.7));
   [swingArm,fore,hand].forEach((b,i)=>b.quaternion.copy(baseArm[i]));
   model.updateMatrixWorld(true);
   const swing=profile.swing*Math.cos(2*Math.PI*phase);
   swingArm.quaternion.copy(G(swingArm.parent).invert().multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),swing).multiply(G(swingArm))));
   model.updateMatrixWorld(true);
   const goals=[],qs=[];
   for(let i=0;i<2;i++){
    const step=footCycle(phase+i*.5,profile),pitch=new T.Quaternion().setFromAxisAngle(V(1,0,0),step.pitch),fq=pitch.clone().multiply(footQ[i]);
    const toe=toeOffsets[i].clone().applyQuaternion(pitch);
    // Keep feet at natural width, below their own hips. Travel is along +Z.
    goals.push(V(center.x+(feet[i].x-center.x)*.78,step.lift*L-toe.y,center.z+step.z*L));qs.push(fq);
   }
   let lower=0;
   for(let i=0;i<2;i++){const [h,k,f]=legs[i],a=W(h),l=a.distanceTo(W(k)),m=W(k).distanceTo(W(f)),r=legReach(l,m,l+m),d=goals[i].clone().sub(a);lower=Math.max(lower,-d.y-Math.sqrt(Math.max(0,r*r-d.x*d.x-d.z*d.z)));}
   hip.position.y-=Math.max(0,lower)/hipScale;model.updateMatrixWorld(true);
   for(let i=0;i<2;i++)if(!solver.solve(i,goals[i],qs[i],Q()))throw Error('Leg target failed');
   model.updateMatrixWorld(true);
   const floor=Math.min(...toes.map(t=>W(t).y));if(floor<0){hip.position.y-=floor/hipScale;model.updateMatrixWorld(true);}
   pos.push(...hip.position.toArray());
   for(const b of controlled){const a=rot.get(b.name),q=b.quaternion.clone();if(a.length&&q.dot(Q().fromArray(a,a.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);a.push(...q.toArray());}
   const current=legs.flat().map(b=>b.quaternion.clone());if(previous)current.forEach((q,i)=>maxDelta=Math.max(maxDelta,q.angleTo(previous[i])));previous=current;
   minHip=Math.min(minHip,W(hip).y);maxHip=Math.max(maxHip,W(hip).y);minGap=Math.min(minGap,W(legs[0][2]).x-W(legs[1][2]).x);
   for(let i=0;i<2;i++){const [h,k,f]=legs[i],u=W(k).sub(W(h)),v=W(f).sub(W(k)),axis=W(f).sub(W(h)).normalize(),pole=u.clone().addScaledVector(axis,-u.dot(axis)).normalize(),fw=V(0,0,1).addScaledVector(axis,-axis.z).normalize(),angle=u.angleTo(v)*180/Math.PI;minPole=Math.min(minPole,pole.dot(fw));minBend=Math.min(minBend,angle);maxBend=Math.max(maxBend,angle);minToe=Math.min(minToe,W(toes[i]).y);maxToe=Math.max(maxToe,W(toes[i]).y);}
  }
  const override=new Set([...controlled.map(b=>b.name+'.quaternion'),hip.name+'.position']);
  const tracks=idle.tracks.filter(t=>!override.has(t.name)).map(t=>{const c=t.clone(),v=Array.from(t.values.slice(0,t.getValueSize()));c.times=new Float32Array([0,profile.duration]);c.values=new Float32Array([...v,...v]);return c;});
  tracks.push(new T.VectorKeyframeTrack(hip.name+'.position',times,pos));
  for(const b of controlled)tracks.push(new T.QuaternionKeyframeTrack(b.name+'.quaternion',times,rot.get(b.name)));
  const clip=new T.AnimationClip(name,profile.duration,tracks);if(!clip.validate())throw Error('Invalid authored clip');
  out.push(clip);metrics.push({name,frames:N+1,minPole,minBend,maxBend,minGap,minToe,maxToe,minHip,maxHip,maxDelta,legLength:L});
 }
 restore(false);return {clips:out,metrics};
}
