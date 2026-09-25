'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {selectRoots}=require('../src/identity-paths.cjs');
const {config}=require('../src/runtime-config.cjs');
test('fresh install and existing library/vault keep deterministic roots',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'vistralo-roots-')),appData=path.join(base,'app'),documents=path.join(base,'docs');
 try{
  assert.equal(selectRoots({appData,documents}).projects,path.join(documents,'Vistralo'));
  fs.mkdirSync(path.join(documents,'OBS Companion'),{recursive:true});fs.writeFileSync(path.join(documents,'OBS Companion','projects.sqlite'),'old');
  fs.mkdirSync(path.join(appData,'OBS Companion'),{recursive:true});fs.writeFileSync(path.join(appData,'OBS Companion','credentials.bin'),'encrypted');
  assert.deepEqual(selectRoots({appData,documents}),{userData:path.join(appData,'OBS Companion'),projects:path.join(documents,'OBS Companion')});
  fs.mkdirSync(path.join(documents,'Vistralo'),{recursive:true});fs.writeFileSync(path.join(documents,'Vistralo','projects.sqlite'),'new');
  assert.throws(()=>selectRoots({appData,documents}),/Both legacy and Vistralo project/);
  assert.equal(fs.readFileSync(path.join(documents,'OBS Companion','projects.sqlite'),'utf8'),'old');
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('canonical environment wins; invalid canonical never falls back',()=>{
 const legacy={COMPANION_TOKEN:'l'.repeat(32),COMPANION_ORIGINS:'http://localhost:8787'};
 assert.equal(config(legacy).token,legacy.COMPANION_TOKEN);
 assert.deepEqual(config({...legacy,VISTRALO_TOKEN:'v'.repeat(32)}).origins,['http://localhost:8787']);
 assert.throws(()=>config({...legacy,VISTRALO_TOKEN:''}),/VISTRALO_TOKEN/);
 assert.throws(()=>config({...legacy,VISTRALO_ORIGINS:'bad'}),/VISTRALO_ORIGINS/);
});
