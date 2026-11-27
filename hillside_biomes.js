// Shared visual masks for ground textures and local vegetation distribution.
import {cityDistance,roadAt,trailWeight,forestDensity} from './hillside_layout.js?v=067';
const clamp=x=>Math.max(0,Math.min(1,x));
export function biomeAt(x,z,y,slope){
 const woods=forestDensity(x,z,y),city=1-clamp(cityDistance(x,z)/14);
 const patch=clamp(.5+.27*Math.sin(x*.31+z*.13)+.18*Math.cos(z*.44-x*.19)+.10*Math.sin(x*.91+z*.83));
 const dry=clamp((slope-.25)*1.25+(y-22)*.023)*(1-city);
 const forest=clamp(woods*1.35)*(1-dry)*(1-city*.65);
 const clover=city*(.42+.5*patch)*(1-dry)*(1-forest);
 const short=clamp((1-patch)*.65)*(1-dry)*(1-forest)*(1-clover);
 const road=roadAt(x,z).distance;
 return {woods,city,patch,dry,forest,clover,short,road,trail:trailWeight(x,z)};
}
export function plantChance(kind,b){
 const edge=Math.exp(-((b.road-4.1)**2)/5.5),lush=(1-b.dry*.78);
 if(kind==='reed')return lush*(.025+.58*edge*b.patch+.33*b.city*b.patch);
 if(kind==='lavender')return lush*(.07+.45*b.patch*(1-b.forest)+.13*edge);
 if(kind==='flower')return lush*(.08+.40*b.patch*(1-b.forest)+.19*edge);
 if(kind==='plant')return lush*(.10+.59*b.forest+.27*b.city);
 if(kind==='naturegrass')return lush*(.22+.48*b.forest+.20*b.city+.12*edge);
 return lush*(.30+.42*b.patch+.21*edge+.20*b.city);
}
