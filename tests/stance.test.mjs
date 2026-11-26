import assert from 'node:assert/strict';
import {createPlayerInput,playerAim,playerMotion,reticleDiameter} from '../player_input.js';
import {newCombat,roll,tickCombat,spread,fire,RULES as R} from '../duel_rules.js';
const i=createPlayerInput(),dt=1/60;let c=newCombat();
const step=n=>{for(let k=0;k<n;k++)tickCombat(c,dt,{aim:playerAim(i.keys)});};
step(120);assert.equal(c.focus,0);assert.equal(reticleDiameter(c,false,0,720,70),3);
i.down('KeyA',0);assert.equal(playerMotion(i.keys).r,-1);assert.equal(i.rollAt(.01),0);i.up('KeyA');
i.down('Space',0);assert(playerAim(i.keys));assert.equal(i.rollAt(.01),0);const initial=reticleDiameter(c,true,0,720,70);step(73);assert(c.focus>.999);assert(reticleDiameter(c,true,0,720,70)<initial/4);
i.up('Space');step(1);assert.equal(c.focus,0);assert.equal(reticleDiameter(c,false,0,720,70),3);assert(spread(c.focus,false,0)>spread(1,true,0)*20);
for(const [key,side] of [['KeyA',-1],['KeyD',1],['ArrowLeft',-1],['ArrowRight',1]])for(const reverse of [false,true]){i.clear();c=newCombat();let keys=reverse?[key,'Space']:['Space',key];i.down(keys[0],0);i.down(keys[1],.01);assert.equal(i.rollAt(.02),side);assert.equal(playerMotion(i.keys).r,0);assert(roll(c,i.rollAt(.02)));i.consumeRoll();i.down(key,.03,true);assert.equal(i.rollAt(.04),0);assert.equal(c.stamina,67);let travel=0;for(let t=0;t<1;t+=dt)travel+=tickCombat(c,dt,{aim:true}).travel;assert(Math.abs(travel-R.rollDistance)<1e-8);step(73);assert(c.focus>.99);i.up('Space');step(1);assert.equal(c.focus,0);}
i.clear();i.down('Space',0);i.down('KeyW',.1);i.down('ShiftLeft',.1);assert.deepEqual(playerMotion(i.keys),{stance:true,f:1,r:0,sprintKey:false});assert.equal(i.rollAt(.2),0);
i.clear();i.down('Space',0);i.down('KeyA',.1);i.consumeRoll();i.down('ArrowLeft',.2);assert.equal(i.rollAt(.2),0);i.up('KeyA');i.up('ArrowLeft');i.down('KeyD',.3);assert.equal(i.rollAt(.31),1);
console.log('PASS stance-only focus, hipfire point, no focus on exit, WASD and arrows in both orders, no auto-repeat, stance W/S and sprint exclusion');
