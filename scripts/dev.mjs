import {spawn} from 'node:child_process';
import {createServer} from 'vite';
await import('./build-main.mjs');
const server=await createServer(); await server.listen();
const {runtime}=await import('./runtime.mjs');const electron=await runtime();
const child=spawn(electron,['.'],{stdio:'inherit',env:{...process.env,DOCK_DEV:'1'}});
child.on('exit',async()=>{await server.close();process.exit()});
process.on('SIGINT',()=>child.kill());
