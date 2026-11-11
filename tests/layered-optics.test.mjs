import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buttonLensGeometry,circularLensOffset} from '../src/glass/optics.mjs';
import {defaults,validate} from '../electron/policy.mjs';

test('the secondary circular lens bends its rim radially while preserving center and outside pixels',()=>{
 const button={x:24,y:70,radius:44};
 assert.deepEqual(circularLensOffset(24,70,button,1),{x:24,y:70});
 assert.deepEqual(circularLensOffset(100,70,button,1),{x:100,y:70});
 assert.deepEqual(circularLensOffset(60,70,button,0),{x:60,y:70});
 const right=circularLensOffset(60,70,button,.65),left=circularLensOffset(-12,70,button,.65),bottom=circularLensOffset(24,106,button,.65);
 assert.ok(60-right.x>4,'rim must distort the background rather than only its tint');
 assert.ok(Math.abs((right.x-24)+(left.x-24))<1e-8,'radial bending must be symmetric');
 assert.ok(Math.abs((right.x-24)-(bottom.y-70))<1e-8,'lens strength must be independent of angle');
 assert.ok(circularLensOffset(60,70,button,1).x<right.x);
 assert.deepEqual(circularLensOffset(60,70,{...button,radius:0},1),{x:60,y:70});
});
test('the play lens stays aligned through UI scaling, reveal translation and hover resizing',()=>{
 const canvas={left:200,top:-50,width:408,height:234},logical={width:544,height:312};
 const rect={left:371,top:85,width:66,height:66};
 const circle=buttonLensGeometry(canvas,logical,rect);assert.deepEqual(circle,{x:0,y:68,radius:44});
 const moved=buttonLensGeometry({...canvas,top:canvas.top-200},logical,{...rect,top:rect.top-200});assert.deepEqual(moved,circle);
 const hover={left:rect.left-1.98,top:rect.top-1.98-.75,width:69.96,height:69.96};
 const hovered=buttonLensGeometry(canvas,logical,hover);assert.ok(Math.abs(hovered.x)<1e-8);assert.ok(Math.abs(hovered.y-67)<1e-8);assert.ok(Math.abs(hovered.radius-46.64)<1e-8);
 assert.deepEqual(buttonLensGeometry(canvas,logical,undefined),{x:0,y:0,radius:0});
});
test('button refraction and lower reflection preferences persist and recover independently',()=>{
 assert.equal(defaults.liquidButtonWarp,65);assert.equal(defaults.liquidBottomReflection,35);assert.equal(defaults.liquidReflectionDepth,35);
 const s=validate({...defaults,theme:'liquid',liquidButtonWarp:-10,liquidBottomReflection:500,liquidReflectionDepth:-20});assert.equal(s.liquidButtonWarp,0);assert.equal(s.liquidBottomReflection,100);assert.equal(s.liquidReflectionDepth,0);
 const corrupt=validate({...defaults,liquidButtonWarp:NaN,liquidBottomReflection:'bad',liquidReflectionDepth:Infinity});assert.equal(corrupt.liquidButtonWarp,65);assert.equal(corrupt.liquidBottomReflection,35);assert.equal(corrupt.liquidReflectionDepth,35);
 const restored=validate(JSON.parse(JSON.stringify({...defaults,liquidButtonWarp:0,liquidBottomReflection:70,liquidReflectionDepth:80})));assert.equal(restored.liquidButtonWarp,0);assert.equal(restored.liquidBottomReflection,70);assert.equal(restored.liquidReflectionDepth,80);assert.equal(restored.liquidEdgeWarp,defaults.liquidEdgeWarp);
});
