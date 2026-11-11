import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import Module from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaults} from '../electron/policy.mjs';

// Exercise the real renderer without requiring Windows/GPU or enabling sample sessions.
const built=await build({entryPoints:['src/Dock.tsx'],bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom'],loader:{'.png':'dataurl'}});
const filename=path.resolve('.cache/reveal-render.cjs');
const loaded=new Module(filename);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(built.outputFiles[0].text,filename);
const {DockView}=loaded.exports;
const session={id:'test',source:'test',title:'A track',artist:'An artist',album:'',artwork:null,playing:false,position:10,duration:200,rate:1,updatedAt:0,shuffle:null,repeat:null,controls:{play:true,pause:true,toggle:true,next:true,previous:true,seek:true,shuffle:false,repeat:false}};

test('a revealed island has explicit visible motion for each theme with and without media',()=>{
 for(const theme of ['black','dark','light','liquid'])for(const active of [false,true]){
  const base={uiScale:1,settings:{...defaults,theme},media:{sessions:active?[session]:[],currentId:active?'test':null,connected:true},displays:[]};
  const visible=renderToStaticMarkup(React.createElement(DockView,{state:{...base,open:true},previewMode:true}));
  const hidden=renderToStaticMarkup(React.createElement(DockView,{state:{...base,open:false},previewMode:true}));
  const visibleSection=visible.match(/<section\b[^>]*>/)?.[0];
  const hiddenSection=hidden.match(/<section\b[^>]*>/)?.[0];
  assert.ok(visibleSection?.includes('translateY(0) scale(1)')&&visibleSection.includes('opacity:1'),`hover state remains hidden for ${theme}/${active}`);
  assert.ok(hiddenSection?.includes('var(--window-height)')&&hiddenSection.includes('opacity:0'),`hidden island remains visible for ${theme}/${active}`);
  assert.ok(visible.includes('overlay is-open'));
  assert.equal(visible.includes('data-glass-lens="play"'),theme==='liquid'&&active,'only Liquid Glass playback gets the secondary lens');
 }
});
test('black notch presents the selected device, playback state, and disabled unsupported actions',()=>{
 const make=(kind,playing)=>renderToStaticMarkup(React.createElement(DockView,{previewMode:true,state:{open:true,uiScale:1,settings:defaults,media:{sessions:[{...session,playing}],currentId:'test',connected:true,output:{id:'test-output',name:'My output',kind}},displays:[]}}));
 const speaker=make('speakers',true),headphones=make('headphones',false);
 assert.ok(speaker.includes('lucide-laptop'));assert.ok(speaker.includes('aria-label="Pause"'));
 assert.ok(speaker.includes('notch-track-row')&&speaker.includes('notch-progress')&&speaker.includes('notch-controls'));
 assert.ok(headphones.includes('lucide-headphones'));assert.ok(headphones.includes('aria-label="Play"'));
 assert.ok(headphones.includes('Windows output: My output. Open sound settings'));
 assert.ok(headphones.includes('Shuffle unavailable in this player'));
 assert.ok(!headphones.includes('data-animate="true"'),'settings preview must not animate continuously');
 const live=(open,reducedMotion=false)=>renderToStaticMarkup(React.createElement(DockView,{state:{open,uiScale:1,settings:{...defaults,reducedMotion},media:{sessions:[{...session,playing:true}],currentId:'test',connected:true},displays:[]}}));
 assert.ok(live(true).includes('data-animate="true"'),'active visible playback should animate its indicator');
 assert.ok(!live(false).includes('data-animate="true"'),'a hidden dock must stop playback-indicator animation');
 assert.ok(!live(true,true).includes('data-animate="true"'),'reduced motion must stop continuous animation');
});

test('liquid reveal waits for painted live pixels instead of showing a loading background',()=>{
 for(const active of [false,true])for(const mode of [undefined,'off','paused','starting','live','fallback']){
  const state={open:true,uiScale:1,settings:{...defaults,theme:'liquid'},capture:mode?{mode,message:''}:undefined,media:{sessions:active?[session]:[],currentId:active?'test':null,connected:true},displays:[]};
  const markup=renderToStaticMarkup(React.createElement(DockView,{state}));
  const section=markup.match(/<section\b[^>]*>/)?.[0];const ready=mode==='live'||mode==='fallback';
  assert.ok(section.includes(ready?'opacity:1':'opacity:0'),`unexpected reveal during ${mode}/${active}`);
  assert.ok(section.includes(`aria-hidden="${!ready}"`));
  assert.equal(markup.includes('overlay is-open'),ready,'handle stays visible while live material is preparing');
  const closed=renderToStaticMarkup(React.createElement(DockView,{state:{...state,open:false}}));
  assert.ok(closed.match(/<section\b[^>]*>/)?.[0].includes('opacity:0'));
 }
});
