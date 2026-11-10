import React,{useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import {Glass,Button} from 'glisse';
import {Play,Pause,SkipBack,SkipForward,Shuffle,Repeat,Repeat1,Settings2} from 'lucide-react';
import type {DockState,MediaSession,Command} from './shared';
import {getGeometryStyle,dockRect,notchPath} from '../electron/geometry.mjs';
import {BrandLogo} from './Brand';
function time(value:number){if(!Number.isFinite(value)||value<0)return '0:00';return `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`}
function source(value:string){return value.replace(/\.exe$/i,'').replace(/_.+!.+$/,'').replace(/^Microsoft\./,'')||'Windows media'}

export function DockView({state,previewMode=false}:{state:DockState;previewMode?:boolean}){
 const [error,setError]=useState('');
 const active=state.media.sessions.find(s=>s.id===state.media.currentId)||state.media.sessions[0];
 const black=state.settings.theme==='black';
 const Surface=black?'div':Glass;
 const PlaybackControl=black?'button':Button;
 const outline=dockRect(!!active,state.settings.theme,state.settings);
 const command=async(action:Command['action'],value?:Command['value'])=>{if(!active||previewMode)return;try{setError('');await window.dock?.command({action,id:active.id,value})}catch(e){setError(e instanceof Error?e.message:'Media command failed')}};
 return <main data-theme={state.settings.theme} className={`overlay ${state.open?'is-open':''}`} style={{...getGeometryStyle(state.settings),'--ui-scale':state.uiScale,'--surface-alpha':state.settings.opacity/100,'--glass-strength':state.settings.glass/100,'--lg-glass-bend':0.18+state.settings.glass*0.003,'--lg-glass-dispersion':0.2,'--lg-rim-shine':0.12+state.settings.glass*0.002} as CSSProperties}>
  <div className={`handle ${state.settings.collapsed==='hidden'?'invisible':''}`}><span/><span/><span/>{black&&<svg className="handle-notch" viewBox="0 0 84 8" aria-hidden="true"><path d={notchPath(84,8,4,4)} fill="#000"/></svg>}</div>
  <section className={`island ${active?'':'idle'}`} style={{transform:state.open?'translateY(0) scale(1)':`translateY(calc(-1 * var(--window-height)))${black?'':' scale(.65,.8)'}`,opacity:state.open?1:0}} aria-label="Music player" aria-hidden={!state.open} inert={previewMode||!state.open}>
   {black?<svg className="notch-surface" viewBox={`0 0 ${outline.width} ${outline.height}`} aria-hidden="true"><path d={notchPath(outline.width,outline.height,outline.radius)} fill="#000"/></svg>:<div className="material-backdrop" aria-hidden="true">{state.settings.ambient&&active?.artwork&&<div className="ambient" style={{backgroundImage:`url("${active.artwork}")`}}/>}</div>}
   <Surface className="shell">
    {active?<>
     {state.settings.showArtwork&&<Artwork session={active}/>}
     <div className="details">
      <div className="metadata" key={active.id+active.title}><h1 title={active.title}>{active.title||'Untitled track'}</h1><p title={[active.artist,active.album,source(active.source)].filter(Boolean).join(' / ')}>{active.artist||'Unknown artist'}</p>{state.settings.showAlbum&&active.album&&<small className="album" title={active.album}>{active.album}</small>}</div>
      <Progress showTimes={state.settings.showTimes} session={active} visible={!previewMode&&state.open} seek={v=>command('seek',v)}>
      <nav className="transport" aria-label="Playback controls">
       {state.settings.optionalControls&&active.controls.shuffle&&active.shuffle!==null&&<button title="Shuffle" aria-label="Shuffle" aria-pressed={active.shuffle} className={active.shuffle?'accent optional':'optional'} onClick={()=>command('shuffle',!active.shuffle)}><Shuffle size={13}/></button>}
       <button aria-label="Previous track" disabled={!active.controls.previous} onClick={()=>command('previous')}><SkipBack size={17} fill="currentColor"/></button>
       <PlaybackControl className="primary-play" aria-label={active.playing?'Pause':'Play'} disabled={!(active.controls.toggle||(active.playing?active.controls.pause:active.controls.play))} onClick={()=>command('toggle')}  >{active.playing?<Pause size={17} fill="currentColor"/>:<Play size={17} fill="currentColor"/>}</PlaybackControl>
       <button aria-label="Next track" disabled={!active.controls.next} onClick={()=>command('next')}><SkipForward size={17} fill="currentColor"/></button>
       {state.settings.optionalControls&&active.controls.repeat&&active.repeat!==null&&<button aria-label={`Repeat: ${active.repeat}`} title={`Repeat: ${active.repeat}`} className={active.repeat!=='None'?'accent optional':'optional'} onClick={()=>command('repeat',active.repeat==='None'?'List':active.repeat==='List'?'Track':'None')}>{active.repeat==='Track'?<Repeat1 size={13}/>:<Repeat size={13}/>}</button>}
      </nav>
      </Progress>
     </div>
    </>:<div className="idle-content"><div className="idle-icon"><BrandLogo decorative/></div><div><h2>Nothing playing</h2><p>{state.media.connected?'Your music will find its way here.':'Connecting to Windows media...'}</p></div><button aria-label="Settings" onClick={()=>window.dock?.settings()}><Settings2 size={20}/></button></div>}
   </Surface>
   {!previewMode&&(error||state.media.error)&&<div className="error" role="status">{error||state.media.error}</div>}
  </section>
  {!previewMode&&!window.dock&&<div className="preview-note">Desktop preview - Open the Electron app for Windows media controls.</div>}
 </main>
}
function Artwork({session}:{session:MediaSession}){const [broken,setBroken]=useState(false);useEffect(()=>setBroken(false),[session.artwork]);return <div className="artwork" key={session.id+session.title+session.album}>{session.artwork&&!broken?<img src={session.artwork} alt={`${session.album||session.title} artwork`} onError={()=>setBroken(true)}/>:<div className="art-placeholder"><div className="record"><BrandLogo decorative/></div><span>THE SOUND OF YOUR DAY</span></div>}<div className="art-shine"/></div>}
function Progress({session:s,visible,seek,children,showTimes}:{showTimes:boolean;session:MediaSession;visible:boolean;seek:(v:number)=>void;children:ReactNode}){
 const [now,setNow]=useState(Date.now()),[drag,setDrag]=useState<number|null>(null);
 useEffect(()=>{if(!visible||!s.playing)return;const timer=setInterval(()=>setNow(Date.now()),200);return()=>clearInterval(timer)},[visible,s.playing]);
 const elapsed=Math.min(s.duration,Math.max(0,s.position+(s.playing?Math.max(0,(now-s.updatedAt)/1000)*s.rate:0)));
 const value=drag??elapsed;
 return <div className="progress"><input aria-label="Playback position" type="range" min={0} max={Math.max(1,s.duration)} step={0.1} value={value} disabled={!s.controls.seek||s.duration<=0} style={{'--progress':`${s.duration?value/s.duration*100:0}%`} as CSSProperties} onChange={e=>setDrag(Number(e.target.value))} onPointerUp={()=>{if(drag!==null){seek(drag);setDrag(null)}}} onPointerCancel={()=>setDrag(null)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)&&drag!==null){seek(drag);setDrag(null)}}}/><div className="timeline-controls">{showTimes&&<span className="time">{time(value)}</span>}{children}{showTimes&&<span className="time">{s.duration>0?time(s.duration):'LIVE'}</span>}</div></div>
}
