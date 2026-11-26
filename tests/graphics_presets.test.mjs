import assert from 'node:assert/strict';
import {STYLES,QUALITIES,graphicsSettings,createTextureProfiles,collectTextures} from '../graphics_settings.js';
assert.equal(STYLES.length,4);assert.equal(STYLES[1].name,'STYLIZED');assert.equal(QUALITIES.length,4);
for(let s=0;s<4;s++)for(let q=0;q<4;q++){
 const a=graphicsSettings(s,q);assert(a.scale>0);if(q===0||s===0){assert.equal(a.aa,0);assert.equal(a.blur,0);assert.equal(a.bloom,0);}
}
assert.equal(graphicsSettings(0,2).scale,.8);assert.equal(graphicsSettings(0,2).q.shadow,2048);
assert(graphicsSettings(2,2,{mode:2}).blur>graphicsSettings(2,2).blur);
assert(graphicsSettings(2,2,{zoom:true}).blur<graphicsSettings(2,2).blur);
assert(graphicsSettings(2,2,{zoom:true}).near>graphicsSettings(2,2).near);
const T={LinearFilter:1,LinearMipmapLinearFilter:2};
const a={isTexture:true,magFilter:3,minFilter:4,anisotropy:2,generateMipmaps:true},b={isTexture:true,magFilter:3,minFilter:4,anisotropy:1,generateMipmaps:false};
const all=collectTextures({traverse:fn=>fn({material:{map:a}})},[b]);assert.equal(all.size,2);
const apply=createTextureProfiles(T,all,8);apply(false,16);
assert.equal(a.magFilter,1);assert.equal(a.minFilter,2);assert.equal(a.anisotropy,8);assert.equal(b.minFilter,1);
apply(true,2);assert.equal(a.magFilter,3);assert.equal(a.minFilter,4);assert.equal(a.anisotropy,2);assert.equal(b.anisotropy,1);
assert.equal(graphicsSettings(3,3).ao,true);assert.equal(graphicsSettings(3,2).ao,false);
assert.equal(graphicsSettings(1,2).blur,0);assert.equal(graphicsSettings(2,0).blur,0);
console.log('PASS 16 graphics combinations, depth ranges and texture restoration');
