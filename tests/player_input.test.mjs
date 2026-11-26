import assert from 'node:assert/strict';
import {createPlayerInput,keyCode} from '../player_input.js';
import {newCombat,roll,fire,tickCombat,spread,RULES as R} from '../duel_rules.js';
let i=createPlayerInput();i.down('Space',0);i.down('ArrowLeft',.01);assert.equal(i.rollAt(.02),-1);i.consumeRoll();i.down('ArrowLeft',.03,true);assert.equal(i.rollAt(.04),0);i.up('ArrowLeft');i.down('ArrowRight',.1);assert.equal(i.rollAt(.11),1);assert.equal(i.rollAt(.51),0);
i.clear();i.down('ArrowRight',0);i.down('Space',.1);assert.equal(i.rollAt(.2),1);i.consumeRoll();i.up('Space');i.down('Space',.3);assert.equal(i.rollAt(.31),1);i.clear();i.down('Space',0);i.down('ArrowUp',.1);assert.equal(i.rollAt(.2),0);assert.equal(keyCode({key:' ',code:'Unidentified'}),'Space');assert.equal(keyCode({key:'ArrowLeft'}),'ArrowLeft');
// A roll requested during the shot's short lockout is not lost.
i.clear();let c=newCombat();fire(c);i.down('Space',0);i.down('ArrowRight',0);let started=false,travel=0;for(let t=0;t<1;t+=1/60){const req=i.rollAt(t);if(req&&roll(c,req)){started=true;i.consumeRoll();}travel+=tickCombat(c,1/60).travel;}assert(started);assert(Math.abs(travel-R.rollDistance)<1e-8);assert.equal(c.rollSide,1);
// Camera interpolation is deliberately absent from the player focus input.
i.clear();c=newCombat();for(let j=0;j<73;j++)tickCombat(c,1/60,{aim:true,turn:i.turnRate(1/60)});assert(c.focus>.999);assert(spread(c.focus,true,0)<spread(0,true,0)/10);i.lookBy(.1);tickCombat(c,1/60,{aim:true,turn:i.turnRate(1/60)});assert(c.focus<1);i.clear();assert.equal(i.turnRate(1/60),0);
console.log('PASS player chord, both orders, no auto-repeat, expiry, buffered roll, aim independent of camera');
