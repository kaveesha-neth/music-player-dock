import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {GlassDecoder} from './glass-protocol.mjs';
import type {GlassFrame,GlassStatus} from '../src/shared';
type Config={hwnd:string;margin:number;maxWidth:number;maxHeight:number;fps:number};
const PREPARATION_TIMEOUT=5000;
export class GlassCapture {
 private child?:ChildProcessWithoutNullStreams;private timer?:NodeJS.Timeout;private timeout?:NodeJS.Timeout;
 private wanted=false;private active=false;private eligible=false;private ready=false;private config?:Config;
 private generation=0;private epoch=0;private pendingEpoch=0;private sequence=0;private revision=0;private busy=false;private requestedAt=0;
 private repairs=0;private recoveryUntil=0;private revealSince?:number;private rebuilds=0;private fault:'capture'|'renderer'|null=null;
 private latest?:Omit<GlassFrame,'generation'>;private deliveredEpoch=-1;private paintedEpoch=-1;
 status:GlassStatus={revision:0,mode:'off',message:'Liquid Glass is off'};
 constructor(private executable:string,private frame:(frame:GlassFrame)=>void,private changed:(status:GlassStatus)=>void,private launch:typeof spawn=spawn,private repairExclusion?:()=>void,private now:()=>number=Date.now){}
 private statusTo(mode:GlassStatus['mode'],message:string){if(this.status.mode===mode&&this.status.message===message&&this.status.revision===this.revision)return;this.status={mode,message,revision:this.revision};this.changed(this.status);}
 // The idle helper blocks on stdin. No desktop reads are issued while hidden.
 configure(wanted:boolean,active:boolean,config:Config,eligible=true){
  const wasActive=this.active,wasWanted=this.wanted;this.wanted=wanted;this.active=wanted&&active&&eligible;this.eligible=wanted&&eligible;this.config=config;
  if(!wanted){this.repairs=0;this.recoveryUntil=0;this.ready=false;this.revealSince=undefined;this.rebuilds=0;this.fault=null;if(wasWanted)this.revision++;this.stop();this.statusTo('off','Liquid Glass is off');return;}
  if(this.active&&!wasActive){
   this.epoch++;this.revealSince=this.now();this.rebuilds=0;
   // A failed session must be recoverable on the next deliberate hover.
   if(this.status.mode==='fallback'){
    if(this.fault==='renderer')this.rebuildRenderer('Reinitializing glass for this reveal');
    else{this.stop();this.repairs=0;this.recoveryUntil=0;this.fault=null;this.statusTo('starting','Retrying desktop capture for this reveal');}
   }
  }
  if(!this.eligible){this.stop();this.revealSince=undefined;if(this.status.mode!=='fallback')this.statusTo('paused','Desktop capture is suspended');return;}
  if(this.now()<this.recoveryUntil)return;
  if(!this.active){clearTimeout(this.timer);this.timer=undefined;this.revealSince=undefined;if(this.ready&&!this.child&&this.status.mode!=='fallback')this.start();if(this.status.mode!=='fallback')this.statusTo('paused','Capture paused; helper ready for the next reveal');return;}
  if(this.status.mode==='fallback')return;
  if(this.revealSince===undefined)this.revealSince=this.now();
  // Receiving native packets is not proof that the renderer has painted one.
  if(this.status.mode!=='live'&&this.now()-this.revealSince>=PREPARATION_TIMEOUT){
   if(this.rebuilds<1){this.rebuilds++;this.rebuildRenderer('Recovering glass after a missing renderer acknowledgement');}
   else this.fail('Glass did not become ready. Hover again or use Retry desktop glass.','renderer');
   return;
  }
  if(this.ready&&!this.child)this.start();
  if(!wasActive||this.status.mode==='paused'||this.status.mode==='off')this.statusTo('starting','Waiting for the first live desktop frame');
  if(!this.busy&&!this.timer)this.request();
 }
 feedback(event:'ready'|'painted'|'failed',message='',epoch?:number,revision?:number){
  if(revision!==undefined&&revision!==this.revision)return;
  if(event==='failed'){this.ready=false;this.fail(message||'GPU glass is unavailable','renderer');return;}
  if(event==='ready'){this.ready=true;this.stop();if(this.wanted&&this.status.mode==='fallback'){this.fault=null;this.statusTo('paused','Ready to retry desktop capture');}return;}
  if(this.child&&this.wanted&&this.active&&epoch===this.epoch&&this.deliveredEpoch===epoch){this.paintedEpoch=epoch;this.repairs=0;this.rebuilds=0;this.revealSince=undefined;this.fault=null;this.statusTo('live','Live desktop pixels - GPU blur and refraction');}
 }
 private captureFailed(message:string){
  if(message.startsWith('Desktop capture stopped: the dock is not excluded from capture')&&this.repairExclusion&&this.wanted&&this.eligible&&this.repairs<2){
   this.stop();this.repairs++;
   try{this.repairExclusion()}catch{this.fail('Windows could not refresh dock capture exclusion');return;}
   this.recoveryUntil=this.now()+this.repairs*120;this.statusTo('starting','Refreshing Windows capture exclusion before retrying');return;
  }
  this.fail(message);
 }
 fail(message:string,origin:'capture'|'renderer'='capture'){this.stop();this.fault=origin;this.statusTo('fallback',message.slice(0,220));}
 private start(){
  if(!this.config)return;this.stop();const generation=++this.generation;
  if(this.active)this.statusTo('starting','Preparing the first live desktop frame');
  const child=this.child=this.launch(this.executable,['--glass-stream'],{windowsHide:true,stdio:'pipe'}) as ChildProcessWithoutNullStreams;
  const decoder=new GlassDecoder((packet:any)=>{
   if(this.child!==child||generation!==this.generation)return;
   clearTimeout(this.timeout);this.busy=false;
   if(packet.status===1){this.captureFailed(packet.pixels.toString('utf8'));return;}
   if(packet.status===0)this.latest={...packet,pixels:new Uint8Array(packet.pixels)};
   // Repeat safe cached pixels after fresh unchanged replies until paint is acknowledged.
   if(this.active&&this.pendingEpoch===this.epoch&&this.latest&&(packet.status===0||this.paintedEpoch!==this.epoch)){
    this.deliveredEpoch=this.epoch;this.frame({...this.latest,generation:this.epoch});
   }
   if(this.active)this.timer=setTimeout(()=>{this.timer=undefined;this.request()},Math.max(0,1000/(this.config?.fps||30)-(this.now()-this.requestedAt)));
  });
  child.stdout.on('data',(chunk:Buffer)=>{if(this.child!==child||generation!==this.generation)return;try{decoder.push(chunk)}catch(e){this.fail(e instanceof Error?e.message:'Invalid desktop frame')}});
  let diagnostic='';child.stderr.on('data',(data:Buffer)=>{diagnostic=(diagnostic+data.toString()).slice(-1200)});
  child.stdin.on('error',()=>{if(this.child===child)this.fail('Desktop capture input disconnected')});
  child.once('error',(error)=>{if(this.child===child)this.fail('Desktop capture helper could not start: '+error.message)});
  child.once('exit',(code,signal)=>{if(this.child===child)this.fail(`Desktop capture helper exited (${code??signal??'unknown'}): ${diagnostic.trim()||'no diagnostic output'}`)});
 }
 private request(){
  if(!this.active||!this.eligible||!this.ready||!this.child?.stdin.writable||!this.config||this.busy)return;
  this.busy=true;this.pendingEpoch=this.epoch;this.requestedAt=this.now();this.child.stdin.write(JSON.stringify({...this.config,id:++this.sequence})+'\n');
  this.timeout=setTimeout(()=>this.fail('Desktop capture timed out'),4000);
 }
 private rebuildRenderer(message:string){this.stop();this.ready=false;this.fault=null;this.repairs=0;this.recoveryUntil=0;this.revealSince=this.now();this.revision++;this.statusTo(this.wanted?'starting':'off',message);}
 resetRenderer(message='Waiting for the glass renderer'){this.rebuilds=0;this.rebuildRenderer(message);}
 retry(){this.rebuilds=0;this.rebuildRenderer('Retrying desktop glass');}
 stop(){clearTimeout(this.timer);this.timer=undefined;clearTimeout(this.timeout);this.busy=false;this.generation++;this.epoch++;this.latest=undefined;this.deliveredEpoch=-1;this.paintedEpoch=-1;const child=this.child;this.child=undefined;if(child){child.stdin.end();const kill=setTimeout(()=>child.kill(),500);kill.unref();child.once('exit',()=>clearTimeout(kill));}}
}
