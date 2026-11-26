import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const clips=JSON.parse(readFileSync(new URL('../assets/survival/hero/locomotion.json',import.meta.url),'utf8'));
assert.deepEqual(clips.map(c=>c.name),['walk','sneak']);
for(const clip of clips){
 assert(clip.duration>0);
 for(const track of clip.tracks){
  const n=track.values.length/track.times.length;
  assert(Number.isInteger(n)&&n>0);
  assert(track.values.every(Number.isFinite));
  assert(track.times.every(Number.isFinite));
  assert.equal(track.times[0],0);
  assert(Math.abs(track.times.at(-1)-clip.duration)<.00001);
  const a=track.values.slice(0,n),b=track.values.slice(-n);
  if(track.type==='quaternion'){
   const dot=a.reduce((s,x,i)=>s+x*b[i],0);
   assert(Math.abs(Math.abs(dot)-1)<.00001);
  }else assert(a.every((x,i)=>Math.abs(x-b[i])<.00001));
 }
}
console.log('PASS local walk / sneak clip data and loop closure');
