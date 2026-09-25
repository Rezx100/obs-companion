# OBS Companion progress

## Website capture result and preview — 25 September 2026

A Windows preview user reported that after a website capture, the video, narration state, saved location and next action were unclear, with no live visual feedback. The follow-up branch adds a result panel above scope settings, playable output or original evidence, explicit AI narration and analysis status, direct Save video dialogs, per-viewport Save actions, and a distinct project-backup label. During capture, completed JPEG frames update the result panel as a live still-frame preview; this is not a real-time video stream. Rendered outputs record their processing action so the UI claims narration inclusion only for narrated or voice-replacement renders. Previous outputs without provenance are marked unverified.

Local source verification: JSX transpiled with esbuild 0.28.2; `node --check` passed for the transformed UI and changed CommonJS files. The Save dialog was not exercised on Windows and no new installer was built. PR #6 targets the rebrand branch; the current GitHub workflow triggers PR validation only for `main`, so this stacked PR has no CI result until it is integrated into a main-targeting change.

## Windows signing gate — 25 September 2026

The distributed Vistralo preview produces the SmartScreen **Unknown publisher** warning because the installer and executable are unsigned. Added `scripts/Build-SignedRelease.ps1`: a Windows-only, fail-closed path that requires a trusted code-signing certificate identifying Dynamix LTD, timestamps and verifies all packaged Windows binaries and the installer, and recomputes the signed artifact checksum. The NSIS license now starts with Vistralo/Dynamix attribution and retains the original OBS Companion contributor copyright. No certificate or Windows signing host is available in this workspace; this is **not** a signed deliverable or a completed Windows install test. Signed downloads and native acceptance are pending. The unpublished privacy/terms drafts and separate data-practice gates remain pending as well.

## Vistralo Windows download correction — 25 September 2026

The standard electron-builder Windows artifact name is now `Vistralo-${version}-Setup.exe`, matching the custom installer and current desktop identity. The custom installer's displayed publisher is Dynamix LTD. The legacy application ID and uninstall registry key remain for upgrade continuity; the historical OBS Companion evidence below records earlier builds.

## Security and reliability audit — 25 September 2026

Completed a repository-wide and live-deployment audit. The remediation branch adds OBS finalization and reused-input recovery, consistent SSRF classification, Windows concat portability, imported-video remux, truthful cancellation/UI prerequisites, clean-clone acceptance setup, structured OBS health output, full dependency auditing, and focused regressions. The local suite now passes 32 tests; real Windows Chrome/HTTP/FFmpeg browser, capture, and MCP acceptances pass. Both full and production-only npm audits report zero known vulnerabilities after the packaging dependency update.

The current loopback-only VPS remains appropriate for one trusted operator. The critical operational gap is the absence of an evidenced off-site copy or restore drill for the persistent volume. No Bunny or Cloudflare resource was provisioned. See `docs/AUDIT-2026-09-25.md` for findings, current official pricing, service decisions, and migration/rollback guidance.

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

## Vistralo engineering rebrand — 25 September 2026

Source branch `codex/rebrand-vistralo` changes first-party package, runtime, desktop, browser and MCP identity. The old desktop library/vault, installer registration, OBS resources, server volume and deployment lock have explicit compatibility handling. Deployment is gated until the forced-command handler is installed and a restorable backup is verified; see `docs/VISTRALO-CUTOVER.md`. This is not a live production migration or native Windows pass. Earlier acceptance/evidence sections below are historical OBS Companion results.

## Legal disclosure audit — 25 September 2026

The engineering rebrand changed desktop/server names, but no privacy policy, service terms or storage notice existed in the repository or app navigation. Added Vistralo-specific unpublished drafts and a verified product data map under `docs/legal/`. These are not a compliance certification and are not linked as live policies. Operator identity, privacy contact, retention/deletion, provider contracts, transfer safeguards and customer terms must be supplied and reviewed before publication. The current shared-token studio is not suitable for independent customer accounts.
