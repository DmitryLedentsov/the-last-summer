export const SWAMP={size:280,limit:130,spawn:[-42,74],yaw:0,title:'Затопленный квартал'};
export const WATER=.04;
export const HOUSES=[
 {model:'house07',x:-69,z:54,w:46,d:11,h:18,rot:Math.PI/2,correction:-22.444203*Math.PI/180},
 {model:'house03',x:-38,z:39,w:24,d:12,h:15,rot:0,correction:0},
 {model:'house02',x:10,z:43,w:21,d:12,h:14,rot:.03,correction:0},
 {model:'house07',x:61,z:8,w:49,d:11,h:19,rot:Math.PI/2,correction:-22.444203*Math.PI/180},
 {model:'house03',x:38,z:-28,w:24,d:12,h:15,rot:0,correction:0},
 {model:'house02',x:-34,z:-38,w:23,d:12,h:15,rot:.05,correction:0}
];
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const routes=[[[-42,95],[-42,64],[-20,58],[11,61],[42,37],[50,5],[42,-14],[26,-26],[-9,-25],[-34,-20],[-45,3],[-42,33],[-42,64]],[[42,-14],[72,-19],[91,-42],[105,-69]],[[-45,3],[-74,-6],[-100,-28]],[[-9,-25],[-9,-62],[8,-90]]];
const segments=routes.flatMap(r=>r.slice(1).map((b,i)=>[r[i],b]));
function segdist(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
export function roadDistance(x,z){return Math.min(...segments.map(([a,b])=>segdist(x,z,a,b)));}
export function buildingDistance(x,z){return Math.min(...HOUSES.map(h=>{const c=Math.cos(h.rot),s=Math.sin(h.rot),dx=x-h.x,dz=z-h.z;return Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-h.w/2),Math.max(0,Math.abs(s*dx+c*dz)-h.d/2));}));}
export function swampHeight(x,z){let y=-.30+.44*Math.sin(x*.064+z*.035)+.32*Math.cos(z*.085-x*.05)+.19*Math.sin(x*.26+z*.14)+.13*Math.cos(x*.43-z*.32);y-=.70*Math.exp(-((x-2)**2+(z-7)**2)/850)+.5*Math.exp(-((x+69)**2+(z+59)**2)/920);y+=.48*Math.exp(-((x-97)**2+(z+63)**2)/1100);const r=roadDistance(x,z),b=buildingDistance(x,z);y=y*(smooth(2.6,9,r))+.48*(1-smooth(2.6,9,r));const p=1-smooth(2,7,b);return y*(1-p)+.58*p;}
export function roadMask(x,z){return 1-smooth(2.1,3.8,roadDistance(x,z));}
export function canWade(height,x,z){return height(x,z)>=WATER-.62;}
export function reserve(x,z){return roadDistance(x,z)<4.2||buildingDistance(x,z)<3||Math.hypot(x-SWAMP.spawn[0],z-SWAMP.spawn[1])<4;}
