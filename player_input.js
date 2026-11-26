import {spread} from './duel_rules.js';
// Player commands are sampled by the fixed-step simulation, not by the camera.
export function keyCode(e){
 const k=e.key;if(e.code&&e.code!=='Unidentified')return e.code;
 return k===' '||k==='Spacebar'?'Space':k==='Shift'?'ShiftLeft':/^[a-z]$/i.test(k||'')?'Key'+k.toUpperCase():/^[12]$/.test(k||'')?'Digit'+k:k;
}
export function createPlayerInput(){
 const keys=new Set();let pending=0,expires=0,look=0,usedChord=0;
 const chord=()=>keys.has('Space')&&keys.has('ArrowLeft')!==keys.has('ArrowRight')?(keys.has('ArrowLeft')?-1:1):0;
 return {keys,
  down(code,time,repeat=false){keys.add(code);const next=chord();if(next&&next!==usedChord){pending=next;expires=time+.40;usedChord=next;}},
  up(code){keys.delete(code);if(!chord())usedChord=0;},
  rollAt(time){if(time>expires)pending=0;return pending;},
  consumeRoll(){pending=0;},
  lookBy(amount){if(Number.isFinite(amount))look+=Math.abs(amount);},
  turnRate(dt,keyboard=0){const rate=look/Math.max(dt,1e-6)+Math.abs(keyboard);look=0;return rate;},
  clear(){keys.clear();pending=expires=look=usedChord=0;}
 };
}

// RMB slows movement and zooms; a stationary player also settles the weapon.
export function playerAim(rmb,sprint,moving){return !sprint&&(rmb||!moving);}
export function reticleDiameter(c,aim,speed,height,fov){return Math.max(9,spread(c.focus,aim,speed)*height/Math.tan(fov*Math.PI/360));}
