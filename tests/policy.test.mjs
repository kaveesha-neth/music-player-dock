import {test} from 'node:test';import assert from 'node:assert/strict';
import {validate,defaults,Visibility,within} from '../electron/policy.mjs';
test('corrupt settings recover and values clamp',()=>{assert.deepEqual(validate(null),defaults);const s=validate({hideDelay:NaN,scale:90,collapsed:'bad',theme:'weird',autoHide:'false'});assert.equal(s.hideDelay,550);assert.equal(s.scale,1.5);assert.equal(s.collapsed,'handle');assert.equal(s.autoHide,true)});
test('rapid hover reverses hiding without waiting for stale transition',()=>{const v=new Visibility();assert.equal(v.tick(0,true,false,true,550),'revealing');assert.equal(v.tick(420,false,true,true,550),'expanded');v.tick(450,false,false,true,550);assert.equal(v.tick(1001,false,false,true,550),'hiding');assert.equal(v.tick(1100,true,false,true,550),'revealing');assert.equal(v.tick(1520,false,true,true,550),'expanded')});
test('leave deadline cancels on return and resets on next departure',()=>{const v=new Visibility();v.tick(100,true,false,true,550);v.tick(600,false,false,true,550);v.tick(700,false,true,true,550);assert.equal(v.deadline,0);v.tick(800,false,false,true,550);assert.equal(v.deadline,1350);assert.equal(v.tick(1349,false,false,true,550),'expanded');assert.equal(v.tick(1350,false,false,true,550),'hiding')});
test('fullscreen overrides pinning and completes hidden state',()=>{const v=new Visibility();v.tick(0,false,false,false,550);assert.equal(v.tick(500,true,true,false,550,true),'hiding');assert.equal(v.tick(920,true,true,false,550,true),'hidden')});
test('trigger uses inclusive bounds and hysteresis pad',()=>{const r={x:-800,y:0,width:90,height:10};assert.equal(within({x:-760,y:5},r),true);assert.equal(within({x:-700,y:5},r),false);assert.equal(within({x:-700,y:5},r,14),true)});
test('black notch is the default and legacy appearance migrates without losing behavior',()=>{
 assert.equal(defaults.theme,'black');
 const migrated=validate({theme:'dark',hideDelay:900,scale:1.25});
 assert.equal(migrated.theme,'black');assert.equal(migrated.hideDelay,900);assert.equal(migrated.scale,1.25);
 assert.equal(validate({...migrated,theme:'dark'}).theme,'dark');
 assert.equal(validate({...migrated,theme:'light'}).theme,'light');
 assert.equal(validate({...migrated,theme:'unknown'}).theme,'black');
});
test('layout settings recover safely and reserve space for large type and controls',()=>{
 const s=validate({dockWidth:5,dockHeight:20,titleSize:500,buttonSize:500,dockPadding:500,progressThickness:99,showAlbum:true,progressStyle:'bad',artworkSize:NaN});
 assert.equal(s.dockWidth,380);assert.equal(s.titleSize,24);assert.equal(s.buttonSize,44);
 assert.ok(s.dockHeight>=184&&s.dockHeight<=220);assert.equal(s.progressThickness,8);
 assert.equal(s.progressStyle,'gradient');assert.equal(s.artworkSize,112);
 assert.equal(validate(null).dockHeight,160);
});
