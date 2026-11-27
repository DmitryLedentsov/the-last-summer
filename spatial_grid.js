// Shared static broadphase, independent of Three.js and rendering quality.
export function createSpatialGrid(cell=5,padding=.75){
 if(!(cell>0&&padding>=0))throw Error('Invalid grid dimensions');
 const buckets=new Map(),empty=[],key=(x,z)=>Math.floor(x/cell)+':'+Math.floor(z/cell);
 function insert(c){
  const b=c.rayBounds||c,x0=b.x0??c.x-c.r,x1=b.x1??c.x+c.r,z0=b.z0??c.z-c.r,z1=b.z1??c.z+c.r;
  if(![x0,x1,z0,z1].every(Number.isFinite)||x0>x1||z0>z1)throw Error('Invalid collider bounds');
  for(let i=Math.floor((x0-padding)/cell);i<=Math.floor((x1+padding)/cell);i++)for(let j=Math.floor((z0-padding)/cell);j<=Math.floor((z1+padding)/cell);j++){
   const k=i+':'+j;let bucket=buckets.get(k);if(!bucket)buckets.set(k,bucket=[]);bucket.push(c);
  }
  return c;
 }
 return {cell,insert,at:(x,z)=>buckets.get(key(x,z))||empty,atCell:(i,j)=>buckets.get(i+':'+j)||empty};
}
