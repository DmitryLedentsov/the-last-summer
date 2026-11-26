// FBX mesh local -Y is forward, +Z is up. Gameplay socket expects +X forward, +Y up.
export const MALORIAN = Object.freeze({scale: .118, grip: [0,.96,-.33], muzzle: [-.02,-1.182,.20]});
export function socketPoint([x,y,z]) {
 const [gx,gy,gz]=MALORIAN.grip,s=MALORIAN.scale;
 return [(gy-y)*s,(z-gz)*s,(gx-x)*s];
}
export function prepareMalorian(T,source,texture) {
 let body;
 source.traverse(o=>{if(o.isMesh&&o.name==='Malorian')body=o;});
 if(!body)throw Error('Malorian: pistol mesh missing');
 const geometry=body.geometry.clone();
 const basis=new T.Matrix4().makeBasis(new T.Vector3(0,0,-1),new T.Vector3(-1,0,0),new T.Vector3(0,1,0));
 geometry.translate(...MALORIAN.grip.map(v=>-v));
 geometry.applyMatrix4(basis);geometry.scale(MALORIAN.scale,MALORIAN.scale,MALORIAN.scale);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.clearGroups();
 const material=new T.MeshStandardMaterial({map:texture,roughness:.85,metalness:.08,side:T.DoubleSide});
 const mesh=new T.Mesh(geometry,material);mesh.name='Malorian';mesh.castShadow=true;
 const root=new T.Group();root.add(mesh);return root;
}
