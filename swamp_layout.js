export const SWAMP={size:280,limit:130,spawn:[-42,66],yaw:0,title:'Затопленный квартал'};
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
// Broken footpaths through the marsh, not a street network.
const routes=[[[-42,95],[-42,66],[-34,54],[-21,49],[-12,35],[0,19],[15,11],[29,3],[48,4]],[[0,19],[-14,4],[-27,-10],[-35,-23],[-23,-39],[-17,-64]],[[-12,35],[0,43],[25,52],[41,34],[49,23]],[[29,3],[32,-12],[24,-25],[17,-41],[36,-61],[61,-70],[83,-63],[96,-63]],[[-27,-10],[-53,-3],[-77,-15],[-100,-28]]];
const segments=routes.flatMap(r=>r.slice(1).map((b,i)=>[r[i],b]));
function segdist(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
export function roadDistance(x,z){return Math.min(...segments.map(([a,b])=>segdist(x,z,a,b)));}
export function buildingDistance(x,z){return Math.min(...HOUSES.map(h=>{const c=Math.cos(h.rot),s=Math.sin(h.rot),dx=x-h.x,dz=z-h.z;return Math.hypot(Math.max(0,Math.abs(c*dx-s*dz)-h.w/2),Math.max(0,Math.abs(s*dx+c*dz)-h.d/2));}));}
export function swampHeight(x,z){
 // Broad hummocks, peat hollows and pools; no cliffs or mountain features.
 let y=.14+.22*Math.sin(x*.078+z*.041)+.18*Math.cos(z*.106-x*.06)+.12*Math.sin(x*.31+z*.16)+.07*Math.cos(x*.53-z*.39);
 const pools=[[3,7,18,.84],[-69,-59,21,.80],[37,81,17,.64],[-86,34,13,.67],[74,-36,20,.76],[-12,-91,16,.72],[102,49,17,.65],[-41,14,12,.64]];
 for(const [a,b,r,d] of pools)y-=d*Math.exp(-((x-a)**2+(z-b)**2)/(r*r));
 const r=roadDistance(x,z),b=buildingDistance(x,z);
 y=y*smooth(.85,4.2,r)+.24*(1-smooth(.85,4.2,r));
 const p=1-smooth(1.0,4.5,b);return y*(1-p)+.32*p;
}
export function roadMask(x,z){return 1-smooth(.65,1.8,roadDistance(x,z));}
export function canWade(height,x,z){return height(x,z)>=WATER-.62;}
export function reserve(x,z){return roadDistance(x,z)<.85||buildingDistance(x,z)<.55||Math.hypot(x-SWAMP.spawn[0],z-SWAMP.spawn[1])<1.6;}

// Deterministic non-periodic cover patches: open muddy spots and continuous grass groups.
function coverNoise(x,z,size){
 const i=Math.floor(x/size),j=Math.floor(z/size),u=smooth(0,1,x/size-i),v=smooth(0,1,z/size-j);
 const hash=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;
}
export function marshCover(x,z){return .67*coverNoise(x,z,9)+.23*coverNoise(x,z,3.2)+.10*coverNoise(x,z,1.3);}
