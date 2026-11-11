import {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,screen,shell,powerMonitor} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {Bridge} from './bridge';
import {GlassCapture} from './glass-capture';
import {prepareOverlayWindow,setOverlayPassthrough} from './window-material.mjs';
import {defaults,validate,Visibility,within} from './policy.mjs';
import {geometry,fitWindow,dockRect,hitDock} from './geometry.mjs';
import type {Settings,Snapshot,Command,DockState,GlassStatus} from '../src/shared';

let dock:BrowserWindow, preferences:BrowserWindow|undefined,tray:Tray,bridge:Bridge;
let settings=validate(defaults) as Settings;
let media:Snapshot={sessions:[],currentId:null,connected:false};
let selected='',open=false,quitting=false,configPath='',uiScale=1,interactingUntil=0;
const visibility=new Visibility();
let rendererRecovery:NodeJS.Timeout|undefined;let lastRendererRecovery=0;
let poll:NodeJS.Timeout;let ignoring=true;let glass:GlassCapture|undefined;let rendererLoaded=false;let captureSuspended=false;let screenLocked=false,powerSuspended=false;let protectedMaterial=false;
const dev=process.env.DOCK_DEV==='1';
const diagnostics=process.argv.includes('--diagnostics');
if(diagnostics)app.setPath('userData',path.resolve('.cache/diagnostic-profile'));
if(process.argv.includes('--software-rendering')){app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-gpu')}
const preload=path.join(__dirname,'preload.cjs');
const companionPath=()=>app.isPackaged?path.join(process.resourcesPath,'bridge/MediaBridge.exe'):path.join(app.getAppPath(),'resources/bridge/MediaBridge.exe');
const iconPath=()=>path.join(app.getAppPath(),'assests/MusicPlayerDock-logo.ico');
function current(){return media.sessions.find(s=>s.id===selected)||(!settings.automatic?media.sessions.find(s=>s.source===settings.preferredSource):undefined)||media.sessions.find(s=>s.id===media.currentId)||media.sessions.find(s=>s.playing)||media.sessions[0]}
function snapshot():DockState{return {open,uiScale,settings,capture:glass?.status,media:{...media,currentId:current()?.id??null},displays:screen.getAllDisplays().map(d=>({id:String(d.id),name:d.label||`Display ${d.id}`}))}}
function glassStatusChanged(status:GlassStatus){
 if(status.mode==='fallback'){
  const file=path.join(app.getPath('userData'),'glass-diagnostics.log');
  try{let previous='';try{previous=fs.readFileSync(file,'utf8').slice(-16000)}catch{};const line=JSON.stringify({time:new Date().toISOString(),version:app.getVersion(),message:status.message});fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,previous.split('\n').filter(Boolean).slice(-31).concat(line).join('\n')+'\n')}catch{}
 }
 send();
}
function sendToWindow(window:BrowserWindow|undefined,event:string,value:unknown){if(!window||window.isDestroyed()||window.webContents.isDestroyed()||(window===dock&&!rendererLoaded)||window.webContents.isCrashed())return;try{window.webContents.send(event,value)}catch{/* A recovering renderer can temporarily have no main frame. */}}
function send(){const state=snapshot();for(const window of [dock,preferences])sendToWindow(window,'state',state)}
function display(){return screen.getAllDisplays().find(d=>String(d.id)===settings.monitor)||screen.getPrimaryDisplay()}
function refreshCaptureExclusion(force=true){
 if(settings.theme!=='liquid'||dock.isDestroyed())return;
 // Force the owning native window to reapply affinity after show/recreation.
 if(force)dock.setContentProtection(false);dock.setContentProtection(true);protectedMaterial=true;
}
function preserveCaptureExclusion(){refreshCaptureExclusion(false)}
function layout(){
 const d=display(),fit=fitWindow(settings.scale,d.workArea,settings);uiScale=fit.scale;
 dock.setContentBounds({x:Math.round(d.bounds.x+(d.bounds.width-fit.width)/2),y:d.bounds.y,width:fit.width,height:fit.height});
 const protect=settings.theme==='liquid';if(!protect)glass?.stop();try{if(protect)refreshCaptureExclusion();else if(protectedMaterial){dock.setContentProtection(false);protectedMaterial=false}}catch{glass?.fail('Windows could not exclude the dock from capture')}
}
function load(w:BrowserWindow,route=''){if(dev)void w.loadURL(`http://127.0.0.1:5173/${route}`);else void w.loadFile(path.join(__dirname,'../dist/index.html'),{hash:route.replace('#','')})}
function secure(w:BrowserWindow){w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false))}
function showSettings(){
 if(preferences&&!preferences.isDestroyed()){preferences.show();preferences.focus();return}
 const area=screen.getPrimaryDisplay().workArea;const prefWidth=Math.min(780,area.width-40),prefHeight=Math.min(860,area.height-40);
 preferences=new BrowserWindow({icon:iconPath(),title:'MusicPlayerDock - Settings',width:prefWidth,height:prefHeight,minWidth:Math.min(600,prefWidth),minHeight:Math.min(600,prefHeight),backgroundColor:'#101216',autoHideMenuBar:true,webPreferences:{preload,partition:'dock-preferences',contextIsolation:true,nodeIntegration:false,sandbox:true}});
 secure(preferences);load(preferences,'#settings');preferences.on('closed',()=>{preferences=undefined});
}
function recoverDockRenderer(reason:string,force=false){
 if(quitting||dock.isDestroyed()||rendererRecovery)return;
 const delay=force?300:Math.max(300,30000-(Date.now()-lastRendererRecovery));
 rendererLoaded=false;glass?.resetRenderer(reason);
 visibility.state='hidden';visibility.deadline=0;visibility.transition=0;open=false;interactingUntil=0;
 try{setOverlayPassthrough(dock,true,settings.theme==='liquid'?preserveCaptureExclusion:undefined);ignoring=true}catch{}
 rendererRecovery=setTimeout(()=>{rendererRecovery=undefined;if(!quitting&&!dock.isDestroyed()){lastRendererRecovery=Date.now();dock.webContents.reload()}},delay);
}
function tick(){
 const d=display(),p=screen.getCursorScreenPoint(),b=dock.getContentBounds();
 const local={x:(p.x-b.x)/uiScale,y:(p.y-b.y)/uiScale};
 const active=!!current(),visual=dockRect(active,settings.theme,settings);
 // Match the attached shoulder silhouette as well as the floating glass corners.
 const hit=hitDock(local,active,settings.theme,settings);
 const inside=open&&(Date.now()<interactingUntil||within(local,visual,14));
 const near=within(p,{x:d.bounds.x+(d.bounds.width-settings.triggerWidth)/2,y:d.bounds.y,width:settings.triggerWidth,height:settings.triggerHeight});
 const f=media.fullscreen;
 const center=screen.dipToScreenPoint({x:Math.round(d.bounds.x+d.bounds.width/2),y:Math.round(d.bounds.y+d.bounds.height/2)});
 const blocked=captureSuspended||!!(settings.hideFullscreen&&f&&within(center,f));
 const previous=visibility.state;
 const phase=visibility.tick(Date.now(),near,inside,settings.autoHide,settings.hideDelay,blocked,settings.animations&&!settings.reducedMotion?420:0);
 const next=phase==='expanded'||phase==='revealing';
 if(next!==open){open=next;send()}
 const materialReady=settings.theme!=='liquid'||glass?.status.mode==='live'||glass?.status.mode==='fallback';
 const ignore=!(open&&materialReady&&(hit||Date.now()<interactingUntil));if(ignore!==ignoring){try{setOverlayPassthrough(dock,ignore,settings.theme==='liquid'?preserveCaptureExclusion:undefined)}catch{glass?.fail('Windows could not refresh capture protection after changing mouse input')}finally{ignoring=ignore}}
 const visible=!blocked&&(phase!=='hidden'||settings.collapsed==='handle');
 if(visible&&!dock.isVisible()){dock.showInactive();try{refreshCaptureExclusion()}catch{glass?.fail('Windows could not refresh capture exclusion after showing the dock')}}else if(!visible&&dock.isVisible())dock.hide();
 if(previous!==phase&&phase==='hidden')send();
 if(glass){const hwnd=dock.getNativeWindowHandle().readBigUInt64LE().toString();glass.configure(settings.theme==='liquid',rendererLoaded&&!blocked&&phase!=='hidden'&&dock.isVisible(),{hwnd,margin:Math.round(96*d.scaleFactor),maxWidth:Math.round(settings.liquidQuality),maxHeight:Math.min(960,Math.round(settings.liquidQuality*.75)),fps:settings.liquidFps},rendererLoaded&&!blocked);}
}
const actions=new Set(['play','pause','toggle','next','previous','seek','shuffle','repeat','open']);
function authorized(event:Electron.IpcMainEvent|Electron.IpcMainInvokeEvent){if(![dock?.webContents.id,preferences?.webContents.id].includes(event.sender.id)||event.senderFrame!==event.sender.mainFrame)throw Error('Untrusted IPC')}
if(!app.requestSingleInstanceLock())app.quit();else {
 app.on('second-instance',()=>showSettings());
 app.whenReady().then(()=>{
  app.setAppUserModelId('com.musicplayerdock.app');configPath=path.join(app.getPath('userData'),'settings.json');
  try{settings=validate(JSON.parse(fs.readFileSync(configPath,'utf8'))) as Settings}catch{}
  if(diagnostics)settings={...settings,autoHide:false,startWithWindows:false};
  if(app.isPackaged&&settings.startWithWindows){try{app.setLoginItemSettings({openAtLogin:true,path:process.env.PORTABLE_EXECUTABLE_FILE||app.getPath('exe')})}catch{}}
  dock=new BrowserWindow({icon:iconPath(),show:false,width:geometry.windowWidth,height:geometry.windowHeight,frame:false,thickFrame:false,useContentSize:true,transparent:true,resizable:false,hasShadow:false,skipTaskbar:true,focusable:false,alwaysOnTop:true,webPreferences:{preload,partition:'dock-overlay',contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  glass=new GlassCapture(companionPath(),frame=>sendToWindow(dock,'glass:frame',frame),glassStatusChanged,undefined,refreshCaptureExclusion);
  dock.webContents.on('did-start-loading',()=>{rendererLoaded=false;glass?.resetRenderer()});
  dock.webContents.on('did-finish-load',()=>{rendererLoaded=true;dock.webContents.setZoomFactor(1);void dock.webContents.setVisualZoomLevelLimits(1,1);layout();send()});
  dock.webContents.on('zoom-changed',event=>{event.preventDefault();dock.webContents.setZoomFactor(1)});
  prepareOverlayWindow(dock);secure(dock);layout();load(dock);dock.on('close',e=>{if(!quitting){e.preventDefault();dock.hide()}});
  const runtimeErrors:string[]=[];
  dock.webContents.on('render-process-gone',(_e,details)=>{runtimeErrors.push(details.reason);recoverDockRenderer('Recovering the stopped dock renderer')});
  dock.on('unresponsive',()=>recoverDockRenderer('Recovering an unresponsive dock'));
  dock.webContents.on('did-fail-load',(_e,code,description)=>runtimeErrors.push(`${code}: ${description}`));
  dock.webContents.on('console-message',(_e,_level,message)=>{if(_level>=3)runtimeErrors.push(message)});
  dock.once('ready-to-show',()=>{tick();send();if(diagnostics)setTimeout(()=>{fs.mkdirSync(path.resolve('.cache'),{recursive:true});fs.writeFileSync(path.resolve('.cache/desktop-diagnostics.json'),JSON.stringify({loaded:true,bounds:dock.getBounds(),visible:dock.isVisible(),focusable:dock.isFocusable(),focused:dock.isFocused(),state:visibility.state,open,ignoring,mediaConnected:media.connected,mediaError:media.error,capture:glass?.status,protectedMaterial,rendererLoaded,rendererErrors:runtimeErrors},null,2));app.quit()},6000)});
  tray=new Tray(nativeImage.createFromPath(iconPath()));tray.setToolTip('MusicPlayerDock');tray.setContextMenu(Menu.buildFromTemplate([{label:'MusicPlayerDock',enabled:false},{label:'Settings...',click:showSettings},{label:'Recover dock',click:()=>recoverDockRenderer('Recovering the dock from the tray',true)},{label:'Reveal music island',click:()=>{visibility.state='revealing';visibility.transition=Date.now()+420;visibility.deadline=Date.now()+3000;open=true;send();dock.showInactive();try{refreshCaptureExclusion()}catch{glass?.fail('Windows could not refresh capture exclusion after showing the dock')}}},{type:'separator'},{label:'Quit',click:()=>app.quit()}]));tray.on('double-click',showSettings);
  bridge=new Bridge(companionPath(),s=>{media=s;if(!s.sessions.some(x=>x.id===selected))selected='';send()});bridge.start();
  const refreshCapturePower=()=>{const was=captureSuspended;captureSuspended=screenLocked||powerSuspended;if(captureSuspended)glass?.stop();else if(was&&settings.theme==='liquid')glass?.retry();tick()};
  powerMonitor.on('lock-screen',()=>{screenLocked=true;refreshCapturePower()});powerMonitor.on('suspend',()=>{powerSuspended=true;refreshCapturePower()});powerMonitor.on('unlock-screen',()=>{screenLocked=false;refreshCapturePower()});powerMonitor.on('resume',()=>{powerSuspended=false;refreshCapturePower()});
  poll=setInterval(()=>{try{tick()}catch(error){glass?.fail('Dock window update failed: '+(error instanceof Error?error.message:String(error)))}},50);
  const updateDisplay=()=>{layout();if(settings.theme==='liquid')glass?.retry();send()};screen.on('display-added',updateDisplay);screen.on('display-removed',updateDisplay);screen.on('display-metrics-changed',updateDisplay);
  ipcMain.on('glass:feedback',(e,data)=>{authorized(e);if(e.sender!==dock.webContents||!data||!['ready','painted','failed'].includes(data.event))return;glass?.feedback(data.event,typeof data.message==='string'?data.message.slice(0,220):'',Number.isSafeInteger(data.generation)?data.generation:undefined,Number.isSafeInteger(data.revision)?data.revision:undefined)});
  ipcMain.on('glass:retry',e=>{authorized(e);glass?.stop();if(settings.theme==='liquid'){try{refreshCaptureExclusion()}catch{glass?.fail('Windows could not enable capture exclusion');return}}glass?.retry();send()});
  ipcMain.handle('state',e=>{authorized(e);return snapshot()});
  ipcMain.handle('command',(e,c:Command)=>{authorized(e);if(!c||!actions.has(c.action)||typeof c.id!=='string'||!media.sessions.some(s=>s.id===c.id))throw Error('Invalid media command');if(c.action==='seek'&&(!Number.isFinite(c.value)||Number(c.value)<0))throw Error('Invalid seek');bridge.send(c)});
  ipcMain.handle('save',async(e,input)=>{authorized(e);const next=validate(input) as Settings;app.setLoginItemSettings({openAtLogin:next.startWithWindows,path:process.env.PORTABLE_EXECUTABLE_FILE||app.getPath('exe')});await fs.promises.mkdir(path.dirname(configPath),{recursive:true});await fs.promises.writeFile(configPath+'.tmp',JSON.stringify(next,null,2));await fs.promises.rename(configPath+'.tmp',configPath);const themeChanged=settings.theme!==next.theme;settings=next;if(themeChanged)glass?.retry();if(settings.automatic)selected='';layout();send()});
  ipcMain.on('sound-settings',e=>{authorized(e);void shell.openExternal('ms-settings:sound').catch(()=>{})});
  ipcMain.on('interaction',(e,active)=>{authorized(e);interactingUntil=active===true?Date.now()+30000:0});
  ipcMain.on('settings',e=>{authorized(e);showSettings()});ipcMain.on('select',(e,id)=>{authorized(e);if(media.sessions.some(s=>s.id===id)){selected=id;send()}});ipcMain.on('quit',e=>{authorized(e);app.quit()});
 }).catch(e=>{console.error(e);app.quit()});
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{quitting=true;clearTimeout(rendererRecovery);clearInterval(poll);glass?.stop();bridge?.stop();tray?.destroy()});
}
