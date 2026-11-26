// An ambient idle is a deliberate action, never a locomotion or combat base.
export const IDLE_DELAY=2;
export function idleActivity({commandSpeed=0,actualSpeed=0,turnRate=0,aim=false,zoom=false,fire=false,reload=false,roll=false,recover=false,hit=false}={}){
 return commandSpeed>.025||actualSpeed>.08||Math.abs(turnRate)>.12||aim||zoom||fire||reload||roll||recover||hit;
}
export function advanceIdle(elapsed,dt,activity){
 const next=elapsed+Math.max(0,dt);return activity?0:next>=IDLE_DELAY-1e-9?IDLE_DELAY:next;
}
// Static, authored idle sample. Head/neck quaternion comes from the rig's neutral
// rest pose, so even an idle clip that opens mid-scan cannot turn the head.
export function makeQuietIdle(T,clip,model){
 const tracks=clip.tracks.map(track=>{
  const copy=track.clone(),size=track.getValueSize();
  let sample=Array.from(track.values.slice(0,size));
  if(track.name.endsWith('.quaternion')){
   const boneName=track.name.slice(0,-11);
   const bone=model.getObjectByName(boneName);
   if(bone&&/(head|neck)\d*$/i.test(bone.name.replace(/[^a-z0-9]/gi,'')))sample=bone.quaternion.toArray();
  }
  copy.times=new Float32Array([0,1]);copy.values=new Float32Array([...sample,...sample]);return copy;
 });
 return new T.AnimationClip('__quiet',1,tracks);
}
