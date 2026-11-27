// Cosmetic responses only. No hitstop, damage, movement, spread, or fire-rate changes.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const IMPACT_TIME=.44;
export function impactMotion(age,localX,localZ,height=1){
 const t=clamp(age/IMPACT_TIME,0,1),k=t<.11?ease(t/.11):Math.exp(-5*(t-.11))*Math.cos((t-.11)*5)*(1-t);
 const amp=clamp(.24+(height-.8)*.1,.20,.34)*k;
 return {pitch:localZ*amp,roll:-localX*amp,twist:localX*.12*k};
}
export function recoilMotion(age){if(age<0||age>=.36)return 0;return age<.045?ease(age/.045):Math.exp(-(age-.045)*13)*(1-ease((age-.045)/.315));}
export function fallMotion(age,duration=.69){const t=clamp(age/duration,0,1),drop=ease(t),tilt=Math.pow(t,1.35);return {tilt,drop,settled:t>=1,bounce:t>.77?Math.sin((t-.77)/.23*Math.PI)*.035:0};}
export function fallDirection(dx,dz,vx,vz,yaw){
 let x=dx+vx*.13,z=dz+vz*.13,n=Math.hypot(x,z);if(n<.001){x=Math.sin(yaw);z=Math.cos(yaw);n=1;}
 return {x:x/n,z:z/n};
}
export function impactSurface(c){if(!c)return 'ground';if(c.surface)return c.surface;if(c.raySlices||c.poly)return 'wood';return 'concrete';}
