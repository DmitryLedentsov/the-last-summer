export const SWAMP={size:280,segments:336,limit:130,spawn:[-42,66],yaw:0,title:'Затопленный квартал'};
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
 // Natural peat banks and hollows, without rock cliffs. Multiple independent noise scales.
 let y=.05+1.25*(coverNoise(x,z,29)-.5)+.78*(coverNoise(x+57,z-27,12)-.5)
  +.39*(coverNoise(x-20,z+16,4.6)-.5)+.12*(coverNoise(x+11,z+77,1.8)-.5);
 const banks=[[-54,73,13,1.55],[-17,50,12,1.35],[26,33,14,1.8],[-34,-3,15,1.7],
  [48,-12,16,1.4],[83,-57,19,1.8],[-84,-25,19,2.1],[-13,-67,16,1.55],[106,82,21,1.8],[-95,92,17,1.6]];
 for(const [a,b,r,d] of banks)y+=d*Math.exp(-((x-a)**2+(z-b)**2)/(r*r));
 const pools=[[3,7,18,1.02],[-69,-59,21,.98],[37,81,17,.76],[-86,34,13,.83],[74,-36,20,.96],[-12,-91,16,.91],[102,49,17,.87],[-41,14,12,.85]];
 for(const [a,b,r,d] of pools)y-=d*Math.exp(-((x-a)**2+(z-b)**2)/(r*r));
 // Paths follow the land instead of flattening it, rising only where necessary.
 const r=roadDistance(x,z),b=buildingDistance(x,z);
 y+=(Math.max(WATER+.20,y)-y)*(1-smooth(.9,5.0,r));
 // Flat foundations only beneath the actual buildings; blend into the adjacent bog.
 const p=1-smooth(.8,8.0,b);return y*(1-p)+.42*p;
}
export function roadMask(x,z){return 1-smooth(.65,1.8,roadDistance(x,z));}
export function canWade(height,x,z){return height(x,z)>=WATER-.62;}
export function treeGrove(x,z){return .72*coverNoise(x+137,z-83,24)+.28*coverNoise(x-37,z+18,10);}
export function reserve(x,z){return roadDistance(x,z)<.85||buildingDistance(x,z)<.55||Math.hypot(x-SWAMP.spawn[0],z-SWAMP.spawn[1])<1.6;}

// Deterministic non-periodic cover patches: open muddy spots and continuous grass groups.
function coverNoise(x,z,size){
 const i=Math.floor(x/size),j=Math.floor(z/size),u=smooth(0,1,x/size-i),v=smooth(0,1,z/size-j);
 const hash=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;
}
export function marshCover(x,z){return .67*coverNoise(x,z,9)+.23*coverNoise(x,z,3.2)+.10*coverNoise(x,z,1.3);}
