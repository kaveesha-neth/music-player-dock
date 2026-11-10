import {test} from 'node:test';
import assert from 'node:assert/strict';
import {outputPresentation} from '../src/audio-output.mjs';
test('device presentation changes between real endpoint kinds and preserves its friendly name',()=>{
 assert.equal(outputPresentation({kind:'speakers',name:'Built-in speakers'}).icon,'laptop');
 const headphone=outputPresentation({kind:'headphones',name:'USB Headset'});
 assert.equal(headphone.icon,'headphones');assert.ok(headphone.label.includes('USB Headset'));
 assert.equal(outputPresentation({kind:'display',name:'HDMI monitor'}).icon,'display');
 assert.equal(outputPresentation({kind:'none',name:'No audio output connected'}).icon,'none');
 assert.equal(outputPresentation(null).icon,'unknown');
 assert.equal(outputPresentation({kind:'unrecognized',name:''}).icon,'unknown');
});
