import {spread} from './duel_rules.js?v=043';
// Player commands are sampled by the fixed-step simulation, not by the camera.
export function keyCode(e){
 const k=e.key;if(e.code&&e.code!=='Unidentified')return e.code;
 return k===' '||k==='Spacebar'?'Space':k==='Shift'?'ShiftLeft':/^[a-z]$/i.test(k||'')?'Key'+k.toUpperCase():/^[12]$/.test(k||'')?'Digit'+k:k;
}
export function createPlayerInput(){
 const keys=new Set();let pending=0,expires=0,look=0;
 const chord=()=>{const left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');return keys.has('Space')&&left!==right?(left?-1:1):0;};
 return {keys,
  down(code,time,repeat=false){const prev=chord(),fresh=!keys.has(code)&&!repeat;keys.add(code);const next=chord();if(fresh&&next&&next!==prev){pending=next;expires=time+.40;}},
  up(code){keys.delete(code);},
  rollAt(time){if(time>expires)pending=0;return pending;},
  consumeRoll(){pending=0;},
  lookBy(amount){if(Number.isFinite(amount))look+=Math.abs(amount);},
  turnRate(dt,keyboard=0){const rate=look/Math.max(dt,1e-6)+Math.abs(keyboard);look=0;return rate;},
  clear(){keys.clear();pending=expires=look=0;}
 };
}

// Space alone enables the combat stance; RMB is camera zoom only.
export function playerAim(keys){return keys.has('Space');}
export function playerMotion(keys){const stance=playerAim(keys),f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),r=stance?0:Number(keys.has('KeyD'))-Number(keys.has('KeyA'));return {stance,f,r,sprintKey:!stance&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))};}
export function reticleDiameter(c,aim,speed,height,fov){return aim?Math.max(9,spread(c.focus,true,speed)*height/Math.tan(fov*Math.PI/360)):3;}
