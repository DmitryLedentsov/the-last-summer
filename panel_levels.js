const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const mound=(x,z,cx,cz,w,h)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/w**2);
const ripple=(x,z)=>.13*Math.sin(x*.18+z*.08)+.08*Math.cos(z*.21-x*.12)+.04*Math.sin(x*.43+z*.29);
const seg=(x,z,ax,az,bx,bz)=>{let dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz));return Math.hypot(x-ax-t*dx,z-az-t*dz);};
const path=(pts,x,z)=>Math.min(...pts.slice(1).map((p,i)=>seg(x,z,...pts[i],...p)));
const distance=(paths,x,z)=>Math.min(...paths.map(p=>path(p,x,z)));
// Measured from the FBX vertices with authored transforms, with original yaw removed.
const houseInfo={ 'house03.fbx':{dims:[478.5,400,294.7],yaw:0,h:13.2}, 'house02.fbx':{dims:[427.6,343.6,264.7],yaw:0,h:14.5}, 'house06.fbx':{dims:[500,910,230],yaw:-28.798584,h:45}, 'house07.fbx':{dims:[1618.9,570,290],yaw:22.444203,h:25.5} };
function house(model,x,z,rot=0){const m=houseInfo[model],scale=m.h/m.dims[1],w=m.dims[0]*scale,d=m.dims[2]*scale;return {model,x,z,rot,height:m.h,correction:-m.yaw*Math.PI/180,footprint:[Math.abs(Math.cos(rot))*w+Math.abs(Math.sin(rot))*d,Math.abs(Math.sin(rot))*w+Math.abs(Math.cos(rot))*d]};}
const yardHouses=[house('house07.fbx',-33,0,Math.PI/2),house('house03.fbx',20,19),house('house03.fbx',20,-16,Math.PI),house('house06.fbx',3,-48),house('house02.fbx',47,-8,Math.PI/2)];
const outskirtsHouses=[house('house07.fbx',-32,38,Math.PI),house('house06.fbx',49,-36),house('house03.fbx',-47,-52),house('house02.fbx',52,48)];
const ring=Array.from({length:49},(_,i)=>[4+20*Math.cos(i*Math.PI/24),8+13*Math.sin(i*Math.PI/24)]);
function rect(x,z,cx,cz,rx,rz){return Math.hypot(Math.max(0,Math.abs(x-cx)-rx),Math.max(0,Math.abs(z-cz)-rz));}
function houseDist(list,x,z){return Math.min(...list.map(h=>rect(x,z,h.x,h.z,h.footprint[0]/2,h.footprint[1]/2)));}
function make(cfg){return {...cfg,
 distance(x,z){return distance(this.paths,x,z);},road(x,z){return distance(this.roads,x,z);},
 height(x,z){let h=ripple(x,z)+mound(x,z,-65,62,30,1.7)+mound(x,z,64,-58,30,1.7)-mound(x,z,0,0,80,.65);h=mix(h,.08,1-smooth(this.roadWidth+1,8.5,this.road(x,z)));h=mix(h,.12,1-smooth(1.2,6,this.distance(x,z)));for(const site of this.houses)h=mix(h,.14,1-smooth(2,8,rect(x,z,site.x,site.z,site.footprint[0]/2,site.footprint[1]/2)));return h;},
 treeZone(x,z){return this.sceneType==='yard'?clamp(.20+.48*Math.exp(-((x+20)**2+(z-3)**2)/600)+.2*Math.exp(-((x-7)**2+(z-33)**2)/330)+.25*Math.exp(-((x+56)**2+(z+46)**2)/900)+.14*Math.sin(x*.18+z*.1)):clamp(.04+.55*Math.exp(-((x+65)**2+(z-48)**2)/900)+.55*Math.exp(-((x-67)**2+(z+50)**2)/1300)+.28*Math.exp(-((x+40)**2+(z+42)**2)/700));},
 reserved(x,z){return houseDist(this.houses,x,z)<1.5||this.distance(x,z)<1.15||this.road(x,z)<this.roadWidth+.4||this.clear(x,z);}
};}
export const levels={
 yard:make({id:'yard',sceneType:'yard',title:'Тихий квартал',subtitle:'Август. После семи.',sky:'sunset',fog:0xba9a84,density:.012,hemi:0xe5d6c5,ground:0x77745e,ambient:1.65,sun:0xffcb96,sunPower:1.55,sunPos:[-47,22,-60],size:154,limit:69,seed:5182,spawn:[-11,53],yaw:.10,grass:'WildForestClover',path:'ForestEarthGround',houses:yardHouses,trailWidth:1.25,roadWidth:2.65,trees:108,grassCount:8700,
 roads:[[[-18,66],[-18,-30],[-16,-61]], [[-18,35],[32,35],[64,35]], [[-18,-30],[32,-30],[65,-30]], [[33,35],[33,-30]]],
 paths:[[[-11,63],[-11,31],[-9,16],[-9,-17],[-11,-39],[-11,-60]], [[-23,32],[-23,-32]], [[-23,4],[7,4],[13,12],[20,12]], [[-9,-18],[11,-18]], [[7,4],[20,4],[32,4]]],
 clear:(x,z)=>rect(x,z,-1,2,8,6)<.5||rect(x,z,50,51,14,5)<.5||rect(x,z,49,20,9,6)<.5}),
 outskirts:make({id:'outskirts',sceneType:'outskirts',title:'Пустырь у кольца',subtitle:'Конечная. Перед дождём.',sky:'mist',fog:0xa8b3b1,density:.014,hemi:0xe0e5dc,ground:0x7b847d,ambient:1.9,sun:0xcbd4d0,sunPower:.75,sunPos:[-18,33,-26],size:168,limit:74,seed:7719,spawn:[18,59],yaw:.10,grass:'ForestWildGround',path:'ForestGravel_Ground',houses:outskirtsHouses,trailWidth:1.25,roadWidth:3.1,trees:72,grassCount:7800,
 roads:[[[-78,-12],[4,-12],[78,-12]],ring,[[4,-12],[4,-5]], [[24,8],[36,18],[38,58]], [[-70,50],[38,50]]],
 paths:[[[18,68],[18,48],[16,32],[11,27],[5,25],[-7,24],[-22,20],[-32,9],[-34,-9],[-35,-24]], [[28,4],[37,-5],[38,-26],[48,-26]], [[-23,-17],[-23,-37],[-35,-44],[-47,-44]], [[38,18],[54,18],[61,30]]],
 clear:(x,z)=>rect(x,z,50,25,14,5)<.5||rect(x,z,-49,-31,14,11)<.5||rect(x,z,3,8,14,7)<.5&&Math.sin(x*.3+z*.2)<0})
};
export function pathWeight(level,x,z){return 1-smooth(level.trailWidth*.65,level.trailWidth+.8,level.distance(x,z)+.12*Math.sin(z*1.3+x*.5));}
