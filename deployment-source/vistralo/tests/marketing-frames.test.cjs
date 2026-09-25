'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FrameLoader,sceneAt,thresholdIndex}=require('../marketing/frame-loader.js');
test('decoded-frame cache protects the current draw, closes evictions, and aborts on teardown',async()=>{
 const savedFetch=global.fetch,savedBitmap=global.createImageBitmap,closed=[];let n=0;
 global.fetch=async()=>({ok:true,blob:async()=>({})});global.createImageBitmap=async()=>{const id=n++;return {id,close(){closed.push(id);}};};
 try{const cache=new FrameLoader({template:'/stage-{frame}.avif'},500,3);cache.retainIndex=0;const active=await cache.get(0);for(let i=1;i<10;i++)await cache.get(i);assert.equal(cache.cache.size,3);assert.equal(closed.includes(active.id),false);assert.equal((await cache.get(0)).id,active.id);cache.close();assert.equal(closed.includes(active.id),true);assert.equal(cache.controller.signal.aborted,true);assert.equal(await cache.get(10),null);}finally{global.fetch=savedFetch;global.createImageBitmap=savedBitmap;}
});
test('scene mapping follows enabled scene lengths and caption boundaries retain hysteresis',()=>{
 const scenes=[{id:'observe',scrollVh:160},{id:'brief',scrollVh:140},{id:'build',scrollVh:180}];assert.equal(sceneAt(scenes,0).scene.id,'observe');assert.equal(sceneAt(scenes,1).scene.id,'build');assert.equal(sceneAt(scenes,1).progress,1);
 const captions=[{start:.1},{start:.34}];assert.equal(thresholdIndex(captions,.35,0),0);assert.equal(thresholdIndex(captions,.38,0),1);assert.equal(thresholdIndex(captions,.32,1),1);assert.equal(thresholdIndex(captions,.30,1),0);
});
