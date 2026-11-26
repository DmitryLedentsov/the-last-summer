const hill=(x,z,cx,cz,w,h)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(w*w));
const wave=(x,z)=>.48*Math.sin(x*.36+z*.16)+.34*Math.cos(z*.32-x*.21)+.16*Math.sin(x*.81+z*.45);
export const levels={
 sunset:{title:'Лес за городом', subtitle:'Последний свет',sky:'sunset',fog:0xc58c83,density:.014,hemi:0xe0c0cf,ground:0x857858,ambient:1.55,sun:0xffba87,sunPower:2.15,sunPos:[-28,12,-50],size:100,limit:42,seed:631,spawn:[0,27],yaw:0,grass:'WildForestGrass',path:'ForestEarthGround',trees:145,grassCount:4400, trail:z=>3.8*Math.sin(z*.10)+1.2*Math.sin(z*.24),trailWidth:1.35,
 height:(x,z)=>wave(x,z)+hill(x,z,-16,1,13,6)+hill(x,z,18,14,14,4.4)+hill(x,z,0,-17,16,5.5)-hill(x,z,13,-39,18,6),
 treeSpecies:['PSX_Tree1','PSX_Tree2','PSX_Tree3','PSX_Tree4'],flowers:'PSX_Lavender', message:'Последние огни города уже погасли.'},
 mist:{title:'Туманная низина',subtitle:'До первого поезда',sky:'mist',fog:0xaabeb6,density:.038,hemi:0xdce8e0,ground:0x778f79,ambient:2.05,sun:0xcbd8d0,sunPower:.85,sunPos:[-20,27,-15],size:108,limit:45,seed:196,spawn:[0,31],yaw:0,grass:'WildForestClover',path:'ForestGravel_Ground',trees:65,grassCount:3600,trail:z=>6*Math.sin(z*.065),trailWidth:1.7,
 height:(x,z)=>wave(x,z)*.52+hill(x,z,-24,-12,19,4)+hill(x,z,22,13,15,3.8)-hill(x,z,5,-14,11,2.0),
 treeSpecies:['PSX_Tree1','PSX_Tree3','PSX_Tree4'],flowers:'PSX_Reed',message:'Тишина здесь кажется почти осязаемой.'},
 twilight:{title:'Каменный перевал',subtitle:'Место, которого нет',sky:'twilight',fog:0x536e68,density:.027,hemi:0x9ebfcb,ground:0x8c8871,ambient:1.45,sun:0xa3d9cb,sunPower:1.7,sunPos:[-35,19,-10],size:92,limit:38,seed:920,spawn:[0,25],yaw:0,grass:'ForestWildGround',path:'ForestDryGround',trees:72,grassCount:2200,trail:z=>4.8*Math.sin(z*.095),trailWidth:1.35,
 height:(x,z)=>wave(x,z)*1.1+hill(x,z,-15,-3,11,7)+hill(x,z,16,4,11,8)+hill(x,z,1,-24,16,7)-hill(x,z,0,24,14,2),
 treeSpecies:['PSX_Tree2','PSX_Tree3','PSX_Tree4'],flowers:'PSX_Lavender',message:'Камни помнят то, чего никогда не случалось.'}
};
export function trailMask(level,x,z){const d=Math.abs(x-level.trail(z)),w=level.trailWidth;return Math.max(0,Math.min(1,(w+.7-d)/1.1));}
