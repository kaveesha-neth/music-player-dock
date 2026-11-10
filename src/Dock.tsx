import React,{useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {Glass,Button} from 'glisse';
import {Play,Pause,SkipBack,SkipForward,Rewind,FastForward,Shuffle,Repeat,Repeat1,Settings2,Laptop,Headphones,MonitorSpeaker,AudioLines,VolumeX} from 'lucide-react';
import type {DockState,MediaSession,Command,AudioOutput} from './shared';
import {getGeometryStyle,dockRect,notchPath} from '../electron/geometry.mjs';
import {outputPresentation} from './audio-output.mjs';
import {BrandLogo} from './Brand';
import {LiquidSwap} from './LiquidSwap';
import {DesktopGlass} from './glass/DesktopGlass';

function time(value:number){if(!Number.isFinite(value)||value<0)return '0:00';return `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`}
function source(value:string){return value.replace(/\.exe$/i,'').replace(/_.+!.+$/,'').replace(/^Microsoft\./,'')||'Windows media'}
function useSystemReducedMotion(){
 const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{if(typeof window==='undefined'||!window.matchMedia)return;const m=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change)},[]);
 return reduced;
}

export function DockView({state,previewMode=false}:{state:DockState;previewMode?:boolean}){
 const [error,setError]=useState(''),systemReduced=useSystemReducedMotion();
 const active=state.media.sessions.find(s=>s.id===state.media.currentId)||state.media.sessions[0];
 const black=state.settings.theme==='black',liquid=state.settings.theme==='liquid',modern=black||liquid,Surface=modern?'div':Glass,PlaybackControl=black?'button':Button;
 const revealed=state.open&&(!liquid||previewMode||state.capture?.mode==='live'||state.capture?.mode==='fallback');
 const outline=dockRect(!!active,state.settings.theme,state.settings);
 const motion=state.settings.animations&&!state.settings.reducedMotion&&!systemReduced&&revealed&&!previewMode;
 const command=async(action:Command['action'],value?:Command['value'])=>{if(!active||previewMode)return;try{setError('');await window.dock?.command({action,id:active.id,value})}catch(e){setError(e instanceof Error?e.message:'Media command failed')}};
 const repeat=()=>command('repeat',active?.repeat==='None'?'List':active?.repeat==='List'?'Track':'None');
 return <main data-theme={state.settings.theme} data-open={revealed} className={`overlay ${revealed?'is-open':''}`} style={{...getGeometryStyle(state.settings),'--ui-scale':state.uiScale,'--surface-alpha':state.settings.opacity/100,'--glass-strength':state.settings.glass/100,'--lg-glass-bend':liquid?state.settings.liquidRefraction*.004:0.18+state.settings.glass*0.003,'--lg-glass-dispersion':liquid?state.settings.liquidDispersion*.006:0.2,'--lg-rim-shine':0.12+state.settings.glass*0.002} as CSSProperties}>
  <div className={`handle ${state.settings.collapsed==='hidden'?'invisible':''}`}><span/><span/><span/>{modern&&<svg className="handle-notch" viewBox="0 0 84 8" aria-hidden="true"><path d={notchPath(84,8,4,4)} fill="#000"/></svg>}</div>
  <section className={`island ${active?'':'idle'}`} style={{transform:revealed?'translateY(0) scale(1)':`translateY(calc(-1 * var(--window-height)))${modern?'':' scale(.65,.8)'}`,opacity:revealed?1:0}} aria-label="Music player" aria-hidden={!revealed} inert={previewMode||!revealed}>
   {black?<svg className="notch-surface" viewBox={`0 0 ${outline.width} ${outline.height}`} aria-hidden="true"><path d={notchPath(outline.width,outline.height,outline.radius)} fill="#000"/></svg>:liquid?<DesktopGlass state={state} visible={revealed} preview={previewMode}/>:<div className="material-backdrop" aria-hidden="true">{state.settings.ambient&&active?.artwork&&<div className="ambient" style={{backgroundImage:`url("${active.artwork}")`}}/>}</div>}
   <Surface className="shell">
    {active?modern?<>
     <div className={`notch-track-row ${state.settings.showArtwork?'':'without-art'}`}>
      {state.settings.showArtwork&&<Artwork session={active} animate={motion}/>}
      <TrackInfo session={active} showAlbum={state.settings.showAlbum} animate={motion}/>
      <PlaybackActivity playing={active.playing} animate={motion}/>
     </div>
     <Progress variant="notch" showTimes={state.settings.showTimes} session={active} visible={!previewMode&&revealed} seek={v=>command('seek',v)}/>
     <nav className="notch-controls" aria-label="Playback controls">
      <div className="notch-edge-actions">
       {state.settings.optionalControls&&<button className={active.shuffle===true?'active':''} title={active.controls.shuffle&&active.shuffle!==null?'Shuffle':'Shuffle unavailable in this player'} aria-label="Shuffle" aria-pressed={active.shuffle??undefined} disabled={!active.controls.shuffle||active.shuffle===null} onClick={()=>command('shuffle',!active.shuffle)}><LiquidSwap identity={`shuffle:${active.shuffle}`} enabled={motion}><Shuffle/></LiquidSwap><span className="control-state-dot"/></button>}
       {state.settings.optionalControls&&active.controls.repeat&&active.repeat!==null&&<button className={`notch-repeat ${active.repeat!=='None'?'active':''}`} title={`Repeat: ${active.repeat}`} aria-label={`Repeat: ${active.repeat}`} onClick={repeat}><LiquidSwap identity={`repeat:${active.repeat}`} enabled={motion}>{active.repeat==='Track'?<Repeat1/>:<Repeat/>}</LiquidSwap><span className="control-state-dot"/></button>}
      </div>
      <button className="notch-skip" aria-label="Previous track" disabled={!active.controls.previous} onClick={()=>command('previous')}><Rewind fill="currentColor"/></button>
      <PlaybackControl className="primary-play" aria-label={active.playing?'Pause':'Play'} disabled={!(active.controls.toggle||(active.playing?active.controls.pause:active.controls.play))} onClick={()=>command('toggle')}><LiquidSwap identity={active.playing?'pause':'play'} enabled={motion}>{active.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</LiquidSwap></PlaybackControl>
      <button className="notch-skip" aria-label="Next track" disabled={!active.controls.next} onClick={()=>command('next')}><FastForward fill="currentColor"/></button>
      <OutputDevice output={state.media.output} animate={motion} preview={previewMode}/>
     </nav>
    </>:<>
     {state.settings.showArtwork&&<Artwork key={active.id+active.title+active.album} session={active}/>}
     <div className="details">
      <TrackInfo key={active.id+active.title} session={active} showAlbum={state.settings.showAlbum}/>
      <Progress showTimes={state.settings.showTimes} session={active} visible={!previewMode&&state.open} seek={v=>command('seek',v)}>
       <nav className="transport" aria-label="Playback controls">
        {state.settings.optionalControls&&active.controls.shuffle&&active.shuffle!==null&&<button title="Shuffle" aria-label="Shuffle" aria-pressed={active.shuffle} className={active.shuffle?'accent optional':'optional'} onClick={()=>command('shuffle',!active.shuffle)}><Shuffle size={13}/></button>}
        <button aria-label="Previous track" disabled={!active.controls.previous} onClick={()=>command('previous')}><SkipBack size={17} fill="currentColor"/></button>
        <PlaybackControl className="primary-play" aria-label={active.playing?'Pause':'Play'} disabled={!(active.controls.toggle||(active.playing?active.controls.pause:active.controls.play))} onClick={()=>command('toggle')}>{active.playing?<Pause size={17} fill="currentColor"/>:<Play size={17} fill="currentColor"/>}</PlaybackControl>
        <button aria-label="Next track" disabled={!active.controls.next} onClick={()=>command('next')}><SkipForward size={17} fill="currentColor"/></button>
        {state.settings.optionalControls&&active.controls.repeat&&active.repeat!==null&&<button aria-label={`Repeat: ${active.repeat}`} title={`Repeat: ${active.repeat}`} className={active.repeat!=='None'?'accent optional':'optional'} onClick={repeat}>{active.repeat==='Track'?<Repeat1 size={13}/>:<Repeat size={13}/>}</button>}
       </nav>
      </Progress>
     </div>
    </>:<div className="idle-content"><div className="idle-icon"><BrandLogo decorative/></div><div><h2>Nothing playing</h2><p>{state.media.connected?'Your music will find its way here.':'Connecting to Windows media...'}</p></div><button aria-label="Settings" onClick={()=>window.dock?.settings()}><Settings2 size={20}/></button></div>}
   </Surface>
   {!previewMode&&(error||state.media.error)&&<div className="error" role="status">{error||state.media.error}</div>}
  </section>
  {!previewMode&&typeof window!=='undefined'&&!window.dock&&<div className="preview-note">Desktop preview - Open the Electron app for Windows media controls.</div>}
 </main>;
}

function TrackInfo({session:s,showAlbum,animate=false}:{session:MediaSession;showAlbum:boolean;animate?:boolean}){
 return <div className="metadata"><LiquidSwap block className="track-transition" identity={[s.id,s.title,s.artist,s.album,showAlbum].join('\u0001')} enabled={animate}><h1 title={s.title}>{s.title||'Untitled track'}</h1><p title={[s.artist,s.album,source(s.source)].filter(Boolean).join(' / ')}>{s.artist||'Unknown artist'}</p>{showAlbum&&s.album&&<small className="album" title={s.album}>{s.album}</small>}</LiquidSwap></div>;
}
function Artwork({session:s,animate=false}:{session:MediaSession;animate?:boolean}){
 return <div className="artwork"><LiquidSwap block className="art-transition" identity={s.artwork??'placeholder'} enabled={animate}><ArtworkImage url={s.artwork} label={`${s.album||s.title} artwork`}/></LiquidSwap><div className="art-shine"/></div>;
}
function ArtworkImage({url,label}:{url:string|null;label:string}){
 const [broken,setBroken]=useState(false);useEffect(()=>setBroken(false),[url]);
 return url&&!broken?<img src={url} alt={label} draggable={false} onError={()=>setBroken(true)}/>:<div className="art-placeholder"><div className="record"><BrandLogo decorative/></div><span>THE SOUND OF YOUR DAY</span></div>;
}
function PlaybackActivity({playing,animate}:{playing:boolean;animate:boolean}){
 return <div className={`playback-activity ${playing?'playing':''}`} data-animate={animate&&playing} role="img" aria-label={playing?'Playback active':'Playback paused'} title={playing?'Playback active':'Playback paused'}>{[0,1,2,3,4].map(n=><span key={n}/>)}</div>;
}
function OutputDevice({output,animate,preview}:{output?:AudioOutput|null;animate:boolean;preview:boolean}){
 const p=outputPresentation(output),Icon=p.icon==='headphones'?Headphones:p.icon==='laptop'?Laptop:p.icon==='display'?MonitorSpeaker:p.icon==='none'?VolumeX:AudioLines;
 return <button className="device-control" title={p.label} aria-label={p.label} onClick={()=>{if(!preview)window.dock?.soundSettings()}}><LiquidSwap identity={p.icon} enabled={animate}><Icon/></LiquidSwap><span className="sr-only" role="status">{p.name}</span></button>;
}
function Progress({session:s,visible,seek,children,showTimes,variant='compact'}:{showTimes:boolean;session:MediaSession;visible:boolean;seek:(v:number)=>void;children?:ReactNode;variant?:'compact'|'notch'}){
 const [now,setNow]=useState(Date.now()),[drag,setDrag]=useState<number|null>(null),[pending,setPending]=useState<number|null>(null);
 const dragValue=useRef<number|null>(null),pendingTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{if(!visible||!s.playing)return;const timer=setInterval(()=>setNow(Date.now()),200);return()=>clearInterval(timer)},[visible,s.playing]);
 useEffect(()=>()=>{clearTimeout(pendingTimer.current);if(typeof window!=='undefined')window.dock?.interaction(false)},[]);
 useEffect(()=>{if(dragValue.current!==null)window.dock?.interaction(false);setDrag(null);dragValue.current=null;setPending(null);clearTimeout(pendingTimer.current)},[s.id,s.title]);
 useEffect(()=>{if(pending!==null&&Math.abs(s.position-pending)<1.5){setPending(null);clearTimeout(pendingTimer.current)}},[s.position,pending]);
 const elapsed=Math.min(s.duration,Math.max(0,s.position+(s.playing?Math.max(0,(now-s.updatedAt)/1000)*s.rate:0))),value=drag??pending??elapsed;
 const finish=()=>{if(dragValue.current!==null){const target=dragValue.current;seek(target);setPending(target);clearTimeout(pendingTimer.current);pendingTimer.current=setTimeout(()=>setPending(null),1200)}dragValue.current=null;setDrag(null);window.dock?.interaction(false)};
 const input=<input aria-label="Playback position" type="range" min={0} max={Math.max(1,s.duration)} step={0.1} value={value} data-seeking={drag!==null} disabled={!s.controls.seek||s.duration<=0} style={{'--progress':`${s.duration?value/s.duration*100:0}%`} as CSSProperties} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);window.dock?.interaction(true)}} onChange={e=>{dragValue.current=Number(e.target.value);setDrag(dragValue.current)}} onPointerUp={finish} onLostPointerCapture={()=>{if(dragValue.current!==null)finish()}} onPointerCancel={()=>{dragValue.current=null;setDrag(null);window.dock?.interaction(false)}} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))finish()}}/>;
 if(variant==='notch')return <div className="progress notch-progress">{showTimes&&<span className="time">{time(value)}</span>}{input}{showTimes&&<span className="time">{s.duration>0?time(s.duration):'LIVE'}</span>}</div>;
 return <div className="progress">{input}<div className="timeline-controls">{showTimes&&<span className="time">{time(value)}</span>}{children}{showTimes&&<span className="time">{s.duration>0?time(s.duration):'LIVE'}</span>}</div></div>;
}
