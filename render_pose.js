// Render-only interpolation. Simulation always sees the latest authoritative pose.
export function createRenderPose(root){
 const entries=[];
 root.traverse(node=>{if(!node.matrixAutoUpdate)return;entries.push({
  node,previousP:node.position.clone(),previousQ:node.quaternion.clone(),previousS:node.scale.clone(),
  currentP:node.position.clone(),currentQ:node.quaternion.clone(),currentS:node.scale.clone()
 });});
 let applied=false;
 return {
  capturePrevious(){for(const e of entries){e.previousP.copy(e.node.position);e.previousQ.copy(e.node.quaternion);e.previousS.copy(e.node.scale);}},
  apply(alpha){
   if(applied)throw Error('Render pose already applied');
   alpha=Math.max(0,Math.min(1,alpha));applied=true;
   for(const e of entries){const n=e.node;e.currentP.copy(n.position);e.currentQ.copy(n.quaternion);e.currentS.copy(n.scale);
    n.position.copy(e.previousP).lerp(e.currentP,alpha);n.quaternion.copy(e.previousQ).slerp(e.currentQ,alpha);n.scale.copy(e.previousS).lerp(e.currentS,alpha);}
   root.updateMatrixWorld(true);
  },
  restore(){if(!applied)return;for(const e of entries){e.node.position.copy(e.currentP);e.node.quaternion.copy(e.currentQ);e.node.scale.copy(e.currentS);}applied=false;root.updateMatrixWorld(true);}
 };
}
