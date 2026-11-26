import assert from 'node:assert/strict';
import {STYLES,QUALITIES,graphicsSettings,findStyle,createTextureProfiles,collectTextures} from '../graphics_settings.js';
assert.equal(STYLES.length,6);assert.equal(findStyle('DIORAMA'),1);assert.equal(findStyle('DIORAMA LEGACY'),1);
assert.equal(QUALITIES.length,4);
for(let s=0;s<STYLES.length;s++)for(let q=0;q<4;q++){
 const a=graphicsSettings(s,q);assert(a.scale>0);if(q===0||s===0){assert.equal(a.aa,0);assert.equal(a.blur,0);assert.equal(a.bloom,0);}
}
for(let q=0;q<4;q++)for(const mode of [1,2])for(const zoom of [true,false]){
 const a=graphicsSettings(1,q,{mode,zoom});
 assert.equal(a.blur,Math.min(1,QUALITIES[q].blur*(mode===2?1.25:zoom?.35:.85)));
 assert.equal(a.near,mode===2?23:zoom?42:25);assert.equal(a.far,mode===2?53:zoom?115:85);
 assert.equal(a.foreground,0);assert.equal(a.lens,1);assert.equal(a.legacy,true);
 const mini=graphicsSettings(2,q,{mode,zoom,focusDepth:20});
 assert(mini.blur<=.42);assert(mini.near>20);assert(mini.far>mini.near);
 if(mode===1||zoom)assert.equal(mini.foreground,0);
 if(mode===2&&!zoom)assert(mini.foreground<20);
}
assert.equal(graphicsSettings(0,2).scale,.8);assert.equal(graphicsSettings(0,2).q.shadow,2048);
assert.equal(graphicsSettings(3,3).ao,true);assert.equal(graphicsSettings(3,2).blur,0);
assert(graphicsSettings(4,2).bloom>0);assert.equal(graphicsSettings(5,2).bloom,0);
assert.equal(graphicsSettings(2,2,{mode:2}).lens,1.2);
const T={LinearFilter:1,LinearMipmapLinearFilter:2};
const a={isTexture:true,magFilter:3,minFilter:4,anisotropy:2,generateMipmaps:true},b={isTexture:true,magFilter:3,minFilter:4,anisotropy:1,generateMipmaps:false};
const all=collectTextures({traverse:fn=>fn({material:{map:a}})},[b]);assert.equal(all.size,2);
const apply=createTextureProfiles(T,all,8);apply(false,16);
assert.equal(a.magFilter,1);assert.equal(a.minFilter,2);assert.equal(a.anisotropy,8);assert.equal(b.minFilter,1);
apply(true,2);assert.equal(a.magFilter,3);assert.equal(a.minFilter,4);assert.equal(a.anisotropy,2);assert.equal(b.anisotropy,1);
console.log('PASS 24 graphics combinations; exact legacy formula, optical bounds, independent contrast/glow, texture restoration');
