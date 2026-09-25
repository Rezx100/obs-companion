'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const {createServer} = require('../src/server.cjs');
const {run} = require('../src/media.cjs');

const token = 'workspace-test-' + crypto.randomBytes(32).toString('hex');
async function setup(root) {
  const app = createServer({root, token, origins: ['http://workspace.local'], env: {FREE_DISK_FLOOR_BYTES:'1'}, uploadOptions: {freeFloor:0, maxBytes:10 * 1024 ** 2}});
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  let cookie = '';
  const request = (url, options = {}) => new Promise((resolve, reject) => {
    const req = http.request({host:'127.0.0.1', port:app.server.address().port, path:url, method:options.method || 'GET', headers:{Host:'workspace.local', Origin:'http://workspace.local', Cookie:options.anonymous ? '' : cookie, ...options.headers}}, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), {status:response.statusCode, headers:response.headers})));
    }); req.on('error', reject); req.end(options.body);
  });
  const login = async () => {const response = await request('/login', {method:'POST', body:JSON.stringify({token})}); cookie = response.headers.get('set-cookie').split(';')[0];};
  const rpc = async (method, args = {}) => {
    const response = await request('/rpc', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({method,args})});
    const data = await response.json(); if (!response.ok) throw Error(data.error); return data.value;
  };
  await login(); return {app, request, rpc};
}

test('workspace metadata and preferences survive restart without changing native project states', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vistralo-workspace-')); let client = await setup(root);
  try {
    const project = await client.rpc('create', {name:'Website study', mode:'walkthrough', type:'brief', source:'web', url:'https://example.com/design'});
    await client.rpc('workspaceUpdate', {id:project.id, patch:{name:'Design review', pinned:true, folder:'Research', lastOpened:true}});
    await client.rpc('workspaceSettings', {patch:{displayName:'Project owner', theme:'light', locale:'en-GB'}});
    await assert.rejects(() => client.rpc('workspaceUpdate', {id:project.id, patch:{url:'javascript:alert(1)'}}), /HTTP/);
    await assert.rejects(() => client.rpc('workspaceUpdate', {id:project.id, patch:{trashedAt:'now'}}), /Unsupported/);
    await client.app.close(); client = await setup(root);
    const result = await client.rpc('workspaceList'), saved = result.projects.find(item => item.id === project.id);
    assert.equal(saved.name, 'Design review'); assert.equal(saved.state, 'Ready'); assert.equal(saved.workspace.status, 'draft');
    assert.equal(saved.workspace.pinned, true); assert.equal(saved.workspace.folder, 'Research'); assert.ok(saved.workspace.lastOpened);
    assert.equal(saved.workspace.url, 'https://example.com/design'); assert.equal(result.settings.theme, 'light'); assert.equal(result.settings.displayName, 'Project owner');
    assert.equal(result.capabilities.collaboration, false); assert.equal(result.capabilities.authentication, 'private-token');
  } finally {await client.app.close(); fs.rmSync(root, {recursive:true, force:true});}
});

test('duplicate, Trash, restore and permanent deletion preserve independent copies and other hardlinks', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vistralo-delete-')), client = await setup(root);
  try {
    const project = await client.rpc('create', {name:'Brief', mode:'walkthrough'});
    await client.rpc('briefSave', {id:project.id, text:'# A real brief\n\n## Scope\nEvidence.'});
    const external = path.join(root, 'keep.md'); fs.linkSync(path.join(root, project.id, 'brief.md'), external);
    const duplicate = await client.rpc('workspaceDuplicate', {id:project.id});
    assert.notEqual(fs.statSync(path.join(root, project.id, 'brief.md')).ino, fs.statSync(path.join(root, duplicate.id, 'brief.md')).ino);
    await client.rpc('briefSave', {id:duplicate.id, text:'# Edited copy'});
    assert.match((await client.rpc('briefRead', {id:project.id})).text, /A real brief/);
    await assert.rejects(() => client.rpc('workspaceDelete', {ids:[project.id], confirmation:'DELETE'}), /Trash/);
    await client.rpc('workspaceTrash', {ids:[project.id]});
    await assert.rejects(() => client.rpc('briefSave', {id:project.id, text:'changed'}), /Restore/);
    await client.rpc('workspaceRestore', {ids:[project.id]});
    assert.equal((await client.rpc('workspaceList')).projects.find(item => item.id === project.id).workspace.trashedAt, null);
    await client.rpc('workspaceTrash', {ids:[project.id]});
    await assert.rejects(() => client.rpc('workspaceDelete', {ids:[project.id], confirmation:'yes'}), /Confirm/);
    await client.rpc('workspaceDelete', {ids:[project.id], confirmation:'DELETE'});
    assert.equal(fs.existsSync(path.join(root, project.id)), false); assert.match(fs.readFileSync(external, 'utf8'), /A real brief/);
    assert.equal((await client.rpc('briefRead', {id:duplicate.id})).text, '# Edited copy');
  } finally {await client.app.close(); fs.rmSync(root, {recursive:true, force:true});}
});

test('capability sharing is read-only, scoped, hashed, expiring and immediately revocable', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vistralo-share-')), client = await setup(root);
  try {
    const project = await client.rpc('create', {name:'Shared brief', mode:'walkthrough'});
    await client.rpc('briefSave', {id:project.id, text:'# Public review\n\nOnly selected content.'});
    fs.writeFileSync(path.join(root, project.id, 'private.json'), JSON.stringify({secret:'never share'}));
    const share = await client.rpc('shareCreate', {id:project.id, expiresInDays:1});
    assert.equal(share.token.length, 43);
    const row = client.app.service.store.db.prepare('SELECT * FROM workspace_shares WHERE id=?').get(share.id);
    assert.ok(!JSON.stringify(row).includes(share.token));
    const response = await client.request(share.path + '/data', {anonymous:true}); assert.equal(response.status, 200);
    const publicData = await response.json(); assert.equal(publicData.readOnly, true); assert.match(publicData.brief, /Public review/);
    assert.ok(!('data' in publicData)); assert.ok(!('events' in publicData)); assert.ok(!('jobs' in publicData));
    assert.equal((await client.request(share.path + '/media?file=brief.md', {anonymous:true})).status, 200);
    assert.equal((await client.request(share.path + '/media?file=private.json', {anonymous:true})).status, 404);
    assert.equal((await client.request(share.path + '/media?file=../../projects.sqlite', {anonymous:true})).status, 404);
    assert.equal((await client.request('/media?id=' + project.id + '&file=brief.md', {anonymous:true})).status, 401);
    assert.equal((await client.request('/rpc', {anonymous:true, method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({method:'workspaceTrash',args:{ids:[project.id]}})})).status, 401);
    await client.rpc('shareRevoke', {shareId:share.id}); assert.equal((await client.request(share.path + '/data', {anonymous:true})).status, 404);
    const expired = await client.rpc('shareCreate', {id:project.id, expiresInDays:7});
    client.app.service.store.db.prepare('UPDATE workspace_shares SET expires=? WHERE id=?').run('2000-01-01T00:00:00.000Z', expired.id);
    assert.equal((await client.request(expired.path + '/data', {anonymous:true})).status, 404);
    const trashed = await client.rpc('shareCreate', {id:project.id}); await client.rpc('workspaceTrash', {ids:[project.id]}); await client.rpc('workspaceRestore', {ids:[project.id]});
    assert.equal((await client.request(trashed.path + '/data', {anonymous:true})).status, 404);
  } finally {await client.app.close(); fs.rmSync(root, {recursive:true, force:true});}
});

test('active uploads block destructive project actions and bulk validation is all-or-nothing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vistralo-busy-')), client = await setup(root);
  try {
    const first = await client.rpc('create', {name:'Idle', mode:'record'}), second = await client.rpc('create', {name:'Uploading', mode:'record'});
    const upload = await client.rpc('uploadCreate', {id:second.id, kind:'video', filename:'capture.webm', size:100, digest:'0'.repeat(64)});
    await assert.rejects(() => client.rpc('workspaceTrash', {ids:[first.id, second.id]}), /active/);
    const projects = (await client.rpc('workspaceList')).projects;
    assert.equal(projects.find(item => item.id === first.id).workspace.trashedAt, null);
    assert.equal(projects.find(item => item.id === second.id).workspace.status, 'uploading');
    await client.rpc('uploadRemove', {upload:upload.id}); await client.rpc('workspaceTrash', {ids:[first.id,second.id]});
    assert.equal((await client.rpc('workspaceList')).projects.every(item => item.workspace.trashedAt), true);
  } finally {await client.app.close(); fs.rmSync(root, {recursive:true, force:true});}
});

test('real media probe, stable-frame thumbnail, duration validation and scoped video sharing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vistralo-thumb-')), client = await setup(root);
  try {
    const project = await client.rpc('create', {name:'Recording', mode:'record'}), source = path.join(root, project.id, 'video.mp4');
    await run('ffmpeg', ['-hide_banner','-nostdin','-v','error','-f','lavfi','-i','color=c=blue:size=640x360:rate=24','-t','6','-c:v','libx264','-pix_fmt','yuv420p',source]);
    client.app.service.store.update(project.id, 'Needs Review', {video:'video.mp4'});
    const info = await client.rpc('mediaInfo', {id:project.id,file:'video.mp4'}); assert.equal(info.duration, 6); assert.equal(info.width, 640);
    await assert.rejects(() => client.rpc('plan', {id:project.id, plan:{version:1,source:'video.mp4',clips:[{start:0,end:10}]}}), /duration/);
    const preview = await client.rpc('thumbnail', {id:project.id}); assert.ok(preview.variants.some(item => item.type === 'image/webp')); assert.ok(preview.variants.every(item => item.width <= 640));
    assert.ok(preview.frameAt <= 1.2); assert.ok(fs.statSync(path.join(root,project.id,preview.file)).size > 0);
    assert.deepEqual(await client.rpc('thumbnail', {id:project.id}), preview);
    const share = await client.rpc('shareCreate', {id:project.id});
    const range = await client.request(share.path + '/media?file=video.mp4', {anonymous:true,headers:{Range:'bytes=0-31'}}); assert.equal(range.status,206); assert.equal((await range.arrayBuffer()).byteLength,32);
    assert.equal((await client.request(share.path + '/media?file=' + encodeURIComponent(preview.file), {anonymous:true})).status,200);
  } finally {await client.app.close(); fs.rmSync(root, {recursive:true, force:true});}
});

test('brief thumbnails escape untrusted title text and the application keeps a strict CSP', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vistralo-svg-')), client = await setup(root);
  try {
    const project = await client.rpc('create', {name:'Review', mode:'walkthrough'});
    await client.rpc('briefSave', {id:project.id, text:'# <script>alert(1)</script>\n## Details'});
    const thumbnail = await client.rpc('thumbnail', {id:project.id}), contents = fs.readFileSync(path.join(root,project.id,thumbnail.file),'utf8');
    assert.ok(contents.includes('&lt;script&gt;')); assert.ok(!contents.includes('<script>'));
    const response = await client.request('/'); assert.equal(response.status,200);
    const csp = response.headers.get('content-security-policy'); assert.ok(!csp.includes('unsafe-inline')); assert.match(csp,/media-src 'self' blob:/); assert.match(csp,/frame-ancestors 'none'/);
    assert.equal((await client.request('/assets/../src/server.cjs')).status,404);
  } finally {await client.app.close(); fs.rmSync(root, {recursive:true, force:true});}
});
