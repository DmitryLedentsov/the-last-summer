// Calibrate a stable hinge plane from the authored rig. One solve per leg per frame.
// All lengths and targets are in world units; bend references are body-relative.
export function legReach(upper,lower,distance){
 const bounded=angle=>Math.sqrt(upper*upper+lower*lower+2*upper*lower*Math.cos(angle));
 return Math.max(bounded(110*Math.PI/180),Math.min(bounded(7*Math.PI/180),distance));
}
export function createLegSolver(T,root,legs){
 const v=()=>new T.Vector3(),q=()=>new T.Quaternion(),world=b=>b.getWorldPosition(v());
 const project=(n,axis)=>n.clone().addScaledVector(axis,-n.dot(axis));
 function basis(axis,normal){
  const x=axis.clone().normalize(),z=project(normal,x).normalize(),y=z.clone().cross(x).normalize();
  return new T.Matrix4().makeBasis(x,y,z);
 }
 function setWorld(b,rotation){b.quaternion.copy(b.parent.getWorldQuaternion(q()).invert().multiply(rotation));b.updateWorldMatrix(false,true);}
 root.updateMatrixWorld(true);
 const rq=root.getWorldQuaternion(q()),forward=new T.Vector3(0,0,1).applyQuaternion(rq);
 const entries=legs.map(([hip,knee,foot])=>{
  const a=world(hip),b=world(knee),c=world(foot),axis=c.clone().sub(a).normalize();
  let pole=project(b.clone().sub(a),axis),fallback=project(forward,axis);
  if(pole.length()<.012||pole.dot(fallback)<=0)pole=fallback;
  if(pole.lengthSq()<1e-8)pole=project(new T.Vector3(1,0,0).applyQuaternion(rq),axis);
  pole.normalize();
  const normal=axis.clone().cross(pole).normalize();
  const calibrate=(bone,segment)=>{
   const inv=bone.getWorldQuaternion(q()).invert();
   return basis(segment.applyQuaternion(inv),normal.clone().applyQuaternion(inv)).invert();
  };
  return {hip,knee,foot,pole:pole.clone().applyQuaternion(rq.clone().invert()),normal:normal.clone().applyQuaternion(rq.clone().invert()),
   upper:calibrate(hip,b.clone().sub(a)),lower:calibrate(knee,c.clone().sub(b)),
   // Store exact rest offsets rather than using the other leg as the pole.
   rest:root.worldToLocal(c.clone())};
 });
 function solve(i,target,footRotation,bodyQ){
  const e=entries[i],{hip,knee,foot}=e,a=world(hip),b=world(knee),c=world(foot);
  const l=a.distanceTo(b),m=b.distanceTo(c),axis=target.clone().sub(a);
  if(l<.001||m<.001||axis.lengthSq()<1e-8)return false;
  const length=legReach(l,m,axis.length());axis.normalize();
  let pole=project(e.pole.clone().applyQuaternion(bodyQ),axis);
  if(pole.lengthSq()<1e-6)pole=e.normal.clone().applyQuaternion(bodyQ).cross(axis);
  if(pole.lengthSq()<1e-8)return false;pole.normalize();
  const along=(l*l-m*m+length*length)/(2*length),bend=Math.sqrt(Math.max(0,l*l-along*along));
  const joint=a.clone().addScaledVector(axis,along).addScaledVector(pole,bend),end=a.clone().addScaledVector(axis,length),normal=axis.clone().cross(pole).normalize();
  const upperQ=q().setFromRotationMatrix(basis(joint.clone().sub(a),normal).multiply(e.upper));
  const lowerQ=q().setFromRotationMatrix(basis(end.clone().sub(joint),normal).multiply(e.lower));
  setWorld(hip,upperQ);setWorld(knee,lowerQ);setWorld(foot,footRotation);
  return true;
 }
 return {entries,solve};
}
