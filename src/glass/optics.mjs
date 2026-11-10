export function roundedDistance(x,y,width,height,radius){
 const qx=Math.abs(x)-(width/2-radius),qy=Math.abs(y)-(height/2-radius);
 return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
}
export function lensOffset(x,y,width,height,radius,strength,edgeWarp=strength){
 const d=roundedDistance(x,y,width,height,radius),band=Math.min(radius*1.6,Math.min(width,height)*.25);
 const edge=Math.max(0,Math.min(1,1-Math.max(0,-d)/band));
 let nx=roundedDistance(x+.5,y,width,height,radius)-roundedDistance(x-.5,y,width,height,radius);
 let ny=roundedDistance(x,y+.5,width,height,radius)-roundedDistance(x,y-.5,width,height,radius);
 const length=Math.hypot(nx,ny)||1;nx/=length;ny/=length;
 const bend=Math.pow(edge,1.7)*edgeWarp*Math.min(width,height)*.18;
 return {x:x-nx*bend-x*.018*strength,y:y-ny*bend-y*.018*strength,edge};
}
// CSS viewport coordinates -> the cropped physical desktop texture, including DPI/UI scale.
export function textureMapping(frame,rect,viewport){
 const sx=frame.windowWidth/viewport.width,sy=frame.windowHeight/viewport.height;
 return {x:(frame.left+rect.left*sx)/frame.sourceWidth,y:(frame.top+rect.top*sy)/frame.sourceHeight,
 width:rect.width*sx/frame.sourceWidth,height:rect.height*sy/frame.sourceHeight};
}
