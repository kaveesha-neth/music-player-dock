import {defaults} from './policy.mjs';
// Logical pixels shared by CSS layout, native content bounds and pointer hit testing.
export function createGeometry(settings={}){
 const s={...defaults,...settings},width=s.dockWidth,height=s.dockHeight,p=s.dockPadding;
 const artSize=Math.min(s.artworkSize,height-p*2,width-p*3-228);
 return {windowWidth:width+24,windowHeight:height+24,
 expanded:{x:12,y:12,width,height,radius:s.cornerRadius},
 idle:{x:(width+24-320)/2,y:12,width:320,height:80,radius:s.cornerRadius},artSize,artColumn:s.showArtwork?artSize+p:0};
}
export const geometry=createGeometry();
export function getGeometryStyle(settings={}){
 const s={...defaults,...settings},g=createGeometry(s);
 return {'--window-width':g.windowWidth+'px','--window-height':g.windowHeight+'px',
 '--dock-x':g.expanded.x+'px','--dock-y':g.expanded.y+'px','--dock-width':g.expanded.width+'px','--dock-height':g.expanded.height+'px',
 '--idle-x':g.idle.x+'px','--idle-width':g.idle.width+'px','--idle-height':g.idle.height+'px',
 '--corner-radius':s.cornerRadius+'px','--art-size':g.artSize+'px','--art-column':g.artColumn+'px','--dock-padding':s.dockPadding+'px',
 '--title-size':s.titleSize+'px','--button-size':s.buttonSize+'px','--progress-thickness':s.progressThickness+'px',
 '--track-gradient':s.progressStyle==='solid'?'linear-gradient(#fff,#fff)':'linear-gradient(90deg,#b7bcc5,#fff)',
 '--timeline-columns':s.showTimes?'32px minmax(0,1fr) 32px':'minmax(0,1fr)'};
}
export const geometryStyle=getGeometryStyle();
export function fitWindow(scale,workArea,settings={}){
 const g=createGeometry(settings),effectiveScale=Math.min(scale,(workArea.width-24)/g.windowWidth,(workArea.height-24)/g.windowHeight);
 return {scale:effectiveScale,width:Math.ceil(g.windowWidth*effectiveScale),height:Math.ceil(g.windowHeight*effectiveScale)};
}
export function dockRect(active,theme,settings={}){
 const g=createGeometry(settings),r=active?g.expanded:g.idle;
 return theme==='black'?{x:r.x-12,y:0,width:r.width+24,height:r.y+r.height,radius:r.radius}:r;
}
export function notchPath(width,height,radius=22,shoulder=12){
 return `M0 0 Q${shoulder} 0 ${shoulder} ${shoulder} V${height-radius} A${radius} ${radius} 0 0 0 ${shoulder+radius} ${height} H${width-shoulder-radius} A${radius} ${radius} 0 0 0 ${width-shoulder} ${height-radius} V${shoulder} Q${width-shoulder} 0 ${width} 0 Z`;
}
export function hitDock(point,active,theme,settings={}){
 const r=dockRect(active,theme,settings),x=point.x-r.x,y=point.y-r.y;
 if(x<0||y<0||x>r.width||y>r.height)return false;
 if(theme==='black'){
  if(y<=12){const edge=24*Math.sqrt(y/12)-y;return x>=edge&&x<=r.width-edge;}
  if(x<12||x>r.width-12)return false;
  const cx=Math.max(12+r.radius,Math.min(x,r.width-12-r.radius));
  return y<=r.height-r.radius||Math.hypot(x-cx,y-(r.height-r.radius))<=r.radius;
 }
 const cx=Math.max(r.radius,Math.min(x,r.width-r.radius)),cy=Math.max(r.radius,Math.min(y,r.height-r.radius));
 return Math.hypot(x-cx,y-cy)<=r.radius;
}
