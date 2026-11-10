import React,{useLayoutEffect,useRef,useState,type ReactNode} from 'react';

// At most two layers; transitions reverse from their current visual values.
// Animation frames and cleanup timers exist only during a visible change.
export function LiquidSwap({identity,children,enabled,className='',block=false}:{identity:string;children:ReactNode;enabled:boolean;className?:string;block?:boolean}){
 const serial=useRef(0),previous=useRef(identity);
 const [layers,setLayers]=useState([{id:0,content:children,phase:'stable'}]);
 useLayoutEffect(()=>{
  const different=previous.current!==identity;previous.current=identity;
  if(!enabled){setLayers([{id:++serial.current,content:children,phase:'stable'}]);return}
  if(!different)return;
  const id=++serial.current;
  setLayers(current=>[...current.slice(-1).map(layer=>({...layer,phase:'exit'})),{id,content:children,phase:'enter'}]);
  let second=0;
  const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setLayers(current=>current.map(layer=>layer.id===id?{...layer,phase:'stable'}:layer)))});
  const timer=setTimeout(()=>setLayers(current=>current.filter(layer=>layer.id===id)),440);
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);clearTimeout(timer)};
  // Content identity, rather than React element allocation, controls transitions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[identity,enabled]);
 const Root=block?'div':'span';
 return <Root className={`liquid-swap ${className}`} data-motion={enabled?'on':'off'}>{layers.map(layer=><Root key={layer.id} className="liquid-layer" data-phase={layer.phase}>{layer.content}</Root>)}</Root>;
}
