import { createClient } from '@supabase/supabase-js';
import type { WorkspaceAdapter, Project, ProjectDetail, CreateProjectInput, ProjectPatch, UploadOptions, WorkspaceSettings, ShareLink } from './contracts';
import { uuid } from './id';

declare const VISTRALO_SUPABASE_URL: string;
declare const VISTRALO_SUPABASE_KEY: string;
export const cloudConfigured = typeof VISTRALO_SUPABASE_URL !== 'undefined' && !!VISTRALO_SUPABASE_URL;
export const cloud = cloudConfigured ? createClient(VISTRALO_SUPABASE_URL,VISTRALO_SUPABASE_KEY,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
const required = () => {if(!cloud) throw Error('Cloud connection is not configured.'); return cloud;};
const unwrap = <T,>(result:{data?:T|null,error:any}):NonNullable<T> => {if(result.error) throw Error(result.error.message);return result.data as NonNullable<T>;};
const now = () => new Date().toISOString();
export async function cloudAccount() {
  const client=required(); const {data,error}=await client.auth.getUser();
  if(error||!data.user) throw Error('Sign in to Vistralo.');
  const account=unwrap<{role:string,user_id:string,display_name:string,workspace_name:string}>(await client.from('vistralo_accounts').select('*').eq('user_id',data.user.id).single());
  if(!account) throw Error('Your account has not been granted workspace access.');
  return {...account,email:data.user.email||''};
}
export class CloudAdapter implements WorkspaceAdapter {
  readonly mode='cloud' as const;
  capabilities={manage:true,share:true,workspaceAccess:false,upload:true,capture:true,obs:false,providers:false,localOnly:false};
  private urls=new Map<string,string>();
  async login(value:string){const {email,password}=JSON.parse(value);const result=await required().auth.signInWithPassword({email,password});if(result.error)throw result.error;await cloudAccount();}
  async logout(){unwrap(await required().auth.signOut());this.urls.clear();}
  async settings(patch?:WorkspaceSettings){const account=await cloudAccount();if(patch)unwrap(await required().from('vistralo_accounts').update({display_name:String(patch.displayName||account.display_name),workspace_name:String(patch.name||account.workspace_name)}).eq('user_id',account.user_id));return {displayName:account.display_name,email:account.email,name:account.workspace_name,role:account.role};}
  private async row(id:string){await cloudAccount();const row=unwrap<{id:string,owner_id:string,document:Project,updated_at:string}>(await required().from('vistralo_projects').select('*').eq('id',id).single());return row;}
  private async sign(p:Project){
    const files=Object.keys(p.data.files||{});
    for(const file of files){const key=p.id+':'+file;if(!this.urls.has(key)){const data=unwrap(await required().storage.from('vistralo-media').createSignedUrl(file,600));this.urls.set(key,data.signedUrl);}}
    return {...p,thumbnail:p.thumbnail?this.media(p.id,p.thumbnail):undefined};
  }
  async list(){await cloudAccount();const rows=unwrap(await required().from('vistralo_projects').select('*').order('updated_at',{ascending:false}));this.urls.clear();return Promise.all(rows.map(r=>this.sign({...r.document,id:r.id,created:r.created_at,updated:r.updated_at})));}
  async create(input:CreateProjectInput){const account=await cloudAccount();const id=uuid();const p:Project={id,name:input.name,type:input.type||(input.source==='web'?'brief':'walkthrough'),source:input.source,url:input.url,status:'draft',access:'private',created:now(),updated:now(),eventAt:now(),eventLabel:'Updated',data:{files:{}}};unwrap(await required().from('vistralo_projects').insert({id,owner_id:account.user_id,document:p}));return p;}
  private async save(id:string,mutate:(p:Project)=>Project){const row=await this.row(id);const p=mutate(row.document);p.updated=now();const saved=unwrap(await required().from('vistralo_projects').update({document:p,updated_at:p.updated}).eq('id',id).eq('updated_at',row.updated_at).select('id'));if(!saved.length)throw Error('This project changed in another session. Refresh and try again.');return this.sign(p);}
  async update(id:string,patch:ProjectPatch){if(patch.access&&patch.access!=='private')throw Error('Use a read-only share link to grant access.');return this.save(id,p=>({...p,...patch,eventLabel:patch.lastOpened?'Updated':'Edited',eventAt:patch.lastOpened?p.eventAt:now()}));}
  async duplicate(id:string){const original=await this.row(id);if(Object.keys(original.document.data.files||{}).length)throw Error('Duplicate a media project by uploading its source into a new project. Originals stay private.');const next=await this.create({...original.document,name:original.document.name+' (copy)'});return this.save(next.id,p=>({...p,data:structuredClone(original.document.data)}));}
  async trash(ids:string[]){for(const id of ids){await this.save(id,p=>({...p,trashed:true,trashedAt:now()}));unwrap(await required().from('vistralo_shares').update({revoked:true}).eq('project_id',id));}}
  async restore(ids:string[]){for(const id of ids)await this.save(id,p=>({...p,trashed:false,trashedAt:undefined}));}
  async remove(ids:string[]){for(const id of ids){const row=await this.row(id);if(!row.document.trashed)throw Error('Move the project to Trash first.');const files=Object.keys(row.document.data.files||{});if(files.length)unwrap(await required().storage.from('vistralo-media').remove(files));unwrap(await required().from('vistralo_projects').delete().eq('id',id));}}
  async project(id:string):Promise<ProjectDetail>{const row=await this.row(id);const p=await this.sign(row.document);const jobs=unwrap(await required().from('vistralo_jobs').select('*').eq('project_id',id).order('created_at',{ascending:false}));return {project:p,files:Object.entries(p.data.files||{}).map(([file,value]:[string,any])=>({file,...value})),evidence:p.data.evidence||null,jobs,events:[],shares:await this.shares(id),brief:p.data.brief};}
  media(id:string,file:string,_download=false){return this.urls.get(id+':'+file)||'';}
  async readText(id:string,file:string){await this.row(id);const data=unwrap(await required().storage.from('vistralo-media').download(file));return data.text();}
  async upload(id:string,file:File,options:UploadOptions={}){
    if(!file.size||file.size>50*1024*1024)throw Error('This cloud workspace accepts recordings up to 50 MB.');
    if(options.signal?.aborted)throw new DOMException('Upload cancelled','AbortError');
    const account=await cloudAccount();const row=await this.row(id);if(row.document.trashed)throw Error('Restore this project before uploading.');
    const ext=file.name.split('.').pop()?.toLowerCase();if(!['mp4','webm','mov','mkv','wav','mp3','m4a','srt','vtt'].includes(ext||''))throw Error('Unsupported media format.');
    options.onProgress?.({phase:'hashing',percent:0});const bytes=await file.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const target=`${account.user_id}/${id}/${uuid()}.${ext}`;
    await this.save(id,p=>({...p,status:'uploading',progress:0}));options.onProgress?.({phase:'uploading',percent:0});
    try {
      unwrap(await required().storage.from('vistralo-media').upload(target,file,{contentType:file.type||'application/octet-stream',upsert:false}));
      options.onProgress?.({phase:'verifying',percent:100});
      const uploaded=unwrap(await required().storage.from('vistralo-media').download(target));
      const serverDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await uploaded.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==serverDigest)throw Error('Source checksum verification failed.');
      await this.save(id,p=>({...p,status:'draft',progress:undefined,video:target,duration:undefined,eventLabel:'Uploaded',eventAt:now(),data:{...p.data,video:target,output:null,editPlan:null,sourceSha256:digest,files:{...p.data.files,[target]:{size:file.size,mime:file.type}}}}));
      if(await this.workerReady()){unwrap(await required().from('vistralo_jobs').insert({project_id:id,owner_id:account.user_id,kind:'probe',payload:{}}));await this.save(id,p=>({...p,status:'queued'}));}
      return {file:target,sha256:digest};
    } catch(e){await this.save(id,p=>({...p,status:'failed',error:(e as Error).message}));throw e;}
  }
  async shares(id:string):Promise<ShareLink[]>{const rows=unwrap(await required().from('vistralo_shares').select('id,expires_at,created_at,revoked').eq('project_id',id));return rows.map(r=>({id:r.id,expiresAt:r.expires_at,created:r.created_at,revoked:r.revoked}));}
  async share(id:string,days:1|7|30=7){const row=await this.row(id);if(row.document.trashed)throw Error('Restore the project first.');if(!row.document.data.output?.file&&!row.document.data.brief)throw Error('Finish the output or save a brief before sharing.');const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');const data=unwrap<{id:string,expires_at:string}>(await required().from('vistralo_shares').insert({project_id:id,owner_id:row.owner_id,token_hash:hash,expires_at:new Date(Date.now()+days*86400000).toISOString()}).select().single());return {id:data.id,url:`${VISTRALO_SUPABASE_URL}/functions/v1/vistralo-share?t=${token}`,expiresAt:data.expires_at};}
  async revoke(id:string){unwrap(await required().from('vistralo_shares').update({revoked:true}).eq('id',id));}
  async rpc<T=any>(method:string,args:Record<string,any>={}):Promise<T>{
    if(method==='check'){await cloudAccount();return {database:'connected',worker:await this.workerReady()} as T;}
    if(method==='briefSave'){const text=String(args.text||'');if(text.length>1024*1024)throw Error('Brief exceeds 1 MB.');return await this.save(args.id,p=>({...p,eventLabel:'Edited',eventAt:now(),data:{...p.data,brief:text}})) as T;}
    if(method==='plan'){return await this.save(args.id,p=>({...p,eventLabel:'Edited',eventAt:now(),data:{...p.data,editPlan:args.plan,output:null}})) as T;}
    if(method==='mediaInfo'){const row=await this.row(args.id);const info=row.document.data.mediaInfo;if(info&&row.document.video===args.file)return info;throw Error('Media inspection requires the connected capture worker.');}
    if(method==='thumbnail'){return null as T;}
    if(method==='walkthrough'||method==='process'){
      if(!await this.workerReady())throw Error('The capture and render worker is offline. Your project is saved; try again when it reconnects.');
      const row=await this.row(args.id);const kind=method==='walkthrough'?'website':'render';
      if(kind==='render'&&args.action!=='render')throw Error('Only approved trim rendering is supported in this cloud workspace.');
      const job=unwrap(await required().from('vistralo_jobs').insert({project_id:args.id,owner_id:row.owner_id,kind,payload:kind==='website'?{url:args.url,viewports:args.viewports}:{plan:row.document.data.editPlan}}).select().single());
      await this.save(args.id,p=>({...p,status:'queued',error:undefined}));return job as T;
    }
    throw Error('This action is not available in the cloud workspace yet.');
  }
  private async workerReady(){const rows=unwrap(await required().from('vistralo_runtime').select('heartbeat_at').eq('id','capture-worker'));return !!rows[0]&&Date.now()-Date.parse(rows[0].heartbeat_at)<60000;}
}
