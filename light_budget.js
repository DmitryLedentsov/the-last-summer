// Keep the authored light objects as animation data; render only a fixed nearest-light pool.
export function createLightBudget(T,scene){
 const sources=[];scene.traverse(o=>{if(o.isPointLight&&!o.castShadow&&o.name!=='muzzle-light')sources.push(o);});
 if(!sources.length)return null;
 // The muzzle light is named before this function runs; it always stays independent.
 for(const l of sources){l.updateWorldMatrix(true,false);l.userData.budgetPosition=l.getWorldPosition(new T.Vector3());l.userData.budgetParent=l.parent;l.removeFromParent();}
 const pool=[];let count=0;
 function update(o,q){const limit=Math.min(sources.length,[2,3,5,8][q]);while(pool.length<limit){const l=new T.PointLight(0xffffff,0,1,2);scene.add(l);pool.push(l);}while(pool.length>limit)scene.remove(pool.pop());const ranked=sources.map(l=>({l,d:l.userData.budgetPosition.distanceTo(o)})).sort((a,b)=>a.d-b.d);count=0;for(let i=0;i<pool.length;i++){const {l,d}=ranked[i],p=pool[i];p.position.copy(l.userData.budgetPosition);p.color.copy(l.color);p.distance=l.distance;p.decay=l.decay;p.intensity=d>l.distance+45?0:l.intensity;if(p.intensity>0)count++;}}
 return {update,stats:()=>({active:count,total:sources.length,pool:pool.length}),dispose(){for(const p of pool)scene.remove(p);pool.length=0;for(const l of sources){l.userData.budgetParent?.add(l);delete l.userData.budgetParent;}}};
}
