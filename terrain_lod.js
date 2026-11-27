// Chunked visual geometry only. All physical height samples remain unchanged.
// Coarse cells keep every vertex along chunk boundaries, so adjacent LODs cannot open cracks.
export function chunkIndices(width,height,stride=1){
 const out=[],at=(x,z)=>z*(width+1)+x;
 for(let z=0;z<height;z+=stride)for(let x=0;x<width;x+=stride){
 const X=Math.min(width,x+stride),Z=Math.min(height,z+stride);
 if(stride===1||((x>0&&X<width)&&(z>0&&Z<height))||X-x<2||Z-z<2){out.push(at(x,z),at(x,Z),at(X,z),at(X,z),at(x,Z),at(X,Z));continue;}
 const ring=[[x,z]];for(let j=z+(x===0?1:Z-z);j<Z;j+=x===0?1:Z-z)ring.push([x,j]);ring.push([x,Z]);
 for(let i=x+(Z===height?1:X-x);i<X;i+=Z===height?1:X-x)ring.push([i,Z]);ring.push([X,Z]);
 for(let j=Z-(X===width?1:Z-z);j>z;j-=X===width?1:Z-z)ring.push([X,j]);ring.push([X,z]);
 for(let i=X-(z===0?1:X-x);i>x;i-=z===0?1:X-x)ring.push([i,z]);
 const c=at(Math.floor((x+X)/2),Math.floor((z+Z)/2));for(let i=0;i<ring.length;i++)out.push(c,at(...ring[i]),at(...ring[(i+1)%ring.length]));
 }return out;
}
export function createTerrainLOD(T,scene,terrain){
 const g=terrain?.geometry,p=g?.attributes?.position,side=Math.sqrt(p?.count||0),segments=side-1;
 if(!g?.attributes?.trailWeight||!Number.isInteger(side)||segments<32)return null;
 const chunks=[],size=24;for(let z=0;z<segments;z+=size)for(let x=0;x<segments;x+=size){
 const w=Math.min(size,segments-x),h=Math.min(size,segments-z),geo=new T.BufferGeometry();
 for(const [name,a] of Object.entries(g.attributes)){const arr=new a.array.constructor((w+1)*(h+1)*a.itemSize);let k=0;for(let j=0;j<=h;j++)for(let i=0;i<=w;i++){const src=((z+j)*side+x+i)*a.itemSize;for(let n=0;n<a.itemSize;n++)arr[k++]=a.array[src+n];}geo.setAttribute(name,new T.BufferAttribute(arr,a.itemSize,a.normalized));}
 const indices=[1,2,4].map(n=>new T.BufferAttribute(Uint16Array.from(chunkIndices(w,h,n)),1));geo.setIndex(indices[0]);geo.computeBoundingBox();geo.computeBoundingSphere();
 const mesh=new T.Mesh(geo,terrain.material);mesh.name='terrain-chunk';mesh.castShadow=terrain.castShadow;mesh.receiveShadow=terrain.receiveShadow;mesh.renderOrder=terrain.renderOrder;mesh.matrixAutoUpdate=false;mesh.matrix.copy(terrain.matrix);scene.add(mesh);const c=geo.boundingSphere.center;chunks.push({mesh,indices,x:c.x,z:c.z,lod:0,r:geo.boundingSphere.radius});
 }terrain.visible=false;let lastX=Infinity,lastZ=Infinity,lastQ=-1,triangles=0;
 function update(o,q){if(q===lastQ&&Math.hypot(o.x-lastX,o.z-lastZ)<2)return;lastX=o.x;lastZ=o.z;lastQ=q;triangles=0;for(const c of chunks){const d=Math.max(0,Math.hypot(o.x-c.x,o.z-c.z)-c.r),near=[24,35,48,65][q],far=[48,70,90,120][q],lod=d<near?0:d<far?1:2;if(lod!==c.lod){c.lod=lod;c.mesh.geometry.setIndex(c.indices[lod]);}triangles+=c.indices[lod].count/3;}}
 return {update,stats:()=>({chunks:chunks.length,triangles,full:g.index.count/3}),dispose(){for(const c of chunks){scene.remove(c.mesh);c.mesh.geometry.dispose();}terrain.visible=true;}};
}
