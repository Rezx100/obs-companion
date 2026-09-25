'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,safeStorage,protocol,net}=require('electron');const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const runtimeResources=app.isPackaged?process.resourcesPath:path.join(__dirname,'..','resources');if(process.platform==='win32'&&fs.existsSync(path.join(runtimeResources,'browsers')))process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(runtimeResources,'browsers');
const {Service}=require('./service.cjs');const {Vault,Providers}=require('./providers.cjs');const {assert,within,atomic}=require('./core.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'companion',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
if(!process.argv.includes('--mcp')&&!app.requestSingleInstanceLock())app.quit();
let service,win,quitting=false;
app.whenReady().then(async()=>{
 const root=process.env.OBS_COMPANION_TEST_ROOT||path.join(app.getPath('documents'),'OBS Companion');
 if(process.argv.includes('--mcp')){require('./mcp.cjs').start(root);return;}
 const settingsFile=path.join(app.getPath('userData'),'settings.json');let settings=fs.existsSync(settingsFile)?JSON.parse(fs.readFileSync(settingsFile,'utf8')):{};
 
 service=new Service(root,settings);const vault=new Vault(app.getPath('userData'),safeStorage),providers=new Providers(service.store,vault);
 protocol.handle('companion',request=>{try{const u=new URL(request.url);let file;if(u.hostname==='app'){const rel=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';file=within(path.join(__dirname,'..','ui'),rel,true);}else if(u.hostname==='media'){const parts=u.pathname.slice(1).split('/').map(decodeURIComponent),pid=parts.shift();service.store.get(pid);file=within(service.store.dir(pid),parts.join('/'),true);assert(/\.(mp4|webm|mkv|mp3|wav|jpg|png|vtt)$/i.test(file),'Unsupported preview file');}else throw new Error('Unknown origin');return net.fetch(pathToFileURL(file).href);}catch{return new Response('Not found',{status:404});}});
 const methods={
  status:async()=>({projects:service.store.list(),connected:service.capture.connected,obs:service.capture.version||null,meters:service.capture.meters,capture:service.capture.last||null,active:service.capture.active,root,credentials:vault.status(),settings,progress:service.progress}),
  create:async a=>service.store.create(a.name,a.mode),project:async a=>service.status(a.id),evidence:async a=>service.evidence(a.id),
  connect:async a=>{if(a.password)vault.save({obs:a.password});return service.capture.connect(vault.read().obs,Number(a.port)||4455);},
  setup:async()=>service.capture.setup(),devices:async()=>service.capture.devices(),configure:async a=>service.capture.configure(a),preview:async()=>service.capture.preview(),
  start:async a=>service.capture.start(a.id),pause:async()=>service.capture.pause(),resume:async()=>service.capture.resume(),stop:async()=>service.capture.stop(),recover:async a=>service.capture.recover(a.id),restore:async()=>service.capture.restore(),
  walkthrough:async a=>service.walkthrough(a.id,{url:a.url,pages:a.pages||[],viewports:a.viewports,actions:a.actions||[],localApproved:a.localApproved===true,reducedMotion:a.reducedMotion===true,channel:process.platform==='win32'?'msedge':undefined,headless:true}),
  process:async a=>service.process(a.id,a.action),plan:async a=>service.savePlan(a.id,a.plan),cancel:async a=>service.cancel(a.id),
  narratedPlan:async a=>service.saveNarrationPlan(a.id,a.segments),
  transcript:async a=>{const selected=await dialog.showOpenDialog(win,{title:'Import word-timed transcript JSON (text, start, end in seconds)',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});if(selected.canceled)return null;const f=selected.filePaths[0];assert(fs.statSync(f).size<10e6,'Transcript too large');const data=JSON.parse(fs.readFileSync(f,'utf8'));return service.transcript(a.id,Array.isArray(data)?data:data.words);},
  openFolder:async a=>{service.store.get(a.id);return shell.openPath(service.store.dir(a.id));},
  import:async a=>{service.store.get(a.id);const result=await dialog.showOpenDialog(win,{title:'Choose completed local media',properties:['openFile'],filters:[{name:'Media',extensions:a.kind==='audio'?['wav','mp3','m4a']:a.kind==='captions'?['srt','vtt']:['mp4','mkv','webm','mov']}]});if(result.canceled)return null;return service.importFile(a.id,result.filePaths[0],a.kind);},
  importProject:async()=>{const selected=await dialog.showOpenDialog(win,{title:'Open an exported project folder',properties:['openDirectory']});if(selected.canceled)return null;return service.importProject(selected.filePaths[0]);},
  export:async a=>{const selected=await dialog.showOpenDialog(win,{title:'Choose parent folder for project export',properties:['openDirectory','createDirectory']});if(selected.canceled)return null;return service.exportProject(a.id,path.join(selected.filePaths[0],'OBS-Project-'+a.id+'-'+Date.now()));},
  secrets:async a=>{vault.save(a);return vault.status();},verifyVoice:async()=>providers.verifyVoice(),
  analysis:async a=>service.task(a.id,'analysis',signal=>providers.analyze(a.id,{...a,signal})),speech:async a=>service.task(a.id,'speech',signal=>providers.speech(a.id,{...a,signal})),
  readText:async a=>{const p=within(service.store.dir(a.id),a.file,true);assert(/\.(md|json|srt|vtt|txt)$/.test(p)&&fs.statSync(p).size<5e6,'Text preview not allowed');return fs.readFileSync(p,'utf8');},
  check:async()=>({media:await service.media.check(),root,platform:process.platform,version:app.getVersion()}),
  chooseTool:async a=>{assert(['ffmpeg','ffprobe'].includes(a.tool),'Unsupported tool');const selected=await dialog.showOpenDialog(win,{title:'Select '+a.tool+' executable',properties:['openFile'],filters:process.platform==='win32'?[{name:'Executable',extensions:['exe']}]:[]});if(selected.canceled)return null;settings[a.tool]=selected.filePaths[0];atomic(settingsFile,settings);service.media[a.tool]=settings[a.tool];return service.media.check();}
 };
 ipcMain.handle('companion',async(event,{method,args={}})=>{assert(event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&event.senderFrame.url.startsWith('companion://app/'),'Unauthorized caller');assert(Object.hasOwn(methods,method),'Unsupported operation');assert(Buffer.byteLength(JSON.stringify(args))<2e6,'Request too large');try{return {ok:true,value:await methods[method](args)};}catch(e){return {ok:false,error:e.message};}});
 win=new BrowserWindow({width:1340,height:900,minWidth:980,minHeight:700,title:'OBS Companion',backgroundColor:'#f4f4ef',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('companion://app/'))e.preventDefault();});win.webContents.session.setPermissionRequestHandler((wc,p,callback)=>callback(false));await win.loadURL('companion://app/index.html');
 win.on('close',async e=>{if(quitting)return;if(service.capture.active||service.running.size){e.preventDefault();const answer=await dialog.showMessageBox(win,{type:'question',message:'Work is still running',detail:'Keep the app open, or stop recording and cancel local processing before closing. Paid submissions may still complete at the provider.',buttons:['Keep open','Stop and close'],defaultId:0,cancelId:0});if(answer.response===1){quitting=true;await service.close();app.quit();}}});
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{if(service&&!quitting){quitting=true;service.close().catch(()=>{});}});
