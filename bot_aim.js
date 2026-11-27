// NPC-only perception: observe periodically, react, then move the aim toward a noisy sample.
// No changes to player spread or the common projectile / combat rules.
export function botAimProfile(skill){skill=Math.max(0,Math.min(1,skill));return {reaction:.30+.28*(1-skill),sample:.14+.10*(1-skill),error:.032+.033*(1-skill),lead:.42+.18*skill,tracking:6+4*skill};}
export function botAimError(profile,distance,moving,random){const angle=random()*Math.PI*2,r=Math.sqrt(random())*Math.max(.09,distance*profile.error)*(moving?1.28:1);return {side:Math.cos(angle)*r,up:Math.sin(angle)*r*.65};}
export function botReadyToShoot({seenFor,reaction,focus,range,aligned}){return seenFor>=reaction&&aligned&&(focus>(range<8?.23:.58)||range<3.5);}
