import React,{useEffect,useRef,useState} from 'react';
import {dockRect,notchPath} from '../../electron/geometry.mjs';
import type {DockState,GlassFrame,Settings} from '../shared';
import {GlassRenderer} from './GlassRenderer';

function illustratedFrame(canvas:HTMLCanvasElement):GlassFrame{
 const demo=document.createElement('canvas');demo.width=960;demo.height=600;const ctx=demo.getContext('2d')!;
 const gradient=ctx.createLinearGradient(0,0,960,600);gradient.addColorStop(0,'#8e949c');gradient.addColorStop(.48,'#171a20');gradient.addColorStop(1,'#aeb4bc');ctx.fillStyle=gradient;ctx.fillRect(0,0,960,600);
 ctx.fillStyle='#e8ebed';ctx.beginPath();ctx.moveTo(520,-100);ctx.bezierCurveTo(830,90,80,180,170,700);ctx.lineTo(410,700);ctx.bezierCurveTo(240,220,1030,300,760,-100);ctx.closePath();ctx.fill();
 ctx.fillStyle='#101216';ctx.beginPath();ctx.moveTo(0,540);ctx.bezierCurveTo(300,100,390,90,960,470);ctx.lineTo(960,650);ctx.lineTo(0,650);ctx.fill();
 const rect=canvas.getBoundingClientRect();
 return {generation:-1,id:0,width:960,height:600,left:-rect.left,top:-rect.top,windowWidth:window.innerWidth,windowHeight:window.innerHeight,sourceWidth:rect.width,sourceHeight:rect.height,excluded:true,pixels:new Uint8Array(ctx.getImageData(0,0,960,600).data)};
}

export function DesktopGlass({state,visible,preview=false}:{state:DockState;visible:boolean;preview?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<GlassRenderer|null>(null),settings=useRef<Settings>(state.settings);
 const wasOpen=useRef(visible),visibleNow=useRef(visible);visibleNow.current=visible;
 const [phase,setPhase]=useState<'starting'|'live'|'fallback'|'preview'>('starting'),[detail,setDetail]=useState(''),[restart,setRestart]=useState(0);
 settings.current=state.settings;
 const captureStatus=useRef(state.capture);captureStatus.current=state.capture;
 useEffect(()=>{
  const element=canvas.current!;let disposed=false,lastGeneration=0;
  const failure=(message:string)=>{if(disposed)return;setPhase('fallback');setDetail(message);if(!preview)window.dock?.glassFeedback('failed',message,undefined,state.capture?.revision??0)};
  try{engine.current=new GlassRenderer(element)}catch(e){failure(e instanceof Error?e.message:'GPU glass unavailable');return;}
  setPhase('starting');
  const draw=()=>{try{return engine.current?.draw(settings.current)}catch(e){failure(e instanceof Error?e.message:'Glass rendering failed');return false}};
  const lost=(e:Event)=>{e.preventDefault();failure('The graphics context was lost. Retry Liquid Glass in Settings.')};
  const restored=()=>setRestart(x=>x+1);element.addEventListener('webglcontextlost',lost);element.addEventListener('webglcontextrestored',restored);
  let unsubscribe:(()=>void)|undefined,frameRequest=0,interactionFrame=0;
  const island=element.closest('.island');
  const trackLens=(event:Event)=>{
   const button=event.target instanceof Element?event.target.closest('[data-glass-lens=play]'):null;
   if(!button||(!preview&&!visibleNow.current))return;
   const pointer=event as PointerEvent;if((event.type==='pointerover'||event.type==='pointerout')&&pointer.relatedTarget instanceof Node&&button.contains(pointer.relatedTarget))return;
   cancelAnimationFrame(interactionFrame);
   const reduced=!settings.current.animations||settings.current.reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const until=performance.now()+(reduced?0:520);
   const paint=()=>{if(disposed||(!preview&&!visibleNow.current)||document.visibilityState==='hidden')return;if(draw()&&performance.now()<until)interactionFrame=requestAnimationFrame(paint)};
   interactionFrame=requestAnimationFrame(paint);
  };
  const pointerEvents=['pointerover','pointerout','pointerdown','pointerup','pointercancel','lostpointercapture'];
  for(const type of pointerEvents)island?.addEventListener(type,trackLens);
  if(preview){
   frameRequest=requestAnimationFrame(()=>{try{engine.current?.upload(illustratedFrame(element));if(draw())setPhase('preview')}catch(e){failure(e instanceof Error?e.message:'Material preview unavailable')}});
  }else if(window.dock){
   unsubscribe=window.dock.subscribeGlass(frame=>{
    if(disposed)return;
    try{engine.current?.upload(frame);if(draw()){setPhase('live');setDetail('');if(lastGeneration!==frame.generation||captureStatus.current?.mode!=='live'){lastGeneration=frame.generation;window.dock?.glassFeedback('painted','',frame.generation,state.capture?.revision??0)}}}catch(e){failure(e instanceof Error?e.message:'Desktop glass unavailable')}
   });
   window.dock.glassFeedback('ready','',undefined,state.capture?.revision??0);
  }else failure('Live desktop capture is available only in the Windows app');
  const resize=new ResizeObserver(()=>{
   if(preview){try{engine.current?.upload(illustratedFrame(element));draw()}catch(e){failure(e instanceof Error?e.message:'Material preview unavailable')}}else draw();
  });resize.observe(element);
  return()=>{disposed=true;unsubscribe?.();cancelAnimationFrame(frameRequest);cancelAnimationFrame(interactionFrame);for(const type of pointerEvents)island?.removeEventListener(type,trackLens);resize.disconnect();element.removeEventListener('webglcontextlost',lost);element.removeEventListener('webglcontextrestored',restored);engine.current?.dispose();engine.current=null};
 },[preview,restart,state.capture?.revision]);
 useEffect(()=>{if(!preview&&state.capture?.mode==='fallback'){setPhase('fallback');setDetail(state.capture.message)}else if(!preview&&state.capture?.mode==='starting')setPhase(current=>current==='live'?'live':'starting')},[state.capture?.mode,state.capture?.message,preview]);
 // Re-render uniforms on changes; only the short reveal/retract needs intermediate frames.
 useEffect(()=>{
  const closing=wasOpen.current&&!visible;wasOpen.current=visible;if(!preview&&!visible&&!closing)return;
  let frame=0;const duration=state.settings.animations&&!state.settings.reducedMotion&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?520:0;const end=performance.now()+duration;let cancelled=false;
  const paint=()=>{if(cancelled||document.visibilityState==='hidden')return;try{engine.current?.draw(settings.current)}catch{}if(performance.now()<end)frame=requestAnimationFrame(paint)};
  frame=requestAnimationFrame(paint);return()=>{cancelled=true;cancelAnimationFrame(frame)};
 },[visible,state.uiScale,state.settings.liquidBlur,state.settings.liquidRefraction,state.settings.liquidDispersion,state.settings.liquidTint,state.settings.liquidEdgeShade,state.settings.liquidEdgeWarp,state.settings.liquidButtonWarp,state.settings.liquidBottomReflection,state.settings.liquidReflectionDepth,state.settings.liquidButtonSize,state.settings.liquidPadding,state.settings.liquidRadius,state.settings.animations,state.settings.reducedMotion]);
 const active=state.media.sessions.length>0,outline=dockRect(active,'liquid',state.settings);
 return <div className={`desktop-glass phase-${phase}`} style={{clipPath:`path('${notchPath(outline.width,outline.height,outline.radius)}')`}}><div className="desktop-glass-fallback" aria-hidden="true"/><canvas key={`${state.capture?.revision??0}:${restart}`} ref={canvas} aria-hidden="true"/><div className="liquid-top-shade" aria-hidden="true"/>{phase==='fallback'&&<span className="glass-fallback-label" role="status" title={detail}>Desktop glass unavailable · fallback material</span>}</div>;
}
