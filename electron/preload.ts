import {contextBridge,ipcRenderer} from 'electron';
import type {DockAPI,DockState} from '../src/shared';
const api:DockAPI={getState:()=>ipcRenderer.invoke('state'),subscribe(fn){const listener=(_:unknown,s:DockState)=>fn(s);ipcRenderer.on('state',listener);return()=>ipcRenderer.removeListener('state',listener)},command:c=>ipcRenderer.invoke('command',c),save:s=>ipcRenderer.invoke('save',s),settings:()=>ipcRenderer.send('settings'),select:id=>ipcRenderer.send('select',id),quit:()=>ipcRenderer.send('quit')};
contextBridge.exposeInMainWorld('dock',api);
