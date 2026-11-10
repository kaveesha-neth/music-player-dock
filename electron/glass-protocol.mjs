import {Buffer} from 'node:buffer';
export const GLASS_HEADER_SIZE=56;
// Incremental bounded decoder; stdout may split headers/pixels at any byte.
export class GlassDecoder {
 header=Buffer.alloc(GLASS_HEADER_SIZE);headerUsed=0;payload=null;payloadUsed=0;meta=null;
 constructor(accept){this.accept=accept;}
 push(chunk){let offset=0;while(offset<chunk.length){
  if(this.payload===null){
   const count=Math.min(GLASS_HEADER_SIZE-this.headerUsed,chunk.length-offset);chunk.copy(this.header,this.headerUsed,offset,offset+count);this.headerUsed+=count;offset+=count;
   if(this.headerUsed<GLASS_HEADER_SIZE)continue;
   if(this.header.toString('ascii',0,4)!=='MPDG')throw Error('Invalid desktop frame header');
   const n=Array.from({length:13},(_,i)=>this.header.readInt32LE(4+i*4));
   const [status,id,width,height,length,left,top,windowWidth,windowHeight,sourceWidth,sourceHeight,excluded]=n;
   if(![0,1,2].includes(status)||length<0||length>1280*960*4)throw Error('Invalid desktop frame size');
   if(status===0&&(width<1||height<1||width>1280||height>960||length!==width*height*4||excluded!==1||sourceWidth<=0||sourceHeight<=0||windowWidth<=0||windowHeight<=0||left<0||top<0||left+windowWidth>sourceWidth+1||top+windowHeight>sourceHeight+1))throw Error('Unsafe desktop frame');
   if(status===1&&length>8192||status===2&&(length!==0||excluded!==1))throw Error('Invalid desktop status packet');
   this.meta={status,id,width,height,left,top,windowWidth,windowHeight,sourceWidth,sourceHeight,excluded:excluded===1};this.payload=Buffer.allocUnsafe(length);this.payloadUsed=0;
   if(!length)this.finish();
  }else{
   const count=Math.min(this.payload.length-this.payloadUsed,chunk.length-offset);chunk.copy(this.payload,this.payloadUsed,offset,offset+count);this.payloadUsed+=count;offset+=count;
   if(this.payloadUsed===this.payload.length)this.finish();
  }
 }}
 finish(){const meta=this.meta,payload=this.payload;this.headerUsed=0;this.payload=null;this.payloadUsed=0;this.meta=null;this.accept({...meta,pixels:payload});}
}
