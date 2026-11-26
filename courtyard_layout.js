// Ground plan in world units. Geometry and navigation use the same coordinates.
export const COURTYARD=Object.freeze({
 limit:39, size:86, spawn:[0,31], yaw:0,
 houses:[
  {model:'house07',x:-32,z:-2,w:57,d:11,h:21,rot:Math.PI/2,correction:-22.444203*Math.PI/180},
  {model:'house07',x:8,z:-33,w:49,d:10,h:19,rot:0,correction:-22.444203*Math.PI/180},
  {model:'house03',x:32,z:-10,w:20,d:11,h:15,rot:Math.PI/2,correction:0},
  {model:'house02',x:32,z:15,w:18,d:11,h:15,rot:Math.PI/2,correction:0}
 ],
 // x,z,width,depth,kind; sidewalks and roads are flat, never blocking colliders.
 paving:[
  [0,25,55,5,'road'],[0,-23,54,5,'road'],[-23,1,5,49,'road'],[23,1,5,49,'road'],
  [0,5,4,36,'path'],[-8,-5,26,2.4,'path'],[9,15,25,2.4,'path'],
  [-25,1,1.8,53,'path'],[25,1,1.8,53,'path'],[7,-27,46,2,'path'],
  [-15,31,13,4,'path'],[19,31,19,4,'road'],[-7,2,12,10,'sand']
 ],
 trees:[[-17,-14],[-15,-7],[-18,9],[-14,17],[-17,20],[-7,-16],[7,-16],[13,-13],[17,-3],[17,8],[12,20],[-29,30],[-12,35],[5,35],[36,29],[-36,33],[-36,-34],[35,-35],[-9,-28]],
 lamps:[[-22,19,1],[0,22,1],[21,13,1],[1,-19,1],[-20,-16,1],[19,-22,0],[-13,30,1]],
 garages:[11,15,19,23,27],
});
export function isPaved(x,z,padding=0){return COURTYARD.paving.some(([cx,cz,w,d])=>Math.abs(x-cx)<=w/2+padding&&Math.abs(z-cz)<=d/2+padding);}
export function canScatter(x,z,colliders,hit){return Math.abs(x)<COURTYARD.limit&&Math.abs(z)<COURTYARD.limit&&!isPaved(x,z,.35)&&!colliders.some(c=>hit(c,x,z,.22));}
