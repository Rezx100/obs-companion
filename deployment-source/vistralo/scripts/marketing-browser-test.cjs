'use strict';
// Synthetic frames live only in an OS temp directory. They test controls, not product claims.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright'),{renderHome}=require('../marketing/render.cjs');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vistralo-marketing-qa-')),evidence=path.resolve('evidence/marketing');
 fs.cpSync('dist-marketing',root,{recursive:true});fs.mkdirSync(evidence,{recursive:true});
 const report={at:new Date().toISOString(),scope:'Preview and synthetic engine fixtures; not product/provider acceptance',cases:[]};
 const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.vtt':'text/vtt'};
 const server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  let file=path.resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;let browser;const deadline=setTimeout(()=>{console.error('Marketing browser test exceeded 120 seconds');process.exit(1)},120000);
 try{
  browser=await chromium.launch({headless:true,...(process.env.VISTRALO_TEST_CHROMIUM?{executablePath:process.env.VISTRALO_TEST_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  for(const [width,height]of [[390,844],[768,1024],[1280,720],[1440,900],[1920,1080]]){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(require('axe-core').source);const a11y=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
   const metrics=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,minFont:Math.min(...Array.from(document.querySelectorAll('p,a,summary,button')).filter(x=>x.getClientRects().length).map(x=>parseFloat(getComputedStyle(x).fontSize)))}));
   assert.deepEqual(a11y,[],JSON.stringify(a11y));assert.ok(metrics.documentWidth<=width,JSON.stringify(metrics));assert.equal(metrics.h1,1);assert.ok(metrics.minFont>=13);assert.deepEqual(errors,[]);
   await page.locator('.faq summary').nth(0).click();await page.locator('.faq summary').nth(1).click();assert.equal(await page.locator('.faq details[open]').count(),1);
   await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:path.join(evidence,`home-${width}.png`),fullPage:true});report.cases.push({name:`home-${width}`,a11y,metrics,errors});await page.close();
  }
  for(const settings of [{javaScriptEnabled:false},{reducedMotion:'reduce'},{forcedColors:'active'}]){
   const page=await browser.newPage({viewport:{width:390,height:844},...settings});await page.goto(origin);assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('.faq details').count(),6);assert.ok(await page.locator('.primary').first().getAttribute('href'));report.cases.push({name:JSON.stringify(settings),passed:true});await page.close();
  }
  const docs=await browser.newPage();for(const route of ['docs','privacy','terms','security','about','changelog','reference/fernhill']){const response=await docs.goto(origin+'/'+route+'/');assert.equal(response.status(),200);assert.equal(await docs.locator('h1').count(),1);}await docs.close();
  // Exercise a six-scene timeline with neutral 1px image fixtures, never publish them.
  const manifest=JSON.parse(fs.readFileSync('marketing/story.json'));const copy=JSON.parse(fs.readFileSync('marketing/messages.json'));const build=JSON.parse(fs.readFileSync('evidence/marketing/build.json'));
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=gray:s=320x200:r=10','-frames:v','1',path.join(root,'fixture.png')]);const png=fs.readFileSync(path.join(root,'fixture.png'));
  fs.mkdirSync(path.join(root,'story'),{recursive:true});fs.writeFileSync(path.join(root,'story/test.png'),png);execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=gray:s=320x200:r=10','-t','1','-c:v','libx264','-pix_fmt','yuv420p',path.join(root,'story/test.mp4')]);
  manifest.frames.desktop.template='/story/test.png';manifest.frames.desktop.fallback='/story/test.png';manifest.frames.mobile.template='/story/test.png';manifest.frames.mobile.fallback='/story/test.png';
  manifest.scenes.forEach(s=>Object.assign(s,{enabled:true,desktopPoster:'/story/test.png',mobilePoster:'/story/test.png',captions:[{text:'Synthetic test caption. This is not product evidence.',start:0},{text:'Second synthetic caption for threshold testing.',start:.5}],callouts:[{label:'Test measurement',start:.2,end:.8,x:20,y:20,width:200,height:100}]}));
  manifest.compare={original:'/story/test.png',rebuilt:'/story/test.png',uneditedAgentOutput:true};manifest.genericCaption='Synthetic generic test caption.';
  manifest.narration={mp4:'/story/test.mp4',webm:null,vtt:'/story/test.vtt',transcript:'/story/test.txt',approved:true};fs.writeFileSync(path.join(root,'story/test.vtt'),'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSynthetic test caption.\n');fs.writeFileSync(path.join(root,'story/test.txt'),'Synthetic test transcript.');
  fs.writeFileSync(path.join(root,'story.json'),JSON.stringify(manifest));fs.writeFileSync(path.join(root,'index.html'),renderHome({m:manifest,c:copy,assets:build.assets,release:false}));
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.locator('.story.is-enhanced').waitFor();
  await page.locator('#how-it-works').scrollIntoViewIfNeeded();await page.waitForTimeout(900);await page.locator('.listen').click();assert.ok(await page.locator('dialog').evaluate(el=>el.open));await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);assert.equal(await page.locator('.listen').evaluate(el=>el===document.activeElement),true);
  // Native range keyboard step and manual ownership, in the visible static fallback.
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.story:not(.is-enhanced)').waitFor();await page.locator('.static-compare input').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.static-compare input').inputValue(),'52');assert.equal(await page.locator('.static-compare [data-compare]').getAttribute('data-manual'),'true');assert.equal(await page.locator('.pin-spacer').count(),0);
  assert.equal(await page.locator('.static-scene').count(),6);await page.screenshot({path:path.join(evidence,'synthetic-reduced-motion.png'),fullPage:true});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.story.is-enhanced').waitFor();await page.locator('#how-it-works').scrollIntoViewIfNeeded();await page.waitForTimeout(800);await page.locator('.story-skip').click();await page.waitForTimeout(900);assert.equal(await page.locator('#pricing').evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(errors,[]);report.cases.push({name:'synthetic-engine-dialog-range-reduced-skip',passed:true,errors});await page.close();
  const phone=await browser.newPage({viewport:{width:390,height:844}});phone.setDefaultTimeout(12000);await phone.goto(origin);await phone.locator('.story.is-enhanced').waitFor();assert.equal(await phone.locator('#stage').count(),1);
  const pinTop=await phone.locator('.pin-spacer').evaluate(el=>el.getBoundingClientRect().top+scrollY);
  await phone.evaluate(y=>scrollTo(0,y),pinTop+844*3.5*.5);await phone.waitForTimeout(1000);assert.equal(await phone.locator('.story').getAttribute('data-scene'),'judgment');await phone.locator('[data-judgment="0"]').click();assert.equal(await phone.locator('.judgment-wipe').evaluate(el=>el.style.getPropertyValue('--wipe')),'0%');
  await phone.evaluate(y=>scrollTo(0,y),pinTop+844*6.8*.5);await phone.waitForTimeout(1000);assert.equal(await phone.locator('.story').getAttribute('data-scene'),'build');await phone.locator('.stage-compare input').focus();const before=Number(await phone.locator('.stage-compare input').inputValue());await phone.keyboard.press('ArrowRight');assert.equal(Number(await phone.locator('.stage-compare input').inputValue()),before+2);await phone.evaluate(()=>scrollBy(0,10));await phone.waitForTimeout(800);assert.equal(Number(await phone.locator('.stage-compare input').inputValue()),before+2);
  await phone.emulateMedia({reducedMotion:'reduce'});await phone.locator('.story:not(.is-enhanced)').waitFor();assert.equal(await phone.locator('h1').isVisible(),true);await phone.close();report.cases.push({name:'synthetic-mobile-toggle-comparison-ownership',passed:true});
  const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(origin);assert.equal(await nojs.locator('.static-scene').count(),6);assert.equal(await nojs.locator('video[controls]').count(),1);await nojs.close();report.cases.push({name:'synthetic-story-no-javascript',passed:true});
  const missing=await browser.newPage();await missing.route('**/story/test.png',r=>r.abort());await missing.goto(origin);await missing.waitForTimeout(700);assert.equal(await missing.locator('.story.is-enhanced').count(),0);assert.equal(await missing.locator('.static-scene').count(),6);await missing.close();report.cases.push({name:'missing-sequence-preserves-stacked-story',passed:true});
  report.passed=true;clearTimeout(deadline);console.log(JSON.stringify(report,null,2));
 }catch(e){report.passed=false;report.error=e.stack;clearTimeout(deadline);throw e;}finally{fs.writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
