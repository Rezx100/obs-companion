# Vistralo 0.1.0 — Windows preview

The earlier OBS Companion server deployment passed its recorded live OBS acceptance. This Vistralo source branch has not been deployed to that server. See [server deployment and acceptance](docs/SERVER-DEPLOYMENT.md). Live forwarding of laptop devices is not yet implemented. The earlier OBS Companion Windows installer remains a historical preview. A Vistralo build needs native upgrade verification.

An independent local recording and website-evidence companion. **No OVH or ReqTalk dependency. This is an unsigned preview, not a verified end-to-end production release.**

## Install and start

1. Install `Vistralo-0.1.0-Setup.exe` after a verified build on 64-bit Windows 10/11. No administrator access is required. Compare the SHA-256 with the supplied checksum before running it. It is unsigned; Windows may show an unknown-publisher warning.
2. Install OBS Studio 28+ separately. In **Tools → WebSocket Server Settings**, enable the server and authentication; set a password. Keep the endpoint local.
3. Install FFmpeg and FFprobe from a trusted distribution. Open Vistralo **Settings** and select both executables, or place them on PATH. Click **Check setup**. Microsoft Edge must be installed for website evidence capture. The small Playwright video encoder helper is bundled.
4. Connect OBS in Settings. Create a recording project → **Prepare OBS workspace** → select devices → **Use these sources**. Confirm both previews and the microphone meter before recording.
5. Record, pause/resume and Finish. **Prepare MP4 replay** remuxes the recoverable MKV without re-encoding. **Extract screen + camera** creates two separate 1080p derivatives. Open Folder shows the exact completed files.

Read [docs/SETUP.md](docs/SETUP.md), [docs/PROVIDERS.md](docs/PROVIDERS.md), and [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) before hardware/provider tests.

## What is implemented

- Sandboxed desktop UI, SQLite project/job history, Windows-protected secrets, source hashes, interrupted-recording recovery, local media import, portable project export/reimport.
- Authenticated OBS WebSocket control with a dedicated profile/collection, source selection, source screenshots, microphone meters, pause/resume, disk preflight/low-space stop and explicit completion states.
- A single 3840×1080 OBS atlas containing two 1920×1080 source slots on one clock. Original master retained. Full-resolution derivatives use local FFmpeg cropping/re-encoding. Native source dimensions are recorded; a lower-resolution device does not become native 1080p by being placed in a 1080p slot. Optional desktop audio is separate on track 2; microphone alone is track 1.
- Isolated Chromium website evidence: selected same-origin pages, desktop/mobile viewports, load video, consecutive screenshots, Web Animations metadata, geometry/style samples, bidirectional scrolling, bounded hover exploration and explicitly reviewed click targets. No browser profile/cookie import. Non-GET requests blocked.
- Evidence-linked Markdown brief, motion manifest, coverage report, source video/frames, optional reviewed visual-model analysis, exact Boya voice adapter, local trim plans, imported word-timed transcript cleanup proposals, voice-only replacement, narration-segment composition and SRT output.
- Local MCP with typed operations. No shell tool, paid-generation tool, network listener or browser-to-native agent bridge.

## Known incomplete requirements

- Clean Windows install/runtime and real OBS/camera/microphone/hardware tests have **not** run. A compiled installer is not proof of a usable 40-minute capture on the user's laptop.
- Public-site quality/narration gate is open: Mercury failed DNS preflight in this environment.
- Automatic speech recognition, automatic English correction/semantic repetition editing, selective mouth-modification/lip-sync and resumable Drive/cloud uploads are **not implemented**. Word-timed transcript import and reviewed local edits are implemented.
- Live standalone OpenAI/HeyGen API calls, prices/caps and paid output quality are unverified. Connector read-only access confirmed the exact Boya voice and its Starfish listing; it does not transfer an API key into the app.
- No named GUI MCP desktop client was tested. The official SDK stdio client did pass real list/edit/render/output integration.
- Coverage is bounded discovery, not exhaustive proof of every animation. Canvas/WebGL and inaccessible frames need review. Sparse frame timing is approximate. Original-speed evidence is preserved.
- No signing certificate, automatic updater, production QA or long-duration hardware benchmark.

## Reproduce

Use Node 24 and npm. Dependency versions and integrity hashes are locked.

```powershell
npm ci
npm test
npm run build
# Build the Windows application directory:
npm run package:win
# Install NSIS 3 and set MAKENSIS to its executable, then:
$env:MAKENSIS = 'C:\Program Files (x86)\NSIS\makensis.exe'
npm run installer:custom
```

`resources/browsers/ffmpeg-1011` is included in the source archive with its LGPL notice. To restore it separately, see `scripts/prepare-browser-helper.cjs`. The custom NSIS source reproduces the delivered installer structure; Windows binary hashes may differ across build hosts. The initial standard electron-builder NSIS route required Wine on Linux, so the delivered installer uses the checked-in NSIS script. Neither build path signs the executable.

```sh
npm run test:integration       # Linux evidence fixture using dev-only Chromium package
node scripts/atlas-validation.cjs
node scripts/mcp-integration.cjs
node scripts/ui-smoke.cjs
node scripts/rebuild-validation.cjs
```

These scripts create `work/` artifacts and `evidence/` records. Linux development tests use a dev-only Chromium binary and synthetic media, explicitly distinguished from OBS/Windows/provider acceptance.

Architecture and stack deviation: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Source license: MIT. Runtime notices: [resources/NOTICE.txt](resources/NOTICE.txt).
