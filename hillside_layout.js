// Independent terrain and road plan for "Лес за городом". Units are metres.
export const HILLSIDE={size:240,limit:108,spawn:[-51,67],yaw:0,summit:[60,-67],houses:[
 {model:'house07',x:-83,z:32,w:47,d:10,h:19,rot:Math.PI/2,correction:-22.444203*Math.PI/180},
 {model:'house03',x:-51,z:18,w:22,d:12,h:15,rot:0,correction:0},
 {model:'house02',x:-25,z:18,w:18,d:11,h:14,rot:0,correction:0},
 {model:'house03',x:-29,z:73,w:22,d:11,h:15,rot:Math.PI,correction:0}
]};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const bump=(x,z,cx,cz,w,h)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(w*w));
const rect=(x,z,cx,cz,rx,rz)=>Math.hypot(Math.max(0,Math.abs(x-cx)-rx),Math.max(0,Math.abs(z-cz)-rz));
const route=[[-68,45,.65],[-39,45,.65],[-8,38,1.1],[22,28,2.4],[54,19,4.7],[83,10,7.8],[93,-7,11.1],[80,-24,14.4],[36,-24,17.4],[24,-38,20.2],[36,-49,23.2],[82,-49,26.5],[88,-64,28.8],[76,-79,31.2],[58,-77,33.5],[60,-67,35.0]];
function rounded(points){let p=points;for(let pass=0;pass<2;pass++){const q=[p[0]];for(let i=1;i<p.length;i++){q.push(p[i-1].map((v,j)=>mix(v,p[i][j],.25)),p[i-1].map((v,j)=>mix(v,p[i][j],.75)));}q.push(p.at(-1));p=q;}return p;}
export const SERPENTINE=rounded(route);
const streets=[[[-68,45,.65],[-68,83,.65]],[[-68,65,.65],[-12,65,.65]],[[-42,45,.65],[-42,28,.65]],[[-68,28,.65],[-18,28,.65]]];
const trails=[[[-12,65],[-2,55],[15,45],[34,41],[54,19]],[[-42,28],[-22,2],[0,-17],[24,-38]],[[-8,38],[-10,9],[5,-5],[36,-24]]];
function segments(lines){return lines.flatMap(p=>p.slice(1).map((b,i)=>{const a=p[i],dx=b[0]-a[0],dz=b[1]-a[1];return {a,b,dx,dz,dd:dx*dx+dz*dz};}));}
const roads=segments([SERPENTINE,...streets]),paths=segments(trails);
function closest(list,x,z){let best=Infinity,y=0;for(const {a,b,dx,dz,dd} of list){const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/dd),d=(x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2;if(d<best){best=d;y=mix(a[2]||0,b[2]||0,t);}}return {distance:Math.sqrt(best),y};}
export function roadAt(x,z){return closest(roads,x,z);}
export function trailDistance(x,z){return closest(paths,x,z).distance;}
export function cityDistance(x,z){return rect(x,z,-50,47,38,39);}
export function groundHeight(x,z){
 let h=.48*Math.sin(x*.068+z*.035)+.32*Math.cos(z*.095-x*.055)+.18*Math.sin(x*.23+z*.15);
 h+=bump(x,z,60,-66,40,35.3)+bump(x,z,88,-35,31,5)+bump(x,z,5,-70,38,8)+bump(x,z,-10,5,27,3.8);
 h=mix(.65,h,smooth(0,17,cityDistance(x,z)));
 // Grade the road into the terrain, not a floating mesh; broad shoulders blend to natural hills.
 const r=roadAt(x,z);h=mix(r.y,h,smooth(2.9,13,r.distance));
 // Summit clearing is gently flattened into a viewpoint, connected to the road.
 const d=Math.hypot(x-60,z+67);h=mix(35,h,smooth(6,16,d));
 return h;
}
export function roadWeight(x,z){return 1-smooth(2.1,3.5,roadAt(x,z).distance);}
export function trailWeight(x,z){return 1-smooth(.75,1.65,trailDistance(x,z));}
export function reserveTree(x,z){return cityDistance(x,z)<1||roadAt(x,z).distance<5||trailDistance(x,z)<2.1||Math.hypot(x-60,z+67)<10;}
