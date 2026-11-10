export const defaults={autoHide:true,hideDelay:550,triggerWidth:90,triggerHeight:10,collapsed:'handle',animations:true,glass:65,opacity:88,theme:'black',appearanceVersion:1,ambient:true,scale:1,reducedMotion:false,automatic:true,preferredSource:'',optionalControls:true,startWithWindows:false,hideFullscreen:true,monitor:'primary',dockWidth:440,dockHeight:160,dockPadding:14,cornerRadius:22,artworkSize:112,titleSize:19,buttonSize:36,progressThickness:5,progressStyle:'gradient',showArtwork:true,showTimes:true,showAlbum:false};
export function validate(input){
 const out={...defaults}; if(!input||typeof input!=='object')return out;
 for(const key of Object.keys(defaults))if(typeof input[key]===typeof defaults[key])out[key]=input[key];
 for(const [k,min,max] of [['hideDelay',100,5000],['triggerWidth',30,500],['triggerHeight',2,50],['glass',0,100],['opacity',60,100],['scale',0.65,1.5],['dockWidth',380,640],['dockHeight',144,220],['dockPadding',10,22],['cornerRadius',16,30],['artworkSize',80,152],['titleSize',16,24],['buttonSize',28,44],['progressThickness',3,8]])out[k]=Number.isFinite(out[k])?Math.max(min,Math.min(max,out[k])):defaults[k];
 if(!['solid','gradient'].includes(out.progressStyle))out.progressStyle='gradient';
 // Keep the full control row visible even when large type, spacing and album text combine.
 const minimumHeight=Math.ceil(out.dockPadding*2+out.titleSize*1.25+18+(out.showAlbum?16:0)+out.progressThickness+12+out.buttonSize+4+8);
 out.dockHeight=Math.max(out.dockHeight,minimumHeight);
 if(!['handle','hidden'].includes(out.collapsed))out.collapsed='handle';
 // Adopt the new default once for pre-theme-release settings. Later selections persist.
 if(input.appearanceVersion!==1||!['black','dark','light'].includes(out.theme))out.theme='black';
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
