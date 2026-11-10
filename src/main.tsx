import React,{useEffect,useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DockView} from './Dock';
import {Preferences} from './Preferences';
import type {DockState,Settings} from './shared';
import {defaults} from '../electron/policy.mjs';
import './style.css';
const preview=new URLSearchParams(location.search).get('preview')==='1';
const initial:DockState={open:preview,uiScale:1,settings:defaults as Settings,media:{sessions:[],currentId:null,connected:false},displays:[]};
// Set scroll behavior before the first paint; preferences keep their own scroll area.
document.documentElement.dataset.view=location.hash==='#settings'?'settings':'dock';
if(preview&&!window.dock){initial.media.sessions=[{id:'preview',source:'Design preview',title:'Midnight Echoes',artist:'Luna Ray',album:'After the rain',artwork:null,playing:false,position:92,duration:227,rate:1,updatedAt:Date.now(),shuffle:null,repeat:null,controls:{play:false,pause:false,toggle:false,next:false,previous:false,seek:false,shuffle:false,repeat:false}}];initial.media.currentId='preview'}

function useDock(){const [state,setState]=useState(initial);useEffect(()=>{let live=true;const off=window.dock?.subscribe(setState);window.dock?.getState().then(s=>{if(live)setState(s)});return()=>{live=false;off?.()}},[]);return [state,setState] as const}

function App(){
 const [state,setState]=useDock();const settingsPage=location.hash==='#settings';
 useLayoutEffect(()=>{document.documentElement.dataset.theme=settingsPage?'dark':state.settings.theme;document.documentElement.dataset.motion=state.settings.reducedMotion||!state.settings.animations?'off':'on'},[state.settings,settingsPage]);
 if(settingsPage)return <Preferences state={state} onSave={async settings=>{if(window.dock)await window.dock.save(settings);else setState(current=>({...current,settings}))}}/>;
 return <DockView state={state}/>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
