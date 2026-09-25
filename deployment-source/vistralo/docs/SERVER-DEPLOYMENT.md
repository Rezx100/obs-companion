# Current rebrand status

This document records the prior OBS Companion VPS acceptance and installation path. For Vistralo upgrade and rollback use [VISTRALO-CUTOVER.md](VISTRALO-CUTOVER.md). The production service has not been migrated by the source PR.

# OBS Companion server preview — 25 September 2026

**Deployed and accepted on the supplied VPS.** The isolated `studio` service is healthy on loopback-only HTTP port 8787 and retained its persistent data volume through every rebuild. The live gate captured `https://example.com/` through Chromium on virtual X11 with OBS Studio 32.2.2 and authenticated obs-websocket 5.7.4, downloaded the MKV with a matching SHA-256, rendered and downloaded an MP4, exercised MCP, and recovered a playable MKV after a container restart. See `evidence/vps-live-acceptance.json`, `evidence/vps-restart-recovery.json`, and `evidence/vps-deployment.json`.

## What moves to the server

| Operation | Server preview |
| --- | --- |
| Website browser automation, video and visual evidence | Server job with a fresh Chromium profile |
| OBS website recording | Linux OBS captures an isolated 1920×1080 virtual desktop at 30 fps; native VPS validation passed |
| Upload completed recordings/audio/captions | Resumable 8 MiB chunks, browser SHA-256, verified import, restart recovery |
| Trim, replace audio, compose narration, render MP4/SRT | Server FFmpeg; source masters preserved |
| Optional analysis and exact Boya speech | Server provider adapters with reviewed estimates/caps; no paid tests run |
| Projects and downloaded outputs | Server SQLite/files on a persistent volume; authenticated browser downloads |
| MCP tools | SSH stdio bridge to the same authenticated HTTP scheduler; seven scoped tools |
| Camera, microphone and personal desktop on the laptop | Live forwarding is not implemented; imported recordings are supported |

Your laptop opens the studio, transfers media and plays previews. Its local devices cannot be captured without local permission and a local media connection. Browser hashing and transfers use some laptop CPU/network. This preview does not claim that all physical capture has moved off the laptop.

Automatic ASR/English rewriting, selective lip sync, Drive uploads, automated pricing/reconciliation and other gaps in ACCEPTANCE.md remain unfinished. Server-side storage does not provide those features by itself.

## Installation boundary

The provided container recipe is for a Linux x86-64 server with an existing Docker Engine and Compose v2. It does not install or upgrade Docker, modify host firewall rules, restart other applications, or use OVH/provider infrastructure. The image includes OBS Studio, FFmpeg, a virtual X11 display and the browser runtime. NVIDIA hardware is not required by the recipe; software encoding and software OpenGL must be benchmarked on the actual host.

The service publishes **only `127.0.0.1:8787` on the server**. Use an SSH tunnel. OBS WebSocket and the browser proxy have no host-published ports. Do not expose the HTTP port directly to the Internet. A future public deployment needs a separate authenticated HTTPS design.

Runtime limits are 4 CPU cores, 6 GiB RAM with no additional swap allowance, 512 processes, low CPU weight, a private network and filesystem, dropped capabilities and a read-only image. The pinned Playwright seccomp profile enables Chromium's sandbox; sandboxing is enabled for server capture. Chromium receives a filtered environment without provider keys. Website traffic uses a proxy that resolves and pins checked public destinations. Server requests cannot approve private-origin browsing.

These limits reduce resource contention; they do not prove zero impact on another workload. Disk I/O, shared storage capacity, Docker build load, encoder throughput, virtual-display startup and host security-policy compatibility need measurement. Upload reservations are bounded to 20 GiB, with a 5 GiB free-space floor. There is no filesystem-level total-project disk quota yet. Monitor growth and provision a dedicated quota/volume before unattended production use.

## Deploy from a Windows computer that can reach SSH

Extract the source archive. In PowerShell from its `deploy` folder:

```powershell
.\Deploy-Studio.ps1 -ServerHost YOUR_SERVER -Username YOUR_SSH_USER -Port 22
```

Use the SSH port from your supplied configuration if it differs. Windows OpenSSH prompts for the password or uses your SSH agent. The script never places a password in process arguments. Verify the host fingerprint on first connection. It uploads an explicit source-only archive and refuses to overwrite an existing `~/obs-companion-server` directory. Docker/Compose must already be usable by that SSH account.

If executing directly on the server after copying the source:

```bash
cd obs-companion-server
bash deploy/install.sh
```

The installer checks at least 8 GiB currently available RAM and 50 GiB free build space, creates random tokens in `deploy/runtime.env` with mode 600, builds the image and waits for full health. Health requires the OBS process, port 4455, authenticated `GetVersion`, and HTTP 200. Application startup also waits for authenticated OBS readiness. The VPS image built successfully and separately passed a real OBS capture; HTTP health alone is not treated as capture evidence.

Read `COMPANION_TOKEN` privately in `~/obs-companion-server/deploy/runtime.env`. Do not share that file or paste the token in chat. Open the studio from PowerShell:

```powershell
.\Connect-Studio.ps1 -ServerHost YOUR_SERVER -Username YOUR_SSH_USER -Port 22
```

Keep the SSH window open, open `http://127.0.0.1:8787` and enter the studio token. If the browser opens before SSH finishes authentication, refresh it. No Windows OBS installation is needed for server website studies or processing uploaded media.

## Provider setup

Add standalone `OPENAI_API_KEY` and `HEYGEN_API_KEY` to the private server `deploy/runtime.env` and recreate only this service by running `docker compose up -d` from the `deploy` directory. Browser and MCP responses never contain these keys. Provider keys cannot be changed through the browser. The same exact Boya voice ID is retained: `02dbea5e083144c884525b7d9260bec6`.

Paid generation requires a reviewed estimate, quote and cap in the UI. An app-side cap is not a provider-enforced billing ceiling. Unknown submissions remain locked; no automatic paid retry is added. No provider credit was used to test this server preview.

## MCP over SSH

Use SSH key/agent authentication with a verified host key. Configure your MCP client's command as `ssh`, with arguments equivalent to:

```text
-T -p 22 USER@SERVER docker compose -f obs-companion-server/deploy/compose.yaml exec -T studio node src/server-mcp.cjs
```

The bridge uses the container's internal token and the same job scheduler as the browser. It offers project list/read, evidence read, edit plan, render, output and cancel. No shell tool, credentials tool or paid-generation tool is exposed. Closing the MCP client does not cancel an accepted server job. Use the cancel tool explicitly.

## Operation, recovery and removal

```bash
docker compose -f deploy/compose.yaml ps
docker compose -f deploy/compose.yaml logs --tail 100 studio
docker stats --no-stream
```

To stop only this app, run `docker compose -f deploy/compose.yaml stop`. To remove its container/network while preserving projects, use `docker compose -f deploy/compose.yaml down` **without `-v`**. Never remove the data volume to fix a capture failure.

Interrupted uploads resume by selecting the same file, project and source type again. If local browser storage was cleared, start a new upload; unfinished staging uploads remain until explicitly removed through the authenticated upload API. A disconnect does not stop already accepted jobs. On process restart, interrupted tasks are marked for review rather than reported as completed.

For an interrupted OBS job, use **Recover server OBS** on that project. It checks the active record directory before stopping a recorder, retains all MKVs and probes completed files. Unconfirmed stop requests are not blindly repeated. Review recovered video/audio before rendering.

## Real-server acceptance result

1. Passed: isolated image build/recreate, preserved volume, loopback-only HTTP, protected `runtime.env`, full authenticated health and recorded image/package receipt.
2. Passed: public website on virtual X11, OBS scene/input framing, MKV stop/finalization, 1920×1080 H.264 at 30 fps with stereo AAC, authenticated download and matching SHA-256.
3. Passed: FFmpeg edit/render to H.264/AAC MP4, authenticated output download and matching SHA-256, and seven MCP tools against the same project store.
4. Passed: interruption during active OBS recording, container restart, startup without the OBS Safe Mode dialog, no recording left active, playable MKV recovery and post-test healthy service.
5. Outside this VPS gate: long-duration load/drift benchmarking and live forwarding of the laptop's camera, microphone, or personal desktop. Those devices remain local unless a separate forwarding design is implemented.
6. No paid provider calls ran and no provider credentials are required for the accepted capture/edit/MCP path.

## Reproduction and references

Node 24 and `npm ci` reproduce the locked JavaScript dependency graph. Run `npm test`, `npm run build`, `npm run build:server`, `node scripts/server-ui-test.cjs`, `node scripts/server-capture-test.cjs`, and `node scripts/server-mcp-test.cjs`. Tests using a local fixture deliberately inject local-origin permission; the production API does not.

The Docker recipe pins OBS Studio 32.2.2 by version and upstream DEB SHA-256 and pins the JavaScript lockfile. The accepted local image ID is recorded in `evidence/vps-deployment.json`; it is not a registry-published digest. `deploy/NOTICE.md` lists the upstream seccomp source and hash.

Primary references consulted: https://obsproject.com/kb/remote-control-guide, https://github.com/obsproject/obs-websocket, https://docs.docker.com/engine/containers/resource_constraints/, https://playwright.dev/docs/docker.
