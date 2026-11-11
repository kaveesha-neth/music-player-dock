import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectDockState} from '../src/state-subscription.mjs';
function source(){let resolve,listener,unsubscribed=false;const state=new Promise(done=>resolve=done);return {api:{getState:()=>state,subscribe(fn){listener=fn;return()=>unsubscribed=true}},resolve,emit:value=>listener(value),get unsubscribed(){return unsubscribed}}}
test('a late startup snapshot cannot overwrite newer live settings or glass readiness',async()=>{
 const s=source(),updates=[];const stop=connectDockState(s.api,state=>updates.push(state));
 s.emit({theme:'liquid',revision:2,ready:true});s.resolve({theme:'black',revision:0,ready:false});await Promise.resolve();
 assert.deepEqual(updates,[{theme:'liquid',revision:2,ready:true}]);stop();assert.equal(s.unsubscribed,true);
});
test('initial state still loads without a subscription event and cleanup rejects late state',async()=>{
 const s=source(),updates=[];const stop=connectDockState(s.api,state=>updates.push(state));s.resolve({theme:'liquid'});await Promise.resolve();assert.deepEqual(updates,[{theme:'liquid'}]);stop();s.emit({theme:'black'});assert.equal(updates.length,1);
 const late=source(),none=[];const close=connectDockState(late.api,state=>none.push(state));close();late.resolve({theme:'liquid'});await Promise.resolve();assert.deepEqual(none,[]);
});
