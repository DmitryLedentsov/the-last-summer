// Player commands are sampled by the fixed-step simulation, not by the camera.
export function keyCode(e){
 const k=e.key;if(e.code&&e.code!=='Unidentified')return e.code;
 return k===' '||k==='Spacebar'?'Space':k==='Shift'?'ShiftLeft':/^[a-z]$/i.test(k||'')?'Key'+k.toUpperCase():/^[12]$/.test(k||'')?'Digit'+k:k;
}
export function createPlayerInput(){
 const keys=new Set();let pending=0,expires=0,look=0;
 const chord=()=>keys.has('Space')&&keys.has('ArrowLeft')!==keys.has('ArrowRight')?(keys.has('ArrowLeft')?-1:1):0;
 return {keys,
  down(code,time,repeat=false){const prev=chord();keys.add(code);const next=chord();if(!repeat&&next&&next!==prev){pending=next;expires=time+.40;}},
  up(code){keys.delete(code);},
  rollAt(time){if(time>expires)pending=0;return pending;},
  consumeRoll(){pending=0;},
  lookBy(amount){if(Number.isFinite(amount))look+=Math.abs(amount);},
  turnRate(dt,keyboard=0){const rate=look/Math.max(dt,1e-6)+Math.abs(keyboard);look=0;return rate;},
  clear(){keys.clear();pending=expires=look=0;}
 };
}
