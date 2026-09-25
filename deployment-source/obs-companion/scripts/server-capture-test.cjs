'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createServer}=require('../src/server.cjs');
const {atomic}=require('../src/core.cjs');
(async()=>{
  const fixture=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(fs.readFileSync('fixtures/motion-lab.html'));});
  await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
  const root=fs.mkdtempSync(path.resolve('work/server-capture-')),token=crypto.randomBytes(32).toString('hex'),origin='http://127.0.0.1:8789';
  const exe=process.env.COMPANION_TEST_CHROMIUM||path.resolve('.cache/chromium/chromium');
  if(!process.env.COMPANION_TEST_CHROMIUM){fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,require('node:zlib').brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/chromium.br')));fs.chmodSync(exe,0o755);}
  // Fixture access is injected only by this test. The production API never accepts it.
  const app=createServer({root,token,origins:[origin],env:{FREE_DISK_FLOOR_BYTES:'1'},captureOptions:{localApproved:true,executablePath:exe}});
  await new Promise(resolve=>app.server.listen(8789,'127.0.0.1',resolve));
  try{
    const login=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({token})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
    const rpc=async(method,args={})=>{const r=await fetch(origin+'/rpc',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({method,args})}),data=await r.json();if(!r.ok)throw Error(data.error);return data.value;};
    const p=await rpc('create',{name:'HTTP server motion capture',mode:'walkthrough'});
    const started=await rpc('walkthrough',{id:p.id,url:'http://127.0.0.1:'+fixture.address().port,viewports:[{width:1440,height:900}],actions:[{selector:'#next',trigger:'click',reviewed:true}]});
    assert.equal(started.project,p.id);assert.ok(app.active);
    await assert.rejects(()=>rpc('walkthrough',{id:p.id,url:'http://example.com'}),/another job/);
    const deadline=Date.now()+90000;while(app.active&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));assert.equal(app.active,null,'Capture must finish within the test deadline');
    const project=(await rpc('project',{id:p.id})).project;assert.equal(project.state,'Needs Review');const manifest=await rpc('evidence',{id:p.id});assert.ok(!manifest.sessions[0].error);assert.ok(manifest.sessions[0].frames.length>20);
    const response=await fetch(origin+'/media?'+new URLSearchParams({id:p.id,file:manifest.sessions[0].video}),{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>1000);
    atomic('evidence/server-capture.json',{passed:true,at:new Date().toISOString(),checks:['authenticated async HTTP capture','capture continues after start request returns','single active job enforced','real Chromium fixture capture','evidence manifest and video downloadable'],frames:manifest.sessions[0].frames.length,project:p.id,boundary:'Local deterministic fixture; private fixture origin allowed only through test dependency injection. Production rejects this origin. Not a public-site, supplied-server, native OBS or hardware pass.'});
    console.log('Server HTTP capture acceptance passed');
  }finally{await app.close();fixture.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
