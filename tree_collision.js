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
