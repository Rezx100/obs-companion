# OBS Companion 0.1.0 acceptance — 25 September 2026

## Audit remediation addendum

The 25 September security/reliability audit raises the automated suite to **32 passed, 0 failed** and adds real local Windows browser/HTTP/FFmpeg/MCP acceptance. Regression coverage now includes delayed MKV finalization, reused OBS input reattachment, profile-or-collection restoration, reserved/CGNAT URL rejection, truthful job cancellation, imported-video remux, and Windows narrated concat paths. Full and production-only npm audits report zero known vulnerabilities. These results do not replace native live VPS OBS evidence or authorize paid-provider calls.

The audit's architecture verdict, service matrices, cost assumptions, and remaining risks are in `docs/AUDIT-2026-09-25.md`. No Bunny or Cloudflare infrastructure was provisioned. An independently restorable off-site copy remains required before the retained masters can be considered durable against host/volume loss.

**Release status: unsigned Windows preview. The complete handoff is not yet satisfied.** Source, local processing and evidence workflows are implemented and tested as listed below. A built Windows installer is not a Windows runtime, OBS hardware or paid-provider pass.

## New server migration preview

**Live VPS deployment passed the requested OBS gate.** The accepted image uses OBS Studio 32.2.2 and obs-websocket 5.7.4. A real `https://example.com/` capture produced a 5.9-second, 1920×1080/30 fps H.264 MKV with stereo AAC; its authenticated download matched SHA-256 `798c5a036b0d8f6cd4e0b2f953bd36212ef08a25dcd7ea3bfbb83de92a647a56`. FFmpeg produced a verified two-second MP4, MCP exposed all seven expected tools, and restart recovery retained a playable 4.266-second MKV with no recorder left active. No paid provider call ran.

| New server gate | Actual result |
| --- | --- |
| Automated suite | 32 passed, 0 failed in the audit run. Linux OBS tests use a mock WebSocket client and are not native capture passes. Historical `evidence/server-tests.txt` belongs to the earlier 27-test VPS gate. |
| Browser studio and real processing | Passed locally: real HTTP authentication, browser checksum worker, upload, edit, FFmpeg render, source preservation, desktop/mobile UI and no renderer exceptions. `evidence/server-ui.json` and screenshots. |
| Resumable upload | Passed: interrupted transfer survives server restart; stale offsets/checksum mismatch rejected; completion idempotent; originals retained. |
| Async server website capture | Passed against local deterministic fixture; job survives request completion, second job blocked, real Chromium evidence/video downloadable. `evidence/server-capture.json`. Not a public-site test. |
| MCP server bridge | Passed with official SDK, real stdio child → authenticated HTTP → shared server scheduler → FFmpeg output. `evidence/server-mcp.json`. SSH/GUI-client transport unverified. |
| Server isolation controls | Verified on the VPS: non-root read-only container, 4 CPU/6 GiB limit, loopback-only HTTP, no published WebSocket, dropped capabilities with only `SYS_CHROOT` restored for Chromium sandboxing, no-new-privileges and checked-destination proxy. |
| Dependency audit | 0 known vulnerabilities in both full and runtime-only audits after the packaging dependency update; `evidence/server-audit.json`. Not a security certification. |
| Docker image/install and Windows launchers | VPS Docker image built and recreated successfully while retaining the same data volume. Windows tunnel launcher source remains supplied but was not re-executed in this gate. |
| Server OBS and physical capture | Passed for a real server virtual-display website capture, authenticated control, MKV, download, render and interruption recovery. Live laptop-device forwarding remains unimplemented. |
| Reproduction | Locked Node source, pinned upstream OBS DEB checksum, package receipt and accepted local image ID recorded. No registry digest or byte-identical cross-host image claim. |

The existing Windows 0.1.0 installer belongs to the earlier local preview and was not rebuilt as a server client. Use the browser studio over SSH after deployment. Original eight handoff gates and unfinished features below remain applicable. No paid provider generation ran. Full deployment instructions, limitations and server acceptance are in `docs/SERVER-DEPLOYMENT.md`.

## Results against the eight handoff gates

| Gate | Status | Evidence and remaining work |
|---|---|---|
| 1. Clean Windows install and record/replay | Pending | Windows x64 application packaged; native clean install/run not available in this Linux environment. OBS/device controls have contract tests, not real OBS tests. |
| 2. Separate full-resolution sources and audio | Partial | Real FFmpeg split of a synthetic 3840×1080 atlas created two 1920×1080 outputs, both 2.033333 s, original hash unchanged. Real Brio/Boya routing, pause drift and native source format remain unverified. |
| 3. Known-motion test site | Passed for browser evidence | Real Chromium captured desktop 1440×900 and mobile 390×844 videos/frames. Entrance 600 ms and carousel 400 ms event times verified within 35 ms; accordion/hover/scroll/reverse capture present. Additional keyboard/mobile/reduced-motion/sticky/reset checks recorded separately. This is Playwright evidence, not OBS hardware capture. |
| 4. Real public-site narrated walkthrough | Partial | Real public `example.com` footage passed through server OBS/X11 and was downloaded and rendered. Paid reasoning, speech, and narration-quality review were intentionally not run. |
| 5. Rebuild from exported evidence | Partial | Representative heading reconstructed from captured geometry/type/keyframes. Compared at 0/150/300/450/600 ms: position within 1 px and opacity within 0.002. Initial missing letter-spacing mismatch was fixed by capturing it. Full representative interactive section/public-site fidelity remains pending. |
| 6. Failure and recovery | Partial | Real VPS interruption during active OBS recording passed: restart returned healthy, the recorder was inactive, the project became Interrupted, and recovery retained a playable MKV and moved it to Needs Review. Physical disk exhaustion, provider failures and interrupted cloud uploads remain pending. |
| 7. 40-minute capture / 10-minute finished output | Pending | No access to user's i5-8365U/8 GB/Brio 100/Boya Mini 2 or equivalent. No CPU/RAM/frame-loss/drift/long-output/cost claims. Atlas capture processes twice the pixels of 1080p. |
| 8. Packaged app and MCP client | Partial | Windows x64 package and unsigned NSIS installer build; archive checks documented in packaging evidence. Real official MCP SDK client completed list → edit plan → local FFmpeg render → output hash via stdio. Windows GUI and a named GUI MCP desktop client untested. |

## Exact validation commands

Run from the source root with Node 24:

- `npm test` — **32 passed, 0 failed** in the audit run. Includes real FFmpeg trim, cancellation, delayed-finalization recovery and narrated MP4/SRT composition; paid-provider and OBS protocol contracts are explicitly mocked.
- `npm run build` — production React bundle succeeded.
- `npm run test:integration` — real deterministic browser capture on two viewports, continuous WebM, consecutive JPEG evidence, motion manifest, brief, coverage, local H.264 MP4.
- `node scripts/state-validation.cjs` — keyboard disclosure, mobile layout, reduced motion, sticky header and reverse-scroll reset on the deterministic site.
- `node scripts/rebuild-validation.cjs` — representative heading motion comparison.
- `node scripts/atlas-validation.cjs` — full-resolution synthetic atlas extraction with source hash preservation.
- `node scripts/mcp-integration.cjs` — actual MCP SDK stdio client and local render, not a mocked tool response.
- `node scripts/ui-smoke.cjs` — real Chromium renderer and Service harness: project creation/navigation and no renderer exceptions; screenshots included. Does not exercise Electron IPC or DPAPI.
- `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron -e ...` — Electron 44.4.5 / Node 24.21.0 / SQLite 3.53.4 module smoke check on Linux; exact result in `evidence/electron-runtime.txt`.
- `npm audit --omit=dev --json` — 0 reported runtime dependency vulnerabilities at build time, not a security certification.
- `npm run package:win` and `npm run installer:custom` — Windows x64 directory then checked-in NSIS script. See final packaging record and checksum.

The first normal electron-builder NSIS attempt required Wine. The first custom LZMA attempt did not complete in the execution session; no checksum or delivery claim was made for that partial file. The final script uses zlib and the completed artifact must pass archive checks before delivery. Linux GUI startup was blocked by this environment's Unix-socket restrictions; no successful Electron GUI launch is claimed.

## Unimplemented features, separate from external verification

1. Automatic speech recognition and automatic meaning-preserving English/repetition rewriting. Importing word-timed transcripts, local filler/gap proposals and human-reviewed scripts are available.
2. Selective lip/mouth synchronization in original presenter footage. No verified provider/API contract was established; no substitute avatar or full recreation is used.
3. Resumable Drive/other cloud upload adapter and its failure tests. Local completed project export is available.
4. Automatic provider-price calculation, provider-enforced per-job dollar ceilings, ambiguous-job reconciliation and completed-speech download resumption. Current UI requires a reviewed estimate/cap and blocks duplicate request fingerprints, but entered estimates are not hard provider billing limits.
5. Live recording preview video (source snapshots and live audio meters are implemented), exhaustive safe interaction discovery, source segmentation and full presentation-quality automated narration alignment.

## External requirements still needed

- Windows test machine, OBS installation, Edge, FFmpeg/FFprobe, actual camera/microphone and enough free disk. Planned RAM upgrade is not assumed installed.
- Standalone provider API credentials with actual model/voice access, verified current prices, and separate capped paid-test authorization. **No paid generations ran.** Read-only HeyGen connector access confirmed exact Boya ID and Starfish listing; it does not validate this application's API account.
- A verified selective lip-sync provider contract if that workflow is to ship.
- Signing certificate and Windows native install/uninstall/DPAPI/source-format/encoder tests before production release.

No videos were published. No OVH infrastructure was provisioned. ReqTalk was not modified. Original media are retained by all editing operations.

## Packaging validation

The final artifact is `OBS-Companion-0.1.0-Setup.exe`, unsigned. Its checksum is supplied in SHA256SUMS.txt; machine-readable size/hash and verification details are in `evidence/installer-validation.json`.

`python3 scripts/verify-installer.py` verifies the PE signature, NSIS header, entire raw-deflate stream, CRC32 and byte-for-byte presence of the application ASAR and browser FFmpeg helper. A separate ASAR check matches all runtime/UI files and runtime package metadata to the tested source. The uninstaller removes enumerated application files rather than recursively deleting unrelated files in a selected installation folder.

The bundled minimal 7za utility lacks an NSIS reader; explicit NSIS structural/payload validation replaces that unsuitable check. Neither check executes the Windows application.

A final regression fix prevents edit/import/processing operations from replacing Recording/Paused/Stopping state. SQLite atomic claims also prevent a second local process from taking a project that is already recording or processing. Two focused regression tests bring the local suite to 21 passing tests.

## Vistralo rebranding addendum — 25 September 2026

This source change preserves the historical OBS Companion 0.1.0 evidence above. Current verification must be tied to the rebranding commit and is recorded in `evidence/vistralo-rebrand.json`. The old installer checksum is **not** a Vistralo artifact. Live VPS cutover, repository administration and native Windows upgrade/DPAPI checks are separate pending gates. See `docs/VISTRALO-CUTOVER.md`.

## Legal notice status

Unpublished Vistralo legal drafts are in `docs/legal/`. No public privacy/terms pages or desktop/server policy links have been released. Legal operator facts and a tested rights/deletion process are still missing; do not call the product US, EEA or UK compliant on this basis.
