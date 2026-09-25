#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
command -v docker >/dev/null || { echo 'Docker is required. No host packages were changed.' >&2; exit 1; }
docker compose version >/dev/null
test -f seccomp_profile.json || { echo 'Missing pinned Chromium seccomp profile.' >&2; exit 1; }
# Read-only preflight: never stop, update or reuse another application's containers.
available_kb=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
test "$available_kb" -ge 8388608 || { echo 'At least 8 GiB currently available RAM is required.' >&2; exit 1; }
free_kb=$(df -Pk . | awk 'NR==2 {print $4}')
test "$free_kb" -ge 52428800 || { echo 'At least 50 GiB free build space is required.' >&2; exit 1; }
docker info >/dev/null
if command -v ss >/dev/null && ss -ltnH 'sport = :8787' | head -1 | read -r line; then
  if ! docker compose ps --status running --services | grep -qx 'studio'; then
    echo 'Port 8787 is in use. No existing service was changed.' >&2; exit 1
  fi
fi
umask 077
if ! test -f runtime.env; then
  command -v openssl >/dev/null
  {
    printf 'VISTRALO_TOKEN=%s\n' "$(openssl rand -hex 32)"
    printf 'OBS_WEBSOCKET_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'VISTRALO_ORIGINS=http://127.0.0.1:8787,http://localhost:8787\n'
    printf 'FREE_DISK_FLOOR_BYTES=5368709120\nOPENAI_API_KEY=\nHEYGEN_API_KEY=\n'
  } > runtime.env
fi
chmod 600 runtime.env
docker volume inspect obs-companion_studio-data >/dev/null 2>&1 && { echo 'Legacy project volume exists. Use the documented upgrade procedure instead.' >&2; exit 1; }
compose=(docker compose -f compose.yaml -f compose.fresh.yaml)
"${compose[@]}" config --quiet
"${compose[@]}" build
"${compose[@]}" up -d --wait --wait-timeout 180
"${compose[@]}" images --format json > image-receipt.json
echo 'Studio installed on server loopback port 8787. Keep the SSH tunnel open to use it.'
echo 'The studio access token is in deploy/runtime.env. Do not post it in chat.'
echo 'Live OBS capture and load acceptance are separate checks; a healthy HTTP service is not a recording pass.'
