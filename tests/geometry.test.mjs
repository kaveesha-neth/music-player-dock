import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geometry,fitWindow,dockRect,hitDock,createGeometry} from '../electron/geometry.mjs';
import {validate} from '../electron/policy.mjs';

test('full dock including controls fits native content area across fractional UI scales',()=>{
 for(const scale of [.65,.7,.85,1,1.05,1.1,1.25,1.5]){
  const fit=fitWindow(scale,{width:1920,height:1080});
  const rect=geometry.expanded;
  assert.ok((rect.x+rect.width)*fit.scale<=fit.width,`right edge clipped at ${scale}`);
  assert.ok((rect.y+rect.height)*fit.scale<=fit.height,`bottom controls clipped at ${scale}`);
  assert.ok(geometry.windowWidth*fit.scale<=fit.width,'viewport rounded below rendered width');
  assert.ok(geometry.windowHeight*fit.scale<=fit.height,'viewport rounded below rendered height');
 }
});
test('custom dimensions keep artwork, the complete transport row and native hit bounds aligned',()=>{
 for(const width of [380,440,640])for(const height of [144,160,220])for(const padding of [10,22])for(const artwork of [false,true]){
  const s=validate({dockWidth:width,dockHeight:height,dockPadding:padding,showArtwork:artwork,artworkSize:152,buttonSize:44,titleSize:24,showAlbum:true,cornerRadius:30});
  const g=createGeometry(s),fit=fitWindow(1.25,{width:1280,height:720},s);
  assert.ok(g.artSize<=s.dockHeight-2*padding);
  const detailsWidth=s.dockWidth-g.artColumn-2*padding-2;
  assert.ok(detailsWidth>=222,'transport with both timestamps and optional controls would overflow');
  assert.ok((g.expanded.y+g.expanded.height)*fit.scale<=fit.height);
  for(const theme of ['black','dark','light']){
   const r=dockRect(true,theme,s),center={x:r.x+r.width/2,y:r.y+r.height-2};
   assert.ok(hitDock(center,true,theme,s),'rendered lower edge must accept clicks');
   assert.equal(hitDock({...center,y:r.y+r.height+1},true,theme,s),false);
  }
 }
});
test('attached notch includes the screen edge but passes clicks through shoulder cutouts',()=>{
 for(const active of [true,false]){
  const r=dockRect(active,'black');
  assert.equal(r.y,0);
  assert.ok(hitDock({x:r.x+r.width/2,y:0},active,'black'));
  assert.ok(hitDock({x:r.x+12,y:11},active,'black'));
  assert.equal(hitDock({x:r.x+1,y:10},active,'black'),false);
  assert.equal(hitDock({x:r.x+r.width-1,y:10},active,'black'),false);
  assert.equal(hitDock({x:r.x+12,y:r.height-1},active,'black'),false);
  assert.ok(hitDock({x:r.x+r.width/2,y:r.height-1},active,'black'));
  assert.ok(r.x>=0&&r.x+r.width<=geometry.windowWidth&&r.height<=geometry.windowHeight);
 }
});
test('fitting a small display keeps the complete dock on screen',()=>{
 const area={width:390,height:180};const fit=fitWindow(1.5,area);
 assert.ok(fit.width<=area.width-24);assert.ok(fit.height<=area.height-24);
 for(const rect of [geometry.expanded,geometry.idle]){
  assert.ok((rect.x+rect.width)*fit.scale<=fit.width);
  assert.ok((rect.y+rect.height)*fit.scale<=fit.height);
 }
});
