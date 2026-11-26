// Fixed-step locomotion and presentation helpers. No Three or DOM dependency.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export function analogSpeed(magnitude,{stance=false,canSprint=true}={}){
 const m=clamp(magnitude,0,1);if(stance)return 1.12*m;
 const walk=2.65*Math.min(1,m/.72);
 return walk+(canSprint?(4.7-2.65)*smooth((m-.72)/.28):0);
}
export function approach(current,target,dt,rate){return current+(target-current)*(1-Math.exp(-dt*rate));}
export function strideLength(speed){return clamp(.24+speed*.19,.28,.66);}
export function gaitStride(phase,stride){
 const p=((phase%1)+1)%1;
 if(p<.6)return {offset:stride*(.5-p/.6),lift:0};
 const t=(p-.6)/.4;return {offset:stride*(smooth(t)-.5),lift:Math.sin(Math.PI*t)*.13};
}
export function rollPose(progress){
 const p=clamp(progress,0,1),curl=smooth(p/.24)*(1-smooth((p-.68)/.32));
 return {angle:Math.PI*2*smooth((p-.08)/.84),height:.88-.43*curl,tuck:curl};
}
export function movementFacing(yaw,dx,dz,aim,aimYaw){
 if(aim)return aimYaw;return dx*dx+dz*dz>.04?Math.atan2(dx,dz):yaw;
}
