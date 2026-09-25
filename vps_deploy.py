import argparse
import base64
import hashlib
import os
import shlex
import socket
import sys
import time

import paramiko


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(errors="replace")


EXPECTED_FINGERPRINT = "SHA256:mQNZyu7m6eoKdEfvOmmdubW5h3XB8vJneK802m0syYo"


def load_env(path):
    values = {}
    with open(path, "r", encoding="utf-8-sig") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def connect(env_path):
    values = load_env(env_path)
    host = values.get("SERVER_HOST") or values.get("IP")
    port = int(values.get("SERVER_PORT") or 22)
    password = values.get("SERVER_PASSWORD") or values.get("Password")
    if not host or not password:
        raise RuntimeError("The environment file must contain the VPS host and password.")

    sock = socket.create_connection((host, port), timeout=20)
    transport = paramiko.Transport(sock)
    transport.start_client(timeout=20)
    key = transport.get_remote_server_key()
    actual = "SHA256:" + base64.b64encode(
        hashlib.sha256(key.asbytes()).digest()
    ).decode("ascii").rstrip("=")
    if actual != EXPECTED_FINGERPRINT:
        transport.close()
        raise RuntimeError(f"SSH host key mismatch: expected {EXPECTED_FINGERPRINT}, got {actual}")
    transport.auth_password("root", password)
    return transport


def run(transport, command, *, stream=False, timeout=None):
    channel = transport.open_session(timeout=20)
    if timeout:
        channel.settimeout(timeout)
    channel.exec_command(command)
    stdout_parts = []
    stderr_parts = []
    while True:
        if channel.recv_ready():
            text = channel.recv(65536).decode("utf-8", "replace")
            stdout_parts.append(text)
            if stream:
                print(text, end="", flush=True)
        if channel.recv_stderr_ready():
            text = channel.recv_stderr(65536).decode("utf-8", "replace")
            stderr_parts.append(text)
            if stream:
                print(text, end="", file=sys.stderr, flush=True)
        if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
            break
        time.sleep(0.05)
    code = channel.recv_exit_status()
    return code, "".join(stdout_parts), "".join(stderr_parts)


def inventory(transport):
    remote_script = r'''
set -u
echo "== identity =="
id
printf "hostname: "; hostname -f 2>/dev/null || hostname
printf "os: "; . /etc/os-release && echo "$PRETTY_NAME"
printf "arch: "; uname -m
echo "== resources =="
nproc
free -h
df -hT / /var/lib/docker 2>/dev/null || df -hT /
echo "== docker =="
if command -v docker >/dev/null; then
  docker --version
  docker compose version 2>&1
  docker info --format "server={{.ServerVersion}} driver={{.Driver}} root={{.DockerRootDir}}" 2>&1
  echo "containers:"
  docker ps --format "{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"
else
  echo "docker: missing"
fi
echo "== listeners =="
ss -ltnp 2>/dev/null | sed -n "1,40p"
echo "== deployment path =="
if test -e /root/obs-companion-server; then
  echo "exists"
  ls -la /root/obs-companion-server | sed -n "1,30p"
else
  echo "absent"
fi
echo "== gpu =="
if command -v nvidia-smi >/dev/null; then nvidia-smi -L; else echo "nvidia-smi: absent"; fi
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command)
    print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)
    if code:
        raise RuntimeError(f"Inventory command failed with exit status {code}")


def deploy(transport, archive_path):
    preflight = (
        "bash -lc "
        + shlex.quote(
            "set -eu; test ! -e /root/obs-companion-server; "
            "command -v docker >/dev/null; docker compose version >/dev/null; "
            "test $(awk '/MemAvailable:/ {print $2}' /proc/meminfo) -ge 8388608; "
            "test $(df -Pk /root | awk 'NR==2 {print $4}') -ge 52428800"
        )
    )
    code, out, err = run(transport, preflight)
    if code:
        if out:
            print(out, end="")
        if err:
            print(err, end="", file=sys.stderr)
        raise RuntimeError("VPS deployment preflight failed; no files were uploaded.")

    remote_archive = f"/root/obs-companion-{int(time.time())}.tar.gz"
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        print("Uploading source archive...", flush=True)
        sftp.put(archive_path, remote_archive)
    finally:
        sftp.close()

    command = (
        "bash -lc "
        + shlex.quote(
            f"set -eu; mkdir /root/obs-companion-server; "
            f"tar -xzf {shlex.quote(remote_archive)} -C /root/obs-companion-server; "
            f"rm {shlex.quote(remote_archive)}; "
            "bash /root/obs-companion-server/deploy/install.sh"
        )
    )
    print("Building and starting the service...", flush=True)
    code, _, _ = run(transport, command, stream=True)
    if code:
        raise RuntimeError(f"Remote installation failed with exit status {code}")


def install_docker(transport):
    remote_script = r'''
set -euo pipefail
conflicts="$(dpkg-query -W -f='${Package}\n' docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc 2>/dev/null || true)"
if test -n "$conflicts"; then
  echo "Conflicting Docker packages are already installed:" >&2
  echo "$conflicts" >&2
  exit 42
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
arch="$(dpkg --print-architecture)"
codename="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
printf '%s\n' \
  'Types: deb' \
  'URIs: https://download.docker.com/linux/ubuntu' \
  "Suites: $codename" \
  'Components: stable' \
  "Architectures: $arch" \
  'Signed-By: /etc/apt/keyrings/docker.asc' \
  > /etc/apt/sources.list.d/docker.sources
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker --version
docker compose version
docker info --format 'server={{.ServerVersion}} driver={{.Driver}} root={{.DockerRootDir}}'
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, _, _ = run(transport, command, stream=True)
    if code:
        raise RuntimeError(f"Docker installation failed with exit status {code}")


def status(transport):
    remote_script = r'''
set -eu
cd /root/obs-companion-server
echo "== compose =="
docker compose -f deploy/compose.yaml ps
echo "== health =="
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8787/
echo "== authenticated status =="
docker compose -f deploy/compose.yaml exec -T studio node -e "const o='http://127.0.0.1:8787'; fetch(o+'/login',{method:'POST',headers:{Origin:o,'Content-Type':'application/json'},body:JSON.stringify({token:process.env.COMPANION_TOKEN})}).then(async r=>{if(!r.ok)throw Error('login '+r.status);const c=r.headers.get('set-cookie').split(';')[0];return fetch(o+'/rpc',{method:'POST',headers:{Origin:o,'Content-Type':'application/json',Cookie:c},body:JSON.stringify({method:'status'})})}).then(async r=>{if(!r.ok)throw Error('rpc '+r.status);return r.text()}).then(console.log).catch(e=>{console.error(e.message);process.exit(1)})"
echo "== resources =="
docker stats --no-stream --format "{{.Name}}|cpu={{.CPUPerc}}|mem={{.MemUsage}}|pids={{.PIDs}}" obs-companion-studio-1
echo "== image =="
docker image inspect obs-companion-server:0.2.0-preview --format "id={{.Id}} created={{.Created}} size={{.Size}}"
echo "== hardening and persistence =="
stat -c "runtime.env mode=%a owner=%U:%G" deploy/runtime.env
printf "runtime keys: "; cut -d= -f1 deploy/runtime.env | paste -sd, -
docker inspect obs-companion-studio-1 --format "restart={{.HostConfig.RestartPolicy.Name}} readonly={{.HostConfig.ReadonlyRootfs}} memory={{.HostConfig.Memory}} nano_cpus={{.HostConfig.NanoCpus}} pids={{.HostConfig.PidsLimit}} cap_drop={{json .HostConfig.CapDrop}} security={{json .HostConfig.SecurityOpt}} binds={{json .HostConfig.PortBindings}}"
docker volume inspect obs-companion_studio-data --format "volume={{.Name}} mountpoint={{.Mountpoint}}"
ss -ltnH 'sport = :8787'
echo "== recent logs =="
docker compose -f deploy/compose.yaml logs --tail 30 studio
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command)
    print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)
    if code:
        raise RuntimeError(f"Status verification failed with exit status {code}")


def acceptance(transport):
    remote_script = r'''
set -euo pipefail
cd /root/obs-companion-server
docker compose -f deploy/compose.yaml exec -T studio node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const {execFile, spawn} = require('node:child_process');
const {promisify} = require('node:util');
const readline = require('node:readline');
const execFileAsync = promisify(execFile);
const origin = 'http://127.0.0.1:8787';
const token = process.env.COMPANION_TOKEN;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, options = {}) {
  const response = await fetch(origin + path, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text}`);
  return {response, value: text ? JSON.parse(text).value : null};
}
(async () => {
  const login = await fetch(origin + '/login', {
    method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'},
    body: JSON.stringify({token})
  });
  if (!login.ok) throw new Error('Login failed: ' + login.status);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const rpc = (method, args = {}) => request('/rpc', {
    method: 'POST', headers: {Origin: origin, Cookie: cookie, 'Content-Type': 'application/json'},
    body: JSON.stringify({method, args})
  }).then(result => result.value);
  const check = await rpc('check');
  if (!check.media?.ffmpeg || !check.media?.ffprobe) throw new Error('FFmpeg/ffprobe unavailable');
  const project = await rpc('create', {name: 'VPS live acceptance ' + new Date().toISOString(), mode: 'walkthrough'});
  await rpc('walkthrough', {id: project.id, url: 'https://example.com/', obs: true, viewports: [{width: 1280, height: 720}]});
  const deadline = Date.now() + 180000;
  let current;
  do {
    await sleep(1000);
    current = await rpc('status');
    if (Date.now() > deadline) throw new Error('OBS capture exceeded 180 seconds');
  } while (current.active);
  const detail = (await rpc('project', {id: project.id})).project;
  if (detail.state === 'Failed') throw new Error('Capture failed: ' + detail.data.error);
  if (!detail.data.master || !detail.data.sourceSha256) throw new Error('OBS master/hash missing');
  const files = await rpc('files', {id: project.id});
  const master = files.find(item => item.file === detail.data.master);
  if (!master || master.size < 1000) throw new Error('OBS master is missing or empty');
  const media = await fetch(origin + '/media?' + new URLSearchParams({id: project.id, file: detail.data.master}), {headers: {Cookie: cookie}});
  if (!media.ok) throw new Error('Master download failed: ' + media.status);
  const body = Buffer.from(await media.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  if (sha256 !== detail.data.sourceSha256) throw new Error('Downloaded master checksum mismatch');
  const evidence = await rpc('evidence', {id: project.id});
  if (!evidence.sessions?.length || evidence.sessions.some(session => session.error)) throw new Error('Evidence manifest is incomplete');
  const masterPath = '/data/projects/' + project.id + '/' + detail.data.master;
  const {stdout: probeText} = await execFileAsync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',masterPath]);
  const probe = JSON.parse(probeText), video = probe.streams.find(stream => stream.codec_type === 'video');
  const audio = probe.streams.find(stream => stream.codec_type === 'audio');
  const duration = Number(probe.format.duration);
  if (!video || video.width !== 1920 || video.height !== 1080 || !Number.isFinite(duration) || duration <= 0.2) throw new Error('OBS master media metadata is invalid');
  const clipEnd = Math.max(0.1, Math.min(duration - 0.05, 2));
  await rpc('plan', {id: project.id, plan: {version: 1, source: detail.data.master, clips: [{start: 0, end: clipEnd}]}});
  await rpc('process', {id: project.id, action: 'render'});
  do { await sleep(500); current = await rpc('status'); } while (current.active);
  const rendered = (await rpc('project', {id: project.id})).project.data.output;
  if (!rendered?.file || !rendered.sha256 || !rendered.duration) throw new Error('FFmpeg render output is incomplete');
  const renderedMedia = await fetch(origin + '/media?' + new URLSearchParams({id: project.id, file: rendered.file}), {headers: {Cookie: cookie}});
  if (!renderedMedia.ok) throw new Error('Rendered download failed: ' + renderedMedia.status);
  const renderedBody = Buffer.from(await renderedMedia.arrayBuffer());
  if (crypto.createHash('sha256').update(renderedBody).digest('hex') !== rendered.sha256) throw new Error('Rendered download checksum mismatch');
  const mcp = spawn(process.execPath, ['src/server-mcp.cjs'], {stdio: ['pipe','pipe','pipe'], env: {...process.env, COMPANION_INTERNAL_ORIGIN: origin}});
  const lines = readline.createInterface({input: mcp.stdout, crlfDelay: Infinity});
  let nextId = 0; const waiting = new Map();
  lines.on('line', line => { const message = JSON.parse(line); const pending = waiting.get(message.id); if (pending) { waiting.delete(message.id); message.error ? pending.reject(Error(message.error.message)) : pending.resolve(message.result); } });
  const mcpRequest = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; waiting.set(id,{resolve,reject}); mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n'); });
  const initialized = await mcpRequest('initialize');
  const tools = await mcpRequest('tools/list');
  const listed = await mcpRequest('tools/call',{name:'list_projects',arguments:{}});
  const projects = JSON.parse(listed.content[0].text);
  if (!initialized.serverInfo || tools.tools.length !== 7 || !projects.some(item => item.id === project.id)) throw new Error('MCP bridge acceptance failed');
  mcp.kill('SIGTERM');
  console.log(JSON.stringify({
    passed: true, project: project.id, state: detail.state, master: detail.data.master,
    masterBytes: master.size, sha256, sessions: evidence.sessions.length,
    frames: evidence.sessions.reduce((count, session) => count + (session.frames?.length || 0), 0),
    media: check.media, platform: check.platform, node: check.node,
    masterProbe: {duration, video: {codec:video.codec_name,width:video.width,height:video.height,frameRate:video.avg_frame_rate}, audio: audio ? {codec:audio.codec_name,channels:audio.channels} : null},
    render: {file:rendered.file,sha256:rendered.sha256,duration:rendered.duration,bytes:renderedBody.length},
    mcp: {server:initialized.serverInfo,tools:tools.tools.map(tool=>tool.name)}
  }));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
NODE
echo "== post-acceptance health =="
docker compose -f deploy/compose.yaml ps
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8787/
docker compose -f deploy/compose.yaml logs --tail 40 studio
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command, stream=True, timeout=240)
    if code:
        raise RuntimeError(f"Live server acceptance failed with exit status {code}")


def recovery(transport):
    remote_script = r'''
set -euo pipefail
cd /root/obs-companion-server
project=$(docker compose -f deploy/compose.yaml exec -T studio node <<'NODE'
const origin='http://127.0.0.1:8787', token=process.env.COMPANION_TOKEN;
(async()=>{
  const login=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
  if(!login.ok) throw Error('login '+login.status);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const rpc=async(method,args={})=>{const r=await fetch(origin+'/rpc',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({method,args})});const t=await r.text();if(!r.ok)throw Error(method+' '+r.status+': '+t);return JSON.parse(t).value;};
  const p=await rpc('create',{name:'VPS restart recovery '+new Date().toISOString(),mode:'walkthrough'});
  await rpc('walkthrough',{id:p.id,url:'https://example.com/',obs:true,viewports:[{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]});
  process.stdout.write(p.id);
})().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
NODE
)
test -n "$project"

recording=false
for i in $(seq 1 40); do
  if docker compose -f deploy/compose.yaml exec -T studio node -e 'const O=require("obs-websocket-js").default,o=new O();o.connect("ws://127.0.0.1:4455",process.env.OBS_WEBSOCKET_PASSWORD,{rpcVersion:1,eventSubscriptions:0}).then(()=>o.call("GetRecordStatus")).then(x=>{process.exit(x.outputActive?0:1)}).finally(()=>o.disconnect()).catch(()=>process.exit(1))'; then
    recording=true
    break
  fi
  sleep 0.5
done
test "$recording" = true
sleep 3
docker restart -t 2 obs-companion-studio-1 >/dev/null
for i in $(seq 1 120); do
  state=$(docker inspect obs-companion-studio-1 --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')
  test "$state" = healthy && break
  test "$state" = unhealthy && exit 1
  sleep 1
done
test "$(docker inspect obs-companion-studio-1 --format '{{.State.Health.Status}}')" = healthy

docker compose -f deploy/compose.yaml exec -T -e RECOVERY_PROJECT="$project" studio node <<'NODE'
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const O=require('obs-websocket-js').default;
const execFileAsync=promisify(execFile), origin='http://127.0.0.1:8787', token=process.env.COMPANION_TOKEN, id=process.env.RECOVERY_PROJECT;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const login=await fetch(origin+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
  if(!login.ok)throw Error('login '+login.status);const cookie=login.headers.get('set-cookie').split(';')[0];
  const rpc=async(method,args={})=>{const r=await fetch(origin+'/rpc',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({method,args})});const t=await r.text();if(!r.ok)throw Error(method+' '+r.status+': '+t);return JSON.parse(t).value;};
  const interrupted=(await rpc('project',{id})).project;
  if(interrupted.state!=='Interrupted')throw Error('expected Interrupted state, got '+interrupted.state);
  const obs=new O();await obs.connect('ws://127.0.0.1:4455',process.env.OBS_WEBSOCKET_PASSWORD,{rpcVersion:1,eventSubscriptions:0});
  const before=await obs.call('GetRecordStatus');if(before.outputActive)throw Error('recording remained active after restart');await obs.disconnect();
  await rpc('recover',{id});let status,deadline=Date.now()+60000;
  do{await sleep(500);status=await rpc('status');if(Date.now()>deadline)throw Error('recovery timeout');}while(status.active);
  const recovered=(await rpc('project',{id})).project;
  if(recovered.state!=='Needs Review'||!recovered.data.master||!recovered.data.sourceSha256||!recovered.data.recovered?.length)throw Error('recovery result incomplete');
  const file='/data/projects/'+id+'/'+recovered.data.master;
  const {stdout}=await execFileAsync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]);const probe=JSON.parse(stdout),video=probe.streams.find(s=>s.codec_type==='video'),duration=Number(probe.format.duration);
  if(!video||!Number.isFinite(duration)||duration<=0)throw Error('recovered MKV is not playable');
  const verify=new O();await verify.connect('ws://127.0.0.1:4455',process.env.OBS_WEBSOCKET_PASSWORD,{rpcVersion:1,eventSubscriptions:0});const after=await verify.call('GetRecordStatus');await verify.disconnect();
  if(after.outputActive)throw Error('recording active after recovery');
  console.log(JSON.stringify({passed:true,project:id,interruptedState:interrupted.state,recoveredState:recovered.state,recordingActiveAfterRestart:before.outputActive,recordingActiveAfterRecovery:after.outputActive,master:recovered.data.master,sha256:recovered.data.sourceSha256,recoveredFiles:recovered.data.recovered.length,duration,video:{codec:video.codec_name,width:video.width,height:video.height,frameRate:video.avg_frame_rate}}));
})().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
NODE
docker compose -f deploy/compose.yaml ps
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command, stream=True, timeout=240)
    if code:
        raise RuntimeError(f"Restart recovery acceptance failed with exit status {code}")


def diagnose_obs(transport):
    remote_script = r'''
set -eu
cd /root/obs-companion-server
docker compose -f deploy/compose.yaml exec -T studio sh -lc '
  supervisorctl -c /app/deploy/supervisord.conf status || true
  echo "== processes =="
  ps -eo pid,ppid,comm
  echo "== port 4455 =="
  ss -ltnp 2>/dev/null | grep 4455 || true
  echo "== OBS logs =="
  for f in /tmp/obs-* /data/home/.config/obs-studio/logs/*; do
    if test -f "$f"; then echo "--- $f"; tail -n 120 "$f" | sed -E "s/(--websocket_password )[[:graph:]]+/\\1<redacted>/g"; fi
  done
  echo "== OBS websocket config =="
  node -e '"'"'const fs=require("fs"),p="/data/home/.config/obs-studio/plugin_config/obs-websocket/config.json";const o=JSON.parse(fs.readFileSync(p));console.log({path:p,keys:Object.keys(o),values:Object.fromEntries(Object.entries(o).map(([k,v])=>[k,/pass|secret|token/i.test(k)?`<redacted:${String(v).length}>`:v]))})'"'"'
  echo "== OBS websocket CLI strings =="
  find /usr -type f -name "obs-websocket.so" -exec strings {} \; 2>/dev/null | grep -E -- "--websocket|ServerEnabled|server_enabled" | sort -u
  echo "== X11 windows =="
  xwininfo -root -tree 2>/dev/null | sed -n "1,100p"
  xwininfo -name "WebSocket Server Settings" 2>/dev/null | grep -E "Map State|Absolute upper-left|Width:|Height:" || true
  echo "== OBS capture input kinds =="
  node -e '"'"'const O=require("obs-websocket-js").default,o=new O();o.connect("ws://127.0.0.1:4455",process.env.OBS_WEBSOCKET_PASSWORD,{rpcVersion:1,eventSubscriptions:0}).then(()=>o.call("GetInputKindList",{unversioned:true})).then(x=>console.log(x.inputKinds.filter(k=>/xshm|screen|display|monitor|window|pipewire|capture/i.test(k)))).finally(()=>o.disconnect()).catch(e=>{console.error(e.message);process.exit(1)})'"'"'
'
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command, stream=True, timeout=60)
    if code:
        raise RuntimeError(f"OBS diagnostics failed with exit status {code}")


def inspect_recordings(transport):
    remote_script = r'''
set -eu
volume=$(docker volume inspect obs-companion_studio-data --format '{{.Mountpoint}}')
find "$volume/projects" -type f -path '*/masters/*' -printf '%P|bytes=%s\n' | tail -n 20
for file in $(find "$volume/projects" -type f -path '*/masters/*' | tail -n 3); do
  docker compose -f /root/obs-companion-server/deploy/compose.yaml exec -T studio ffprobe -v error -show_entries format=format_name,duration -of compact=p=0:nk=1 "/data/projects/${file#*\/projects\/}" || true
done
docker compose -f /root/obs-companion-server/deploy/compose.yaml exec -T studio node - <<'NODE'
const O=require('obs-websocket-js').default,o=new O();
(async()=>{await o.connect('ws://127.0.0.1:4455',process.env.OBS_WEBSOCKET_PASSWORD,{rpcVersion:1,eventSubscriptions:0});for(const n of ['RecType','RecFormat2','RecFormat','RecEncoder','RecTracks'])console.log(n,await o.call('GetProfileParameter',{parameterCategory:'AdvOut',parameterName:n}));await o.disconnect()})().catch(e=>{console.error(e.message);process.exit(1)});
NODE
docker compose -f /root/obs-companion-server/deploy/compose.yaml exec -T studio sh -lc 'latest=$(ls -t /data/home/.config/obs-studio/logs/*.txt | head -1); grep -Ei "record|encoder|output|error|failed" "$latest" | tail -n 80'
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command, stream=True, timeout=60)
    if code:
        raise RuntimeError(f"Recording inspection failed with exit status {code}")


def update_obs(transport, source_path):
    if not source_path or not os.path.isfile(source_path):
        raise RuntimeError("--source must name the corrected supervisord.conf")
    remote_temp = f"/root/supervisord-{int(time.time())}.conf"
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        sftp.put(source_path, remote_temp)
    finally:
        sftp.close()
    remote_script = f'''
set -euo pipefail
cd /root/obs-companion-server
test -f deploy/supervisord.conf
cp -a deploy/supervisord.conf deploy/supervisord.conf.pre-websocket-fix
install -m 0644 {shlex.quote(remote_temp)} deploy/supervisord.conf
rm {shlex.quote(remote_temp)}
new_obs_password=$(openssl rand -hex 32)
sed -i "s/^OBS_WEBSOCKET_PASSWORD=.*/OBS_WEBSOCKET_PASSWORD=$new_obs_password/" deploy/runtime.env
chmod 0600 deploy/runtime.env
unset new_obs_password
docker compose -f deploy/compose.yaml build studio
docker compose -f deploy/compose.yaml up -d --no-deps studio
for i in $(seq 1 90); do
  status=$(docker inspect obs-companion-studio-1 --format '{{{{if .State.Health}}}}{{{{.State.Health.Status}}}}{{{{else}}}}none{{{{end}}}}')
  test "$status" = healthy && break
  test "$status" = unhealthy && exit 1
  sleep 2
done
test "$(docker inspect obs-companion-studio-1 --format '{{{{.State.Health.Status}}}}')" = healthy
docker compose -f deploy/compose.yaml exec -T studio node -e "const net=require('node:net');let n=0;function probe(){{const s=net.connect(4455,'127.0.0.1',()=>{{s.end();process.exit(0)}});s.on('error',()=>{{s.destroy();if(++n>=30)process.exit(1);setTimeout(probe,1000)}})}}probe()"
docker compose -f deploy/compose.yaml ps
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command, stream=True, timeout=1200)
    if code:
        raise RuntimeError(f"OBS WebSocket deployment update failed with exit status {code}")


def refresh(transport, archive_path):
    if not archive_path or not os.path.isfile(archive_path):
        raise RuntimeError("--archive must name the corrected source archive")
    remote_archive = f"/root/obs-companion-refresh-{int(time.time())}.tar.gz"
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        print("Uploading corrected source archive...", flush=True)
        sftp.put(archive_path, remote_archive)
    finally:
        sftp.close()
    remote_script = f'''
set -euo pipefail
cd /root/obs-companion-server
before_volume=$(docker volume inspect obs-companion_studio-data --format '{{{{.Mountpoint}}}}')
before_files=$(find "$before_volume/projects" -type f 2>/dev/null | wc -l)
tar -tzf {shlex.quote(remote_archive)} | awk '/^(\/|.*(^|\/)\.\.($|\/))/ {{exit 1}}'
tar -xzf {shlex.quote(remote_archive)} -C /root/obs-companion-server
rm {shlex.quote(remote_archive)}
chmod 0600 deploy/runtime.env
docker compose -f deploy/compose.yaml config --quiet
docker compose -f deploy/compose.yaml build studio
docker compose -f deploy/compose.yaml up -d --no-deps --wait --wait-timeout 240 studio
after_volume=$(docker volume inspect obs-companion_studio-data --format '{{{{.Mountpoint}}}}')
after_files=$(find "$after_volume/projects" -type f 2>/dev/null | wc -l)
test "$before_volume" = "$after_volume"
test "$after_files" -ge "$before_files"
echo "persistent-volume=$after_volume files-before=$before_files files-after=$after_files"
docker compose -f deploy/compose.yaml ps
docker image inspect obs-companion-server:0.2.0-preview --format 'image={{{{.Id}}}} created={{{{.Created}}}} size={{{{.Size}}}}'
'''
    command = "bash -lc " + shlex.quote(remote_script)
    code, out, err = run(transport, command, stream=True, timeout=1800)
    if code:
        raise RuntimeError(f"Corrected deployment refresh failed with exit status {code}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("inventory", "install-docker", "deploy", "status", "acceptance", "recovery", "diagnose-obs", "inspect-recordings", "update-obs", "refresh"))
    parser.add_argument("--env", required=True)
    parser.add_argument("--archive")
    parser.add_argument("--source")
    args = parser.parse_args()
    transport = connect(args.env)
    try:
        if args.action == "inventory":
            inventory(transport)
        elif args.action == "install-docker":
            install_docker(transport)
        elif args.action == "deploy":
            if not args.archive or not os.path.isfile(args.archive):
                raise RuntimeError("--archive must name an existing source archive")
            deploy(transport, args.archive)
        elif args.action == "status":
            status(transport)
        elif args.action == "acceptance":
            acceptance(transport)
        elif args.action == "recovery":
            recovery(transport)
        elif args.action == "diagnose-obs":
            diagnose_obs(transport)
        elif args.action == "inspect-recordings":
            inspect_recordings(transport)
        elif args.action == "update-obs":
            update_obs(transport, args.source)
        else:
            refresh(transport, args.archive)
    finally:
        transport.close()


if __name__ == "__main__":
    main()
