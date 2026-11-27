// Periodic baked three-octave value noise, same weights/scales as the BloodFX mask.
export function bakeBloodNoise(size=512,period=4){
 const data=new Uint8Array(size*size),layers=[{n:period*40,w:.125},{n:period*20,w:.25},{n:period*10,w:.5}].map(({n,w})=>{const a=new Float32Array(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const h=Math.sin(x*12.9898+y*78.233)*43758.5453;a[y*n+x]=h-Math.floor(h);}return {n,w,a};});
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){let sum=0;for(const {n,w,a} of layers){const x=(i+.5)*n/size,y=(j+.5)*n/size,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),a0=a[iy*n+ix],a1=a[iy*n+(ix+1)%n],b0=a[((iy+1)%n)*n+ix],b1=a[((iy+1)%n)*n+(ix+1)%n];sum+=w*((a0+(a1-a0)*u)*(1-v)+(b0+(b1-b0)*u)*v);}data[j*size+i]=Math.round(sum*255);}
 return data;
}
export function createBloodNoise(T){const tex=new T.DataTexture(bakeBloodNoise(),512,512,T.RedFormat);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.minFilter=tex.magFilter=T.LinearFilter;tex.generateMipmaps=false;tex.userData.lockPixelFilter=true;tex.needsUpdate=true;return tex;}
