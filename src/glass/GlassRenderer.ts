import {vertexShader,blurShader,refractionShader} from './shaders';
import {textureMapping} from './optics.mjs';
import type {GlassFrame,Settings} from '../shared';

export class GlassRenderer {
 private gl:WebGLRenderingContext;private blur:WebGLProgram;private refract:WebGLProgram;private quad:WebGLBuffer;
 private source:WebGLTexture;private horizontal:WebGLTexture;private vertical:WebGLTexture;
 private fbo:WebGLFramebuffer;private frame?:GlassFrame;private width=0;private height=0;private lastBlur='';
 constructor(private canvas:HTMLCanvasElement){
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!gl)throw Error('WebGL is unavailable; using the fallback material');this.gl=gl;
  this.blur=this.program(blurShader);try{this.refract=this.program(refractionShader)}catch(error){gl.deleteProgram(this.blur);throw error}
  this.quad=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  this.source=this.texture();this.horizontal=this.texture();this.vertical=this.texture();this.fbo=gl.createFramebuffer()!;gl.disable(gl.DITHER);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
 }
 private program(fragment:string){
  const gl=this.gl,shaders:WebGLShader[]=[];
  try{
   for(const [type,source] of [[gl.VERTEX_SHADER,vertexShader],[gl.FRAGMENT_SHADER,fragment]] as const){const shader=gl.createShader(type)!;shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Glass shader compile: '+(gl.getShaderInfoLog(shader)||'unknown driver error'));}
   const program=gl.createProgram()!;for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const error=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error('Glass shader link: '+(error||'unknown driver error'));}return program;
  }finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 private texture(){const gl=this.gl,t=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
 private use(program:WebGLProgram,topDown:number){const gl=this.gl;gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);const location=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);gl.uniform1f(gl.getUniformLocation(program,'uTopDown'),topDown);gl.uniform1i(gl.getUniformLocation(program,'uSource'),0);}
 upload(frame:GlassFrame){
  if(!frame.excluded)throw Error('Capture exclusion was not verified');
  const gl=this.gl;this.frame=frame;this.lastBlur='';
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.source);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  if(this.width!==frame.width||this.height!==frame.height){this.width=frame.width;this.height=frame.height;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,frame.width,frame.height,0,gl.RGBA,gl.UNSIGNED_BYTE,frame.pixels);for(const target of [this.horizontal,this.vertical]){gl.bindTexture(gl.TEXTURE_2D,target);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,frame.width,frame.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}}
  else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,frame.width,frame.height,gl.RGBA,gl.UNSIGNED_BYTE,frame.pixels);
 }
 draw(settings:Settings){
  if(!this.frame)return false;const gl=this.gl,frame=this.frame;
  if(gl.isContextLost())throw Error('The glass graphics context was lost');
  const rect=this.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return false;
  const logicalWidth=this.canvas.clientWidth||rect.width,logicalHeight=this.canvas.clientHeight||rect.height;
  const density=Math.min(2,window.devicePixelRatio||1,1536/rect.width,1024/rect.height),width=Math.max(1,Math.round(rect.width*density)),height=Math.max(1,Math.round(rect.height*density));
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
  const ratio=frame.generation<0?frame.width/logicalWidth:rect.width/logicalWidth*frame.windowWidth/Math.max(1,window.innerWidth)*frame.width/frame.sourceWidth;
  const blurAmount=settings.liquidBlur*ratio;
  const key=`${frame.generation}/${frame.id}/${blurAmount}`;
  if(this.lastBlur!==key){
   this.use(this.blur,0);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,frame.width,frame.height);
   for(const [source,target,x,y] of [[this.source,this.horizontal,blurAmount*.5/frame.width,0],[this.horizontal,this.vertical,0,blurAmount*.5/frame.height]] as const){
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Glass blur target is unavailable');
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,source);gl.uniform2f(gl.getUniformLocation(this.blur,'uStep'),x,y);gl.drawArrays(gl.TRIANGLES,0,6);
   }this.lastBlur=key;
  }
  const mapping=frame.generation<0?{x:0,y:0,width:1,height:1}:textureMapping(frame,rect,{width:Math.max(1,window.innerWidth),height:Math.max(1,window.innerHeight)});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);this.use(this.refract,1);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.vertical);
  const uniform=(name:string,value:number)=>gl.uniform1f(gl.getUniformLocation(this.refract,name),value);
  gl.uniform2f(gl.getUniformLocation(this.refract,'uSize'),logicalWidth,logicalHeight);gl.uniform4f(gl.getUniformLocation(this.refract,'uMapping'),mapping.x,mapping.y,mapping.width,mapping.height);
  uniform('uRadius',Math.min(settings.liquidRadius,(logicalWidth-24)/2,(logicalHeight-12)/2));uniform('uStrength',settings.liquidRefraction/100);uniform('uDispersion',settings.liquidDispersion/100);uniform('uTint',settings.liquidTint/100);uniform('uEdgeShade',settings.liquidEdgeShade/100);uniform('uEdgeWarp',settings.liquidEdgeWarp/100);
  gl.drawArrays(gl.TRIANGLES,0,6);
  const error=gl.getError();if(error!==gl.NO_ERROR)throw Error(`Glass GPU draw failed (WebGL 0x${error.toString(16)})`);
  return true;
 }
 dispose(){const gl=this.gl;gl.deleteTexture(this.source);gl.deleteTexture(this.horizontal);gl.deleteTexture(this.vertical);gl.deleteFramebuffer(this.fbo);gl.deleteBuffer(this.quad);gl.deleteProgram(this.blur);gl.deleteProgram(this.refract);this.frame=undefined;
  // Release discarded preview/retry contexts instead of waiting for browser GC.
  // StrictMode may reuse a connected canvas immediately, so never lose that context.
  const canvas=this.canvas;setTimeout(()=>{if(!canvas.isConnected)gl.getExtension('WEBGL_lose_context')?.loseContext()},0);
 }
}
