export const BLOOD_RANGES=[20,35,50,65];
export const FX_RANGES=[40,60,85,100];
export function withinRange(p,o,r){return (p.x-o.x)**2+(p.y-o.y)**2+(p.z-o.z)**2<=r*r;}
export function createMarkStore(capacity=100,life=65){let id=0,time=0;const marks=[];return {add(p,size,angle){if(marks.length>=capacity)marks.shift();marks.push({id:++id,p:{x:p.x,y:p.y,z:p.z},size,angle,born:time});},advance(dt){time+=Math.max(0,dt);while(marks.length&&time-marks[0].born>=life)marks.shift();},visible(origin,r){return marks.filter(m=>withinRange(m.p,origin,r+m.size*2));},get time(){return time;},get count(){return marks.length;}};}
