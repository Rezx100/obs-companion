'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {assert, within, hash, disk} = require('./core.cjs');
const {captureWalkthrough} = require('./walkthrough.cjs');
const SCENE = 'Companion Server Desktop';
const DISPLAY_INPUT = 'Companion Server Display';

// This adapter owns only the OBS instance inside the isolated server container.
// It never connects to another application's OBS instance or the user's laptop.
async function recordWalkthrough(service, id, options, password, client, capture = captureWalkthrough) {
  const obs = client || new (require('obs-websocket-js').default)();
  const call = (name, data = {}) => obs.call(name, data);
  return service.task(id, 'OBS website capture', async signal => {
    let recording = false, disconnected = false, monitor, failure, recordIntent = false, stopAttempted = false;
    const root = service.store.dir(id), directory = path.join(root, 'masters');
    fs.mkdirSync(directory, {recursive:true});
    const abort = new AbortController();
    obs.on('ConnectionClosed', () => {disconnected = true; abort.abort();});
    async function finish() {
      if (!recording || stopAttempted) return;
      stopAttempted = true;
      const result = await call('StopRecord'); recording = false;
      const deadline = Date.now() + 15000;
      while (!fs.existsSync(result.outputPath) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      assert(fs.existsSync(result.outputPath), 'OBS did not finalize the recording file within 15 seconds');
      const file = fs.realpathSync(result.outputPath), base = fs.realpathSync(directory);
      assert(file.startsWith(base + path.sep) && path.extname(file) === '.mkv', 'OBS output escaped the recording directory');
      const relative = path.relative(root,file).split(path.sep).join('/');
      let playable = false, probeError;
      for (let attempt = 0; attempt < 75 && !playable; attempt++) {
        try { await service.media.probe(file); playable = true; }
        catch (error) { probeError = error; await new Promise(resolve => setTimeout(resolve, 200)); }
      }
      if (!playable) throw probeError || new Error('OBS master did not become playable within 15 seconds');
      let stable = 0, previous = null;
      for (let attempt = 0; attempt < 75 && stable < 5; attempt++) {
        const stat = fs.statSync(file), signature = `${stat.size}:${stat.mtimeMs}`;
        stable = signature === previous ? stable + 1 : 0; previous = signature;
        if (stable < 5) await new Promise(resolve => setTimeout(resolve, 200));
      }
      assert(stable >= 5, 'OBS master did not stop changing within 15 seconds');
      service.store.update(id,'Processing',{master:relative, sourceSha256:await hash(file), capture:{engine:'OBS Studio',source:'server virtual display',width:1920,height:1080,fps:30}});
    }
    try {
      assert(typeof password === 'string' && password.length >= 16, 'Server OBS password is missing');
      await obs.connect('ws://127.0.0.1:4455',password,{rpcVersion:1});
      assert(!(await call('GetRecordStatus')).outputActive && !(await call('GetStreamStatus')).outputActive, 'Server OBS is already recording or streaming; recover it before starting again');
      const kinds = (await call('GetInputKindList',{unversioned:true})).inputKinds;
      const x11Kind = kinds.includes('xshm_input_v2') ? 'xshm_input_v2' : kinds.includes('xshm_input') ? 'xshm_input' : null;
      assert(x11Kind, 'OBS X11 capture is unavailable');
      if (!(await call('GetSceneList')).scenes.some(s=>s.sceneName===SCENE)) await call('CreateScene',{sceneName:SCENE});
      if (!(await call('GetInputList')).inputs.some(i=>i.inputName===DISPLAY_INPUT)) await call('CreateInput',{sceneName:SCENE,inputName:DISPLAY_INPUT,inputKind:x11Kind,inputSettings:{screen:0,show_cursor:false},sceneItemEnabled:true});
      await call('SetCurrentProgramScene',{sceneName:SCENE});
      await call('SetVideoSettings',{baseWidth:1920,baseHeight:1080,outputWidth:1920,outputHeight:1080,fpsNumerator:30,fpsDenominator:1});
      for (const [parameterCategory,parameterName,parameterValue] of [['Output','Mode','Advanced'],['AdvOut','RecType','Standard'],['AdvOut','RecFormat2','mkv'],['AdvOut','RecFormat','mkv'],['AdvOut','RecEncoder','obs_x264'],['AdvOut','RecTracks','1'],['AdvOut','RecRescale','false']]) await call('SetProfileParameter',{parameterCategory,parameterName,parameterValue});
      const profile = await call('GetProfileList');
      await call('SetCurrentProfile',{profileName:profile.currentProfileName});
      await call('SetRecordDirectory',{recordDirectory:directory});
      recordIntent = true;
      await call('StartRecord'); recording = true;
      let confirmed = false;
      for (let attempt = 0; attempt < 50 && !confirmed; attempt++) {
        confirmed = (await call('GetRecordStatus')).outputActive;
        if (!confirmed) await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(confirmed,'OBS did not confirm recording within 5 seconds');
      service.store.event(id,'server-obs-start',{directory:'masters'});
      monitor = setInterval(()=>{try{disk(root,1024**3);}catch(error){failure=error;abort.abort();}},2000);
      const manifest = await capture({root,...options,headless:false,signal:AbortSignal.any([signal,abort.signal]),onProgress:value=>service.progress[id]=value,launchArgs:[...(options.launchArgs||[]),'--kiosk','--window-position=0,0']});
      await finish();
      if (failure) throw failure;
      service.store.update(id,'Processing',{manifest:manifest.path,video:manifest.sessions.find(s=>s.video)?.video,coverage:manifest.coverage.length});
      return manifest;
    } catch (error) {
      if (recordIntent) service.store.event(id,'server-obs-recovery-note',{message:'Inspect masters before retrying. If OBS start/stop was not confirmed, it may still be recording. Never delete partial MKVs.'});
      throw error;
    } finally {
      clearInterval(monitor);
      try {if (recording && !disconnected) await finish();} finally {await obs.disconnect().catch(()=>{});}
    }
  });
}
async function recoverRecording(service,id,password,client) {
  const obs=client||new(require('obs-websocket-js').default)();
  return service.task(id,'Recover server OBS',async()=>{
    try {
      await obs.connect('ws://127.0.0.1:4455',password,{rpcVersion:1});
      const directory=path.join(service.store.dir(id),'masters');
      assert(fs.existsSync(directory),'This project has no server OBS master directory');
      const current=await obs.call('GetRecordDirectory');
      if((await obs.call('GetRecordStatus')).outputActive){
        assert(fs.realpathSync(current.recordDirectory)===fs.realpathSync(directory),'OBS is recording another project; recovery refused');
        await obs.call('StopRecord');
      }
      const recovered=[];
      for(const name of fs.readdirSync(directory).filter(name=>name.endsWith('.mkv'))){
        const file=within(service.store.dir(id),'masters/'+name,true);
        try{await service.media.probe(file);recovered.push({file:'masters/'+name,sha256:await hash(file),modified:fs.statSync(file).mtimeMs});}catch{}
      }
      recovered.sort((a,b)=>a.modified-b.modified);assert(recovered.length,'No playable master found; all source files were retained');
      const last=recovered.at(-1);service.store.update(id,'Processing',{master:last.file,sourceSha256:last.sha256,recovered,warning:'Recovered recording. Review video and audio before rendering.'});
      return recovered;
    }finally{await obs.disconnect().catch(()=>{});}
  });
}
module.exports = {recordWalkthrough,recoverRecording};
