import assert from 'node:assert/strict';
import {createSceneStyles,lightingForStyle,LIGHT_PROFILES} from '../scene_style.js';
class Color{
 constructor(value){this.value=value} clone(){return new Color(this.value)} copy(c){this.value=c.value;return this}
}
class FogExp2{constructor(color,density){this.color=color.clone();this.density=density;this.isFogExp2=true;}}
class ShaderMaterial{constructor(opts){Object.assign(this,opts);}}
class PlaneGeometry{rotateX(){}}
const T={Color,FogExp2,ShaderMaterial,PlaneGeometry};
const texture={name:'grass'},trail={name:'earth'},shader=()=>trail;
const groundMaterial={map:texture,onBeforeCompile:shader,color:new Color(0xe0ddce),roughness:1};
const terrain={isMesh:true,material:groundMaterial,geometry:{attributes:{trailWeight:{}}}};
const leaves={map:{name:'leaf'},alphaTest:.42,color:new Color(0xffffff)};
const tree={isMesh:true,material:[leaves]};
const body={isMesh:true,material:{map:{name:'hazmat'},color:new Color(0xffffff)}};
const hemi={isHemisphereLight:true,color:new Color(0xe0c0cf),groundColor:new Color(0x857858),intensity:1.55};
const sun={color:new Color(0xffba87),intensity:2.15};
const fog=new FogExp2(new Color(0xc58c83),.0105),sky={name:'sunset'};
const scene={children:[terrain,tree,body,hemi,sun],background:sky,fog,
 traverse(fn){for(const o of this.children)fn(o);},add(o){this.children.push(o);}};
const renderer={toneMapping:4,toneMappingExposure:1.15,shadowMap:{needsUpdate:false}};
const originalMaterials=scene.children.map(o=>o.material);
const originalGeometry=terrain.geometry;
const originalAttributes=terrain.geometry.attributes;
const looks=createSceneStyles(T,{scene,renderer,sun,actors:[],height:()=>0});
const baseline={sunIntensity:2.15,hemiIntensity:1.55,fogDensity:.0105,exposure:1.15};
for(let i=0;i<5;i++)for(const style of ['DIORAMA LEGACY','LEGACY CLEAR','LEGACY SOFT','LEGACY VOLUME','LEGACY AIR','RETRO']){
 looks.apply(style);looks.update();
 for(let j=0;j<originalMaterials.length;j++)assert.equal(scene.children[j].material,originalMaterials[j]);
 assert.equal(terrain.geometry,originalGeometry);assert.equal(terrain.geometry.attributes,originalAttributes);
 assert.equal(groundMaterial.map,texture);assert.equal(groundMaterial.onBeforeCompile,shader);
 assert.equal(groundMaterial.onBeforeCompile(),trail);
 assert.equal(groundMaterial.color.value,0xe0ddce);assert.equal(groundMaterial.roughness,1);
 assert.equal(leaves.alphaTest,.42);assert.equal(leaves.color.value,0xffffff);
 assert.equal(scene.background,sky);assert.equal(scene.fog.color.value,0xc58c83);
 assert.equal(sun.color.value,0xffba87);assert.equal(hemi.color.value,0xe0c0cf);assert.equal(hemi.groundColor.value,0x857858);
 const expected=lightingForStyle(baseline,style);
 assert.equal(sun.intensity,expected.sunIntensity);assert.equal(hemi.intensity,expected.hemiIntensity);
 assert.equal(scene.fog.density,expected.fogDensity);assert.equal(renderer.toneMappingExposure,1.15);assert.equal(renderer.toneMapping,4);
 if(style==='RETRO'){assert.equal(scene.fog,fog);assert.equal(sun.intensity,2.15);assert.equal(hemi.intensity,1.55);}
}
console.log('PASS repeated style changes preserve all materials, terrain shader, textures, geometry, baseline light colors and exact Retro restoration');
