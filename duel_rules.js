// Gameplay units, not real-world weapon ballistics. Pure, deterministic rules shared by all armed actors.
export const RULES=Object.freeze({hp:100,capacity:6,shotInterval:.65,focusTime:1.2,rollTime:.52,recoverTime:.25,rollDistance:2.35,rollCost:33,roundTime:.53,bulletSpeed:82,bulletRange:85,damage:35,botCount:6,monsterCount:12});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function newCombat(){return {hp:100,ammo:6,reserve:Infinity,stamina:100,focus:0,cd:0,reload:0,roll:0,rollSide:0,recover:0,regenDelay:0,recoil:0,flash:0,stagger:0};}
export function canFire(c){return c.hp>0&&c.cd<=0&&c.roll<=0&&c.recover<=0&&c.stagger<=0&&c.ammo>0;}
export function fire(c){if(!canFire(c))return null;const focus=c.focus;c.ammo--;c.cd=RULES.shotInterval;c.reload=0;c.focus=0;c.recoil=1;c.flash=.065;return focus;}
export function reload(c){if(c.hp<=0||c.roll>0||c.recover>0||c.stagger>0||c.cd>0||c.ammo>=6||c.reserve<=0||c.reload>0)return false;c.reload=RULES.roundTime;c.focus=0;return true;}
export function roll(c,side){if(c.hp<=0||c.roll>0||c.recover>0||c.stagger>0||c.cd>.38||c.stamina<RULES.rollCost||Math.abs(side)!==1)return false;c.roll=RULES.rollTime;c.rollSide=side;c.stamina-=RULES.rollCost;c.regenDelay=1;c.reload=0;c.focus=0;return true;}
export function rollProgress(c){return clamp(1-c.roll/RULES.rollTime,0,1);}
export function rollTravel(p){return p*p*(3-2*p);}
export function tickCombat(c,dt,{aim=false,speed=0,turn=0,sprint=false}={}){c.cd=Math.max(0,c.cd-dt);c.recoil=Math.max(0,c.recoil-dt*4.1);c.flash=Math.max(0,c.flash-dt);c.stagger=Math.max(0,c.stagger-dt);c.regenDelay=Math.max(0,c.regenDelay-dt);c.recover=Math.max(0,c.recover-dt);
 let travel=0,loaded=false;if(c.roll>0){const a=rollProgress(c);c.roll=Math.max(0,c.roll-dt);travel=(rollTravel(rollProgress(c))-rollTravel(a))*RULES.rollDistance;if(!c.roll)c.recover=RULES.recoverTime;}
 if(c.reload>0){c.reload=Math.max(0,c.reload-dt);if(!c.reload&&c.ammo<6&&c.reserve>0){c.ammo++;c.reserve--;loaded=true;if(c.ammo<6&&c.reserve>0)c.reload=RULES.roundTime;}}
 if(sprint&&speed>1&&c.roll<=0){c.stamina=Math.max(0,c.stamina-15*dt);c.regenDelay=.7;}else if(!c.regenDelay&&c.roll<=0)c.stamina=Math.min(100,c.stamina+23*dt);
 if(aim&&speed<1.25&&turn<1.1&&c.cd<=.05&&!c.roll&&!c.recover&&!c.reload&&!c.stagger){c.focus=Math.min(1,c.focus+dt/RULES.focusTime*(speed>.25?.56:1));}else c.focus=Math.max(0,c.focus-dt*(turn>2||sprint?6:3));
 return {travel,loaded};}
export function spread(focus,aim,speed){return (aim?(.004+.068*(1-focus)**1.8):.105)+Math.min(speed,5)*.007;}
// segment against sphere; returns distance along unit direction, or Infinity.
export function sphereHit(ox,oy,oz,dx,dy,dz,cx,cy,cz,r,max){const x=ox-cx,y=oy-cy,z=oz-cz,b=x*dx+y*dy+z*dz,c=x*x+y*y+z*z-r*r;if(c<=0)return 0;const disc=b*b-c;if(disc<0)return Infinity;const t=-b-Math.sqrt(disc);return t>=0&&t<=max?t:Infinity;}
