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
 for(const theme of ['black','dark','light'])for(const active of [false,true]){
  const base={uiScale:1,settings:{...defaults,theme},media:{sessions:active?[session]:[],currentId:active?'test':null,connected:true},displays:[]};
  const visible=renderToStaticMarkup(React.createElement(DockView,{state:{...base,open:true},previewMode:true}));
  const hidden=renderToStaticMarkup(React.createElement(DockView,{state:{...base,open:false},previewMode:true}));
  const visibleSection=visible.match(/<section\b[^>]*>/)?.[0];
  const hiddenSection=hidden.match(/<section\b[^>]*>/)?.[0];
  assert.ok(visibleSection?.includes('translateY(0) scale(1)')&&visibleSection.includes('opacity:1'),`hover state remains hidden for ${theme}/${active}`);
  assert.ok(hiddenSection?.includes('var(--window-height)')&&hiddenSection.includes('opacity:0'),`hidden island remains visible for ${theme}/${active}`);
  assert.ok(visible.includes('overlay is-open'));
 }
});
