# OBS Companion progress

## Server migration preview — 25 September 2026

The supplied VPS is deployed and accepted for the requested server OBS path. The service runs in an isolated, hardened container with loopback-only HTTP and the original persistent data volume. OBS Studio 32.2.2, authenticated obs-websocket 5.7.4, application readiness and full health checks are operational.

Implemented an authenticated browser studio, one server job scheduler, resumable uploads with checksum verification/restart recovery, server FFmpeg edits and downloads, Linux OBS virtual-display adapter/recovery, and an SSH-compatible MCP-to-HTTP bridge. Prepared an isolated Docker/Compose installer and Windows deployment/tunnel launchers. Provider credentials remain server-side; paid generation was not attempted. Camera/mic/personal-screen live forwarding is NOT implemented.

Verification now includes a live VPS public-site capture through Chromium/X11/OBS, playable 1080p30 H.264 + AAC MKV, authenticated download checksum, FFmpeg MP4 render and download checksum, seven-tool MCP bridge, and active-recording interruption/restart recovery. Runtime production dependency audit reports 0 known vulnerabilities. The accepted local image ID and package versions are recorded in `evidence/vps-deployment.json`.

See docs/SERVER-DEPLOYMENT.md and the server addendum in docs/ACCEPTANCE.md. Remaining work outside this OBS server gate: long-duration/concurrent-load benchmarks, live local-device forwarding, Windows hardware validation, and the original unimplemented editing/provider gates. The prior Windows installer remains the earlier 0.1.0 preview; the browser studio over an SSH tunnel is the thin laptop client for server website capture and rendering.

2026-09-25: Read supplied handoff and pre-existing independent scaffold AGENTS.md. No target remote repository supplied. Created independent version-controlled workspace; ReqTalk untouched. Building vertical slices: (1) capture/recovery, (2) website evidence, (3) review/media/provider safeguards, (4) MCP/packaging, (5) recorded acceptance.

No paid provider generation authorized or attempted. HeyGen read-only lookup confirmed exact requested voice ID/name; API key and engine access are separate requirements.

## Implemented preview

Independent Electron/React application, SQLite state, OBS WebSocket source setup and recording controls, recoverable synchronized atlas capture, local FFmpeg editing, isolated Playwright evidence, review UI, optional visual-analysis/exact-Boya adapters with reservation ledger, transcript import/cut proposals, narrated segment render + SRT, project export/import, local MCP and Windows installer source.

## Verification

21 local tests pass. Real FFmpeg trims/cancellation/narrated composition and source preservation tested; real Chromium desktop/mobile fixture, representative heading reconstruction, UI/service harness, and MCP SDK stdio render tested. Runtime npm audit reports zero known production dependency vulnerabilities. Real OBS, Windows GUI/device/long-duration checks and paid API generation remain pending. Mercury public-site attempt blocked by DNS. Exact Boya voice and Starfish list read-only checks succeeded.

See docs/ACCEPTANCE.md for every gate and explicit unimplemented features. Do not describe this preview as an end-to-end production release. No paid generation authorization was inferred from the handoff. No remote repository supplied; local git history and reproducible source archive are the deliverable.

Final review found and fixed a recording-state conflict: edits/imports/processing now reject an active recording; SQLite claims prevent cross-process state replacement. Two regression tests added (21 total). Installer, source hash checks and checksums regenerated after this fix. Native Windows execution remains pending.
