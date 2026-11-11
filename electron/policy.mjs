export const defaults={autoHide:true,hideDelay:550,triggerWidth:90,triggerHeight:10,collapsed:'handle',animations:true,glass:65,opacity:88,theme:'black',appearanceVersion:1,ambient:true,scale:1,reducedMotion:false,automatic:true,preferredSource:'',optionalControls:true,startWithWindows:false,hideFullscreen:true,monitor:'primary',dockWidth:440,dockHeight:160,dockPadding:14,cornerRadius:22,artworkSize:112,titleSize:19,buttonSize:36,progressThickness:5,progressStyle:'gradient',showArtwork:true,showTimes:true,showAlbum:false,notchWidth:520,notchHeight:280,notchPadding:24,notchRadius:32,notchArtworkSize:80,notchTitleSize:19,notchButtonSize:52,liquidWidth:520,liquidHeight:300,liquidPadding:24,liquidRadius:34,liquidArtworkSize:80,liquidTitleSize:24,liquidButtonSize:72,liquidBlur:7,liquidRefraction:55,liquidDispersion:45,liquidTint:32,liquidEdgeShade:35,liquidEdgeWarp:55,liquidButtonWarp:65,liquidBottomReflection:35,liquidReflectionDepth:35,liquidFps:30,liquidQuality:1024};
export function validate(input){
 const out={...defaults}; if(!input||typeof input!=='object')return out;
 for(const key of Object.keys(defaults))if(typeof input[key]===typeof defaults[key])out[key]=input[key];
 for(const [k,min,max] of [['hideDelay',100,5000],['triggerWidth',30,500],['triggerHeight',2,50],['glass',0,100],['opacity',60,100],['scale',0.65,1.5],['dockWidth',380,640],['dockHeight',144,220],['dockPadding',10,22],['cornerRadius',16,30],['artworkSize',80,152],['titleSize',16,24],['buttonSize',28,44],['progressThickness',3,8],['notchWidth',380,720],['notchHeight',220,340],['notchPadding',16,32],['notchRadius',22,44],['notchArtworkSize',56,152],['notchTitleSize',16,28],['notchButtonSize',40,64],['liquidWidth',380,720],['liquidHeight',220,360],['liquidPadding',16,32],['liquidRadius',22,48],['liquidArtworkSize',56,152],['liquidTitleSize',16,28],['liquidButtonSize',40,72],['liquidBlur',0,24],['liquidRefraction',0,100],['liquidDispersion',0,100],['liquidTint',0,60],['liquidEdgeShade',0,100],['liquidEdgeWarp',0,100],['liquidButtonWarp',0,100],['liquidBottomReflection',0,100],['liquidReflectionDepth',0,100],['liquidFps',10,60],['liquidQuality',512,1280]])out[k]=Number.isFinite(out[k])?Math.max(min,Math.min(max,out[k])):defaults[k];
 if(!['solid','gradient'].includes(out.progressStyle))out.progressStyle='gradient';
 // Keep the full control row visible even when large type, spacing and album text combine.
 const minimumHeight=Math.ceil(out.dockPadding*2+out.titleSize*1.25+18+(out.showAlbum?16:0)+out.progressThickness+12+out.buttonSize+4+8);
 out.dockHeight=Math.max(out.dockHeight,minimumHeight);
 const topHeight=Math.max(out.showArtwork?64:0,out.notchTitleSize*1.25+Math.max(13,out.notchTitleSize*.9)*1.35+5+(out.showAlbum?20:0));
 const notchMinimum=out.notchPadding*2+topHeight+(out.progressThickness+12)+(out.notchButtonSize+16)+40;
 out.notchHeight=Math.max(out.notchHeight,Math.ceil(notchMinimum/2)*2);
 const liquidText=out.liquidTitleSize*1.25+Math.max(13,out.liquidTitleSize*.9)*1.35+5+(out.showAlbum?20:0);
 out.liquidHeight=Math.max(out.liquidHeight,Math.ceil((out.liquidPadding*2+Math.max(out.showArtwork?64:0,liquidText)+(out.progressThickness+12)+(out.liquidButtonSize+16)+40)/2)*2);
 if(!['handle','hidden'].includes(out.collapsed))out.collapsed='handle';
 // Adopt the new default once for pre-theme-release settings. Later selections persist.
 if(input.appearanceVersion!==1||!['black','dark','light','liquid'].includes(out.theme))out.theme='black';
 out.appearanceVersion=1;
 out.preferredSource=out.preferredSource.slice(0,512); out.monitor=out.monitor.slice(0,64);return out;
}
export function within(p,r,pad=0){return p.x>=r.x-pad&&p.x<=r.x+r.width+pad&&p.y>=r.y-pad&&p.y<=r.y+r.height+pad}
export class Visibility {
 state='hidden'; deadline=0; transition=0;
 tick(now,near,inside,autoHide,delay,suppressed=false,motion=420){
  const want=!suppressed&&(near||inside||!autoHide);
  if(want){this.deadline=0;if(this.state==='hidden'||this.state==='hiding'){this.state='revealing';this.transition=now+motion}}
  else if(this.state==='expanded'||this.state==='revealing'){if(!this.deadline)this.deadline=now+delay;if(suppressed||now>=this.deadline){this.state='hiding';this.transition=now+motion;this.deadline=0}}
  if(now>=this.transition){if(this.state==='revealing')this.state='expanded';else if(this.state==='hiding')this.state='hidden'}
  return this.state;
 }
}
