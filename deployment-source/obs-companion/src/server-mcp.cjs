'use strict';
// Run through SSH + docker compose exec -T. All work goes through the one server
// scheduler; this process never opens the database or starts a second renderer.
const readline=require('node:readline');
const {schemas,descriptions}=require('./mcp.cjs');
const {assert}=require('./core.cjs');
const origin=process.env.COMPANION_INTERNAL_ORIGIN||'http://127.0.0.1:8787';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'MCP bridge connects only to the same server');
let cookie,loginPromise;
async function login(){
  const response=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:process.env.COMPANION_TOKEN})});
  assert(response.ok,'Server authentication failed');cookie=response.headers.get('set-cookie').split(';')[0];
}
async function rpc(method,args={}){
  if(!cookie){loginPromise ||= login();await loginPromise;}
  const response=await fetch(origin+'/rpc',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({method,args})});
  if(response.status===401){cookie=null;loginPromise=null;throw Error('Server session expired; reconnect the MCP client');}
  const result=await response.json();assert(response.ok,result.error||'Server request failed');return result.value;
}
async function handle({method,params={}}){
  if(method==='initialize')return {protocolVersion:'2024-11-05',capabilities:{tools:{listChanged:false}},serverInfo:{name:'obs-companion-server',version:'0.2.0-preview'}};
  if(method==='ping')return {};
  if(method==='tools/list')return {tools:Object.entries(schemas).map(([name,inputSchema])=>({name,inputSchema,description:descriptions[name].replaceAll('local','server'),annotations:{readOnlyHint:['list_projects','read_project','read_evidence','get_output'].includes(name),destructiveHint:false,openWorldHint:false}}))};
  assert(method==='tools/call','Method not found');const {name,arguments:args={}}=params;
  assert(Object.hasOwn(schemas,name),'Unknown tool');
  for(const key of Object.keys(args))assert(Object.hasOwn(schemas[name].properties,key),'Unexpected tool argument');
  for(const key of schemas[name].required||[])assert(args[key]!==undefined,'Missing tool argument');
  const id=args.projectId;let result;
  if(name==='list_projects')result=(await rpc('status')).projects;
  if(name==='read_project')result=await rpc('project',{id});
  if(name==='read_evidence')result=await rpc('evidence',{id});
  if(name==='submit_edit_plan')result=await rpc('plan',{id,plan:args.plan});
  if(name==='render')result=await rpc('process',{id,action:'render'});
  if(name==='get_output')result=(await rpc('project',{id})).project.data.output||null;
  if(name==='cancel')result=await rpc('cancel',{id});
  return {content:[{type:'text',text:JSON.stringify(result)}]};
}
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{if(line.length>1024**2)return;let msg;try{msg=JSON.parse(line);}catch{return;}if(msg.id===undefined)return;
  handle(msg).then(result=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result})+'\n')).catch(error=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,error:{code:-32602,message:error.message}})+'\n'));
});
