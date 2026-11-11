import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import path from 'node:path';
import Module from 'node:module';
import {build} from 'esbuild';
const built=await build({entryPoints:['electron/glass-capture.ts'],bundle:true,platform:'node',format:'cjs',write:false});
const filename=path.resolve('.cache/recovery-test.cjs'),loaded=new Module(filename);loaded._compile(built.outputFiles[0].text,filename);
const Capture=loaded.exports.GlassCapture;
function fixture(t){
 const f={clock:1000,requests:[],frames:[],children:[],events:new EventEmitter()};
 f.config={hwnd:'fixture',margin:96,maxWidth:1024,maxHeight:768,fps:60};
 const launch=()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new Writable({write(data,_encoding,done){f.requests.push(JSON.parse(data.toString()));done();f.events.emit('request')}});child.stdin.on('finish',()=>child.emit('exit',0));child.kill=()=>{child.emit('exit',0);return true};f.children.push(child);return child};
 f.capture=new Capture('fixture',frame=>f.frames.push(frame),()=>{},launch,undefined,()=>f.clock);t.after(()=>f.capture.stop());
 f.configure=active=>f.capture.configure(true,active,f.config);
 f.respond=(status=0)=>{const last=f.requests.at(-1),bytes=status===0?Buffer.from([60,70,80,255]):Buffer.alloc(0),header=Buffer.alloc(56);header.write('MPDG');[status,last.id,1,1,bytes.length,0,0,1,1,1,1,1,0].forEach((v,i)=>header.writeInt32LE(v,4+i*4));f.children.at(-1).stdout.write(Buffer.concat([header,bytes]));};
 f.nextRequest=()=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('No capture request')),1500);f.events.once('request',()=>{clearTimeout(timeout);resolve()})});
 f.ready=()=>f.capture.feedback('ready','',undefined,f.capture.status.revision);
 f.paint=()=>f.capture.feedback('painted','',f.frames.at(-1).generation,f.capture.status.revision);
 return f;
}
test('an unchanged desktop is redelivered until its first frame is actually painted',async t=>{
 const f=fixture(t);f.configure(true);f.ready();f.configure(true);f.respond();assert.equal(f.frames.length,1);assert.equal(f.capture.status.mode,'starting');
 await f.nextRequest();f.respond(2);assert.equal(f.frames.length,2,'a missed or zero-size first draw must get another chance');assert.equal(f.capture.status.mode,'starting');
 f.paint();assert.equal(f.capture.status.mode,'live');await f.nextRequest();f.respond(2);assert.equal(f.frames.length,2,'painted unchanged pixels must not keep streaming');
});
test('unacknowledged startup has a bounded rebuild and can recover on the next hover',t=>{
 const f=fixture(t);f.configure(true);const oldRevision=f.capture.status.revision;
 f.clock+=5001;f.configure(true);assert.ok(f.capture.status.revision>oldRevision);assert.equal(f.capture.status.mode,'starting');
 f.capture.feedback('ready','',undefined,oldRevision);f.configure(true);assert.equal(f.children.length,0,'an old renderer must not satisfy the new readiness handshake');
 f.clock+=5001;f.configure(true);assert.equal(f.capture.status.mode,'fallback','hover cannot remain invisible indefinitely');
 f.configure(false);f.configure(true);f.ready();f.configure(true);f.respond();f.paint();assert.equal(f.capture.status.mode,'live','reopening must recover without a Black Notch restart');
});
test('continuous safe packets without a paint acknowledgement also trigger recovery',t=>{
 const f=fixture(t);f.configure(true);f.ready();f.configure(true);f.respond();const revision=f.capture.status.revision;
 f.clock+=5001;f.configure(true);assert.ok(f.capture.status.revision>revision);assert.equal(f.capture.status.mode,'starting');assert.equal(f.children.at(-1).stdin.writable,false);
 f.ready();f.configure(true);f.respond();f.paint();assert.equal(f.capture.status.mode,'live');
});
test('a transient helper failure is retried on hover and old renderer faults are ignored',t=>{
 const f=fixture(t);f.configure(true);f.ready();f.configure(true);f.respond();f.paint();
 f.children.at(-1).emit('exit',1);assert.equal(f.capture.status.mode,'fallback');f.configure(false);f.configure(true);assert.equal(f.children.length,2);f.respond();f.paint();assert.equal(f.capture.status.mode,'live');
 const stale=f.capture.status.revision;f.capture.retry();f.ready();f.configure(true);f.respond();f.paint();f.capture.feedback('failed','obsolete graphics error',undefined,stale);assert.equal(f.capture.status.mode,'live');
});
