export function stickVector(dx,dy,radius){const l=Math.hypot(dx,dy);if(!l||radius<=0)return {x:0,y:0};const n=Math.max(0,(Math.min(1,l/radius)-.12)/.88);return {x:dx/l*n,y:-dy/l*n};}
// Radial sprint and one lateral roll per deliberate gesture, with hysteresis.
export function stickIntent(x,y,stance,previous={sprint:false,rollSide:0}){
 const sprint=!stance&&Math.hypot(x,y)>=(previous.sprint?.72:.82);
 const lateral=Math.abs(x)>=.65&&Math.abs(x)>Math.abs(y)*1.25;
 const rollSide=!stance?0:lateral?Math.sign(x):Math.abs(x)>.35?previous.rollSide:0;
 return {sprint,rollSide};
}
export function mergeMotion(f,r,touch,stance=false){f+=touch?.y||0;r=stance?0:r+(touch?.x||0);const l=Math.max(1,Math.hypot(f,r));return {f:f/l,r:r/l};}
export function applyTouchQuality(renderer,scene){renderer.setPixelRatio(Math.min(devicePixelRatio||1,1)*.55);renderer.setSize(innerWidth,innerHeight);scene.traverse(o=>{if(o.isLight&&o.shadow&&o.shadow.mapSize.x>1024){o.shadow.map?.dispose();o.shadow.map=null;o.shadow.mapSize.set(1024,1024);o.shadow.needsUpdate=true;}});}
export function createTouchControls({menu,combat=false,interactions=false,onLook,onAction}){
 const doc=document,css=doc.createElement('link');css.rel='stylesheet';css.href=new URL('./touch_controls.css?v=049',import.meta.url).href;doc.head.appendChild(css);
 const choice=doc.createElement('label'),check=doc.createElement('input'),forced=new URLSearchParams(location.search).get('touch');choice.className='touch-choice';check.type='checkbox';check.checked=forced==='1'||(forced!=='0'&&navigator.maxTouchPoints>0&&matchMedia('(pointer:coarse)').matches);choice.append(check,doc.createTextNode(' Сенсорное управление'));menu.querySelector('.panel')?.appendChild(choice);
 const tip=doc.createElement('p');tip.className='touch-help';tip.textContent=combat?'Джойстик — ходьба / бег у края; в СТОЙКЕ вперёд / назад — шаг, влево / вправо — перекат. Свайп — прицел.':'Джойстик — ходьба / бег у края; свайп — обзор; ДЕЙСТВИЕ — кнопка.';choice.after(tip);const choiceSync=()=>{tip.hidden=!check.checked;menu.classList.toggle('touch-selected',check.checked);};check.addEventListener('change',choiceSync);choiceSync();
 const root=doc.createElement('div');root.className='touch-ui'+(combat?' combat':'');root.hidden=true;
 root.innerHTML='<div class="touch-look"></div><div class="touch-stick"><div class="touch-knob"></div></div><div class="touch-top"><button data-action="pause" aria-label="Пауза">Ⅱ</button>'+(combat?'<button data-action="camera">ВИД</button><button data-action="style">СТИЛЬ</button><button data-action="quality">ГРАФ.</button><button data-action="stats">FPS</button>':'')+'</div><div class="touch-actions">'+(combat?'<div class="touch-row"><button data-action="rotateL" class="view2">↶</button><button data-action="rotateR" class="view2">↷</button><button data-action="zoom">ЗУМ</button><button data-action="reload">R</button></div><div class="touch-row">'+(interactions?'<button data-action="interact">ОСМОТР</button>':'')+'<button data-action="stance">СТОЙКА</button></div><div class="touch-row"><button data-action="fire" class="fire">ОГОНЬ</button></div>':'<div class="touch-row"><button data-action="interact">ДЕЙСТВИЕ</button></div>')+'</div>';doc.body.appendChild(root);
 const stick=root.querySelector('.touch-stick'),knob=root.querySelector('.touch-knob'),look=root.querySelector('.touch-look'),state={x:0,y:0,stance:false,sprint:false,rollSide:0,zoom:false,rotate:0};let active=false,stickId=null,lookId=null,lastX=0,lastY=0;const rotation=new Map();
 function sync(){root.classList.toggle('stance',state.stance);root.classList.toggle('sprinting',state.sprint);for(const n of ['stance','zoom'])root.querySelector('[data-action="'+n+'"]')?.setAttribute('aria-pressed',String(state[n]));}
 function capture(el,e){try{el.setPointerCapture(e.pointerId);}catch{}}
 function updateIntent(){const prev=state.rollSide,next=stickIntent(state.x,state.y,state.stance,state);state.sprint=next.sprint;state.rollSide=next.rollSide;sync();if(next.rollSide&&next.rollSide!==prev)onAction('roll',{...state});}
 function stickMove(e){const b=stick.getBoundingClientRect(),r=b.width*.35,a=stickVector(e.clientX-b.left-b.width/2,e.clientY-b.top-b.height/2,r);state.x=a.x;state.y=a.y;updateIntent();knob.style.transform='translate(calc(-50% + '+a.x*r+'px),calc(-50% + '+(-a.y*r)+'px))';}
 function resetStick(){stickId=null;state.x=state.y=0;state.sprint=false;state.rollSide=0;sync();knob.style.transform='translate(-50%,-50%)';}
 stick.addEventListener('pointerdown',e=>{if(!active||stickId!==null)return;e.preventDefault();stickId=e.pointerId;capture(stick,e);stickMove(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId){e.preventDefault();stickMove(e);}});
 look.addEventListener('pointerdown',e=>{if(!active||lookId!==null)return;e.preventDefault();lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;capture(look,e);});look.addEventListener('pointermove',e=>{if(e.pointerId===lookId){e.preventDefault();onLook(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;}});
 const end=['pointerup','pointercancel','lostpointercapture'];for(const type of end){stick.addEventListener(type,e=>{if(e.pointerId===stickId)resetStick();});look.addEventListener(type,e=>{if(e.pointerId===lookId)lookId=null;});}
 function rotate(){state.rotate=Math.max(-1,Math.min(1,[...rotation.values()].reduce((a,b)=>a+b,0)));}
 for(const b of root.querySelectorAll('button')){const n=b.dataset.action;if(n==='rotateL'||n==='rotateR'){b.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();capture(b,e);rotation.set(e.pointerId,n==='rotateL'?1:-1);rotate();});for(const type of end)b.addEventListener(type,e=>{rotation.delete(e.pointerId);rotate();});continue;}
 b.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();if(n==='stance'){state.stance=!state.stance;updateIntent();}else if(n==='zoom')state.zoom=!state.zoom;sync();onAction(n,state);});}
 function reset(){resetStick();lookId=null;rotation.clear();state.rotate=0;state.stance=state.sprint=state.zoom=false;sync();}
 function start(){active=true;reset();root.hidden=false;doc.body.classList.add('touch-playing');}
 function stop(){active=false;reset();root.hidden=true;doc.body.classList.remove('touch-playing');}
 function setView(mode){root.classList.toggle('view-top',mode===2);if(mode!==2){rotation.clear();rotate();}}
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden&&active){reset();onAction('pause',state);}});root.addEventListener('contextmenu',e=>e.preventDefault());sync();
 return {get selected(){return check.checked;},get active(){return active;},state,start,stop,reset,setView};
}
