import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync} from 'node:fs';
import type {Command,Snapshot} from '../src/shared';
export class Bridge {
 child?:ChildProcessWithoutNullStreams; stopped=false; timer?:NodeJS.Timeout; attempts=0;
 constructor(private path:string,private update:(s:Snapshot)=>void){}
 start(){
  if(this.stopped)return;
  if(!existsSync(this.path)){this.update({sessions:[],currentId:null,connected:false,error:'Media bridge missing. Run npm run build:native.'});return}
  const child=this.child=spawn(this.path,[],{windowsHide:true,stdio:'pipe'});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{try{const s=JSON.parse(line);if(Array.isArray(s.sessions)){this.attempts=0;this.update({...s,connected:s.connected!==false})}}catch{}});
  let diagnostic='';child.stderr.on('data',data=>{diagnostic=(diagnostic+String(data)).slice(-3000)});
  const failed=()=>{lines.close();if(this.child!==child)return;this.child=undefined;const denied=/Access is denied|UnauthorizedAccess/i.test(diagnostic);this.update({sessions:[],currentId:null,connected:false,error:denied?'Windows denied media-session access. Try running the portable app in your normal desktop session. Retrying…':'Windows media bridge disconnected. Reconnecting…'});if(!this.stopped)this.timer=setTimeout(()=>this.start(),Math.min(30000,1000*2**this.attempts++))};
  child.once('error',failed);child.once('exit',failed);
 }
 send(c:Command){if(!this.child?.stdin.writable)throw new Error('Media bridge is unavailable');this.child.stdin.write(JSON.stringify(c)+'\n')}
 stop(){this.stopped=true;clearTimeout(this.timer);this.child?.stdin.end();this.child?.kill()}
}
