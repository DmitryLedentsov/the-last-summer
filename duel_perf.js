// Render-only optimizations. No change to world placement, collision rules or combat tick rate.
export function chunkIndices(points,size=36){
 const chunks=new Map();
 for(let i=0;i<points.length;i++){const [x,z]=points[i],key=Math.floor(x/size)+':'+Math.floor(z/size);let list=chunks.get(key);if(!list)chunks.set(key,list=[]);list.push(i);}
 return [...chunks.values()];
}
export function splitStaticInstances(T,scene,treeBatches){
 const trees=new Map(treeBatches.map(b=>[b.mesh,b.points])),result=[];
 for(const mesh of [...scene.children]){
  if(!mesh.isInstancedMesh||mesh.count<32){if(trees.has(mesh))result.push({mesh,points:trees.get(mesh)});continue;}
  const matrices=[],points=[],m=new T.Matrix4();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);matrices.push(m.clone());points.push([m.elements[12],m.elements[14]]);}
  const groups=chunkIndices(points,36);
  if(groups.length<2){if(trees.has(mesh))result.push({mesh,points:trees.get(mesh)});continue;}
  for(const ids of groups){
   const b=new T.InstancedMesh(mesh.geometry,mesh.material,ids.length);
   b.position.copy(mesh.position);b.quaternion.copy(mesh.quaternion);b.scale.copy(mesh.scale);
   b.castShadow=mesh.castShadow;b.receiveShadow=mesh.receiveShadow;b.visible=mesh.visible;b.renderOrder=mesh.renderOrder;b.layers.mask=mesh.layers.mask;b.name=mesh.name;
   ids.forEach((id,i)=>b.setMatrixAt(i,matrices[id]));
   if(mesh.instanceColor){const color=new T.Color();ids.forEach((id,i)=>{mesh.getColorAt(id,color);b.setColorAt(i,color);});}
   b.instanceMatrix.needsUpdate=true;b.computeBoundingSphere();scene.add(b);
   if(trees.has(mesh))result.push({mesh:b,points:ids.map(i=>trees.get(mesh)[i])});
  }
  scene.remove(mesh);mesh.dispose(); // InstancedMesh's own buffers only; shared geometry/material survive.
 }
 return result;
}
export function poseInterval(distanceSquared,isPlayer=false){
 return isPlayer||distanceSquared<18*18?0:distanceSquared<42*42?1/30:1/15;
}
export function takePoseDelta(actor,dt,distanceSquared,force=false,isPlayer=false){
 actor.poseElapsed=(actor.poseElapsed||0)+dt;
 if(!force&&actor.poseElapsed+1e-8<poseInterval(distanceSquared,isPlayer))return 0;
 const elapsed=actor.poseElapsed;actor.poseElapsed=0;return elapsed;
}
export function makeSightCache(maxAge=.10,maxMove=.30){
 const records=new WeakMap(),limit=maxMove*maxMove;
 const moved=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2>limit;
 return (a,b,from,to,time,cast)=>{
  let row=records.get(a);if(!row)records.set(a,row=new WeakMap());
  let old=row.get(b);
  if(old&&old.ag===(a.generation||0)&&old.bg===(b.generation||0)&&time-old.t<=maxAge&&!moved(from,old.from)&&!moved(to,old.to))return old.visible;
  const visible=cast(from,to);row.set(b,{from:{x:from.x,y:from.y,z:from.z},to:{x:to.x,y:to.y,z:to.z},t:time,ag:a.generation||0,bg:b.generation||0,visible});return visible;
 };
}
export function createHitFeedback(T,camera,layer){
 const slots=Array.from({length:12},()=>{const el=document.createElement('span');el.className='hit-popup';el.hidden=true;layer.appendChild(el);return {el,position:new T.Vector3(),remaining:0,duration:0};});
 const projected=new T.Vector3();
 function show(position,kill=false){
  const slot=slots.find(s=>s.remaining<=0)||slots.reduce((a,b)=>a.remaining<b.remaining?a:b);
  slot.position.copy(position);slot.duration=slot.remaining=kill?1.05:.68;
  slot.el.textContent=kill?'KILL':'HIT';slot.el.classList.toggle('kill',kill);slot.el.hidden=true;
 }
 function render(dt){
  for(const s of slots){if(s.remaining<=0)continue;s.remaining=Math.max(0,s.remaining-dt);if(!s.remaining){s.el.hidden=true;continue;}
   const progress=1-s.remaining/s.duration;
   projected.copy(s.position);projected.y+=.58*progress;projected.project(camera);
   const visible=projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<1.02&&Math.abs(projected.y)<1.02;
   s.el.hidden=!visible;if(!visible)continue;
   const x=(projected.x*.5+.5)*innerWidth,y=(.5-projected.y*.5)*innerHeight;
   const scale=1+.22*Math.max(0,1-progress*5);
   s.el.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-100%) scale('+scale+')';
   s.el.style.opacity=String(Math.min(1,s.remaining/.25));
  }
 }
 function clear(){for(const s of slots){s.remaining=0;s.el.hidden=true;}}
 return {show,render,clear};
}
// Same candidates, scores and order as the original steering. The upper bound
// excludes only candidates mathematically unable to beat the best score.
export function steeringChoice(heading,turn,stuck,velocity,lookDistance,p,actor,actors,allowed){
 const vx=velocity?.x||0,vz=velocity?.z||0,bonus=Math.hypot(vx,vz)*.06;
 let best=null,bestScore=-Infinity;
 for(const off of [0,.45,-.45,.9,-.9,1.4,-1.4,2,-2,2.7,-2.7,Math.PI]){
  const base=-Math.abs(off)*.65;
  if(best&&base+bonus<bestScore-1e-10)break;
  const angle=heading+off*turn,x=Math.sin(angle),z=Math.cos(angle),lx=p.x+x*lookDistance,lz=p.z+z*lookDistance;
  if(!allowed(lx,lz,.42)||!allowed(p.x+x*.32,p.z+z*.32,.39))continue;
  let score=base-(stuck>.55&&off===0?2:0);
  for(const b of actors)if(b!==actor&&b.alive&&(lx-b.root.position.x)**2+(lz-b.root.position.z)**2<.81)score-=2;
  score+=(x*vx+z*vz)*.06;
  if(score>bestScore){bestScore=score;best={x,z};}
 }
 return best;
}
export function createProfiler(renderer,element){
 let visible=false,frames=0,elapsed=0,sim=0,submit=0,calls=0,triangles=0,frameTimes=[],gpuMs=null,query=null,active=false;
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 function discard(){if(query&&!active){gl.deleteQuery(query);query=null;}}
 function toggle(){visible=!visible;element.hidden=!visible;frames=elapsed=sim=submit=calls=triangles=0;frameTimes=[];gpuMs=null;discard();}
 function beforeRender(){
  if(!visible||!ext)return;
  if(query&&gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;else gpuMs=null;discard();}
  if(!query&&frames%8===0){query=gl.createQuery();if(query){gl.beginQuery(ext.TIME_ELAPSED_EXT,query);active=true;}}
 }
 function afterRender(){if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);active=false;}}
 function sample(dt,simulationMs,renderMs,quality){
  if(!visible)return;frames++;elapsed+=dt;sim+=simulationMs;submit+=renderMs;calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;frameTimes.push(dt*1000);
  if(elapsed>=.6){const sorted=frameTimes.slice().sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];element.textContent=Math.round(frames/elapsed)+' FPS  |  FRAME P95 '+p95.toFixed(1)+' ms\nSIM '+(sim/frames).toFixed(1)+' ms  |  SUBMIT '+(submit/frames).toFixed(1)+' ms  |  GPU '+(gpuMs===null?'n/a':gpuMs.toFixed(1)+' ms')+'\nDRAW '+Math.round(calls/frames)+'  |  TRI '+Math.round(triangles/frames).toLocaleString('en-US')+'  |  '+quality+' / F4';frames=elapsed=sim=submit=calls=triangles=0;frameTimes=[];}
 }
 return {toggle,beforeRender,afterRender,sample};
}
