import {test} from 'node:test';
import assert from 'node:assert/strict';
import {geometry,fitWindow,dockRect,hitDock,createGeometry} from '../electron/geometry.mjs';
import {validate,defaults} from '../electron/policy.mjs';

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
  const s=validate({...defaults,theme:'dark',dockWidth:width,dockHeight:height,dockPadding:padding,showArtwork:artwork,artworkSize:152,buttonSize:44,titleSize:24,showAlbum:true,cornerRadius:30});
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
 for(const theme of ['black','liquid'])for(const active of [true,false]){
  const r=dockRect(active,theme);
  assert.equal(r.y,0);
  assert.ok(hitDock({x:r.x+r.width/2,y:0},active,theme));
  assert.ok(hitDock({x:r.x+12,y:11},active,theme));
  assert.equal(hitDock({x:r.x+1,y:10},active,theme),false);
  assert.equal(hitDock({x:r.x+r.width-1,y:10},active,theme),false);
  assert.equal(hitDock({x:r.x+12,y:r.height-1},active,theme),false);
  assert.ok(hitDock({x:r.x+r.width/2,y:r.height-1},active,theme));
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
test('reference notch rows and output controls fit at all size limits without changing glass profiles',()=>{
 for(const width of [380,520,720])for(const height of [220,260,340])for(const padding of [16,32])for(const artwork of [true,false]){
  const s=validate({...defaults,notchWidth:width,notchHeight:height,notchPadding:padding,notchArtworkSize:152,notchTitleSize:28,notchButtonSize:64,showAlbum:true,showArtwork:artwork});
  const g=createGeometry(s),fit=fitWindow(1.5,{width:1920,height:1080},s);
  assert.ok(g.topHeight>=94,'large title, artist and album would clip');
  assert.ok(g.artSize<=g.topHeight,'artwork escapes the track row');
  assert.ok(g.expanded.width-padding*2>=5*40,'five controls cannot fit');
  assert.ok(g.topHeight+g.progressHeight+g.controlHeight+g.rowGap*2+padding*2<=g.expanded.height+.01,'rows exceed native content area');
  assert.ok((g.expanded.y+g.expanded.height)*fit.scale<=fit.height);
  assert.ok(hitDock({x:g.windowWidth/2,y:g.expanded.height},true,'black',s));
  const glass=createGeometry({...s,theme:'dark'});
  assert.equal(glass.expanded.width,s.dockWidth);assert.equal(glass.expanded.height,s.dockHeight);
 }
});
