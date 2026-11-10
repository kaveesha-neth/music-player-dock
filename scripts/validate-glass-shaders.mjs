import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import Module from 'node:module';
import {build} from 'esbuild';
const root=path.resolve('.cache/shader-check');await fs.mkdir(root,{recursive:true});
const built=await build({entryPoints:['src/glass/shaders.ts'],bundle:true,platform:'node',format:'cjs',write:false});
const filename=path.join(root,'shaders.cjs'),loaded=new Module(filename);loaded._compile(built.outputFiles[0].text,filename);
const {vertexShader,blurShader,refractionShader}=loaded.exports;
await fs.writeFile(path.join(root,'glass.vert'),'#version 100\n'+vertexShader);
for(const [name,shader] of [['blur',blurShader],['refraction',refractionShader]]){
 const fragment=path.join(root,`${name}.frag`);await fs.writeFile(fragment,'#version 100\n'+shader);
 execFileSync(process.env.GLSLANG_VALIDATOR||'glslangValidator',['--glsl-version','100','-l',path.join(root,'glass.vert'),fragment],{stdio:'inherit',windowsHide:true});
}
console.log('Both glass GPU programs compile and link as GLSL ES 1.00.');
