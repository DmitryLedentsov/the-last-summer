// Mutable broadphase for actors; stable iteration order for identical hit/overlap ties.
export function createActorGrid(cell=5){
 const buckets=new Map(),records=new Map();let order=0;
 function key(x,z){return Math.floor(x/cell)+':'+Math.floor(z/cell);}
 function remove(actor){const old=records.get(actor);if(!old)return;const b=buckets.get(old.key);b.delete(actor);if(!b.size)buckets.delete(old.key);records.delete(actor);}
 function update(actor,p){const k=key(p.x,p.z),old=records.get(actor);if(old?.key===k)return;const seq=old?.seq??order++;remove(actor);let b=buckets.get(k);if(!b)buckets.set(k,b=new Set());b.add(actor);records.set(actor,{key:k,seq});}
 function query(x0,z0,x1,z1){const out=[];for(let i=Math.floor(x0/cell);i<=Math.floor(x1/cell);i++)for(let j=Math.floor(z0/cell);j<=Math.floor(z1/cell);j++){const b=buckets.get(i+':'+j);if(b)out.push(...b);}return out.sort((a,b)=>(a.gridOrder??records.get(a).seq)-(b.gridOrder??records.get(b).seq));}
 return {update,remove,query,get size(){return records.size;}};
}
