'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {createServer} = require('../src/server.cjs');
const {run} = require('../src/media.cjs');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

async function start(root, token) {
  const app = createServer({root,token,origins:['http://journey.local'],env:{FREE_DISK_FLOOR_BYTES:'1'},uploadOptions:{freeFloor:0,maxBytes:16 * 1024 ** 2}});
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  let cookie = '';
  const request = (url, options = {}) => new Promise((resolve,reject) => {
    const req = http.request({host:'127.0.0.1',port:app.server.address().port,path:url,method:options.method || 'GET',headers:{Host:'journey.local',Origin:'http://journey.local',Cookie:options.anonymous ? '' : cookie,...options.headers}},res => {
      const parts = [];res.on('data',part => parts.push(part));res.on('end',() => resolve(new Response(Buffer.concat(parts),{status:res.statusCode,headers:res.headers})));
    });req.on('error',reject);req.end(options.body);
  });
  const login = async () => {
    const response = await request('/login',{method:'POST',body:JSON.stringify({token})});assert.equal(response.status,200);
    cookie = response.headers.get('set-cookie').split(';')[0];
  };
  const rpc = async (method,args = {}) => {
    const response = await request('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})});
    const data = await response.json();if(!response.ok)throw Error(data.error);return data.value;
  };
  const chunk = async (id,offset,bytes) => {
    const response = await request('/uploads/' + id,{method:'PUT',headers:{'Upload-Offset':String(offset)},body:bytes});
    const data = await response.json();assert.equal(response.status,200,data.error);return data.value;
  };
  return {app,request,login,rpc,chunk};
}

test('HTTP web journey survives upload and Trash restarts, renders real media, and scopes shared downloads', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(),'vistralo-web-journey-')),root = path.join(scratch,'projects');
  const token = crypto.randomBytes(32).toString('hex');let client = await start(root,token);
  try {
    const fixture = path.join(scratch,'source.mp4');
    await run('ffmpeg',['-hide_banner','-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','3','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
    const bytes = fs.readFileSync(fixture),digest = sha256(bytes);
    await assert.rejects(() => client.rpc('workspaceList'),/Sign in/);
    await client.login();
    const project = await client.rpc('create',{name:'Journey recording',mode:'record',type:'walkthrough',source:'upload'});
    await client.rpc('workspaceUpdate',{id:project.id,patch:{pinned:true,folder:'Review'}});
    const upload = await client.rpc('uploadCreate',{id:project.id,kind:'video',filename:'source.mp4',size:bytes.length,digest});
    const split = Math.floor(bytes.length / 3);
    await client.chunk(upload.id,0,bytes.subarray(0,split));
    assert.equal((await client.rpc('project',{id:project.id})).project.workspace.status,'uploading');
    await client.app.close();client = await start(root,token);await client.login();
    const checkpoint = await client.rpc('uploadStatus',{upload:upload.id});assert.equal(checkpoint.offset,split);
    await client.chunk(upload.id,checkpoint.offset,bytes.subarray(checkpoint.offset));
    const imported = await client.rpc('uploadComplete',{upload:upload.id});assert.equal(imported.sha256,digest);
    const info = await client.rpc('mediaInfo',{id:project.id,file:imported.file});assert.equal(info.duration,3);
    await client.rpc('plan',{id:project.id,plan:{version:1,source:imported.file,clips:[{start:.5,end:1.5}]}});
    await client.rpc('process',{id:project.id,action:'render'});
    const deadline = Date.now() + 15000;let status;
    do {status = await client.rpc('workspaceList');if(status.active)await new Promise(resolve => setTimeout(resolve,20));} while(status.active && Date.now() < deadline);
    assert.equal(status.active,null,'Render must finish within the test deadline');
    const rendered = (await client.rpc('project',{id:project.id})).project;
    assert.equal(rendered.workspace.status,'ready');assert.equal(rendered.workspace.source,'upload');assert.equal(rendered.workspace.pinned,true);
    assert.ok(rendered.data.output.duration > .9 && rendered.data.output.duration < 1.1);
    const outputFile = rendered.data.output.file;
    const download = await client.request('/media?' + new URLSearchParams({id:project.id,file:outputFile,download:'1'}));
    assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment/);
    assert.equal(sha256(Buffer.from(await download.arrayBuffer())),rendered.data.output.sha256);
    const share = await client.rpc('shareCreate',{id:project.id,expiresInDays:7});
    const publicProject = await (await client.request(share.path + '/data',{anonymous:true})).json();assert.equal(publicProject.video,outputFile);
    const shared = await client.request(share.path + '/media?' + new URLSearchParams({file:outputFile}),{anonymous:true});
    assert.equal(sha256(Buffer.from(await shared.arrayBuffer())),rendered.data.output.sha256);
    assert.equal((await client.request(share.path + '/media?' + new URLSearchParams({file:imported.file}),{anonymous:true})).status,404,'The source master is outside this output share');
    await client.rpc('shareRevoke',{shareId:share.id});assert.equal((await client.request(share.path + '/data',{anonymous:true})).status,404);
    await client.rpc('workspaceTrash',{ids:[project.id]});await client.app.close();client = await start(root,token);await client.login();
    assert.ok((await client.rpc('project',{id:project.id})).project.workspace.trashedAt);
    await client.rpc('workspaceRestore',{ids:[project.id]});
    const restored = (await client.rpc('project',{id:project.id})).project;assert.equal(restored.workspace.trashedAt,null);assert.equal(restored.workspace.folder,'Review');
    const sourceDownload = await client.request('/media?' + new URLSearchParams({id:project.id,file:imported.file}));assert.equal(sha256(Buffer.from(await sourceDownload.arrayBuffer())),digest);
    assert.equal(sha256(fs.readFileSync(fixture)),digest);
    // The editor may deliberately select the rendered output instead of the source master.
    const transcript = await client.rpc('transcript',{id:project.id,source:outputFile,words:[{text:'Review',start:0,end:rendered.data.output.duration}]});
    assert.equal(transcript.data.editPlan.source,outputFile);assert.equal(transcript.data.editPlan.clips[0].end,rendered.data.output.duration);
    await assert.rejects(() => client.rpc('transcript',{id:project.id,source:outputFile,words:[{text:'Beyond',start:0,end:2}]}),/duration/);
    await client.request('/logout',{method:'POST'});await assert.rejects(() => client.rpc('workspaceList'),/Sign in/);
  } finally {await client.app.close();fs.rmSync(scratch,{recursive:true,force:true});}
});

test('cancel removes only incomplete upload identity and leaves completed media available', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'vistralo-cancel-')),client = await start(root,crypto.randomBytes(32).toString('hex'));
  try {
    await client.login();const project = await client.rpc('create',{name:'Cancel upload',mode:'record'});
    const captions = Buffer.from('1\n00:00:00,000 --> 00:00:01,000\nKeep this completed source.\n');
    const complete = await client.rpc('uploadCreate',{id:project.id,kind:'captions',filename:'keep.srt',size:captions.length,digest:sha256(captions)});
    await client.chunk(complete.id,0,captions);const imported = await client.rpc('uploadComplete',{upload:complete.id});
    const pending = await client.rpc('uploadCreate',{id:project.id,kind:'video',filename:'pending.webm',size:100,digest:'0'.repeat(64)});
    await client.chunk(pending.id,0,Buffer.alloc(50));
    const result = await client.rpc('cancel',{id:project.id});assert.deepEqual(result.uploads,[pending.id]);
    await assert.rejects(() => client.rpc('uploadStatus',{upload:pending.id}),/Upload not found/);
    assert.equal((await client.rpc('uploadStatus',{upload:complete.id})).state,'Complete');
    assert.equal((await client.rpc('project',{id:project.id})).project.workspace.status,'draft');
    const original = await client.request('/media?' + new URLSearchParams({id:project.id,file:imported.file}));assert.equal(sha256(Buffer.from(await original.arrayBuffer())),sha256(captions));
    const stale = await client.request('/uploads/' + pending.id,{method:'PUT',headers:{'Upload-Offset':'50'},body:Buffer.alloc(50)});assert.equal(stale.status,400);
    await client.rpc('workspaceTrash',{ids:[project.id]});
  } finally {await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('upload cancellation waits for the current write and blocks subsequent chunks and completion', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'vistralo-cancel-race-')),client = await start(root,crypto.randomBytes(32).toString('hex'));
  try {
    await client.login();const project = await client.rpc('create',{name:'Concurrent upload',mode:'record'});
    const bytes = Buffer.alloc(1024 * 1024,17),upload = await client.rpc('uploadCreate',{id:project.id,kind:'video',filename:'pending.webm',size:bytes.length * 2,digest:'0'.repeat(64)});
    // Start a real filesystem write synchronously, then cancel while its promise is pending.
    const chunk = client.app.uploads.chunk(upload.id,0,bytes);
    assert.equal(client.app.uploads.busy.has(upload.id),true);
    const cancelled = client.app.uploads.cancel(upload.id);
    await assert.rejects(() => client.app.uploads.chunk(upload.id,bytes.length,bytes),/cancellation/);
    await assert.rejects(() => client.app.uploads.complete(upload.id),/cancellation/);
    await chunk;assert.deepEqual(await cancelled,{removed:true});
    assert.equal(fs.existsSync(path.join(root,'incoming',upload.id + '.webm')),false);
    await assert.rejects(() => client.rpc('uploadStatus',{upload:upload.id}),/Upload not found/);
  } finally {await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('uploaded playlists cannot turn media probing into a network request', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'vistralo-local-media-')),client = await start(root,crypto.randomBytes(32).toString('hex'));
  let requests = 0;
  const destination = http.createServer((req,res) => {requests++;res.end('Not media');});
  await new Promise(resolve => destination.listen(0,'127.0.0.1',resolve));
  try {
    await client.login();const project = await client.rpc('create',{name:'Media boundary',mode:'record'});
    const playlist = Buffer.from('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1,\nhttp://127.0.0.1:' + destination.address().port + '/segment.ts\n#EXT-X-ENDLIST\n');
    const upload = await client.rpc('uploadCreate',{id:project.id,kind:'video',filename:'disguised.mp4',size:playlist.length,digest:sha256(playlist)});
    await client.chunk(upload.id,0,playlist);
    await assert.rejects(() => client.rpc('uploadComplete',{upload:upload.id}),/ffprobe failed/);
    assert.equal(requests,0,'Probing must not fetch media referenced by a playlist');
    assert.equal((await client.rpc('project',{id:project.id})).project.data.video,undefined);
    await client.rpc('cancel',{id:project.id});
  } finally {await client.app.close();await new Promise(resolve => destination.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
});

test('website job completion persists its brief preview and compact evidence summary', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'vistralo-capture-contract-')),client = await start(root,crypto.randomBytes(32).toString('hex'));
  try {
    await client.login();const project = await client.rpc('create',{name:'Captured site',mode:'walkthrough',type:'brief',source:'web'});
    // Inject only the capture boundary: this verifies the HTTP/job post-processing contract, not Chromium or a live website.
    client.app.service.walkthrough = async (id,options) => {
      assert.equal(options.localApproved,false);assert.equal(options.url,'https://example.com/');
      const manifest = {path:'evidence/test/motion-manifest.json',url:options.url,sessions:[{frames:[{file:'evidence/test/frame.jpg'}]}]};
      const folder = path.join(root,id,'evidence/test');fs.mkdirSync(folder,{recursive:true});
      fs.writeFileSync(path.join(folder,'motion-manifest.json'),JSON.stringify(manifest));
      fs.writeFileSync(path.join(folder,'implementation-brief.md'),'# Captured website\n\n## Recorded behavior\nOne observed interaction.');
      client.app.service.store.update(id,'Needs Review',{manifest:manifest.path});
      return manifest;
    };
    await client.rpc('walkthrough',{id:project.id,url:'https://example.com/'});
    const deadline = Date.now() + 5000;let status;
    do {status = await client.rpc('workspaceList');if(status.active)await new Promise(resolve => setTimeout(resolve,10));} while(status.active && Date.now() < deadline);
    assert.equal(status.active,null);
    const saved = (await client.rpc('project',{id:project.id})).project;
    assert.equal(saved.workspace.status,'ready');assert.equal(saved.workspace.referenceCount,1);assert.equal(saved.workspace.sectionCount,1);
    assert.equal(saved.workspace.evidenceSummary.manifest,'evidence/test/motion-manifest.json');assert.equal(saved.workspace.thumbnail.selection,'brief-content');
    assert.match((await client.rpc('briefRead',{id:project.id})).text,/Recorded behavior/);
    assert.equal((await client.request('/media?' + new URLSearchParams({id:project.id,file:saved.workspace.thumbnail.file}))).status,200);
    // Dashboard reads use the persisted compact summary, so later polls do not parse large timing manifests.
    fs.writeFileSync(path.join(root,project.id,'evidence/test/motion-manifest.json'),'not JSON after summary creation');
    assert.equal((await client.rpc('workspaceList')).projects[0].workspace.referenceCount,1);
    client.app.service.walkthrough = async () => ({sessions:[{error:'The test page was blocked'}]});
    await client.rpc('walkthrough',{id:project.id,url:'https://example.com/'});
    const failedDeadline = Date.now() + 5000;
    do {status = await client.rpc('workspaceList');if(status.active)await new Promise(resolve => setTimeout(resolve,10));} while(status.active && Date.now() < failedDeadline);
    assert.equal(status.active,null);assert.equal(status.projects[0].workspace.status,'failed');assert.match(status.projects[0].workspace.error,/could not read any selected page/);
  } finally {await client.app.close();fs.rmSync(root,{recursive:true,force:true});}
});
