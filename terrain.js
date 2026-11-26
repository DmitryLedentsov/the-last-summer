// Shared grid: rendered triangles and character height use the same samples.
export function createHeightfield({size=96,segments=144,height}) {
  const step=size/segments,half=size/2, side=segments+1;
  const values=new Float32Array(side*side);
  for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++)values[j*side+i]=height(i*step-half,j*step-half);
  function sample(x,z) {
    const u=Math.max(0,Math.min(segments,(x+half)/step)),v=Math.max(0,Math.min(segments,(z+half)/step));
    const i=Math.min(segments-1,Math.floor(u)),j=Math.min(segments-1,Math.floor(v)),a=u-i,b=v-j,k=j*side+i;
    const h00=values[k],h10=values[k+1],h01=values[k+side],h11=values[k+side+1];
    return a+b<=1?h00+(h10-h00)*a+(h01-h00)*b:h11+(h01-h11)*(1-a)+(h10-h11)*(1-b);
  }
  return {size,half,segments,step,side,values,sample};
}
export function buildTerrainGeometry(THREE,field,trailMask) {
  const {side,segments,step,half,values}=field,n=side*side, p=new Float32Array(n*3),uv=new Float32Array(n*2), mask=new Float32Array(n),idx=[];
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
    const k=j*side+i,x=i*step-half,z=j*step-half;
    p.set([x,values[k],z],k*3);uv.set([x*.72,z*.72],k*2);mask[k]=trailMask(x,z);
    if(i<segments&&j<segments)idx.push(k,k+side,k+1,k+1,k+side,k+side+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('trailWeight',new THREE.BufferAttribute(mask,1));g.setIndex(idx);g.computeVertexNormals();return g;
}
