import assert from 'node:assert/strict';
import {sprintAvailable,analogSpeed} from '../character_motion.js';
import {newCombat,tickCombat,roll,RULES} from '../duel_rules.js';
const dt=1/60;
function exercise(fixed){
 const c=newCombat();let exhausted=false,starts=0,last=false,first=Infinity,continuous=0,stamina=0;
 // Three rolls can leave 1 stamina. A held edge-of-stick then requests sprint.
 c.stamina=1;c.regenDelay=.7;
 for(let i=0;i<240;i++){
  const e=fixed?sprintAvailable(c.stamina,exhausted):{available:c.stamina>1,exhausted:false};exhausted=e.exhausted;
  const speed=analogSpeed(1,{canSprint:e.available}),running=speed>2.65;
  if(running&&!last){starts++;first=Math.min(first,i*dt);}
  continuous=running?continuous+dt:0;stamina=c.stamina;last=running;
  tickCombat(c,dt,{speed,sprint:running});
 }
 return {starts,first,continuous,stamina};
}
const old=exercise(false),fixed=exercise(true);
assert(old.starts>=3);assert(fixed.starts<old.starts);assert(fixed.first>1&&fixed.first<1.6);
assert.equal(analogSpeed(1,{stance:true,canSprint:true}),1.12);
assert.equal(sprintAvailable(70,false).available,true);
assert.equal(sprintAvailable(1,false).available,false);assert.equal(sprintAvailable(10,true).available,false);assert.equal(sprintAvailable(15,true).available,true);
console.log('PASS held stick after exhaustion:',old,'=>',fixed);
