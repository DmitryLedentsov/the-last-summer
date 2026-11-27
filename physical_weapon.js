// Authoritative muzzle from body transform + aim, never a bone or a rendered mesh.
// Metres, Y-up, yaw=0 faces +Z. Aim is the requested world point.
// The nominal shoulder and reach match the 1.78m character and 0.50m grip reach.
export function physicalMuzzle(position,yaw,aim,stance=0){
 const sn=Math.sin(yaw),cs=Math.cos(yaw),shoulder={x:position.x-cs*.18,y:position.y+1.39-.14*stance,z:position.z+sn*.18};
 let x=aim.x-shoulder.x,y=aim.y-shoulder.y,z=aim.z-shoulder.z,n=Math.hypot(x,y,z);if(n<.001){x=sn;y=0;z=cs;n=1;}
 const reach=Math.min(.73,Math.max(0,n-.12));return {x:shoulder.x+x/n*reach,y:shoulder.y+y/n*reach-.02,z:shoulder.z+z/n*reach};
}
