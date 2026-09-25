'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const http=require('node:http');
const {createServer}=require('../src/server.cjs');
const {destination,publicAddress}=require('../src/server-egress.cjs');
const {run}=require('../src/media.cjs');
const token='server-test-token-'+crypto.randomBytes(24).toString('hex');
async function setup(root){
  const app=createServer({root,token,origins:['http://studio.local'],env:{FREE_DISK_FLOOR_BYTES:'1'},uploadOptions:{freeFloor:0,maxBytes:10*1024**2}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port;
  let cookie='';
  const request=(url,options={})=>new Promise((resolve,reject)=>{
    const req=http.request(base+url,{method:options.method||'GET',headers:{Host:'studio.local',Origin:'http://studio.local',Cookie:cookie,...options.headers}},res=>{const parts=[];res.on('data',part=>parts.push(part));res.on('end',()=>resolve(new Response(Buffer.concat(parts),{status:res.statusCode,headers:res.headers})));});
    req.on('error',reject);req.end(options.body);
  });
  const login=async()=>{const r=await request('/login',{method:'POST',body:JSON.stringify({token})});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];};
  const rpc=async(method,args={})=>{const r=await request('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})}),data=await r.json();if(!r.ok)throw Error(data.error);return data.value;};
  return {app,request,rpc,login,base};
}
test('server requires authentication, validates origins/hosts, expires session on logout and hides secrets',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-server-auth-')),client=await setup(root);
  try{
    assert.equal((await client.request('/rpc',{method:'POST',body:'{}'})).status,401);
    assert.equal((await client.request('/',{headers:{Host:'evil.test'}})).status,400);
    assert.equal((await client.request('/login',{method:'POST',headers:{Origin:'https://evil.test'},body:JSON.stringify({token})})).status,400);
    assert.equal((await client.request('/login',{method:'POST',body:JSON.stringify({token:'wrong'})})).status,401);
    await client.login();
    assert.equal((await client.rpc('status')).execution,'server');
    await assert.rejects(()=>client.rpc('__proto__'),/Unsupported/);
    await assert.rejects(()=>client.rpc('chooseTool',{tool:'/bin/sh'}),/Unsupported/);
    const status=JSON.stringify(await client.rpc('status'));assert.ok(!status.includes(token));
    await client.request('/logout',{method:'POST'});
    assert.equal((await client.request('/media?id=x&file=../../.env')).status,401);
  }finally{await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('resumable upload survives restart, verifies digest, rejects stale offsets, and completes idempotently',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-server-upload-'));let client=await setup(root);
  try{
    await client.login();const project=await client.rpc('create',{name:'Resume test',mode:'record'}),bytes=Buffer.from('1\n00:00:00,000 --> 00:00:01,000\nA real caption.\n'),digest=crypto.createHash('sha256').update(bytes).digest('hex');
    const upload=await client.rpc('uploadCreate',{id:project.id,filename:'captions.srt',kind:'captions',size:bytes.length,digest});
    let r=await client.request('/uploads/'+upload.id,{method:'PUT',headers:{'Upload-Offset':'0'},body:bytes.subarray(0,15)});assert.equal(r.status,200);
    r=await client.request('/uploads/'+upload.id,{method:'PUT',headers:{'Upload-Offset':'0'},body:bytes.subarray(0,15)});assert.equal(r.status,400);
    await assert.rejects(()=>client.rpc('uploadComplete',{upload:upload.id}),/incomplete/);
    await client.app.close();client=await setup(root);await client.login();
    assert.equal((await client.rpc('uploadStatus',{upload:upload.id})).offset,15);
    r=await client.request('/uploads/'+upload.id,{method:'PUT',headers:{'Upload-Offset':'15'},body:bytes.subarray(15)});assert.equal(r.status,200);
    const result=await client.rpc('uploadComplete',{upload:upload.id});assert.equal(result.sha256,digest);
    assert.deepEqual(await client.rpc('uploadComplete',{upload:upload.id}),result);
    const downloaded=await client.request('/media?'+new URLSearchParams({id:project.id,file:result.file}));assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
    await assert.rejects(()=>client.rpc('uploadRemove',{upload:upload.id}),/Completed/);
    const escape=await client.request('/media?'+new URLSearchParams({id:project.id,file:'../../.env'}));assert.equal(escape.status,400);
    const bad=await client.rpc('uploadCreate',{id:project.id,filename:'bad.srt',kind:'captions',size:bytes.length,digest:'0'.repeat(64)});
    await client.request('/uploads/'+bad.id,{method:'PUT',headers:{'Upload-Offset':'0'},body:bytes});
    await assert.rejects(()=>client.rpc('uploadComplete',{upload:bad.id}),/checksum mismatch/);
    assert.equal((await client.rpc('project',{id:project.id})).project.data.captions,result.file);
    await client.rpc('uploadRemove',{upload:bad.id});
  }finally{await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('real server upload → edit → FFmpeg render → range download preserves the original',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-server-render-')),client=await setup(root);
  try{
    const input=path.join(root,'fixture.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-t','2','-c:v','libx264','-pix_fmt','yuv420p',input]);
    const bytes=fs.readFileSync(input),digest=crypto.createHash('sha256').update(bytes).digest('hex');
    await client.login();const project=await client.rpc('create',{name:'Server render',mode:'record'});
    const upload=await client.rpc('uploadCreate',{id:project.id,filename:'input.mp4',kind:'video',size:bytes.length,digest});
    assert.equal((await client.request('/uploads/'+upload.id,{method:'PUT',headers:{'Upload-Offset':'0'},body:bytes})).status,200);
    const imported=await client.rpc('uploadComplete',{upload:upload.id});
    await client.rpc('plan',{id:project.id,plan:{version:1,source:imported.file,clips:[{start:.25,end:1.25}]}});
    const job=await client.rpc('process',{id:project.id,action:'render'});assert.equal(job.project,project.id);
    const deadline=Date.now()+15000;while(client.app.active&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert.equal(client.app.active,null);
    const finished=(await client.rpc('project',{id:project.id})).project;assert.equal(finished.state,'Needs Review');assert.ok(finished.data.output.duration>.9&&finished.data.output.duration<1.2);
    const url='/media?'+new URLSearchParams({id:project.id,file:finished.data.output.file});
    const range=await client.request(url,{headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,32);
    assert.equal((await client.request(url,{headers:{Range:'bytes=999999999-'}})).status,416);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,project.id,imported.file))).digest('hex'),digest);
    const stat=await client.rpc('status');assert.equal(stat.active,null);
  }finally{await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('server blocks private capture and egress proxy resolves to a checked public address',async()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.2','169.254.169.254','100.64.0.1','192.0.2.1','198.51.100.1','203.0.113.1','224.1.2.3','::1','::ffff:127.0.0.1','fd00::1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('1.1.1.1'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
  await assert.rejects(()=>destination('example.test',22,async()=>[{address:'1.1.1.1',family:4}]),/ports/);
  await assert.rejects(()=>destination('example.test',443,async()=>[{address:'1.1.1.1',family:4},{address:'127.0.0.1',family:4}]),/blocked/);
  assert.deepEqual(await destination('example.test',443,async()=>[{address:'1.1.1.1',family:4}]),{address:'1.1.1.1',family:4});
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-server-private-')),client=await setup(root);
  try{await client.login();await assert.rejects(()=>client.rpc('walkthrough',{url:'http://127.0.0.1',localApproved:true}),/private origins/);}finally{await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('server reports whether the active operation can actually be cancelled',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-server-cancel-state-')),client=await setup(root);
  try{
    await client.login();const project=await client.rpc('create',{name:'Cancel state',mode:'record'}),bytes=Buffer.from('1\n00:00:00,000 --> 00:00:01,000\nCaption.\n'),digest=crypto.createHash('sha256').update(bytes).digest('hex');
    const upload=await client.rpc('uploadCreate',{id:project.id,filename:'captions.srt',kind:'captions',size:bytes.length,digest});
    await client.request('/uploads/'+upload.id,{method:'PUT',headers:{'Upload-Offset':'0'},body:bytes});
    const complete=client.app.uploads.complete.bind(client.app.uploads);let release;const gate=new Promise(resolve=>release=resolve);
    client.app.uploads.complete=async id=>{await gate;return complete(id);};
    const pending=client.rpc('uploadComplete',{upload:upload.id});
    while(!client.app.active)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal((await client.rpc('status')).active.cancellable,false);
    release();await pending;
  }finally{await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});
