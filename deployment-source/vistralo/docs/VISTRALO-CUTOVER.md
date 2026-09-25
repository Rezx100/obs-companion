# Vistralo source transition and production cutover

The PR changes first-party source identity. It does **not** rename the GitHub repository or touch the running VPS. Production deployment is gated by the repository variable `VISTRALO_CUTOVER_READY=true`. Keep it unset until the steps below are verified. The prior deployment's Compose project `obs-companion`, lock `/var/lock/obs-companion-github-deploy.lock`, target `/root/obs-companion-server`, uninstall registration, and persistent volume `obs-companion_studio-data` are deliberate compatibility identities during this release.

## Before changing the VPS

1. Inventory the running app service, Compose project, image ID, `/data/projects` count, volume ID, volume mount, and `/data/home` settings. Record the current Git revision and the existing installed forced-command script hash. Do not print `runtime.env`, keys, or project contents into CI evidence.
2. Verify no capture, render or upload is active using the authenticated status and project/upload records. If any operation is active, leave the old service running and drain it first. Do not start a second scheduler.
3. Make a consistent backup after the studio is stopped. Copy the entire volume, including SQLite database, WAL/SHM, project media and OBS home, plus a separately permission-protected copy of `deploy/runtime.env`. Record hashes and restore a sample to an isolated volume. The old volume remains untouched. A volume snapshot without a restore test is insufficient evidence.
4. Check available disk, the exact target path and image tags for collisions. The checked-in `deploy/compose.yaml` names the **existing** volume explicitly and requires it to exist (`external: true`); a missing volume fails closed. Fresh installations use `deploy/compose.fresh.yaml` and a separate `vistralo_studio-data` volume.
5. Install/review the new `deploy/github-deploy.sh` as the root-owned forced command under the existing restricted SSH key entry. Keep the same key restriction and shared lock. The repository workflow's deploy key cannot replace its own forced command. Test the handler and rollback in an isolated fixture first.
6. Only then set `VISTRALO_CUTOVER_READY=true` and run the validated workflow from `main`. Confirm a single `studio` container, the same old volume ID/mount, unchanged project records and sample original hashes, authenticated HTTP/OBS health and read-only media access. The canonical environment names can be added to the private `runtime.env` later; existing `COMPANION_TOKEN` and `COMPANION_ORIGINS` work as aliases. Do not rotate their values as part of the rename.

## Recovery

If deployment fails, the forced command restores its prior source directory and image and recreates only the prior studio service on the same volume. If manual recovery is required, unset `VISTRALO_CUTOVER_READY`, stop only this app's studio, restore the recorded prior source/image/config pointers, and start exactly one service with `docker compose -p obs-companion -f deploy/compose.yaml up -d --no-deps studio`. Compare volume ID, records and hashes again. Never run `down -v` or Docker wide cleanup.

## Desktop and repository

New desktop installs use `Documents/Vistralo` and Vistralo user data. If existing `projects.sqlite` or credentials exist under the legacy path, the application keeps using that path. If both libraries or both credential stores contain data, startup refuses to choose silently. It does not move large recordings or decrypt credentials. The custom Windows uninstall key and electron-builder `appId` remain the old identifiers for upgrade continuity; the executable and shortcuts are Vistralo. Native Windows fresh-install, old-installer upgrade, DPAPI, uninstall/reinstall and hardware validation remain separate gates.

When the production cutover and redirect consumers are ready, rename the **same** GitHub repository from `Rezx100/obs-companion` to `Rezx100/vistralo` in GitHub repository settings. Confirm availability first. Retain history, branch protection, environment/secrets and collaborators; update remote URLs and consumers. Keep the old slug unused while its redirects matter. Repository administration is separate from this source PR.

Sessions live in memory and require sign-in after a restart. New logins issue `vistralo_session` and clear the old cookie. Existing authenticated old cookies are accepted only if their ID exists in the same in-memory session store. Local browser upload checkpoints migrate only after server validation of upload ID, project, kind, size, digest and offset.
