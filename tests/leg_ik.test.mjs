import assert from 'node:assert/strict';
import {legReach} from '../leg_ik.js';
for(const l of [.35,.42,.49])for(const m of [.33,.40,.48])for(const d of [0,.2,.4,.6,.8,1,2]){const r=legReach(l,m,d);const angle=Math.acos((r*r-l*l-m*m)/(2*l*m))*180/Math.PI;assert(angle>=7-1e-8&&angle<=110+1e-8);assert(r<l+m&&r>Math.abs(l-m));}
console.log('PASS anatomical reach bounds');
