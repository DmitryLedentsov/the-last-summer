import {STYLES,QUALITIES} from './graphics_settings.js?v=076';
export function createGraphicsMenu(graphics,{onOpen=()=>{}}={}){
 const root=document.createElement('div');root.id='graphics-menu';root.hidden=true;
 root.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="gfx-heading"><h2 id="gfx-heading">Настройки графики</h2><label>Стиль<select id="gfx-style"></select></label><label>Качество<select id="gfx-quality"></select></label><label>Дальность травы <output id="gfx-distance-label"></output><input id="gfx-distance" type="range" min="15" max="80" step="1"></label><p id="gfx-note"></p><div class="gfx-buttons"><button id="gfx-reset" type="button">По умолчанию</button><button id="gfx-close" type="button">Готово</button></div></section>';
 document.body.appendChild(root);const get=id=>root.querySelector('#'+id),style=get('gfx-style'),quality=get('gfx-quality'),distance=get('gfx-distance'),label=get('gfx-distance-label');
 for(const [select,items] of [[style,STYLES],[quality,QUALITIES]])items.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=v.name;select.append(o);});
 function sync(){const p=graphics.preferences();style.value=p.style;quality.value=p.quality;distance.value=p.grassDistance;label.value=p.grassDistance+' м';distance.disabled=!graphics.hasVegetation;get('gfx-note').textContent=graphics.hasVegetation?'Густая трава вблизи, разреженная вдали. Настройки сохраняются автоматически.':'На этой карте нет управляемого слоя травы.';}
 function close(){root.hidden=true;}
 function open(){onOpen();sync();root.hidden=false;style.focus({preventScroll:true});}
 style.addEventListener('change',()=>graphics.setStyle(Number(style.value)));quality.addEventListener('change',()=>graphics.setQuality(Number(quality.value)));distance.addEventListener('input',()=>{graphics.setGrassDistance(Number(distance.value));label.value=distance.value+' м';});
 get('gfx-reset').onclick=()=>{graphics.resetPreferences();sync();};get('gfx-close').onclick=close;
 root.addEventListener('click',e=>{if(e.target===root)close();});root.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopPropagation();close();}});
 return {open,close,get visible(){return !root.hidden;}};
}
