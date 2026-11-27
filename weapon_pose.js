// Pure animation state and stable direction math. No input or combat rule changes.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function weaponPoseState(c,stance,previous,dt,fireNow=false){
 const state=c.roll>0?'roll':c.recover>0?'recover':c.reload>0?'reload':fireNow||c.cd>.20?'fire':stance?'aim':'ready';
 const target=state==='fire'||state==='aim'?1:0;
 const raise=fireNow?1:previous.raise+(target-previous.raise)*(1-Math.exp(-dt*12));
 const supportTarget=state==='aim'||(state==='fire'&&stance)?1:0;
 const support=previous.support+(supportTarget-previous.support)*(1-Math.exp(-dt*14));
 return {state,raise,support,fireNow};
}
export function boundedAim(yaw,desired,maxAngle=Math.PI*.42){
 const delta=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
 return yaw+clamp(delta,-maxAngle,maxAngle);
}
export function poseReach(raise,state){
 if(state==='roll'||state==='recover')return .47;
 if(state==='reload')return .53;
 return .57+.30*clamp(raise,0,1);
}

// Independent, upper-body-only magazine exchange. All offsets are in metres.
export function reloadMotion(p){
 p=clamp(p,0,1);const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
 if(p<.18){const k=ease(p/.18);return {hand:k,hip:0,offset:0,tilt:k,visible:false};}
 if(p<.36)return {hand:1,hip:0,offset:.095*ease((p-.18)/.18),tilt:1,visible:true};
 if(p<.52)return {hand:1,hip:ease((p-.36)/.16),offset:.095,tilt:1,visible:false};
 if(p<.68)return {hand:1,hip:1-ease((p-.52)/.16),offset:.095,tilt:1,visible:false};
 if(p<.86)return {hand:1,hip:0,offset:.095*(1-ease((p-.68)/.18)),tilt:1,visible:true};
 const k=1-ease((p-.86)/.14);return {hand:k,hip:0,offset:0,tilt:k,visible:false};
}
