import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import Module from 'node:module';
import {existsSync} from 'node:fs';
import {build} from 'esbuild';

test('capture stays paused while hidden and enters fallback on rejected native exclusion',{skip:process.platform!=='win32'||!existsSync('resources/bridge/MediaBridge.exe')},async t=>{
 const built=await build({entryPoints:['electron/glass-capture.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const filename=path.resolve('.cache/glass-capture-test.cjs'),loaded=new Module(filename);loaded._compile(built.outputFiles[0].text,filename);
 let frames=0,resolveFallback;
 const fallback=new Promise(resolve=>resolveFallback=resolve);
 const capture=new loaded.exports.GlassCapture(path.resolve('resources/bridge/MediaBridge.exe'),()=>frames++,status=>{if(status.mode==='fallback')resolveFallback(status)});
 t.after(()=>capture.stop());
 const config={hwnd:'0',margin:96,maxWidth:1024,maxHeight:768,fps:30};
 capture.configure(true,false,config);capture.feedback('ready');assert.equal(capture.status.mode,'paused');
 capture.configure(true,true,config);assert.equal(capture.status.mode,'starting');
 const timer=setTimeout(()=>capture.fail('test timeout'),8000);t.after(()=>clearTimeout(timer));
 const failure=await fallback;assert.ok(failure.message.includes('not excluded'));assert.equal(frames,0);
 capture.configure(false,false,config);assert.equal(capture.status.mode,'off');
});

test('idle helper performs no reads and each reveal waits for a fresh painted capture epoch',async t=>{
 const {EventEmitter}=await import('node:events');const {PassThrough,Writable}=await import('node:stream');
 const built=await build({entryPoints:['electron/glass-capture.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const filename=path.resolve('.cache/warm-capture-test.cjs'),loaded=new Module(filename);loaded._compile(built.outputFiles[0].text,filename);
 const requests=[],frames=[];let launches=0,child;
 const launch=()=>{
  launches++;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.stdin=new Writable({write(chunk,_encoding,done){requests.push(JSON.parse(chunk.toString()));done()}});
  child.stdin.on('finish',()=>child.emit('exit',0));child.kill=()=>{child.emit('exit',0);return true};return child;
 };
 const capture=new loaded.exports.GlassCapture('fixture',frame=>frames.push(frame),()=>{},launch);t.after(()=>capture.stop());
 const config={hwnd:'test',margin:96,maxWidth:1024,maxHeight:768,fps:10};
 capture.configure(true,false,config);capture.feedback('ready');capture.configure(true,false,config);
 assert.equal(launches,1);assert.equal(requests.length,0,'prewarming must not read desktop pixels');assert.equal(capture.status.mode,'paused');
 const respond=status=>{const header=Buffer.alloc(56);header.write('MPDG');[status,requests.at(-1).id,1,1,status===0?4:0,0,0,1,1,1,1,1,0].forEach((value,index)=>header.writeInt32LE(value,4+index*4));child.stdout.write(status===0?Buffer.concat([header,Buffer.from([80,90,100,255])]):header)};
 capture.configure(true,true,config);assert.equal(requests.length,1);assert.equal(capture.status.mode,'starting');
 respond(0);assert.equal(frames.length,1);assert.equal(capture.status.mode,'starting','receiving bytes alone must not release the reveal');
 const firstEpoch=frames[0].generation;capture.feedback('painted','',firstEpoch);assert.equal(capture.status.mode,'live');
 capture.configure(true,false,config);capture.feedback('painted','',firstEpoch);assert.equal(capture.status.mode,'paused');assert.equal(requests.length,1);
 capture.configure(true,true,config);assert.equal(launches,1,'reveal must reuse the warm helper');assert.equal(requests.length,2);assert.equal(capture.status.mode,'starting');
 capture.feedback('painted','',firstEpoch);assert.equal(capture.status.mode,'starting','old paint feedback must not release a new reveal');
 respond(2);assert.equal(frames.length,2,'unchanged desktop still needs its cached pixels repainted after a fresh read');assert.notEqual(frames[1].generation,firstEpoch);
 capture.feedback('painted','',frames[1].generation);assert.equal(capture.status.mode,'live');
 capture.configure(true,false,config,false);assert.equal(child.stdin.writable,false,'fullscreen/lock/suspend must stop the warm process');
 capture.configure(false,false,config);assert.equal(capture.status.mode,'off');
});

test('lost Windows exclusion is reapplied before retry and persistent failure stays guarded',async t=>{
 const {EventEmitter}=await import('node:events');const {PassThrough,Writable}=await import('node:stream');
 const built=await build({entryPoints:['electron/glass-capture.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const filename=path.resolve('.cache/exclusion-repair-test.cjs'),loaded=new Module(filename);loaded._compile(built.outputFiles[0].text,filename);
 let child,repairs=0,frames=0,requests=0,lastId;
 const launch=()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new Writable({write(data,_encoding,done){requests++;lastId=JSON.parse(data.toString()).id;done()}});child.stdin.on('finish',()=>child.emit('exit',0));child.kill=()=>{child.emit('exit',0);return true};return child};
 const capture=new loaded.exports.GlassCapture('fixture',()=>frames++,()=>{},launch,()=>repairs++);t.after(()=>capture.stop());
 const config={hwnd:'test',margin:96,maxWidth:1024,maxHeight:768,fps:10};
 const respond=error=>{const bytes=error?Buffer.from(error):Buffer.from([40,50,60,255]);const header=Buffer.alloc(56);header.write('MPDG');[error?1:0,lastId,error?0:1,error?0:1,bytes.length,0,0,error?0:1,error?0:1,error?0:1,error?0:1,error?0:1,0].forEach((v,i)=>header.writeInt32LE(v,4+i*4));child.stdout.write(Buffer.concat([header,bytes]))};
 const excludedError='Desktop capture stopped: the dock is not excluded from capture. Reported affinity 0x0';
 capture.configure(true,true,config);capture.feedback('ready');capture.configure(true,true,config);
 respond(excludedError);assert.equal(repairs,1);assert.equal(frames,0);assert.equal(capture.status.mode,'starting');
 capture.configure(true,true,config);assert.equal(requests,1,'must allow Windows composition to settle before another request');
 await new Promise(resolve=>setTimeout(resolve,150));capture.configure(true,true,config);assert.equal(requests,2);
 respond(null);assert.equal(frames,1,'only a verified safe frame reaches the renderer after repair');
 // A retry may repair twice, then must fall back instead of disabling the guard.
 capture.retry();capture.feedback('ready');capture.configure(true,true,config);
 for(const wait of [150,270]){respond(excludedError);assert.equal(capture.status.mode,'starting');await new Promise(resolve=>setTimeout(resolve,wait));capture.configure(true,true,config)}
 respond(excludedError);assert.equal(capture.status.mode,'fallback');assert.equal(repairs,3);assert.equal(frames,1);
 const count=requests;capture.configure(true,true,config);assert.equal(requests,count,'persistent exclusion failure must stop all reads');
});
