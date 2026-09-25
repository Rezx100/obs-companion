'use strict';
// Run inside the existing isolated capture container, with a dedicated DATA_ROOT.
// Never run this in a public/serverless frontend runtime.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createClient}=require('@supabase/supabase-js');
const {Service}=require('../src/service.cjs');
const {within,hash,assert}=require('../src/core.cjs');
const {validatePlan}=require('../src/media.cjs');
const LIMIT=50*1024*1024;
const unwrap=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function start(){
 const {VISTRALO_SUPABASE_URL:url,VISTRALO_SUPABASE_SERVICE_KEY:key,VISTRALO_CLOUD_DATA_ROOT:root}=process.env;
 assert(url&&key&&root,'Configure the Supabase URL, service key and a dedicated cloud data directory');
 assert(path.isAbsolute(root),'Cloud data root must be absolute');
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const service=new Service(root),bucket=db.storage.from('vistralo-media');
 let stopped=false;
 process.on('SIGTERM',()=>{stopped=true;for(const id of service.running.keys())service.cancel(id);});
 process.on('SIGINT',()=>{stopped=true;for(const id of service.running.keys())service.cancel(id);});
 async function heartbeat(){unwrap(await db.from('vistralo_runtime').upsert({id:'capture-worker',heartbeat_at:new Date().toISOString(),capabilities:{render:true,website:true,probe:true}}));}
 const timer=setInterval(()=>heartbeat().catch(()=>{}),15000);
 const upload=async(job,rel,nativeRoot,files)=>{
   const input=within(nativeRoot,rel,true),stat=fs.statSync(input);assert(stat.size<=LIMIT,'Output exceeds this workspace’s 50 MB storage limit');
   const target=`${job.owner_id}/${job.project_id}/${job.id}/${rel}`;
   unwrap(await bucket.upload(target,fs.readFileSync(input),{upsert:false,contentType:/\.mp4$/i.test(rel)?'video/mp4':/\.png$/i.test(rel)?'image/png':/\.jpe?g$/i.test(rel)?'image/jpeg':'application/octet-stream'}));
   files[target]={size:stat.size};return target;
 };
 try {while(!stopped){
  await heartbeat();
  const jobs=unwrap(await db.rpc('vistralo_claim_job'));const job=jobs?.[0];
  if(!job){await new Promise(r=>setTimeout(r,2000));continue;}
  let native;
  try{
   const row=unwrap(await db.from('vistralo_projects').select('*').eq('id',job.project_id).eq('owner_id',job.owner_id).single());
   assert(!row.document.trashed,'Project is in Trash');const p=row.document;
   native=service.store.create(p.name,job.kind==='website'?'walkthrough':'record');
   const nativeRoot=service.store.dir(native.id),files={...p.data.files};let changes={};
   if(job.kind==='website'){
    const options={url:job.payload.url,pages:[],actions:[],viewports:Array.isArray(job.payload.viewports)?job.payload.viewports.slice(0,2):[{width:1440,height:900}],localApproved:false,chromiumSandbox:true,browserEnv:Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','HOME','DISPLAY','LANG','TMPDIR'].includes(k))),proxy:{server:'http://127.0.0.1:3128'},launchArgs:['--proxy-bypass-list=<-loopback>','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']};
    const manifest=await service.walkthrough(native.id,options);
    assert(manifest.sessions?.some(s=>!s.error),'Website capture could not read the page');
    const briefRel=path.posix.join(path.posix.dirname(manifest.path),'implementation-brief.md');
    const brief=fs.readFileSync(within(nativeRoot,briefRel,true),'utf8');let references=0;
    for(const session of manifest.sessions||[])for(const frame of (session.frames||[]).slice(0,12)){if(frame.file){await upload(job,frame.file,nativeRoot,files);references++;}}
    changes={references,sections:(brief.match(/^## /gm)||[]).length,eventLabel:'Analyzed',data:{...p.data,files,brief,evidence:{url:job.payload.url,coverage:manifest.coverage,limitations:manifest.limitations}}};
   }else{
    const source=job.kind==='render'?job.payload.plan?.source:p.video;
    assert(typeof source==='string'&&source.startsWith(`${job.owner_id}/${job.project_id}/`)&&files[source],'Invalid project source');
    const blob=unwrap(await bucket.download(source));assert(blob.size<=LIMIT,'Source exceeds workspace limit');
    const local=path.join(nativeRoot,'cloud-source'+path.extname(source));fs.writeFileSync(local,Buffer.from(await blob.arrayBuffer()));
    if(p.data.sourceSha256&&source===p.video)assert(await hash(local)===p.data.sourceSha256,'Source checksum mismatch');
    const imported=await service.importFile(native.id,local);const probe=await service.media.probe(within(nativeRoot,imported.file,true));const stream=probe.streams.find(s=>s.codec_type==='video');assert(stream,'Source contains no video');
    const info={duration:Number(probe.format.duration),width:stream.width,height:stream.height};
    if(job.kind==='render'){
      const plan={...job.payload.plan,source:imported.file};validatePlan(plan);assert(plan.clips.every(c=>c.end<=info.duration+.05),'Edit exceeds source duration');service.savePlan(native.id,plan);
      const output=await service.process(native.id,'render');const file=await upload(job,output.file,nativeRoot,files);
      changes={video:file,duration:output.duration,eventLabel:'Ready',data:{...p.data,files,sourceMaster:p.data.sourceMaster||p.video,sourceSha256:output.sha256,output:{...output,file},mediaInfo:{...info,duration:output.duration}}};
    }else changes={duration:info.duration,eventLabel:'Uploaded',data:{...p.data,files,mediaInfo:info}};
   }
   const latest=unwrap(await db.from('vistralo_projects').select('document,updated_at').eq('id',job.project_id).single());
   assert(!latest.document.trashed,'Project moved to Trash during processing');
   const at=new Date().toISOString();
   const saved=unwrap(await db.from('vistralo_projects').update({document:{...latest.document,...changes,status:job.kind==='probe'?'draft':'ready',eventAt:at,error:null},updated_at:at}).eq('id',job.project_id).eq('updated_at',latest.updated_at).select('id'));assert(saved.length===1,'Project changed during output save; retained local output requires review');
   unwrap(await db.from('vistralo_jobs').update({state:'ready',finished_at:at}).eq('id',job.id));
  }catch(error){
   const message=String(error.message).slice(0,500);
   unwrap(await db.from('vistralo_jobs').update({state:'failed',error:message,finished_at:new Date().toISOString()}).eq('id',job.id));
   const row=unwrap(await db.from('vistralo_projects').select('document,updated_at').eq('id',job.project_id).maybeSingle());
   if(row)unwrap(await db.from('vistralo_projects').update({document:{...row.document,status:'failed',error:message},updated_at:new Date().toISOString()}).eq('id',job.project_id).eq('updated_at',row.updated_at));
  }
 }}finally{clearInterval(timer);await service.close();}
}
if(require.main===module)start().catch(()=>{console.error('Cloud worker stopped. Check its private configuration and connection.');process.exitCode=1;});
module.exports={start};
