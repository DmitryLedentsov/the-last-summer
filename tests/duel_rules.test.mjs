import assert from 'node:assert/strict';
import {RULES as R,newCombat,fire,canFire,reload,roll,tickCombat,spread,sphereHit} from '../duel_rules.js';
const step=(c,t,cmd={})=>{let travel=0;for(let i=0;i<Math.round(t*120);i++)travel+=tickCombat(c,1/120,cmd).travel;return travel;};
let a=newCombat();step(a,1.2,{aim:true});assert(a.focus>.999);assert(spread(a.focus,true,0)<spread(0,true,0)/10);assert(fire(a)>.999);assert.equal(a.ammo,5);assert.equal(a.focus,0);assert.equal(fire(a),null);assert(!roll(a,-1));step(a,.66);assert(canFire(a));assert(fire(a)!==null);
a=newCombat();step(a,1.2,{aim:true,turn:3});assert.equal(a.focus,0);step(a,1.2,{aim:true,speed:3});assert.equal(a.focus,0);
a=newCombat();assert(!roll(a,0));assert(!roll(a,2));assert(roll(a,-1));assert.equal(a.stamina,67);assert(!canFire(a));assert(!reload(a));assert(!roll(a,1));const distance=step(a,.53);assert(Math.abs(distance-R.rollDistance)<1e-6);assert(a.recover>0);assert(!canFire(a));step(a,.27);assert(canFire(a));assert(roll(a,1));step(a,.79);assert(roll(a,-1));step(a,.79);assert(!roll(a,1));step(a,5);assert.equal(a.stamina,100);
a=newCombat();a.ammo=1;assert(reload(a));step(a,.54);assert.equal(a.ammo,1);assert(a.reload>0);assert.equal(fire(a),null);assert(roll(a,-1));assert.equal(a.reload,0);assert.equal(a.ammo,1);step(a,.82);assert(reload(a));step(a,1.0);assert.equal(a.ammo,1);step(a,.75);assert.equal(a.ammo,R.capacity);assert.equal(a.reload,0);assert.equal(a.reserve,Infinity);
a=newCombat();a.ammo=1;a.reserve=2;assert(reload(a));step(a,1.75);assert.equal(a.ammo,3);assert.equal(a.reserve,0);assert.equal(reload(a),false);
assert.equal(sphereHit(0,0,0,1,0,0,10,0,0,1,20),9);assert.equal(sphereHit(0,0,0,1,0,0,10,0,0,1,8),Infinity);assert.equal(sphereHit(0,0,0,1,0,0,-10,0,0,1,20),Infinity);assert.equal(sphereHit(0,0,0,1,0,0,0,0,0,1,20),0);
// Same shot misses a lowered roll hitbox without magical invulnerability.
assert.equal(sphereHit(0,1.42,0,1,0,0,10,.42,0,.38,20),Infinity);assert(sphereHit(0,.42,0,1,0,0,10,.42,0,.38,20)<Infinity);
// A bullet takes multiple fixed ticks to hit a distant target, not hitscan.
let x=0,ticks=0;while(sphereHit(x,0,0,1,0,0,25,0,0,.3,R.bulletSpeed/60)===Infinity){x+=R.bulletSpeed/60;ticks++;assert(ticks<60);}assert(ticks>10);
console.log('PASS: focus, fire cadence, side-only roll, stamina, recovery, atomic magazine reload with cancellation, swept bullet collision and lowered hitbox');
