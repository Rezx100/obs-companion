'use strict';
const $ = id => document.getElementById(id);
let selected = null, signedIn = false, lastFiles = '', transferring = false;
const message = (text, error=false) => {$('message').textContent=text;$('message').className=error?'error':'';};
async function request(url, options={}) {
  const response=await fetch(url,options), data=await response.json();
  if(response.status===401){signedIn=false;$('login').hidden=false;$('workspace').hidden=true;$('logout').hidden=true;}
  if(!response.ok)throw new Error(data.error||'Request failed');
  return data;
}
const rpc = async(method,args={})=>(await request('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})})).value;
function action(element,fn,event='click') {$(element).addEventListener(event,async e=>{e.preventDefault();const button=e.currentTarget;if(button.tagName==='BUTTON')button.disabled=true;try{await fn(e);await refresh();}catch(error){message(error.message,true);}finally{button.disabled=false;}});}
const media = (file,download=false)=>'/media?'+new URLSearchParams({id:selected,file,...(download?{download:'1'}:{})});
async function select(id) {selected=id;lastFiles='';const {project}=await rpc('project',{id});$('plan').value=JSON.stringify(project.data.editPlan||{version:1,source:project.data.video||project.data.master||'',clips:[{start:0,end:5}]},null,2);await refresh();}
async function refresh(){
  const status=await rpc('status');signedIn=true;$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
  $('projects').replaceChildren();
  for(const project of status.projects){const button=document.createElement('button'),name=document.createElement('span'),state=document.createElement('small');name.textContent=project.name;state.textContent=project.state;button.append(name,state);button.className=selected===project.id?'selected':'';button.onclick=()=>select(project.id).catch(e=>message(e.message,true));$('projects').append(button);}
  $('obs-toggle').disabled=!status.obsAvailable;
  $('empty').hidden=!!selected;$('project').hidden=!selected;
  if(!selected)return;
  const info=await rpc('project',{id:selected}),p=info.project;
  $('project-name').textContent=p.name;$('project-state').textContent=p.state;$('website').hidden=p.mode!=='walkthrough';
  $('job-state').textContent=(status.active?'Server: '+status.active.label:'Server ready')+(p.data.error?' · '+p.data.error:'');
  $('cancel').hidden=status.active?.project!==selected||status.active?.cancellable===false;
  $('history').textContent=JSON.stringify({jobs:info.jobs,events:info.events.slice(-12)},null,2);
  const file=p.data.output?.file||p.data.video;
  if(file&&$('preview').getAttribute('src')!==media(file)){$('preview').src=media(file);$('preview').hidden=false;}
  if(!file){$('preview').hidden=true;$('preview').removeAttribute('src');}
  const files=await rpc('files',{id:selected}),signature=JSON.stringify(files);
  if(signature!==lastFiles){lastFiles=signature;$('files').replaceChildren();for(const f of files){const a=document.createElement('a');a.href=media(f.file,true);a.textContent=f.file+' · '+(f.size/1024/1024).toFixed(2)+' MB';$('files').append(a);}}
  $('render').disabled=!p.data.editPlan;
  $('remux').disabled=!(p.data.master||p.data.video);
  $('voice-replace').disabled=!(p.data.narration&&(p.data.output?.file||p.data.video));
  $('render-segments').disabled=!p.data.narratedPlan;
  $('recover').hidden=!status.obsAvailable||!['Interrupted','Failed'].includes(p.state)||!files.some(f=>/^masters\/.*\.mkv$/i.test(f.file));
  $('analysis').disabled=!status.credentials.openai;$('speech').disabled=!status.credentials.heygen;
}
action('login-form',async()=>{await request('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:$('token').value})});$('token').value='';message('Connected. Jobs run on the server.');},'submit');
action('logout',async()=>{await request('/logout',{method:'POST'});signedIn=false;selected=null;location.reload();});
action('create',async e=>{const f=new FormData(e.currentTarget),p=await rpc('create',{name:f.get('name'),mode:f.get('mode')});await select(p.id);},'submit');
action('check',async()=>{$('health').textContent=JSON.stringify(await rpc('check'),null,2);});
action('capture',async e=>{const f=new FormData(e.currentTarget);await rpc('walkthrough',{id:selected,url:f.get('url'),obs:f.has('obs'),pages:String(f.get('pages')).split('\n').filter(Boolean),viewports:[{width:1440,height:900},...(f.has('mobile')?[{width:390,height:844}]:[])]});message('Capture started on the server. You can close this browser; the job continues.');},'submit');
action('cancel',async()=>{await rpc('cancel',{id:selected});message('Cancellation requested. Originals are preserved.');});
action('recover',async()=>{await rpc('recover',{id:selected});message('Recovering this project’s server recording. All masters are retained.');});
action('save-plan',async()=>{await rpc('plan',{id:selected,plan:JSON.parse($('plan').value)});message('Edit plan saved.');});
for(const [element,type]of [['render','render'],['remux','remux'],['voice-replace','voice-only'],['render-segments','narrated']])action(element,async()=>{await rpc('process',{id:selected,action:type});message('Processing started on the server.');});
action('save-segments',async()=>{await rpc('narratedPlan',{id:selected,segments:JSON.parse($('segments').value)});message('Narration plan saved.');});
action('transcript',async()=>{const file=$('transcript').files[0];if(!file)return;if(file.size>2e6)throw Error('Transcript must be under 2 MB');const data=JSON.parse(await file.text()),p=await rpc('transcript',{id:selected,words:Array.isArray(data)?data:data.words});$('plan').value=JSON.stringify(p.data.editPlan,null,2);message('Review the proposed cuts before rendering.');},'change');
const budget=()=>({estimate:Number($('estimate').value),cap:Number($('cap').value),quote:$('quote').value,approved:true});
action('analysis',async()=>{if(!$('approve-frames').checked)throw Error('Review the frame selection and approve upload first');await rpc('analysis',{id:selected,...budget(),model:$('model').value,frames:$('frames').value.split('\n').filter(Boolean),uploadApproved:true});message('Paid analysis submitted. Do not repeat an unknown submission.');});
action('speech',async()=>{if(!$('approve-script').checked)throw Error('Review and approve the script first');await rpc('speech',{id:selected,...budget(),text:$('script').value,scriptApproved:true});message('Paid speech submitted. Do not repeat an unknown submission.');});
function fileHash(file){return new Promise((resolve,reject)=>{const worker=new Worker('/hash-worker.js');worker.onmessage=e=>{if(e.data.progress!==undefined){$('upload-state').textContent='Checking source: '+e.data.progress+'%';return;}worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.digest);};worker.onerror=()=>{worker.terminate();reject(Error('Could not calculate source checksum'));};worker.postMessage(file);});}
action('upload',async e=>{
  if(transferring)throw Error('An upload is already running');
  transferring=true;
  try{
    const f=new FormData(e.currentTarget),file=f.get('file'),kind=f.get('kind'),id=selected;
    if(!file.size)throw Error('Select a file first');
    const digest=await fileHash(file),key='obs-upload:'+id+':'+kind+':'+digest;
    let upload,stored=localStorage.getItem(key);
    if(stored){try{upload=await rpc('uploadStatus',{upload:stored});}catch{localStorage.removeItem(key);}}
    if(!upload){upload=await rpc('uploadCreate',{id,kind,filename:file.name,size:file.size,digest});localStorage.setItem(key,upload.id);}
    while(upload.offset<file.size){
      const bytes=await file.slice(upload.offset,upload.offset+8*1024**2).arrayBuffer();
      try{upload=(await request('/uploads/'+upload.id,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Upload-Offset':String(upload.offset)},body:bytes})).value;}
      catch(error){throw Error('Transfer paused. Select the same file to resume. '+error.message);}
      $('upload-progress').value=upload.offset/file.size*100;$('upload-state').textContent=Math.round(upload.offset/file.size*100)+'% uploaded';
    }
    const result=await rpc('uploadComplete',{upload:upload.id});localStorage.removeItem(key);
    $('upload-state').textContent='Verified and imported: '+result.file;message('Upload complete. Source checksum verified.');
    if(id===selected&&kind==='video')$('plan').value=JSON.stringify({version:1,source:result.file,clips:[{start:0,end:5}]},null,2);
  }finally{transferring=false;}
},'submit');
refresh().catch(e=>message(e.message));
setInterval(()=>{if(signedIn)refresh().catch(e=>message(e.message,true));},2500);
