#!/usr/bin/env bash
set -euo pipefail
# Read-only inventory; run on the VPS before draining and backup.
project=obs-companion
volume=obs-companion_studio-data
target=/root/obs-companion-server
command -v docker >/dev/null
command -v flock >/dev/null
exec 9>/var/lock/obs-companion-github-deploy.lock
flock -n 9 || { echo 'A deployment is already active' >&2; exit 1; }
test -f "$target/deploy/runtime.env" || { echo 'Existing private runtime.env missing' >&2; exit 1; }
mount=$(docker volume inspect "$volume" --format '{{.Mountpoint}}') || { echo 'Existing project volume missing; cutover refused' >&2; exit 1; }
container=$(docker compose -p "$project" -f "$target/deploy/compose.yaml" ps -q studio)
test -n "$container" || { echo 'Existing studio container missing' >&2; exit 1; }
printf 'project=%s\nvolume=%s\nmount=%s\ncontainer=%s\n' "$project" "$volume" "$mount" "$container"
docker inspect "$container" --format 'image={{.Image}} state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{end}}'
docker compose -p "$project" -f "$target/deploy/compose.yaml" exec -T studio node - <<'NODE'
const token=process.env.VISTRALO_TOKEN ?? process.env.COMPANION_TOKEN;
if(!token||token.length<32)throw Error('Studio token is missing');
const origin='http://127.0.0.1:8787';
(async()=>{
 const login=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
 if(!login.ok)throw Error('Authentication preflight failed');
 const response=await fetch(origin+'/rpc',{method:'POST',headers:{Origin:origin,Cookie:login.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'},body:JSON.stringify({method:'status'})});
 if(!response.ok)throw Error('Status preflight failed');
 const {value}=await response.json();
 const busy=value.active||value.projects.some(p=>['Recording','Paused','Stopping','Processing','Uploading'].includes(p.state));
 console.log(`projects=${value.projects.length} active=${Boolean(busy)}`);
 if(busy)process.exitCode=2;
})().catch(e=>{console.error(e.message);process.exitCode=1});
NODE
