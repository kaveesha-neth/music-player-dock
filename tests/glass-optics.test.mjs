import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundedDistance,lensOffset,textureMapping} from '../src/glass/optics.mjs';
import {defaults,validate} from '../electron/policy.mjs';
import {createGeometry,fitWindow,hitDock} from '../electron/geometry.mjs';

test('lens bends actual sample coordinates near edges and preserves the optical center',()=>{
 const center=lensOffset(0,0,520,300,34,.6);assert.equal(center.x,0);assert.equal(center.y,0);
 const flat=lensOffset(258,0,520,300,34,0);assert.equal(flat.x,258);assert.equal(flat.y,0);
 const refracted=lensOffset(258,0,520,300,34,.6);assert.ok(refracted.x<250,'edge refraction must change background sampling, not just its tint');
 assert.ok(Math.abs(roundedDistance(260,0,520,300,34))<.001);
 assert.ok(roundedDistance(260,150,520,300,34)>0,'rounded outer corner must stay transparent');
 const noEdge=lensOffset(258,0,520,300,34,.6,0),deepEdge=lensOffset(258,0,520,300,34,.6,1);
 assert.ok(deepEdge.x<noEdge.x-30,'edge depth must alter real sample coordinates independently of magnification');
 assert.equal(lensOffset(80,0,520,300,34,.6,0).x,lensOffset(80,0,520,300,34,.6,1).x,'edge depth must preserve the flat center');
});
test('desktop mapping preserves DPI and stays screen-anchored during reveal',()=>{
 const frame={left:120,top:0,windowWidth:1020,windowHeight:570,sourceWidth:1260,sourceHeight:690};
 const rect={left:18,top:18,width:780,height:450},viewport={width:816,height:456};
 const mapped=textureMapping(frame,rect,viewport);
 assert.ok(Math.abs((mapped.x+mapped.width/2)*1260-630)<.001);
 assert.ok(Math.abs(mapped.y*690-22.5)<.001);
 const translated=textureMapping(frame,{...rect,top:rect.top-100},viewport);
 assert.ok(Math.abs((mapped.y-translated.y)*690-125)<.001,'background must not slide with the glass');
});
test('liquid geometry is independent of Black Notch and bounded for large optics controls',()=>{
 assert.equal(defaults.theme,'black');
 const s=validate({...defaults,theme:'liquid',liquidWidth:380,liquidHeight:220,liquidTitleSize:28,liquidButtonSize:72,liquidPadding:32,showAlbum:true,liquidRadius:48});
 const g=createGeometry(s),black=createGeometry({...s,theme:'black'}),fit=fitWindow(1.5,{width:1280,height:720},s);
 assert.equal(black.expanded.width,defaults.notchWidth);assert.equal(black.expanded.height,defaults.notchHeight);
 assert.equal(g.expanded.width,380);assert.ok(g.topHeight>=94);assert.ok(g.expanded.height<=360);
 assert.ok(g.topHeight+g.progressHeight+g.controlHeight+g.rowGap*2+64<=g.expanded.height+.01);
 assert.ok((g.expanded.y+g.expanded.height)*fit.scale<=fit.height);
 assert.equal(hitDock({x:1,y:10},true,'liquid',s),false);
 assert.ok(hitDock({x:g.windowWidth/2,y:g.expanded.y+2},true,'liquid',s));
 const safe=validate({...s,liquidFps:900,liquidQuality:Infinity,liquidRefraction:-10});
 assert.equal(safe.liquidFps,60);assert.equal(safe.liquidQuality,1024);assert.equal(safe.liquidRefraction,0);
 const optics=validate({...s,liquidEdgeShade:200,liquidEdgeWarp:-5});
 assert.equal(optics.liquidEdgeShade,100);assert.equal(optics.liquidEdgeWarp,0);
 const corrupt=validate({...s,liquidEdgeShade:NaN,liquidEdgeWarp:'invalid'});
 assert.equal(corrupt.liquidEdgeShade,35);assert.equal(corrupt.liquidEdgeWarp,55);
 const restored=validate(JSON.parse(JSON.stringify({...s,liquidEdgeShade:20,liquidEdgeWarp:80})));
 assert.equal(restored.liquidEdgeShade,20);assert.equal(restored.liquidEdgeWarp,80);
});
