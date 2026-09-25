'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('../src/server.cjs');
const {atomic,hash}=require('../src/core.cjs');
const {run}=require('../src/media.cjs');
(async()=>{
  const token=crypto.randomBytes(32).toString('hex'),origin='http://127.0.0.1:8788';
  fs.mkdirSync(path.resolve('work'),{recursive:true});
  const root=fs.mkdtempSync(path.resolve('work/server-ui-'));
  const app=createServer({root,token,origins:[origin],env:{FREE_DISK_FLOOR_BYTES:'1'},uploadOptions:{freeFloor:0}});
  await new Promise(resolve=>app.server.listen(8788,'127.0.0.1',resolve));
  const exe=process.env.COMPANION_TEST_CHROMIUM||path.resolve('.cache/chromium/chromium');
  if(!process.env.COMPANION_TEST_CHROMIUM){fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,require('node:zlib').brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/chromium.br')));fs.chmodSync(exe,0o755);}
  const browser=await chromium.launch({executablePath:exe,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(origin);await page.locator('#token').fill(token);await page.getByRole('button',{name:'Open studio'}).click();await page.locator('#workspace').waitFor({state:'visible'});
    await page.locator('#create input').fill('Server studio acceptance');await page.locator('#create select').selectOption('record');await page.getByRole('button',{name:'Create project',exact:true}).click();await page.locator('#project-name').getByText('Server studio acceptance').waitFor();
    assert.equal(await page.locator('#recover').isHidden(),true);assert.equal(await page.locator('#voice-replace').isDisabled(),true);
    const fixture=path.join(root,'test-upload.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-t','2','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
    await page.locator('#upload input[type=file]').setInputFiles(fixture);await page.getByRole('button',{name:'Upload / resume',exact:true}).click();await page.locator('#upload-state').getByText('Verified and imported:',{exact:false}).waitFor({timeout:30000});
    let p=app.service.store.list()[0];assert.equal(p.data.imported.sha256,await hash(fixture));
    await page.locator('#plan').fill(JSON.stringify({version:1,source:p.data.video,clips:[{start:0,end:1}]}));await page.getByRole('button',{name:'Save plan',exact:true}).click();await page.getByRole('button',{name:'Render saved plan',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#files').textContent.includes('exports/edited-'),{},{timeout:30000});
    p=app.service.store.list()[0];assert.ok(p.data.output?.file);assert.equal(await hash(path.join(root,p.id,p.data.video)),await hash(fixture));
    await page.screenshot({path:'evidence/server-studio-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'evidence/server-studio-mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No mobile horizontal overflow');
    assert.deepEqual(errors,[]);
    // Verify the hash worker crosses its 1 MiB chunk boundary without loading the whole file.
    const expected=crypto.createHash('sha256').update(Buffer.alloc(2*1024*1024+7,0x61)).digest('hex');
    const actual=await page.evaluate(()=>new Promise((resolve,reject)=>{const worker=new Worker('/hash-worker.js');worker.onmessage=e=>{if(e.data.digest){worker.terminate();resolve(e.data.digest);}if(e.data.error)reject(Error(e.data.error));};worker.postMessage(new File([new Uint8Array(2*1024*1024+7).fill(0x61)],'hash.bin'));}));
    assert.equal(actual,expected);
    atomic('evidence/server-ui.json',{passed:true,at:new Date().toISOString(),checks:['real HTTP login','project creation','unavailable recovery and voice controls hidden or disabled','browser hash worker upload','source SHA-256 preservation','server FFmpeg render','desktop/mobile UI','no horizontal overflow','no browser exceptions','multi-chunk browser SHA-256 matches Node'],output:p.data.output,boundary:`Local ${process.platform} HTTP server and real Chromium/FFmpeg. Not the supplied Ubuntu server, Docker, OBS native capture or other devices.`});
    console.log('Server browser acceptance passed');
  }finally{await browser.close();await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
