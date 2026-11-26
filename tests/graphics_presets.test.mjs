import assert from 'node:assert/strict';
import {STYLES,QUALITIES,graphicsSettings,findStyle,createTextureProfiles,collectTextures} from '../graphics_settings.js';
assert.equal(STYLES.length,6);assert.equal(findStyle('DIORAMA'),1);assert.equal(findStyle('DIORAMA LEGACY'),1);
for(let s=0;s<STYLES.length;s++)for(let q=0;q<4;q++)for(const mode of [1,2])for(const zoom of [true,false]){
 const v=graphicsSettings(s,q,{mode,zoom});assert(v.scale>0);assert.equal(v.lens,1);assert.equal(v.legacy,s!==0);
 if(q===0||s===0){assert.equal(v.aa,0);assert.equal(v.blur,0);assert.equal(v.bloom,0);}
 const l=graphicsSettings(1,q,{mode,zoom});assert(v.blur<=l.blur);assert(v.near>=l.near);assert(v.far>=l.far);
 if(s===1){assert.equal(v.blur,Math.min(1,QUALITIES[q].blur*(mode===2?1.25:zoom?.35:.85)));assert.equal(v.near,mode===2?23:zoom?42:25);assert.equal(v.far,mode===2?53:zoom?115:85);}
}
assert.equal(graphicsSettings(0,2).scale,.8);assert.equal(graphicsSettings(0,2).q.shadow,2048);
const T={LinearFilter:1,LinearMipmapLinearFilter:2};
const a={isTexture:true,magFilter:3,minFilter:4,anisotropy:2,generateMipmaps:true},b={isTexture:true,magFilter:3,minFilter:4,anisotropy:1,generateMipmaps:false};
const all=collectTextures({traverse:fn=>fn({material:{map:a}})},[b]);assert.equal(all.size,2);
const apply=createTextureProfiles(T,all,8);apply(false,16);
assert.equal(a.magFilter,1);assert.equal(a.minFilter,2);assert.equal(a.anisotropy,8);assert.equal(b.minFilter,1);
apply(true,2);assert.equal(a.magFilter,3);assert.equal(a.minFilter,4);assert.equal(a.anisotropy,2);assert.equal(b.anisotropy,1);
console.log('PASS 96 style/quality/view/zoom combinations, exact Legacy, no stronger blur, original texture restoration');

for(const name of STYLES.slice(1).map(s=>s.name))assert(name.startsWith('DIORAMA LEGACY'));
assert.equal(graphicsSettings(3,2).blur,graphicsSettings(1,2).blur);assert(graphicsSettings(3,2).bloom>0);
