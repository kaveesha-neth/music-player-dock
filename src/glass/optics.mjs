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

export function buttonLensGeometry(glassRect,logicalSize,buttonRect){
 if(!buttonRect||glassRect.width<=0||glassRect.height<=0||buttonRect.width<=0||buttonRect.height<=0)return {x:0,y:0,radius:0};
 const sx=logicalSize.width/glassRect.width,sy=logicalSize.height/glassRect.height;
 return {x:(buttonRect.left+buttonRect.width/2-glassRect.left)*sx-logicalSize.width/2,
 y:(buttonRect.top+buttonRect.height/2-glassRect.top)*sy-logicalSize.height/2,
 radius:Math.min(buttonRect.width*sx,buttonRect.height*sy)/2};
}
// CPU reference for the circular shader lens; the playback icon is a separate layer.
export function circularLensOffset(x,y,button,strength){
 const dx=x-button.x,dy=y-button.y,distance=Math.hypot(dx,dy),radius=button.radius;
 if(radius<1||distance>=radius||strength===0)return {x,y};
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
 const r=distance/radius,cover=1-smooth(1-Math.max(.02,1/radius),1,r);
 const bend=Math.pow(smooth(.45,.98,r),1.7)*radius*.38*strength*cover;
 return {x:x-dx/Math.max(distance,.001)*bend-dx*.025*strength*cover,
 y:y-dy/Math.max(distance,.001)*bend-dy*.025*strength*cover};
}
