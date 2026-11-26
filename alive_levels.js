import {levels as old} from './levels.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mound=(x,z,cx,cz,w,h)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/w**2);
const mix=(a,b,t)=>a+(b-a)*t;
const ripple=(x,z)=>.28*Math.sin(x*.32+z*.19)+.15*Math.cos(z*.46-x*.23)+.09*Math.sin(x*.77+z*.66);
const seg=(x,z,ax,az,bx,bz)=>{let dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz));return Math.hypot(x-ax-t*dx,z-az-t*dz);};
const path=(pts,x,z)=>Math.min(...pts.slice(1).map((p,i)=>seg(x,z,...pts[i],...p)));
const rect=(x,z,cx,cz,rx,rz)=>Math.hypot(Math.max(0,Math.abs(x-cx)-rx),Math.max(0,Math.abs(z-cz)-rz));
const sunsetMain=[[-4,80],[-2,43],[2,25],[-3,12],[-10,-4],[-8,-18],[0,-28],[10,-33],[16,-35],[22,-31],[27,-30]];
const sunsetBranch=[[-10,-4],[-21,-11],[-31,-20],[-37,-34],[-41,-55],[-42,-80]];
const sunsetRoad=[[-85,-11],[-43,-11],[-17,-13],[10,-16],[30,-15],[85,-15]];
const mistMain=[[1,70],[-3,42],[-5,29],[-1,16],[-6,2],[-10,-8],[-11.4,-20],[-11.4,-25],[-11.4,-32],[-5,-50],[0,-70]];
const mistBranch=[[-6,2],[4,0],[7,8],[7.5,10],[7,15],[9,26],[-5,29]];
const mistRail=z=>Math.abs(z+25);
export const pond={x:26,z:10,rx:17,rz:13,y:-1.05};
export const pondDistance=(x,z)=>Math.hypot((x-pond.x)/pond.rx,(z-pond.z)/pond.rz);
export const houseSite={x:43,z:-48,y:1.4,h:47};
export const levels={
 sunset:{...old.sunset,size:180,limit:80,seed:631,spawn:[-2,43],yaw:-.23,trees:270,grassCount:12500,density:.0105,sunPos:[-68,27,-75],trailWidth:1.15,
  distance:(x,z)=>Math.min(path(sunsetMain,x,z),path(sunsetBranch,x,z)),road:(x,z)=>path(sunsetRoad,x,z),
  height(x,z){let h=ripple(x,z)+mound(x,z,-26,9,22,5.6)+mound(x,z,19,27,24,3.9)+mound(x,z,-35,-44,24,5)-mound(x,z,10,-25,22,2.3);h=mix(h,1.05,1-smooth(1.3,7,this.road(x,z)));h=mix(h,houseSite.y,1-smooth(0,9,rect(x,z,houseSite.x,houseSite.z,25,15)));return h;},
  treeZone(x,z){return clamp(.22+.60*Math.exp(-((x+26)**2+(z-8)**2)/1100)+.55*Math.exp(-((x-25)**2+(z-35)**2)/700)+.65*Math.exp(-((x+39)**2+(z+47)**2)/900)+.16*Math.sin(x*.19+z*.1));},
  reserved(x,z){return rect(x,z,houseSite.x,houseSite.z,25,15)<1||this.road(x,z)<2.7||Math.hypot(x+15,z-15)<3.3;}
 },
 mist:{...old.mist,size:144,limit:63,seed:196,spawn:[-5,37],yaw:.10,trees:160,grassCount:11000,density:.0195,trailWidth:1.25,
  distance:(x,z)=>Math.min(path(mistMain,x,z),path(mistBranch,x,z)),road:(x,z)=>mistRail(z),
  height(x,z){let h=ripple(x,z)*.7+mound(x,z,-36,2,22,3.1)+mound(x,z,35,-37,20,2.8)+mound(x,z,-26,47,18,1.8);const d=pondDistance(x,z);h=mix(h,pond.y-1.4+1.4*smooth(.57,1,d),1-smooth(1,1.23,d));h=mix(h,.45,1-smooth(2.1,6.5,mistRail(z)));return h;},
  treeZone(x,z){return clamp(.18+.62*Math.exp(-((x+28)**2+(z-10)**2)/650)+.55*Math.exp(-((x-35)**2+(z+35)**2)/750)+.5*Math.exp(-((x-8)**2+(z-48)**2)/500)+.18*Math.sin(x*.2-z*.15));},
  reserved(x,z){return pondDistance(x,z)<1.12||mistRail(z)<3.1||(x>-27&&x<-13&&z>-24&&z<-13)||Math.hypot(x-7,z+12)<3.5;}
 }
};
export function pathWeight(level,x,z){return 1-smooth(level.trailWidth*.62,level.trailWidth+1.0,level.distance(x,z)+.23*Math.sin(z*1.7+x*.8));}
