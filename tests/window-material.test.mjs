import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareOverlayWindow,setOverlayPassthrough} from '../electron/window-material.mjs';

// Models the Windows style changes in Electron 41, without claiming a native GUI test.
function nativeWindow(){return {layered:false,persistent:false,affinity:0,alpha:undefined,
 setOpacity(alpha){this.alpha=alpha;this.persistent=true;this.layered=true},
 setIgnoreMouseEvents(ignore){const next=ignore||this.persistent;if(this.layered&&!next)this.affinity=0;this.layered=next},
 setContentProtection(protectedWindow){this.affinity=protectedWindow?0x11:0}
}}
test('native capture protection survives repeated click-through and interactive transitions',()=>{
 const previous=nativeWindow();previous.setIgnoreMouseEvents(true);previous.setContentProtection(true);previous.setIgnoreMouseEvents(false);
 assert.equal(previous.affinity,0,'the previous setup loses protection when the layered style is removed');
 const window=nativeWindow();prepareOverlayWindow(window);window.setContentProtection(true);assert.equal(window.alpha,1);
 for(let i=0;i<250;i++){setOverlayPassthrough(window,i%2===0,()=>window.setContentProtection(true));assert.equal(window.layered,true);assert.equal(window.affinity,0x11)}
});
test('input transitions reapply protection after native window styles have changed',()=>{
 const events=[];setOverlayPassthrough({setIgnoreMouseEvents(ignore){events.push(['input',ignore])}},false,()=>events.push(['protection',true]));
 assert.deepEqual(events,[['input',false],['protection',true]]);
});
