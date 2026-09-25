'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
const {createServer}=require('../src/server.cjs');
const {atomic}=require('../src/core.cjs');
const {run}=require('../src/media.cjs');
(async()=>{
  const root=fs.mkdtempSync(path.resolve('work/server-mcp-')),origin='http://127.0.0.1:8790',token=crypto.randomBytes(32).toString('hex');
  const app=createServer({root,token,origins:[origin],env:{FREE_DISK_FLOOR_BYTES:'1'}});
  await new Promise(resolve=>app.server.listen(8790,'127.0.0.1',resolve));
  const client=new Client({name:'server SDK acceptance client',version:'1.0.0'});
  try{
    const p=app.service.store.create('MCP server render','record'),file=path.join(app.service.store.dir(p.id),'source.mp4');
    await run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-t','2','-c:v','libx264','-preset','ultrafast',file]);app.service.store.update(p.id,'Needs Review',{video:'source.mp4'});
    await client.connect(new StdioClientTransport({command:process.execPath,args:['src/server-mcp.cjs'],env:{...process.env,COMPANION_INTERNAL_ORIGIN:origin,COMPANION_TOKEN:token},stderr:'pipe'}));
    const tools=await client.listTools();assert.equal(tools.tools.length,7);
    const result=await client.callTool({name:'list_projects',arguments:{}});assert.ok(JSON.parse(result.content[0].text).some(x=>x.id===p.id));
    await client.callTool({name:'submit_edit_plan',arguments:{projectId:p.id,plan:{version:1,source:'source.mp4',clips:[{start:0,end:1}]}}});
    await client.callTool({name:'render',arguments:{projectId:p.id}});
    const deadline=Date.now()+10000;while(app.active&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
    const response=await client.callTool({name:'get_output',arguments:{projectId:p.id}}),output=JSON.parse(response.content[0].text);assert.ok(output.sha256);assert.ok(Math.abs(output.duration-1)<.1);
    atomic('evidence/server-mcp.json',{passed:true,at:new Date().toISOString(),client:'@modelcontextprotocol/sdk 1.26.0',transport:'real stdio child → authenticated HTTP → single server scheduler',tools:tools.tools.map(x=>x.name),output,boundary:'Local Linux test. SSH transport, supplied host and named GUI client not verified.'});
    console.log('Server MCP acceptance passed');
  }finally{await client.close();await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
