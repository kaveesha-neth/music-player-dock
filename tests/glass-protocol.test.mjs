import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {GlassDecoder,GLASS_HEADER_SIZE} from '../electron/glass-protocol.mjs';

function packet(status=0,excluded=1){
 const payload=status===0?Buffer.from(Array.from({length:64},(_,i)=>i)):status===1?Buffer.from('Capture unavailable'):Buffer.alloc(0);
 const header=Buffer.alloc(GLASS_HEADER_SIZE);header.write('MPDG');
 [status,7,4,4,payload.length,0,0,4,4,4,4,excluded,0].forEach((n,i)=>header.writeInt32LE(n,4+i*4));
 return Buffer.concat([header,payload]);
}
test('desktop stream survives arbitrary pipe fragmentation and unchanged-frame packets',()=>{
 const frames=[],decoder=new GlassDecoder(frame=>frames.push(frame)),bytes=Buffer.concat([packet(),packet(2)]);
 for(let offset=0;offset<bytes.length;offset+=3)decoder.push(bytes.subarray(offset,offset+3));
 assert.equal(frames.length,2);assert.equal(frames[0].pixels.length,64);assert.equal(frames[0].pixels[63],63);assert.equal(frames[1].status,2);
});
test('unexcluded, corrupt and oversized desktop frames never reach the renderer',()=>{
 for(const bytes of [packet(0,0),(()=>{const b=packet();b.writeInt32LE(999999999,20);return b})(),(()=>{const b=packet();b.write('NOPE');return b})()]){
  let called=false;assert.throws(()=>new GlassDecoder(()=>called=true).push(bytes));assert.equal(called,false);
 }
});
test('native capture helper rejects an unprotected HWND and exits cleanly without reading desktop pixels',{skip:process.platform!=='win32'||!existsSync('resources/bridge/MediaBridge.exe')},async()=>{
 await new Promise((resolve,reject)=>{
  const child=spawn('resources/bridge/MediaBridge.exe',['--glass-stream'],{windowsHide:true}),packets=[];
  const timer=setTimeout(()=>{child.kill();reject(Error('Capture guard timeout'))},8000);
  const decoder=new GlassDecoder(frame=>packets.push(frame));
  child.stdout.on('data',b=>{try{decoder.push(b)}catch(e){child.kill();reject(e)}});child.stderr.on('data',()=>{});
  child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);try{assert.equal(code,0);assert.equal(packets.length,1);assert.equal(packets[0].status,1);assert.ok(packets[0].pixels.toString().includes('not excluded'));resolve()}catch(e){reject(e)}});
  child.stdin.end(JSON.stringify({id:7,hwnd:'0'})+'\n');
 });
});
