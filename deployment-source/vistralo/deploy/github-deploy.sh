#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

target=/root/obs-companion-server
project=obs-companion
image=vistralo-server:0.2.0-preview
lock=/var/lock/obs-companion-github-deploy.lock
work=$(mktemp -d /root/obs-companion-github-deploy.XXXXXX)
archive="$work/source.tar.gz"
source_dir="$work/source"
previous="$work/previous"
rollback_image="obs-companion-server:github-rollback"

cleanup() {
  case "$work" in /root/obs-companion-github-deploy.*) rm -rf -- "$work" ;; esac
}
trap cleanup EXIT

exec 9>"$lock"
flock -n 9 || { echo 'Another Vistralo deployment is active' >&2; exit 1; }

cat > "$archive"
size=$(stat -c %s "$archive")
test "$size" -gt 0 && test "$size" -le 52428800 || { echo 'Deployment archive must be 1-50 MiB' >&2; exit 1; }

tar -tzf "$archive" > "$work/entries"
awk '/^(\/|.*(^|\/)\.\.($|\/))/ {bad=1} /(^|\/)node_modules(\/|$)/ {bad=1} /(^|\/)runtime\.env$/ {bad=1} END {exit bad}' "$work/entries" || {
  echo 'Unsafe or secret-bearing archive path rejected' >&2
  exit 1
}
if tar -tvzf "$archive" | awk 'substr($1,1,1) == "l" || substr($1,1,1) == "h" {exit 1}'; then :; else
  echo 'Archive links are not accepted' >&2
  exit 1
fi

mkdir -p "$source_dir"
tar -xzf "$archive" -C "$source_dir" --no-same-owner --no-same-permissions
find "$source_dir" -type d -exec chmod 0755 {} +
find "$source_dir" -type f -exec chmod 0644 {} +
test -f "$source_dir/package.json"
test -f "$source_dir/package-lock.json"
test -f "$source_dir/deploy/compose.yaml"
test -f "$source_dir/deploy/Dockerfile"
test -f "$source_dir/.deploy-revision"
test -f "$target/deploy/runtime.env"
install -m 0600 "$target/deploy/runtime.env" "$source_dir/deploy/runtime.env"

revision=$(tr -cd '0-9a-f' < "$source_dir/.deploy-revision" | head -c 40)
test "${#revision}" -eq 40 || { echo 'Invalid deployment revision' >&2; exit 1; }
docker compose -p "$project" -f "$source_dir/deploy/compose.yaml" config --quiet

before_volume=$(docker volume inspect obs-companion_studio-data --format '{{.Mountpoint}}')
if docker image inspect "$image" >/dev/null 2>&1; then docker image tag "$image" "$rollback_image"; fi
docker compose -p "$project" -f "$source_dir/deploy/compose.yaml" build studio

rollback() {
  echo 'Deployment failed; restoring previous source and image' >&2
  if test -d "$target"; then mv "$target" "$work/failed"; fi
  if test -d "$previous"; then mv "$previous" "$target"; fi
  if docker image inspect "$rollback_image" >/dev/null 2>&1; then docker image tag "$rollback_image" "$image"; fi
  docker compose -p "$project" -f "$target/deploy/compose.yaml" up -d --no-deps --force-recreate --wait --wait-timeout 240 studio || true
  docker image rm "$rollback_image" >/dev/null 2>&1 || true
  exit 1
}

mv "$target" "$previous"
mv "$source_dir" "$target"
chmod 0600 "$target/deploy/runtime.env"
docker compose -p "$project" -f "$target/deploy/compose.yaml" up -d --no-deps --force-recreate --wait --wait-timeout 240 studio || rollback
after_volume=$(docker volume inspect obs-companion_studio-data --format '{{.Mountpoint}}')
test "$before_volume" = "$after_volume" || rollback
docker compose -p "$project" -f "$target/deploy/compose.yaml" exec -T studio node /app/deploy/healthcheck.cjs || rollback

docker image rm "$rollback_image" >/dev/null 2>&1 || true
printf '%s revision=%s image=%s volume=%s\n' "$(date -u +%FT%TZ)" "$revision" "$(docker image inspect "$image" --format '{{.Id}}')" "$after_volume" >> /var/log/obs-companion-deployments.log
echo "Vistralo deployed revision $revision"
