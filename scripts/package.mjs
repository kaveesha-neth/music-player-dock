import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {runtime} from './runtime.mjs';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
const suffix=process.env.DOCK_PACKAGE_SUFFIX||'';
if(suffix&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suffix))throw Error('Invalid package suffix');
const artifactName=`MusicPlayerDock-${version}${suffix?'-'+suffix:''}-win-x64`;
const target=path.resolve('release',artifactName);
await fs.mkdir(target,{recursive:true});
await fs.cp(path.dirname(await runtime()),target,{recursive:true,force:true,dereference:true});
await fs.rename(path.join(target,'electron.exe'),path.join(target,'MusicPlayerDock.exe'));
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.resolve('scripts/set-icon.ps1'),'-ExecutablePath',path.join(target,'MusicPlayerDock.exe'),'-IconPath',path.resolve('assests/MusicPlayerDock-logo.ico')],{stdio:'inherit',windowsHide:true});
await fs.rm(path.join(target,'resources/default_app.asar'),{force:true});
const app=path.join(target,'resources/app');await fs.mkdir(app,{recursive:true});
for(const folder of ['dist','dist-electron','assests']){
 const destination=path.resolve(app,folder),relative=path.relative(target,destination);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Package destination escaped release folder');
 await fs.rm(destination,{recursive:true,force:true});
 await fs.cp(folder,destination,{recursive:true});
}
await fs.writeFile(path.join(app,'package.json'),JSON.stringify({name:'music-player-dock',version,main:'dist-electron/main.cjs'}));
await fs.cp('resources/bridge',path.join(target,'resources/bridge'),{recursive:true,dereference:true,filter:src=>!src.endsWith('.pdb')});
await fs.copyFile('README.md',path.join(target,'README.md'));
await fs.copyFile('DEVELOPMENT-REPORT.md',path.join(target,'DEVELOPMENT-REPORT.md'));
await fs.copyFile('LICENSE',path.join(target,'LICENSE-MusicPlayerDock.txt'));
let notices='MusicPlayerDock third-party licenses\nElectron/Chromium notices are shipped alongside this file. The self-contained .NET runtime includes its upstream license notices in the executable.\n';
for(const name of ['react','react-dom','scheduler','glisse','lucide-react'])for(const file of ['LICENSE','LICENSE.txt','LICENSE.md'])try{notices+=`\n\n${name}\n${await fs.readFile(path.join('node_modules',name,file),'utf8')}`;break}catch{}
await fs.writeFile(path.join(target,'THIRD-PARTY-NOTICES.txt'),notices);
execFileSync('tar',['-a','-c','-f',path.resolve(`release/${artifactName}.zip`),'-C',path.dirname(target),path.basename(target)]);
console.log('Ready: '+path.join(target,'MusicPlayerDock.exe'));
