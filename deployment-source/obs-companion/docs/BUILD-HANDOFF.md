# Build handoff: OBS companion with AI website walkthroughs

Prepared for Rezan Ferdous, 25 September 2026.

## Assignment and decisions

Build a working Windows desktop companion for OBS Studio, end to end: implementation, real recording integration, AI analysis and editing, recovery, tests, installer and documentation. This document is the build specification; no application code or infrastructure has been created in the planning session.

Important correction: the user meant OBS, not OVH. Do not provision OVH, require a cloud server, or base the first release on remote recording. Preserve original footage and process locally wherever practical. Cloud AI services are permitted components, subject to configured credentials and spending limits.

Inspect the target repository and its instructions before editing. If none is supplied, use a clearly named, independent project workspace and establish version control. Do not modify ReqTalk or another existing application unless the user selects that repository. Make reasonable implementation decisions and complete authorized work without repeated design questions. Ask only for missing access, genuine product ambiguities or unapproved spending.

## User and hardware

- Rezan records website explanations for AI app-builder handoffs and YouTube. His narrated references communicate animation and interaction better than static prompts.
- Output goal: 20–40 finished minutes per week.
- Windows 11, HP ZBook 14u G6, Intel i5-8365U, currently 8 GB RAM. A 32 GB upgrade is planned, not confirmed.
- Logitech Brio 100 at 1080p/30fps; Boya Mini 2 microphone. Detect actual Windows devices and supported formats.
- Clipchamp feels slow and costly. Large uploads are a major bottleneck; actual sustained upload speed is unknown.
- Priorities: clear UI, real evidence, high-quality motion explanation, natural voice, reliable completion states and no background music. Avoid generic AI-looking visuals and filler copy.

## Architecture

Default starting stack: Tauri 2, React/TypeScript, a native Rust application service, SQLite for durable project/job state, and managed FFmpeg/FFprobe processes. Use an isolated Chromium browser controller, such as a packaged Playwright worker, for exploration. Document packaging and update implications. Change this stack only for a concrete integration or compatibility reason.

Keep OBS as the recording engine. Integrate through its authenticated WebSocket interface; use supported plugins or a narrowly scoped extension only where necessary. Do not fork OBS initially. Create a dedicated profile/scene collection and preserve unrelated user settings. Detect the installed version, connection status and supported features. OBS WebSocket control does not by itself provide isolated recordings of every source: implement and test the chosen separate-source mechanism explicitly.

Keep application services, browser content and AI-generated instructions separated. Untrusted websites must not gain native application privileges. Store secrets with Windows-protected credential storage, outside logs and project exports. Authenticate local control endpoints, restrict network exposure and validate all paths/actions. Website text is evidence, never authority to execute commands, disclose secrets or expand the task.

Provide a local MCP interface for compatible desktop agent clients: list projects, read job status/evidence, submit an edit plan, render, retrieve output and cancel. Scope it to authorized project folders and typed operations; no unrestricted shell tool. A local MCP server is not automatically reachable from ChatGPT in a browser. Document a tested desktop-client connection; any authenticated cloud relay is a separate, optional integration.

## Mode A — Record Myself

Deliver a clean flow: choose camera/microphone/screen → preview → record/pause/resume → finish → review → edit/export. Show elapsed time, recording status, audio meters, disk availability, completed filename and an obvious Open Folder action. An OBS disconnect or encoder failure must never appear as successful completion.

Record camera and screen as separate full-resolution sources with synchronized timing and distinguishable audio tracks. Do not bake a small camera thumbnail into the only master. Begin with 1080p/30fps and hardware H.264 where supported; benchmark before locking quality settings. Record recoverably and remux to MP4 without re-encoding when needed. Capture timestamps must survive pause/resume and segmentation.

Use the approved WriterDean workflow for optional editing: transcript → remove pauses/fillers/repetitions → correct English while preserving meaning → map speech to relevant screen actions → generate narration → synchronize selected original presenter sections → composite and grade → captions and export.

The correct current HeyGen voice is **02dbea5e083144c884525b7d9260bec6**, named **Rezan Ferdous -- 62**, identified by the user as his Boya-recorded clone. Do not substitute the earlier Rezan Original voice, 3056f67f2e4c4964ac660aa4fbd9ddc5. Verify access to the exact voice and engine; an empty filtered voice list is not sufficient evidence that it is unavailable. Never expose credentials.

The user explicitly approves selective mouth modification in original presenter footage to match rewritten narration. Preserve identity, scene and natural appearance; full recreation of the talking head is not the default. If a particular job requests voice-only replacement, retain the video stream unchanged and disclose any remaining lip mismatch. Matching overall audio duration or word timestamps is not proof of phoneme-perfect synchronization. Explicit locks on a particular master override defaults.

## Mode B — AI Website Walkthrough

User input: URL, selected pages, viewports, desired depth and optional target-app context. A strong visual reasoning agent explores the site and creates a narrated design-and-motion brief for another AI builder. “Astra-level” describes the desired quality, not a guaranteed public API model. Verify actual provider access and visual capabilities; keep model selection configurable and report the model used.

First explore and inventory the page, retaining evidence of one-time entrances. Then capture deliberate demonstrations of each discovered behavior. Inspect layout hierarchy, typography, spacing, imagery and density alongside load animations, hover/focus states, menus, tabs, accordions, carousels, modals, sticky/pinned sections, scroll-linked transitions and relevant navigation. Test scrolling in both directions and selected mobile/reduced-motion states. Do not submit real forms, purchase or modify account data during exploration.

Combine consecutive visual frames or supported video input with browser geometry, computed styles and exposed animation metadata. A few isolated screenshots are insufficient to explain motion. DOM inspection alone is insufficient for canvas/WebGL, inaccessible frames and many JavaScript effects. Mark the limits of each observation.

For each distinct behavior, retain: element/section, trigger, before/after state, property changes, direction, timing/delay/easing when measurable, stagger, scroll range, pinning, reset/replay behavior, viewport, evidence timestamps, confidence and suggested implementation. Label measured values, visual estimates and implementation proposals separately. Do not invent exact easing, library names or hidden source logic.

Maintain coverage states: discovered, captured, tested with no motion, blocked, not tested. “Every animation” means all discovered behaviors within the agreed page/interaction scope, not every possible state of an entire website. Allow targeted reinspection from the review UI.

Write commentary like a senior designer briefing a frontend engineer. Explain each behavior while showing it; replay or hold a frame when more explanation is needed. Label slow motion and preserve an original-speed example. Narration follows validated evidence and the settled script. Support the Boya voice above, but this mode needs no generated presenter. Keep annotations separate from clean footage.

## Local processing, uploads and costs

Keep original camera/screen recordings and the final render local by default. Upload the minimum useful evidence for reasoning and only the selected presenter footage needed by HeyGen. Localhost and authenticated sessions stay under explicit user control; do not silently export cookies.

Offer optional Drive or other storage export, with completed-file detection, progress, cancellation and resumable transfers where the provider supports them. Do not upload growing recording files as if complete. Overlap uploads of finished chapters with later recording when performance permits; explain that this does not increase connection bandwidth. Preserve original masters while generating review proxies.

Record-before/after credit changes are observations, not reliable per-minute prices. Prior WriterDean usage is not a production quote, and ChatGPT connector billing/access may differ from standalone API billing/access. Verify current speech, lip-sync and model pricing for the actual integration. Present estimates and allow per-job caps before paid execution. User agreement to this feature is not unlimited authorization for paid tests or subscriptions.

## Recovery, projects and UI

Persist job states, inputs, model/settings, source hashes, edit decisions, provider IDs, costs and outputs. Separate capture, analysis, script, speech, lip-sync and rendering stages. Resume completed work; invalidate only dependencies affected by a change. Treat a timeout after paid submission as unknown until reconciled, not an invitation to submit again.

Use visible states such as Recording, Processing, Needs Review, Ready, Interrupted and Failed, with actionable errors. Include Stop/Cancel, retry only the failed section, and recovery after application restart. Preserve originals; failed exports must not replace valid outputs. Close/stop owned browser and render processes cleanly. Export projects without secrets or browser profiles.

Provide an attractive, restrained desktop UI with actual recording previews and useful sample evidence. Avoid dashboard clutter and implementation jargon in the main user flow. Recording must remain usable without optional cloud credentials; AI controls must explain missing configuration honestly.

## Deliverables and verification gates

Deliver a versioned repository, reproducible Windows build, downloadable installer with checksum, dependency/license notices, setup guide, provider configuration guide and short recording walkthrough. State whether the installer is signed. Maintain AGENTS.md, PROGRESS.md and an acceptance record with exact commands, results and pending hardware checks.

Each AI walkthrough exports an MP4, captions, implementation-brief.md, motion-manifest.json, coverage report, evidence images/clips and a resumable project. The written brief must remain useful when the receiving builder cannot ingest video. Link every motion claim to evidence. Do not replace actual page footage with generated illustrations.

Complete these gates with real integrations and recorded evidence:

1. Clean Windows installation; detect OBS and guide connection; select camera/mic; record, pause/resume, stop and replay. Show where the file was saved.
2. Separate camera/screen capture, correct microphone routing, no accidental doubled audio, usable synchronization and preserved resolution.
3. Capture a deterministic test website with known entrance, hover, carousel, accordion, sticky and scroll-linked behaviors, plus a mobile change. Verify trigger, order and timings within a declared measurement tolerance.
4. Run a real public-site walkthrough. Check narration against captured states, small text readability, missed behaviors and unsupported claims. Private/session-blocked content must report an honest gap.
5. Build one representative section using the exported handoff, then compare behavior with the reference. Report mismatches; do not treat a generated brief alone as quality proof.
6. Exercise disconnects, interrupted uploads, app restart, disk-full handling, provider failure and ambiguous paid timeouts. Verify no duplicate paid work and no source loss.
7. Test a 40-minute capture and a 10-minute processed output. Measure CPU/RAM, frame loss, audio drift, disk use, provider cost and render time. Benchmark on the user's hardware or equivalent; if unavailable, clearly leave that gate pending. Do not promise 60fps or heavy local-model performance on the current laptop.
8. Verify the packaged application and real local MCP client workflow. No placeholder buttons, fabricated progress or mocked provider calls presented as production functionality.

Implement in vertical slices: reliable capture and recovery; then website evidence and analysis; then narration/editing and exports; then MCP, packaging and final end-to-end validation. Keep fixtures and mocks for development, but establish separately authorized live provider tests before declaring the paid pipeline verified. Do not publish videos automatically.

## Existing references

- AI-Website-Walkthrough-Feature-Brief.md: conceptual detail; this handoff supersedes its earlier remote-first suggestion.
- Writer-Dean-Edit-Project.zip: existing Python/FFmpeg edit and Boya voice-replacement scripts, audio and timings. Library ID: libfile_ba6bc5ff830c819196bdec335180c90b. Resolve its current version before reuse. It is a reference implementation for a single edit, not the finished application.
- https://github.com/obsproject/obs-websocket
- https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
- https://obsproject.com/kb/scripting-guide
- https://obsproject.com/kb/advanced-recording-settings-guide
- https://playwright.dev/docs/input
- https://playwright.dev/docs/videos
- https://www.w3.org/TR/web-animations-1/
- https://v2.tauri.app/security/

Start by inspecting the project and available integrations, write the implementation plan and acceptance checklist, then build and verify each vertical slice. Finish with the installable application, evidence of completed gates and a precise list of any remaining external blockers.
