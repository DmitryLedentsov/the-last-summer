// Footprint of the visible trunk, in the same normalized coordinates as batch().
// A convex hull of the bottom 2.8 m excludes most canopy but includes leaning trunks and roots.
export function convexHull(points){
 const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=arr=>{const h=[];for(const q of arr){while(h.length>1&&cross(h.at(-2),h.at(-1),q)<=1e-9)h.pop();h.push(q);}return h;};
 const lo=half(p),hi=half(p.slice().reverse());return lo.slice(0,-1).concat(hi.slice(0,-1));
}
export function trunkFootprint(THREE,template){
 if(!template)return null;template.updateMatrixWorld(true);const vertices=[];
 template.traverse(mesh=>{if(!mesh.isMesh)return;const pos=mesh.geometry.getAttribute('position'),idx=mesh.geometry.index;
  const v=new THREE.Vector3(),pts=Array.from({length:pos.count},(_,i)=>{v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);return [v.x,v.y,v.z];});
  const limit=2.8;const add=p=>vertices.push([p[0],p[2]]);
  const get=i=>pts[idx?idx.getX(i):i];const count=idx?idx.count:pos.count;
  for(let i=0;i+2<count;i+=3){const tri=[get(i),get(i+1),get(i+2)];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(a[1]<=limit)add(a);if((a[1]<limit)!==(b[1]<limit)){const t=(limit-a[1])/(b[1]-a[1]);add([a[0]+(b[0]-a[0])*t,limit,a[2]+(b[2]-a[2])*t]);}}}
 });const hull=convexHull(vertices);return hull.length>=3?hull:null;
}
export function treeCollider(foot,x,z,s,angle){
 if(!foot)return {x,z,r:.55*s};const c=Math.cos(angle),a=Math.sin(angle),poly=foot.map(([u,v])=>[x+s*(c*u+a*v),z+s*(-a*u+c*v)]);
 return {poly,x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),z0:Math.min(...poly.map(p=>p[1])),z1:Math.max(...poly.map(p=>p[1]))};
}
export function hitsCollider(c,x,z,r){
 if('r'in c)return Math.hypot(x-c.x,z-c.z)<r+c.r;
 if(x+r<c.x0||x-r>c.x1||z+r<c.z0||z-r>c.z1)return false;
 if(!c.poly)return true;
 let inside=true;for(let i=0;i<c.poly.length;i++){const a=c.poly[i],b=c.poly[(i+1)%c.poly.length],dx=b[0]-a[0],dz=b[1]-a[1];if(dx*(z-a[1])-dz*(x-a[0])<0)inside=false;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<=r)return true;}return inside;
}


// Combat trees: ignore foliage material groups, clip wood triangles against the
// actual world-height range of the actor, and keep a separate height-aware ray shape.
export function collectWoodTriangles(THREE,template){
 if(!template)return [];template.updateMatrixWorld(true);const triangles=[];
 template.traverse(mesh=>{
  if(!mesh.isMesh)return;const g=mesh.geometry,pos=g.getAttribute('position'),idx=g.index;
  if(!pos)return;
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material],groups=g.groups.length?g.groups:[{start:0,count:idx?idx.count:pos.count,materialIndex:0}];
  const v=new THREE.Vector3(),get=i=>{v.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld);return [v.x,v.y,v.z];};
  for(const group of groups){
   const mat=mats[group.materialIndex]||mats[0];if(/crown|corwn|leaf|foliage/i.test(mat?.name||''))continue;
   const end=Math.min(group.start+group.count,idx?idx.count:pos.count);
   for(let i=group.start;i+2<end;i+=3)triangles.push([get(i),get(i+1),get(i+2)]);
  }
 });
 return triangles;
}
function clipY(poly,h,above){
 const out=[];if(!poly.length)return out;
 const inside=p=>above?p[1]>=h:p[1]<=h;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ai=inside(a),bi=inside(b);
  if(ai)out.push(a);
  if(ai!==bi){const t=(h-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,h,a[2]+(b[2]-a[2])*t]);}
 }
 return out;
}
export function trunkBandFootprint(triangles,min,max){
 const points=[];
 for(const tri of triangles){if(tri.every(p=>p[1]<min)||tri.every(p=>p[1]>max))continue;
  for(const p of clipY(clipY(tri,min,true),max,false))points.push([p[0],p[2]]);
 }
 const hull=convexHull(points);return hull.length>=3?hull:null;
}
export function combatTreeCollider(triangles,x,z,s,angle,baseY,bodyHeight=1.65){
 const foot=trunkBandFootprint(triangles,-.04/s,(bodyHeight+.025)/s);
 const move=treeCollider(foot,x,z,s,angle);
 if(!foot)return move;
 // Slice the lower wood into separate height bands for visibility / bullets /
 // shoulder camera. Leaves and upper canopy do not create an invisible wall.
 const raySlices=[];
 for(let lo=0;lo<3.3;lo+=.55){
  const hi=Math.min(3.3,lo+.55),shape=trunkBandFootprint(triangles,(lo-.025)/s,(hi+.025)/s);
  if(shape)raySlices.push({...treeCollider(shape,x,z,s,angle),bottom:baseY+lo-.025,top:baseY+hi+.025});
 }
 const bounds=[move,...raySlices];
 return {...move,raySlices,rayBounds:{
  x0:Math.min(...bounds.map(c=>c.x0)),x1:Math.max(...bounds.map(c=>c.x1)),
  z0:Math.min(...bounds.map(c=>c.z0)),z1:Math.max(...bounds.map(c=>c.z1))
 }};
}
export function hitsTreeRay(c,x,y,z,r=.035){
 return c.raySlices?.some(slice=>y>=slice.bottom&&y<=slice.top&&hitsCollider(slice,x,z,r))||false;
}
