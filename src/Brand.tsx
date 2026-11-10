import React from 'react';
import logo from '../assests/MusicPlayerDock-logo.png';

export function BrandLogo({className='',decorative=false}:{className?:string;decorative?:boolean}){
 return <img className={`brand-logo ${className}`} src={logo} alt={decorative?'':'MusicPlayerDock'} draggable={false}/>;
}
