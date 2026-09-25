'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {EventEmitter}=require('node:events');
const {Service}=require('../src/service.cjs');
const {recordWalkthrough,recoverRecording}=require('../src/server-obs.cjs');
const {run}=require('../src/media.cjs');
class OBSContract extends EventEmitter {
  constructor(file,{active=false,failStop=false,existingInput=false,attached=true,finalize}={}){super();this.file=file;this.active=active;this.failStop=failStop;this.existingInput=existingInput;this.attached=attached;this.finalize=finalize;this.calls=[];this.directory=path.dirname(file);}
  async connect(){return {};}
  async disconnect(){}
  async call(name,data={}){
    this.calls.push({name,data});
    if(name==='GetRecordStatus')return {outputActive:this.active};
    if(name==='GetStreamStatus')return {outputActive:false};
    if(name==='GetInputKindList')return {inputKinds:['xshm_input']};
    if(name==='GetSceneList')return {scenes:[]};
    if(name==='GetInputList')return {inputs:this.existingInput?[{inputName:'Companion Server Display',inputKind:'xshm_input'}]:[]};
    if(name==='GetSceneItemId'){if(!this.attached)throw Error('scene item missing');return {sceneItemId:7};}
    if(name==='CreateSceneItem'){this.attached=true;return {sceneItemId:7};}
    if(name==='SetRecordDirectory')this.directory=data.recordDirectory;
    if(name==='GetRecordDirectory')return {recordDirectory:this.directory};
    if(name==='StartRecord'){this.active=true;return {};}
    if(name==='StopRecord'){if(this.failStop)throw Error('Unconfirmed stop');this.active=false;this.finalize?.();return {outputPath:this.file};}
    return {};
  }
}
test('Linux OBS contract records server display, hashes master and preserves incomplete capture on ambiguous stop (mock OBS)',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-linux-contract-')),service=new Service(root);
  try{
    const p=service.store.create('Server capture','walkthrough'),file=path.join(service.store.dir(p.id),'masters','fixture.mkv');fs.mkdirSync(path.dirname(file));
    await run('ffmpeg',['-v','error','-f','lavfi','-i','color=size=160x90:rate=30','-t','0.5','-c:v','libx264',file]);
    const client=new OBSContract(file),capture=async options=>{assert.equal(options.headless,false);assert.ok(options.launchArgs.includes('--kiosk'));return {path:'evidence/manifest.json',sessions:[],coverage:[]};};
    await recordWalkthrough(service,p.id,{},'x'.repeat(32),client,capture);
    const result=service.store.get(p.id);assert.equal(result.state,'Needs Review');assert.equal(result.data.master,'masters/fixture.mkv');assert.equal(result.data.sourceSha256.length,64);
    assert.ok(client.calls.some(c=>c.name==='CreateInput'&&c.data.inputKind==='xshm_input'));
    const ambiguous=new OBSContract(file,{failStop:true});
    await assert.rejects(()=>recordWalkthrough(service,p.id,{},'x'.repeat(32),ambiguous,capture),/Unconfirmed stop/);
    assert.equal(ambiguous.calls.filter(c=>c.name==='StopRecord').length,1,'Do not blindly repeat an ambiguous stop');assert.ok(fs.existsSync(file));assert.equal(service.store.get(p.id).state,'Failed');
    const recovery=new OBSContract(file);await recoverRecording(service,p.id,'x'.repeat(32),recovery);assert.equal(service.store.get(p.id).state,'Needs Review');
  }finally{await service.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('Linux OBS contract refuses an already active recorder (mock OBS)',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-linux-busy-')),service=new Service(root);
  try{const p=service.store.create('Busy capture','walkthrough'),client=new OBSContract('/unused/master.mkv',{active:true});await assert.rejects(()=>recordWalkthrough(service,p.id,{},'x'.repeat(32),client),/already recording/);assert.ok(!client.calls.some(c=>c.name==='StartRecord'||c.name==='StopRecord'));}finally{await service.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('Linux OBS reattaches and enables a reused display input (mock OBS)',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-linux-reuse-')),service=new Service(root);
  try{
    const p=service.store.create('Reused display','walkthrough'),file=path.join(service.store.dir(p.id),'masters','fixture.mkv');fs.mkdirSync(path.dirname(file));
    await run('ffmpeg',['-v','error','-f','lavfi','-i','color=size=160x90:rate=30','-t','0.5','-c:v','libx264',file]);
    const client=new OBSContract(file,{existingInput:true,attached:false}),capture=async()=>({path:'evidence/manifest.json',sessions:[],coverage:[]});
    await recordWalkthrough(service,p.id,{},'x'.repeat(32),client,capture);
    assert.ok(client.calls.some(c=>c.name==='CreateSceneItem'&&c.data.sourceName==='Companion Server Display'));
    assert.ok(client.calls.some(c=>c.name==='SetSceneItemEnabled'&&c.data.sceneItemEnabled===true));
  }finally{await service.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('Linux OBS recovery waits for a delayed MKV finalization (mock OBS, real FFprobe)',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obs-linux-finalize-')),service=new Service(root);
  try{
    const p=service.store.create('Delayed finalize','walkthrough'),directory=path.join(service.store.dir(p.id),'masters'),source=path.join(root,'source.mkv'),file=path.join(directory,'delayed.mkv');fs.mkdirSync(directory);
    await run('ffmpeg',['-v','error','-f','lavfi','-i','color=size=160x90:rate=30','-t','0.5','-c:v','libx264',source]);
    const client=new OBSContract(file,{active:true,finalize:()=>setTimeout(()=>fs.copyFileSync(source,file),100)});client.directory=directory;
    const recovered=await recoverRecording(service,p.id,'x'.repeat(32),client);
    assert.equal(recovered.at(-1).file,'masters/delayed.mkv');
  }finally{await service.close();fs.rmSync(root,{recursive:true,force:true});}
});
