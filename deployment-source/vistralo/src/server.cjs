'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const {Service} = require('./service.cjs');
const {Providers} = require('./providers.cjs');
const {Uploads} = require('./server-uploads.cjs');
const {Workspace, safeURL, briefFile} = require('./workspace.cjs');
const {Thumbnails} = require('./thumbnails.cjs');
const {assert, within, disk} = require('./core.cjs');
const {config}=require('./runtime-config.cjs');const brand=require('./brand.cjs');

async function body(req, limit = 2 * 1024 ** 2) {
  const parts = []; let size = 0;
  for await (const part of req) {size += part.length; assert(size <= limit, 'Request too large'); parts.push(part);}
  return Buffer.concat(parts);
}
const json = (res, code, value) => {
  res.writeHead(code, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(value));
};
const digest = value => crypto.createHash('sha256').update(value).digest();
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.mp4':'video/mp4', '.webm':'video/webm', '.mkv':'video/x-matroska', '.mov':'video/quicktime', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.m4a':'audio/mp4', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.avif':'image/avif', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ico':'image/x-icon', '.vtt':'text/vtt', '.json':'application/json', '.md':'text/plain', '.srt':'text/plain', '.txt':'text/plain'};

function createServer({root, token, origins = ['http://127.0.0.1:8787', 'http://localhost:8787'], service = new Service(root), uploadOptions, env = process.env, captureOptions = {}}) {
  assert(typeof token === 'string' && token.length >= 32, 'Set a random server token of at least 32 characters');
  const tokenHash = digest(token), sessions = new Map(), failures = new Map();
  const uploads = new Uploads(service, uploadOptions);
  const vault = {read: () => ({openai: env.OPENAI_API_KEY, heygen: env.HEYGEN_API_KEY})};
  const providers = new Providers(service.store, vault);
  const allowedHosts = new Set(origins.map(origin => new URL(origin).host));
  let active = null;
  const workspace = new Workspace(service, {active: () => active, uploads});
  const thumbnails = new Thumbnails(workspace);
  const capabilities = () => ({authentication:'private-token', collaboration:false, incomingShares:false, emailInvites:false, screenRecording:'browser', resumableUploads:true, cancelUploads:true, maxUploadBytes:uploads.maxBytes, sharing:'expiring-link', websiteAnalysis:'captured-evidence', paidAnalysis:!!env.OPENAI_API_KEY, serverObs:env.SERVER_OBS === '1'});
  function files(id, folder = '') {
    service.store.get(id);
    const dir = folder ? within(service.store.dir(id), folder) : service.store.dir(id);
    return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
      if (e.isSymbolicLink() || /\.partial|\.tmp|credentials|browser-profile/i.test(e.name)) return [];
      const rel = folder ? folder + '/' + e.name : e.name;
      if (e.isDirectory()) return files(id, rel);
      return mime[path.extname(e.name)] ? [{file: rel, size: fs.statSync(within(service.store.dir(id), rel, true)).size}] : [];
    });
  }
  function schedule(id, label, fn) {
    workspace.requireLive(id);
    assert(!active, 'The server is processing another job; wait for it to finish');
    disk(service.store.root, Number(env.FREE_DISK_FLOOR_BYTES) || 5 * 1024 ** 3);
    const job = {id: crypto.randomUUID(), project: id, label, started: new Date().toISOString(), cancellable:true};
    active = job;
    service.store.event(id, 'server-job-start', job);
    // Request completion never depends on a browser keeping its connection open.
    Promise.resolve().then(fn).then(async result => {
        if (result?.sessions?.length && result.sessions.every(session => session.error)) throw Error('Website capture could not read any selected page. ' + String(result.sessions[0].error).split('\n')[0].slice(0,180));
        if (result?.sessions) workspace.cacheEvidence(id,result);
        const project = service.store.get(id);
        if (project.data.output?.file || project.data.video || briefFile(project)) {
          job.label = 'Preparing preview'; job.cancellable = false;
          try {await thumbnails.generate(id);} catch (error) {service.store.event(id,'thumbnail-unavailable',{error:error.message});}
        }
        service.store.event(id, 'server-job-complete', {id: job.id});
      }).catch(error => {
        service.store.event(id, 'server-job-failed', {id: job.id, error: error.message});
        if (!['Failed','Interrupted'].includes(service.store.get(id).state)) service.store.update(id, 'Failed', {error: error.message});
      }).finally(() => {active = null;});
    return job;
  }
  const methods = {
    status: () => ({projects: service.store.list(), active, progress: service.progress, execution: 'server', credentials: {openai: !!env.OPENAI_API_KEY, heygen: !!env.HEYGEN_API_KEY}, obsAvailable: env.SERVER_OBS === '1', capabilities:capabilities()}),
    create: a => {
      assert(typeof a.name === 'string' && a.name.trim().length > 0 && a.name.trim().length <= 120, 'Provide a project name of 1–120 characters');
      if (a.type !== undefined) assert(['walkthrough','brief'].includes(a.type),'Invalid project type');
      if (a.source !== undefined) assert(['screen','web','upload'].includes(a.source),'Invalid project source');
      if (a.url !== undefined) safeURL(a.url);
      const project = service.store.create(a.name.trim(), a.mode);
      const patch = Object.fromEntries(['type','source','url'].filter(key => a[key] !== undefined).map(key => [key,a[key]]));
      return Object.keys(patch).length ? workspace.update(project.id,patch) : workspace.enrich(project);
    },
    workspaceList: () => ({projects:workspace.list(), settings:workspace.settings(), capabilities:capabilities(), active, progress:service.progress}),
    workspaceUpdate: a => workspace.update(a.id,a.patch),
    workspaceDuplicate: a => workspace.duplicate(a.id),
    workspaceTrash: a => workspace.trash(a.ids),
    workspaceRestore: a => workspace.restore(a.ids),
    workspaceDelete: a => workspace.remove(a.ids,a.confirmation),
    workspaceSettings: a => workspace.settings(a.patch),
    shareCreate: a => workspace.shareCreate(a.id,a.expiresInDays),
    shareList: a => workspace.shares(a.id),
    shareRevoke: a => workspace.shareRevoke(a.shareId),
    mediaInfo: a => workspace.mediaInfo(a.id,a.file),
    briefSave: a => workspace.briefSave(a.id,a.text),
    briefRead: a => {
      const project=service.store.get(a.id), file=briefFile(project);
      return {file, text:file ? fs.readFileSync(within(service.store.dir(a.id),file,true),'utf8') : ''};
    },
    thumbnail: a => thumbnails.create(a.id),
    project: a => ({...service.status(a.id),project:workspace.enrich(service.store.get(a.id))}),
    files: a => files(a.id),
    evidence: a => service.evidence(a.id),
    plan: async a => {
      workspace.requireLive(a.id);
      require('./media.cjs').validatePlan(a.plan);
      const info = await workspace.mediaInfo(a.id,a.plan.source);
      assert(info.duration > 0 && a.plan.clips.every(clip => clip.end <= info.duration + .05), 'Edit exceeds source duration');
      return service.savePlan(a.id, a.plan);
    },
    narratedPlan: a => {workspace.requireLive(a.id);return service.saveNarrationPlan(a.id, a.segments);},
    transcript: async a => {
      workspace.requireLive(a.id);
      const project = service.store.get(a.id);
      const source = a.source || project.data.sources?.screen?.file || project.data.video || project.data.output?.file || project.data.master;
      assert(source, 'Choose a recording first');
      const info = await workspace.mediaInfo(a.id, source);
      assert(info.duration > 0, 'Source duration is unavailable');
      assert(Array.isArray(a.words) && a.words.length > 0 && a.words.length <= 50000, 'Word-timed transcript required');
      assert(a.words.every(word => Number.isFinite(word.end) && word.end <= info.duration), 'Transcript exceeds source duration');
      const plan = require('./editor.cjs').transcriptPlan(source, a.words);
      plan.clips = plan.clips.map(clip => ({start:clip.start, end:Math.min(clip.end, info.duration)}));
      require('./media.cjs').validatePlan(plan);
      return service.savePlan(a.id, plan);
    },
    process: a => schedule(a.id, a.action, () => service.process(a.id, a.action)),
    walkthrough: a => {
      assert(a.localApproved !== true, 'Server captures cannot access private origins');
      safeURL(a.url);
      workspace.update(a.id,{source:'web',url:a.url});
      const options = {url:a.url, pages:a.pages || [], viewports:a.viewports || [{width:1440,height:900}], actions:a.actions || [], reducedMotion:a.reducedMotion === true, localApproved:false, ...captureOptions};
      if (a.obs === true) {
        assert(env.SERVER_OBS === '1', 'Server OBS is not enabled');
        return schedule(a.id, 'OBS website capture', () => require('./server-obs.cjs').recordWalkthrough(service, a.id, options, env.OBS_WEBSOCKET_PASSWORD));
      }
      return schedule(a.id, 'Website evidence', () => service.walkthrough(a.id, options));
    },
    cancel: async a => {
      service.store.get(a.id);
      assert(!(active?.project === a.id && active.cancellable === false), active?.label === 'Verifying upload' ? 'Upload verification is already finishing; wait for completion' : 'Preview generation is finishing; wait for completion');
      if (service.running.has(a.id)) return service.cancel(a.id);
      const pending = service.store.db.prepare("SELECT id FROM uploads WHERE project=? AND state='Uploading'").all(a.id);
      assert(pending.length, 'No cancellable operation is running');
      const ids = pending.map(upload => upload.id);
      await Promise.all(ids.map(id => uploads.cancel(id)));
      service.store.event(a.id, 'upload-cancelled', {uploads:ids});
      return {cancelled:true, uploads:ids};
    },
    recover: a => {
      assert(env.SERVER_OBS === '1', 'Server OBS is not enabled');
      return schedule(a.id, 'Recover server OBS', () => require('./server-obs.cjs').recoverRecording(service,a.id,env.OBS_WEBSOCKET_PASSWORD));
    },
    verifyVoice: () => providers.verifyVoice(),
    analysis: a => schedule(a.id, 'AI analysis', () => service.task(a.id, 'analysis', signal => providers.analyze(a.id, {...a, signal}))),
    speech: a => schedule(a.id, 'Boya speech', () => service.task(a.id, 'speech', signal => providers.speech(a.id, {...a, signal}))),
    check: async () => ({media: await service.media.check(), platform: process.platform, node: process.versions.node, storageFreeBytes: disk(service.store.root, 0)}),
    uploadCreate: a => {workspace.requireLive(a.id);return uploads.create(a);},
    uploadStatus: a => uploads.public(a.upload),
    uploadComplete: async a => {
      assert(!active, 'Wait for the active server job before importing');
      active = {id:a.upload,project:uploads.get(a.upload).project,label:'Verifying upload',cancellable:false};
      try {return await uploads.complete(a.upload);} finally {active=null;}
    },
    uploadRemove: a => uploads.remove(a.upload)
  };
  async function sendFile(req, res, file, download) {
    const size = fs.statSync(file).size;
    let start = 0, end = size - 1, code = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match || Number(match[1]) >= size || (match[2] && (Number(match[2]) < Number(match[1]) || Number(match[2]) >= size))) {
        res.writeHead(416, {'Content-Range': `bytes */${size}`}); res.end(); return;
      }
      start = Number(match[1]); if (match[2]) end = Number(match[2]); code = 206;
    }
    res.writeHead(code, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': Math.max(0,end-start+1), 'Accept-Ranges':'bytes', 'Cache-Control':'no-store', ...(code === 206 ? {'Content-Range':`bytes ${start}-${end}/${size}`} : {}), ...(download ? {'Content-Disposition': 'attachment; filename="' + path.basename(file).replace(/[^a-zA-Z0-9._-]/g, '_') + '"'} : {})});
    if (req.method === 'HEAD' || size === 0) {res.end(); return;}
    await pipeline(fs.createReadStream(file, {start, end}), res);
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      assert(allowedHosts.has(req.headers.host), 'Untrusted host');
      const url = new URL(req.url, 'http://server');
      if (!['GET','HEAD'].includes(req.method)) assert(origins.includes(req.headers.origin), 'Untrusted request origin');
      if (url.pathname === '/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress, record = failures.get(ip);
        assert(!record || record.count < 10 || Date.now() - record.at > 60000, 'Too many login attempts; wait one minute');
        const data = JSON.parse((await body(req, 2048)).toString());
        if (typeof data.token !== 'string' || !crypto.timingSafeEqual(digest(data.token), tokenHash)) {
          failures.set(ip, {at:Date.now(), count:record && Date.now()-record.at<60000 ? record.count+1 : 1});
          return json(res, 401, {error:'Invalid access token'});
        }
        failures.delete(ip);
        for (const [key, until] of sessions) if (until < Date.now()) sessions.delete(key);
        if (sessions.size >= 32) sessions.delete(sessions.keys().next().value);
        const sid = crypto.randomBytes(32).toString('hex'); sessions.set(sid, Date.now()+12*3600000);
        res.setHeader('Set-Cookie', ['vistralo_session='+sid+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200' + (origins.every(o=>o.startsWith('https:'))?'; Secure':''), 'obs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);
        return json(res, 200, {ok:true});
      }
      const statics = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/tokens.css':'tokens.css','/hash-worker.js':'hash-worker.js','/favicon.svg':'favicon.svg','/favicon.ico':'favicon.ico'};
      if (Object.hasOwn(statics, url.pathname) && ['GET','HEAD'].includes(req.method)) return await sendFile(req,res,path.join(__dirname,'..','server-ui',statics[url.pathname]));
      if (url.pathname.startsWith('/assets/') && ['GET','HEAD'].includes(req.method)) {
        const relative = decodeURIComponent(url.pathname.slice(1));
        assert(/^assets\/[a-zA-Z0-9_./-]+$/.test(relative) && !relative.includes('..') && ['.js','.css','.woff2','.svg','.png','.jpg','.jpeg','.webp','.avif','.ico','.json'].includes(path.extname(relative)), 'Unsupported application asset');
        return await sendFile(req,res,within(path.join(__dirname,'..','server-ui'),relative,true));
      }
      const shareMatch = /^\/share\/([A-Za-z0-9_-]{43})(?:\/(data|media))?$/.exec(url.pathname);
      if (shareMatch && ['GET','HEAD'].includes(req.method)) {
        try {
          workspace.resolveShare(shareMatch[1]);
          if (shareMatch[2] === 'data') return json(res,200,workspace.shareData(shareMatch[1]));
          if (shareMatch[2] === 'media') return await sendFile(req,res,workspace.shareFile(shareMatch[1],url.searchParams.get('file')),url.searchParams.has('download'));
          return await sendFile(req,res,path.join(__dirname,'..','server-ui','index.html'));
        } catch {return json(res,404,{error:'Share link unavailable or expired'});}
      }
      const sid = /(?:^|;\s*)vistralo_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || /(?:^|;\s*)obs_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      if (!sid || !(sessions.get(sid) > Date.now())) return json(res,401,{error:'Sign in to the server'});
      if (url.pathname === '/logout' && req.method === 'POST') {
        sessions.delete(sid); res.setHeader('Set-Cookie',['vistralo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0','obs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']); return json(res,200,{ok:true});
      }
      if (url.pathname === '/rpc' && req.method === 'POST') {
        assert(req.headers['content-type'] === 'application/json', 'JSON required');
        const {method, args = {}} = JSON.parse((await body(req)).toString());
        assert(args && typeof args === 'object' && !Array.isArray(args), 'Operation arguments must be an object');
        assert(Object.hasOwn(methods,method), 'Unsupported operation');
        return json(res,200,{value:await methods[method](args)});
      }
      if (url.pathname.startsWith('/uploads/') && req.method === 'PUT') {
        const value = await uploads.chunk(url.pathname.slice(9), Number(req.headers['upload-offset']), await body(req, 8*1024**2));
        return json(res,200,{value});
      }
      if (url.pathname === '/media' && ['GET','HEAD'].includes(req.method)) {
        const id = url.searchParams.get('id'), rel = url.searchParams.get('file'); service.store.get(id);
        assert(mime[path.extname(rel || '')] && !/\.partial|\.tmp|credentials|browser-profile/i.test(rel), 'Unsupported file');
        return await sendFile(req,res,within(service.store.dir(id),rel,true),url.searchParams.has('download'));
      }
      json(res,404,{error:'Not found'});
    } catch (error) {
      if (res.headersSent) res.destroy(); else json(res,400,{error:error.message});
    }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  return {server, service, uploads, workspace, thumbnails, get active(){return active;}, close: async () => {
    for (const controller of service.running.values()) controller.abort();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    while (active) await new Promise(resolve=>setTimeout(resolve,20));
    await Promise.allSettled([...thumbnails.pending.values()]);
    await Promise.allSettled([...uploads.cancelling.values()]);
    await service.close();
  }};
}
if (require.main === module) {
  process.umask(0o077);
  const browserEnv = Object.fromEntries(['HOME','PATH','DISPLAY','XAUTHORITY','XDG_RUNTIME_DIR','LANG','PLAYWRIGHT_BROWSERS_PATH','LD_LIBRARY_PATH','FONTCONFIG_PATH'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const runtime=config();
  const app = createServer({root: process.env.DATA_ROOT || '/data/projects', token:runtime.token, origins:runtime.origins, captureOptions:{chromiumSandbox:true,browserEnv,proxy:{server:'http://127.0.0.1:3128'},launchArgs:['--proxy-bypass-list=<-loopback>','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']}});
  app.server.listen(Number(process.env.PORT)||8787, process.env.BIND_ADDRESS || '127.0.0.1', () => console.log(brand.name+' server ready'));
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>app.close().then(()=>process.exit(0)));
}
module.exports = {createServer};
