'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
process.umask(0o077);
for(const key of ['COMPANION_TOKEN','OBS_WEBSOCKET_PASSWORD'])if(!process.env[key]||process.env[key].length<32)throw Error(key+' must contain a random token of at least 32 characters');
fs.mkdirSync(process.env.XDG_RUNTIME_DIR,{recursive:true,mode:0o700});
const obsConfig=path.join(process.env.HOME,'.config/obs-studio');
fs.mkdirSync(obsConfig,{recursive:true,mode:0o700});
// OBS 32 blocks unattended startup behind a Safe Mode dialog when a previous
// container was interrupted. Preserve logs and recordings, but clear only its
// per-run crash sentinels so the supervised instance can recover normally.
const sentinel=path.join(obsConfig,'.sentinel');
if(fs.existsSync(sentinel))for(const entry of fs.readdirSync(sentinel,{withFileTypes:true})){
  if(entry.isFile()&&/^run_[0-9a-f-]+$/i.test(entry.name))fs.unlinkSync(path.join(sentinel,entry.name));
}
const globalIni=path.join(obsConfig,'global.ini');
const existing=fs.existsSync(globalIni)?fs.readFileSync(globalIni,'utf8'):'';
const section='[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nAuthRequired=true\nServerPassword='+process.env.OBS_WEBSOCKET_PASSWORD+'\nAlertsEnabled=false\n';
const next=/^\[OBSWebSocket\]\r?\n[\s\S]*?(?=^\[|\s*$)/m.test(existing)
  ? existing.replace(/^\[OBSWebSocket\]\r?\n[\s\S]*?(?=^\[|\s*$)/m,section+'\n')
  : existing.replace(/\s*$/,'\n\n')+section;
fs.writeFileSync(globalIni+'.tmp',next,{mode:0o600});
fs.renameSync(globalIni+'.tmp',globalIni);
const legacy=path.join(obsConfig,'plugin_config/obs-websocket/config.json');
if(fs.existsSync(legacy))fs.unlinkSync(legacy);
const child=spawn('supervisord',['-n','-c','/app/deploy/supervisord.conf'],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code||0));
