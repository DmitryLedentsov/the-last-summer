// The exact sampled physical world; no render objects, textures, LOD or random generators.
export function createWorldData({id,revision,level,field,colliders}){
 if(!id||!revision||!field?.values||!Array.isArray(colliders))throw Error('Invalid physical map');
 return {id,revision,limit:level.limit,spawn:[...level.spawn],yaw:level.yaw,field,colliders};
}
// Portable snapshot for a future build-time exporter / Java MapLoader.
// Serialize the sampled triangles, never regenerate them independently on the server.
export function serializeWorldData(data){
 const {id,revision,limit,spawn,yaw,field,colliders}=data;
 return {schema:1,id,revision,limit,spawn:[...spawn],yaw,heightfield:{size:field.size,segments:field.segments,values:Array.from(field.values)},colliders:JSON.parse(JSON.stringify(colliders))};
}
