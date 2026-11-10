import {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,screen} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {Bridge} from './bridge';
import {defaults,validate,Visibility,within} from './policy.mjs';
import {geometry,fitWindow,dockRect,hitDock} from './geometry.mjs';
import type {Settings,Snapshot,Command,DockState} from '../src/shared';

let dock:BrowserWindow, preferences:BrowserWindow|undefined,tray:Tray,bridge:Bridge;
let settings=validate(defaults) as Settings;
let media:Snapshot={sessions:[],currentId:null,connected:false};
let selected='',open=false,quitting=false,configPath='',uiScale=1;
const visibility=new Visibility();
let poll:NodeJS.Timeout;let ignoring=true;
const dev=process.env.DOCK_DEV==='1';
const diagnostics=process.argv.includes('--diagnostics');
if(diagnostics)app.setPath('userData',path.resolve('.cache/diagnostic-profile'));
if(process.argv.includes('--software-rendering')){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-gpu')}
const preload=path.join(__dirname,'preload.cjs');
const iconPath=()=>path.join(app.getAppPath(),'assests/MusicPlayerDock-logo.ico');
function current(){return media.sessions.find(s=>s.id===selected)||(!settings.automatic?media.sessions.find(s=>s.source===settings.preferredSource):undefined)||media.sessions.find(s=>s.id===media.currentId)||media.sessions.find(s=>s.playing)||media.sessions[0]}
function snapshot():DockState{return {open,uiScale,settings,media:{...media,currentId:current()?.id??null},displays:screen.getAllDisplays().map(d=>({id:String(d.id),name:d.label||`Display ${d.id}`}))}}
function send(){for(const w of [dock,preferences])if(w&&!w.isDestroyed())w.webContents.send('state',snapshot())}
function display(){return screen.getAllDisplays().find(d=>String(d.id)===settings.monitor)||screen.getPrimaryDisplay()}
function layout(){
 const d=display(),fit=fitWindow(settings.scale,d.workArea,settings);uiScale=fit.scale;
 dock.setContentBounds({x:Math.round(d.bounds.x+(d.bounds.width-fit.width)/2),y:d.bounds.y,width:fit.width,height:fit.height});
}
function load(w:BrowserWindow,route=''){if(dev)void w.loadURL(`http://127.0.0.1:5173/${route}`);else void w.loadFile(path.join(__dirname,'../dist/index.html'),{hash:route.replace('#','')})}
function secure(w:BrowserWindow){w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false))}
function showSettings(){
 if(preferences&&!preferences.isDestroyed()){preferences.show();preferences.focus();return}
 const area=screen.getPrimaryDisplay().workArea;const prefWidth=Math.min(780,area.width-40),prefHeight=Math.min(860,area.height-40);
 preferences=new BrowserWindow({icon:iconPath(),title:'MusicPlayerDock - Settings',width:prefWidth,height:prefHeight,minWidth:Math.min(600,prefWidth),minHeight:Math.min(600,prefHeight),backgroundColor:'#101216',autoHideMenuBar:true,webPreferences:{preload,partition:'dock-preferences',contextIsolation:true,nodeIntegration:false,sandbox:true}});
 secure(preferences);load(preferences,'#settings');preferences.on('closed',()=>{preferences=undefined});
}
function tick(){
 const d=display(),p=screen.getCursorScreenPoint(),b=dock.getContentBounds();
 const local={x:(p.x-b.x)/uiScale,y:(p.y-b.y)/uiScale};
 const active=!!current(),visual=dockRect(active,settings.theme,settings);
 // Match the attached shoulder silhouette as well as the floating glass corners.
 const hit=hitDock(local,active,settings.theme,settings);
 const inside=open&&within(local,visual,14);
 const near=within(p,{x:d.bounds.x+(d.bounds.width-settings.triggerWidth)/2,y:d.bounds.y,width:settings.triggerWidth,height:settings.triggerHeight});
 const f=media.fullscreen;
 const center=screen.dipToScreenPoint({x:Math.round(d.bounds.x+d.bounds.width/2),y:Math.round(d.bounds.y+d.bounds.height/2)});
 const blocked=!!(settings.hideFullscreen&&f&&within(center,f));
 const previous=visibility.state;
 const phase=visibility.tick(Date.now(),near,inside,settings.autoHide,settings.hideDelay,blocked,settings.animations&&!settings.reducedMotion?420:0);
 const next=phase==='expanded'||phase==='revealing';
 if(next!==open){open=next;send()}
 const ignore=!(open&&hit);if(ignore!==ignoring){dock.setIgnoreMouseEvents(ignore);ignoring=ignore}
 const visible=!blocked&&(phase!=='hidden'||settings.collapsed==='handle');
 if(visible&&!dock.isVisible())dock.showInactive();else if(!visible&&dock.isVisible())dock.hide();
 if(previous!==phase&&phase==='hidden')send();
}
const actions=new Set(['play','pause','toggle','next','previous','seek','shuffle','repeat','open']);
function authorized(event:Electron.IpcMainEvent|Electron.IpcMainInvokeEvent){if(![dock?.webContents.id,preferences?.webContents.id].includes(event.sender.id)||event.senderFrame!==event.sender.mainFrame)throw Error('Untrusted IPC')}
if(!app.requestSingleInstanceLock())app.quit();else {
 app.on('second-instance',()=>showSettings());
 app.whenReady().then(()=>{
  app.setAppUserModelId('com.musicplayerdock.app');configPath=path.join(app.getPath('userData'),'settings.json');
  try{settings=validate(JSON.parse(fs.readFileSync(configPath,'utf8'))) as Settings}catch{}
  dock=new BrowserWindow({icon:iconPath(),show:false,width:geometry.windowWidth,height:geometry.windowHeight,frame:false,thickFrame:false,useContentSize:true,transparent:true,resizable:false,hasShadow:false,skipTaskbar:true,focusable:false,alwaysOnTop:true,webPreferences:{preload,partition:'dock-overlay',contextIsolation:true,nodeIntegration:false,sandbox:true}});
  dock.webContents.on('did-finish-load',()=>{dock.webContents.setZoomFactor(1);void dock.webContents.setVisualZoomLevelLimits(1,1);layout();send()});
  dock.webContents.on('zoom-changed',event=>{event.preventDefault();dock.webContents.setZoomFactor(1)});
  dock.setIgnoreMouseEvents(true);secure(dock);layout();load(dock);dock.on('close',e=>{if(!quitting){e.preventDefault();dock.hide()}});
  const runtimeErrors:string[]=[];
  dock.webContents.on('render-process-gone',(_e,details)=>runtimeErrors.push(details.reason));
  dock.webContents.on('did-fail-load',(_e,code,description)=>runtimeErrors.push(`${code}: ${description}`));
  dock.webContents.on('console-message',(_e,_level,message)=>{if(_level>=3)runtimeErrors.push(message)});
  dock.once('ready-to-show',()=>{tick();send();if(diagnostics)setTimeout(()=>{fs.mkdirSync(path.resolve('.cache'),{recursive:true});fs.writeFileSync(path.resolve('.cache/desktop-diagnostics.json'),JSON.stringify({loaded:true,bounds:dock.getBounds(),visible:dock.isVisible(),focusable:dock.isFocusable(),focused:dock.isFocused(),state:visibility.state,open,ignoring,mediaConnected:media.connected,mediaError:media.error,rendererErrors:runtimeErrors},null,2));app.quit()},6000)});
  tray=new Tray(nativeImage.createFromPath(iconPath()));tray.setToolTip('MusicPlayerDock');tray.setContextMenu(Menu.buildFromTemplate([{label:'MusicPlayerDock',enabled:false},{label:'Settings...',click:showSettings},{label:'Reveal music island',click:()=>{visibility.state='revealing';visibility.transition=Date.now()+420;visibility.deadline=Date.now()+3000;open=true;send();dock.showInactive()}},{type:'separator'},{label:'Quit',click:()=>app.quit()}]));tray.on('double-click',showSettings);
  bridge=new Bridge(app.isPackaged?path.join(process.resourcesPath,'bridge/MediaBridge.exe'):path.join(app.getAppPath(),'resources/bridge/MediaBridge.exe'),s=>{media=s;if(!s.sessions.some(x=>x.id===selected))selected='';send()});bridge.start();
  poll=setInterval(tick,50);
  const updateDisplay=()=>{layout();send()};screen.on('display-added',updateDisplay);screen.on('display-removed',updateDisplay);screen.on('display-metrics-changed',updateDisplay);
  ipcMain.handle('state',e=>{authorized(e);return snapshot()});
  ipcMain.handle('command',(e,c:Command)=>{authorized(e);if(!c||!actions.has(c.action)||typeof c.id!=='string'||!media.sessions.some(s=>s.id===c.id))throw Error('Invalid media command');if(c.action==='seek'&&(!Number.isFinite(c.value)||Number(c.value)<0))throw Error('Invalid seek');bridge.send(c)});
  ipcMain.handle('save',async(e,input)=>{authorized(e);const next=validate(input) as Settings;app.setLoginItemSettings({openAtLogin:next.startWithWindows,path:process.env.PORTABLE_EXECUTABLE_FILE||app.getPath('exe')});await fs.promises.mkdir(path.dirname(configPath),{recursive:true});await fs.promises.writeFile(configPath+'.tmp',JSON.stringify(next,null,2));await fs.promises.rename(configPath+'.tmp',configPath);settings=next;if(settings.automatic)selected='';layout();send()});
  ipcMain.on('settings',e=>{authorized(e);showSettings()});ipcMain.on('select',(e,id)=>{authorized(e);if(media.sessions.some(s=>s.id===id)){selected=id;send()}});ipcMain.on('quit',e=>{authorized(e);app.quit()});
 }).catch(e=>{console.error(e);app.quit()});
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{quitting=true;clearInterval(poll);bridge?.stop();tray?.destroy()});
}
