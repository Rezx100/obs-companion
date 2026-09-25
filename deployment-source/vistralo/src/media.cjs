'use strict';
const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
const {assert,within,disk,id,hash,atomic}=require('./core.cjs');
function run(exe,args,{signal,onProgress}={}) {return new Promise((resolve,reject)=>{
 const child=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});let stdout='',stderr='';
 const stop=()=>child.kill();signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
 child.stdout.on('data',b=>{stdout=(stdout+b).slice(-8e6);onProgress?.(String(b));});child.stderr.on('data',b=>stderr=(stderr+b).slice(-16000));
 child.once('error',reject);child.once('close',code=>{signal?.removeEventListener('abort',stop);if(signal?.aborted)return reject(new Error('Cancelled; original files preserved'));code===0?resolve(stdout):reject(new Error(`${path.basename(exe)} failed (${code}). ${stderr.slice(-1200)}`));});
});}
class Media {
 constructor({ffmpeg='ffmpeg',ffprobe='ffprobe'}={}) {this.ffmpeg=ffmpeg;this.ffprobe=ffprobe;}
 async check(){return {ffmpeg:(await run(this.ffmpeg,['-version'])).split('\n')[0],ffprobe:(await run(this.ffprobe,['-version'])).split('\n')[0]};}
 async probe(file){return JSON.parse(await run(this.ffprobe,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,wav,mp3','-show_streams','-show_format','-of','json',file]));}
 async output(root,name,args,options={}) {
  disk(root,32*1024**2);assert(/^[a-zA-Z0-9_-]+$/.test(name),'Invalid output name');const rel=`exports/${name}-${id().slice(0,8)}.mp4`;const out=within(root,rel);fs.mkdirSync(path.dirname(out),{recursive:true});const temp=out+'.partial.mp4';
  try {await run(this.ffmpeg,['-hide_banner','-nostdin','-n',...args,'-movflags','+faststart','-progress','pipe:1',temp],options);const p=await this.probe(temp);assert(p.streams.some(s=>s.codec_type==='video')&&Number(p.format.duration)>0,'Output contains no usable video');fs.renameSync(temp,out);return {file:rel,sha256:await hash(out),duration:Number(p.format.duration),streams:p.streams.map(({codec_type,codec_name,width,height})=>({codec_type,codec_name,width,height}))};}catch(e){try{fs.unlinkSync(temp)}catch{}throw e;}
 }
 async remux(root,file,options) {return this.output(root,'master',['-i',within(root,file,true),'-map','0','-c','copy'],options);}
 async split(root,file,options) {
  const source=within(root,file,true),p=await this.probe(source),v=p.streams.find(s=>s.codec_type==='video');assert(v?.width===3840&&v?.height===1080,'Expected verified 3840 × 1080 atlas; refusing to crop an unrelated recording');
  const screen=await this.output(root,'screen',['-i',source,'-map','0:v:0','-map','0:a:0?','-vf','crop=1920:1080:0:0','-c:v','libx264','-preset','veryfast','-crf','18','-c:a','aac'],options);
  const camera=await this.output(root,'camera',['-i',source,'-map','0:v:0','-map','0:a:0?','-vf','crop=1920:1080:1920:0','-c:v','libx264','-preset','veryfast','-crf','18','-c:a','aac'],options);
  atomic(within(root,'source-manifest.json'),{master:file,masterSha256:await hash(source),screen,camera,clock:'single OBS output; common pause/resume timeline',audio:'microphone track 1; optional desktop track 2 preserved in atlas',note:'Extracted H.264 derivatives; original atlas preserved'});return {screen,camera};
 }
 async render(root,plan,options) {
  validatePlan(plan);const input=within(root,plan.source,true),probe=await this.probe(input),duration=Number(probe.format.duration);assert(plan.clips.every(c=>c.end<=duration+.05),'Edit exceeds source duration');
  const hasAudio=probe.streams.some(s=>s.codec_type==='audio');let graph=[],labels=[];
  plan.clips.forEach((c,i)=>{graph.push(`[0:v]trim=start=${c.start}:end=${c.end},setpts=PTS-STARTPTS[v${i}]`);if(hasAudio)graph.push(`[0:a:0]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS[a${i}]`);labels.push(`[v${i}]${hasAudio?'[a'+i+']':''}`);});
  graph.push(`${labels.join('')}concat=n=${plan.clips.length}:v=1:a=${hasAudio?1:0}[v]${hasAudio?'[a]':''}`);
  const args=['-i',input,'-filter_complex',graph.join(';'),'-map','[v]'];if(hasAudio)args.push('-map','[a]');args.push('-c:v','libx264','-crf','18','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac');return this.output(root,'edited',args,options);
 }
 async voiceOnly(root,video,audio,options){const v=within(root,video,true),a=within(root,audio,true);const vp=await this.probe(v),ap=await this.probe(a);assert(Math.abs(Number(vp.format.duration)-Number(ap.format.duration))<.25,'Voice-only replacement requires audio within 250 ms of video duration');return this.output(root,'voice-replaced',['-i',v,'-i',a,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac'],options);}
}
function validatePlan(plan){assert(plan&&plan.version===1,'Edit plan version must be 1');assert(typeof plan.source==='string','Source required');assert(Array.isArray(plan.clips)&&plan.clips.length>0&&plan.clips.length<=200,'Provide 1–200 clips');let last=0;for(const c of plan.clips){assert(Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=last&&c.end>c.start,'Clips must be finite, chronological and non-overlapping');last=c.end;}return plan;}
module.exports={Media,run,validatePlan};
