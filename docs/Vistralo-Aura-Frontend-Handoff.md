# Vistralo — Aura frontend implementation handoff

**Prepared:** 25 September 2026. **Deliverable:** an original, complete frontend with realistic sample content, working demo journeys, and explicit integration contracts. This document is an implementation brief; it does not mean the design, backend, or release has been approved.

## 1. Outcome and order of work

Build Vistralo for international developers, designers, small business owners, and ecommerce operators. Help them turn website references and recordings into useful visual evidence, an editable brief, and a handoff or finished recording. Prioritize clear next actions and recoverable work over dashboard decoration.

Use **Riverside for workflow clarity** and **DesignCode for visual craft, material depth, and controlled motion**. Keep the name Vistralo. The existing dashboard and its generic wordmark, weak contrast, typography, and color treatments were rejected.

**First deliver one functioning Projects page for Rezan’s visual approval.** This is an explicit prior user instruction. The page must demonstrate the identity, favicon, type, surfaces, artwork treatment, responsive behavior, and interactions. Prepare the architecture and fixtures alongside it, but extend the visual design to the remaining screens only after approval. An existing file named “Approval” is not evidence of approval.

After approval, complete all core journeys below. “Production ready frontend with placeholders” means maintainable source, usable responsive screens, complete interaction states, deterministic demo data, accessible controls, a reproducible build, and tested adapters. A demonstration does not establish live authentication, multi-user isolation, payments, hardware recording, provider processing, or production backend readiness.

## 2. Start from the actual product

Repository: [Rezx100/obs-companion](https://github.com/Rezx100/obs-companion). The repository name is still the old name at inspection.

| Inspected source | State |
| --- | --- |
| Main | `ec9bbc37799214131c97ef4a32447370d232c6a8`; app under `deployment-source/obs-companion` |
| Rebranding branch | `codex/rebrand-vistralo`, current head `5c0e59b3283d9f9ab0a638770637a602ab5adb72`, open PR #4; app under `deployment-source/vistralo`. Runtime contracts inspected at `22fb6be` are unchanged at this head. |
| Desktop | Electron, React 19, Node service, OBS capture, FFmpeg; narrow preload bridge |
| Browser studio | Plain JavaScript frontend, same-origin Node server, token login, RPC, resumable uploads and media delivery |
| Existing design prototype | Separate Sites/Vinext React/TypeScript project; rejected visual direction, useful reference content only |

Fetch the latest refs and read both repository agent guides before implementation. Reconcile the active rebranding branch before choosing a base; do not overwrite it or reintroduce old public branding. Build on a separate frontend branch. Retain legacy identifiers that the rebranding work deliberately preserves for upgrades and stored data.

Read `src/contracts.d.ts`, `src/server.cjs`, `src/main.cjs`, `src/preload.cjs`, and the current UI before inventing contracts. Reuse the existing recording engine, service logic, upload integrity checks, and source preservation behavior. Do not turn this frontend assignment into a backend rewrite or touch unrelated applications.

## 3. Hosted Aura connection and GitHub workflow

**User requirement:** operate from ChatGPT Work with GitHub as the durable development workspace. The user will not run a local Codex installation. A CLI configuration inside a temporary execution workspace does not install Aura tools into this conversation.

Official hosted setup: [OpenAI plugin quickstart](https://developers.openai.com/plugins/quickstart) and [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt). Aura endpoint: `https://mcp.aura.build/mcp`.

1. In ChatGPT, open Settings → Security and login → Developer mode, if the account/workspace makes it available.
2. Open Plugins, use the plus button, name the custom plugin Aura, and enter the public MCP endpoint above. Complete Aura OAuth through this ChatGPT connection.
3. Install the resulting personal plugin. Start a Work chat with Aura selected using `@`, alongside GitHub access to this repository.
4. Invoke `aura_get_status` and inspect the authenticated account and capabilities before reporting a usable connection.

**Verified connection state on 25 September 2026:** the available directory search returned no Aura listing. The earlier workspace CLI entry was created, but its OAuth callback did not complete and it does not provide tools to hosted ChatGPT. This handoff does not claim a hosted Aura connection exists. Account-level custom-plugin creation is the remaining setup step; its availability depends on account/workspace policy. Do not repeatedly retry the local CLI route or ask the user to operate a local development environment.

Use GitHub for source, design tokens, original distributable assets, prompts, handoffs, decisions, progress, tests, review history, and release manifests. Use the current repository until its separately planned administrative rename is complete.

- Work on a dedicated branch and a reviewable pull request. Checkpoint completed work to GitHub so another Work session can recover from a commit rather than a transient filesystem.
- Run build and validation jobs through GitHub Actions. The existing main-branch workflow already validates PRs; it deploys only non-PR main events. Add frontend preview/artifact jobs as part of frontend implementation, without replacing the established deployment safeguards.
- Store validation reports, screenshots and packaged preview builds as CI artifacts; retain approved distributable installers/builds with their version and checksums in releases. Document artifact retention and preserve a reproducible source commit.
- Link each preview to the exact Git commit and, where used, Aura Canvas/revision. Record the user's visual approval against that version before extending the design.
- Keep production runtime on the existing VPS and user project media in its designated persistent/private storage. GitHub holds development material and release records; operational credentials stay in the configured secret stores.
- Treat Aura as a design and review surface. The coding agent imports selected source/assets into Aura and commits every accepted export/change back to GitHub. Aura's MCP does not independently connect to GitHub or browse the repository.
- Maintain the one-page visual approval step. Connection permission is not proof that a design has been approved.

Aura's official [MCP page](https://www.aura.build/mcp) documents Canvas/source operations and import of HTML or React projects with source, static build and explicitly supplied assets. Check account entitlements and actual exposed tool schemas. Import a sanitized review bundle, retain the Canvas/revision IDs, and verify the resulting asset loading and interactions. Updates should name the expected revision to prevent overwriting concurrent changes.

Source integration, testing and the GitHub PR remain the coding agent's responsibility. Keep importing/updating separate from publishing. Any later authorized publication must use the exact reviewed revision. This handoff initiates no paid generation, public publication, merge or deployment.

## 4. Visual system to implement

The following requirements carry forward the user's DesignCode redesign brief. Reference observations are sampled from DesignCode’s rendered site, not an official exported design system. Revisit the live reference for motion. Adapt its principles and create original Vistralo assets. Record the selected fonts, tokens and original assets in this repository.

**Identity:** construct an original capture-frame/aperture emblem with a deliberate negative-space opening. Develop an optically spaced vector wordmark whose letter details relate to the emblem. A font plus a stock V, sparkle, play triangle, or colored dot is insufficient. Deliver horizontal lockup, symbol, monochrome variants, SVG favicon, 16/32px favicon assets, and a 180px touch icon. Verify the real browser tab. Reuse approved geometry for the desktop icon if that packaging work is in scope; changing a web favicon does not update an installer.

**Material and color:** use a coordinated near-black/graphite foundation, distinguish navigation, working surface, elevated panel, and overlay, and introduce directional highlights and restrained indigo/violet illumination. Color should appear in the artwork and composition, not only the CTA. Exact hues remain part of the one-page proposal. Do not reapply the rejected `#7551E8` action treatment. Give brand light, focus, selection, and semantic states separate tokens. Eliminate the harsh full-height sidebar seam without making navigation boundaries unreadable.

**Type:** select and load a licensed family through an integrated visual proposal. Do not default to the rejected Switzer treatment or call a fallback font the final brand. DesignCode’s Geist Sans/Inter usage is reference evidence, not an approved Vistralo font choice. Start with 32–40px page headings, 16–18px card titles, 14–16px operational text, and readable supporting metadata. Keep extreme display tracking out of controls. Test international names, long URLs, numerals, and non-Latin fallbacks.

**Composition:** the Projects page has a clear navigation rail, compact toolbar, distinctive start area, three actions—Record screen, Analyze a website, Upload a recording—and recognizable projects. At 1440 × 900, the project toolbar and first row remain visible. Use purposeful density, aligned baselines, consistent image crops, and a small spacing/radius scale. Avoid nesting every item inside another rounded card. No invented analytics or decorative revenue charts.

**Art and motion:** connect the emblem to offset capture frames that resolve into organized panels. Use fine grain, halftone, and frame-line patterns selectively; keep operational text on a clean field. Deliver intentional original placeholder artwork with the correct silhouette, crop, and lighting while final art is pending. Logo lettering and UI labels remain vectors or HTML. A generic gradient rectangle is not an acceptable branded visual.

Higgsfield Nano Banana Pro and Seedance 2.5 were authorized for the earlier visual proof. This document does not submit generation jobs or expand a budget. Use the requested models when generating final assets, recheck their current schemas, and apply the existing per-job cost approval requirements.

Proposed timings: 140–180ms control feedback, 180–240ms panel transitions, and a short one-time branded reveal. Provide a static poster and reduced-motion equivalent. Pause decorative media when hidden or offscreen. Operational controls must be usable before animation finishes. Avoid persistent WebGL or background video across the editor.

## 5. Screen and route inventory

These are logical routes. For the current server and Electron package, use a hash router such as `/#/projects` unless a tested deep-link fallback is deliberately added. Do not assume the existing server serves arbitrary SPA paths.

| Surface | Required experience and completion behavior |
| --- | --- |
| Product entry | Concise value proposition, authentic product preview, Open studio and clearly labeled Try demo. Link a desktop download only when a verified artifact exists. Include help and legal navigation. No fabricated clients, testimonials, prices, or performance claims. |
| Sign in / session expired | Current studio token login, inline errors, pending state, sign out, and return to the intended project. Never store the token in localStorage. Email signup, password reset, social login, and organizations are future contracts, not current backend features. |
| Projects | Search, sort, grid/list, useful status filters, new-project choices, resumable work, and empty/no-results/error/loading states. Persist view preferences. Derive “ready to export” from actual outputs, not only a project named Ready. |
| New project | Named project, Record / Website / Upload choice, source requirements, validation, cancel/back, and appropriate next step. Preserve input on recoverable errors. |
| Capture setup | In desktop mode, OBS connection, source/device selection, preview, microphone/camera status where supported, and preflight. In server mode, explain that capture runs on the server; offer website capture or upload rather than pretending to record the user’s personal screen. |
| Recording | Preview, timer, state, pause/resume/stop, interruption recovery, pending acknowledgments, and clear preservation of source masters. Availability follows the runtime capability contract. |
| Website capture | URL, selected pages, desktop/mobile viewports, supported interaction options, start/cancel, coverage and blocked-page results. Represent captured, tested-no-motion, blocked, and not-tested evidence distinctly. |
| Upload | Supported file picker/drop zone, metadata, hashing/upload/verifying stages, real progress, resume/reselect, offset recovery, checksum failure, cancel/remove incomplete upload, and completion into project review. |
| Project workspace | Source summary, assets, evidence, brief, editing, review, and export navigation; job status; save state; resume after refresh; missing source and unavailable output handling. |
| Evidence and brief | Inspect frame/page evidence, measurements and coverage; select cited references; edit structured brief sections; distinguish observed facts from inferred recommendations. Keep links to source evidence. Local draft/export works in demo; remote brief persistence needs a verified contract. |
| Editor | Script/brief pane, central media preview, contextual tools, and timeline with source/narration/camera tracks only when present. Real fixture playback, seeking, clip selection, keyboard time inputs, edit-plan save, validation, and undo/redo for local edits. Do not imply unsupported drag or compositing operations work. |
| Review | Source/output comparison, warnings, transcript/caption review, missing evidence, export readiness, optional provider job estimate/cap and explicit review controls. Unknown provider submission is not a retryable ordinary failure. |
| Export | Supported format/settings, queued/processing/cancel/failure/success states, output preview, usable downloads, evidence/brief exports, and preserved originals. A sample download must be a real readable fixture file. |
| Settings / integrations | Runtime and connection status, applicable device/provider setup, appearance/accessibility preferences, language/time formatting, storage information, and help. Mask credentials; show configured status rather than secrets. Future sharing/billing controls are omitted from live mode until supported. |
| Help / legal / system states | Task-specific recovery guidance, supported formats, keyboard shortcuts, privacy/terms/storage page shells, missing route, expired session, offline/reconnecting, and unavailable capability states. |

Use browser back/forward coherently. Restore project context on reload. Protect unsaved local edits when leaving, and provide a useful next step from each error. On small screens prioritize project browsing, upload, evidence, and review; turn editor side panels into accessible tabs or sheets rather than clipping a desktop layout.

## 6. End-to-end journeys that must work

1. **Store owner:** open sample storefront project → inspect desktop/mobile evidence → amend a brief → review coverage gaps → download the brief with source references.
2. **Designer:** create website project → choose pages/viewports → run deterministic demo capture → inspect an intentionally blocked page → continue with a clearly disclosed partial result → export the handoff.
3. **Developer:** upload a sample recording → interrupt and resume → review transcript → change clip boundaries → save the plan → render a sample output → preview and download it.
4. **Desktop creator:** configure a supported source → record/pause/resume/stop → recover an interrupted recording → edit/export while retaining the master. Demo simulates these transitions explicitly; hardware acceptance requires a real Windows/OBS run.
5. **Recovery:** encounter expired session, missing media, rejected file, render failure, and unknown provider status → recover or exit without losing saved work or silently resubmitting a paid job.

Every visible enabled control must produce the appropriate result. An intentionally unavailable capability needs a clear reason and alternative, not a nonfunctional click target or a fabricated success toast.

## 7. Frontend architecture and real integration boundaries

Use the repository’s React 19 foundation with TypeScript for new shared frontend modules, named components, feature folders, CSS design tokens, and a portable static build. Retain the existing esbuild pipeline where practical. Aura output is source material: refactor generated monolithic markup into reusable components and semantic controls. Do not add Next.js, a second server, or a new backend solely because a generator prefers it.

Suggested logical modules: `components/brand`, `components/ui`, `features/projects`, `features/capture`, `features/evidence`, `features/editor`, `features/export`, `adapters`, `contracts`, `fixtures`, and `styles`. Choose final paths after reconciling the rebranding branch. Share presentational components between browser and desktop; isolate platform operations.

Implement three explicit adapters: **demo**, **server**, and **desktop**. Components never import fixture JSON directly or call providers. Select the adapter at the application boundary. Derive feature availability from capabilities, not from guessed user roles or viewport size. Never silently fall back from a failing real adapter into simulated success.

| Existing boundary | Integration requirement |
| --- | --- |
| Browser login | `POST /login` with JSON `{token}`; cookie-based session; `POST /logout`. Preserve existing same-origin and server authentication protections. |
| Browser RPC | `POST /rpc`, JSON `{method,args}`; successful response is `{value: ...}`, errors use an HTTP error response with `{error}`. Do not assume the desktop envelope is identical. |
| Core RPC methods | `status`, `create`, `project`, `files`, `evidence`, `plan`, `narratedPlan`, `transcript`, `walkthrough`, `process`, `cancel`, `recover`, `check`. Verify each method’s arguments in the current source. |
| Upload | `uploadCreate`, `uploadStatus`, `uploadComplete`, `uploadRemove`; `PUT /uploads/:id` with `Upload-Offset`; chunks at most 8 MiB; SHA-256 and final media verification. Reuse the hash worker and migration-compatible resume keys. Completion verification can be non-cancellable. |
| Media | `GET /media?id=…&file=…`, optional `download`; supports range playback. Encode parameters and use server-authorized project-relative paths. |
| Desktop | Rebranding branch exposes `window.vistralo.call(method,args)` through a narrow preload bridge. Additional native recording, import, export, and settings methods differ from server RPC. Preserve isolation and IPC validation. |
| Optional providers | Existing `analysis` and `speech` paths require review and budget data. Display submission/reconciliation state honestly; no provider API calls or secrets in frontend code. |
| Frontend-only / future | Arbitrary project rename/delete, shared workspaces, invitations, hosted brief persistence, public share links, SaaS accounts, subscriptions, and checkout have no established contract in this inspected server. Use explicit demo behavior or omit live actions until implemented. |

Keep native project states compatible: `Ready`, `Recording`, `Paused`, `Stopping`, `Processing`, `Needs Review`, `Interrupted`, `Failed`. Preserve `record` and `walkthrough` modes. UI filters may derive friendlier labels but must not rewrite server state semantics. Existing `EditPlan` uses version 1, source, and clips with start/end seconds; validate ranges against duration before submission.

The server currently has one active-job scheduler. Show busy/queued expectations honestly and handle conflicting operations; do not imply parallel rendering capacity. Poll active work conservatively with cleanup, backoff, and visibility awareness; do not assume WebSocket job events exist. A server job may continue after the browser closes; local desktop jobs have different lifecycle behavior.

The current server uses a strict Content Security Policy and an explicit static asset map. Integrate built chunks, fonts, brand assets, and media through constrained asset serving with correct MIME types and traversal protection. Keep scripts/styles external, avoid remote CDN font dependencies, and do not solve preview issues by broadly disabling CSP. Verify dynamic timeline styling, local file previews, and the desktop custom protocol under the actual policy; add only narrowly justified allowances when required.

## 8. Placeholder and fixture contract

Maintain `PLACEHOLDERS.md` and a machine-readable asset manifest. Each placeholder needs an ID, purpose, screen, path, dimensions/aspect ratio, alt-text policy, license/source, fallback, replacement instructions, and whether it blocks launch. Separate content, assets, and service behavior so replacements do not require component rewrites.

- Seed realistic fictional developer, design, and storefront projects with long names, mixed dates, varying durations, and usable thumbnails. Use reserved example domains for fictitious links. Avoid implying fictional clients or results are real.
- Include short licensed/original sample video, audio, transcript, captions, evidence frames, edit plans, and valid output files. The editor must play real media; export must download a real artifact. No lorem ipsum or inert gray skeletons as finished screens.
- Provide deterministic normal, empty, slow, failed, interrupted, and unknown-job scenarios. Give demos a persistent, restrained Demo indicator and a reset action. Scenario controls belong in the preview/test harness, not normal customer navigation.
- Persist ordinary demo drafts/preferences with versioned browser storage. Keep large media out of localStorage. Clean up object URLs and sample caches. Never put real tokens, provider keys, or private recordings in fixtures or diagnostics.
- Represent brand artwork with composed SVG/static images and a poster/video slot. Keep asset URLs centralized. Generated imagery may supply art, never baked-in form controls, logos, text, or precise evidence.
- Do not invent plan prices, usage quotas, release URLs, consent records, or legal approval. Use the operator-provided contact values below; list other unresolved values in the manifest and render an honest preview state.

Operator information supplied by the user is **Dynamix LTD**, a Bangladesh software company; address: **Mirpur 12, Eastern Housing, Road 10, House 123, 2nd Floor, Dhaka 1216, Bangladesh**. Website: **https://vistralo.com**. Contact email: **contact@vistralo.com**. These are user-provided identity/contact values, not a claim that the website or email delivery has been verified. Additional registration and operational details need verified values. The rebranding branch’s `docs/legal/` content is explicitly draft-only. Build navigable page shells using labeled draft content in private review; do not silently publish those drafts or claim regional legal compliance.

## 9. Accessibility, international use, and performance

Target WCAG 2.2 AA. Record measured contrast on actual composited backgrounds: at least 4.5:1 for ordinary text, 3:1 for qualifying large text, and 3:1 for essential non-text controls/indicators where required. Decorative separators do not need to become bright full-height rules. Contrast checks alone are not an AA certification.

Verify keyboard operation, focus visibility and return, modal focus containment, programmatic labels, associated validation errors, status announcements, non-color status cues, reduced motion, 200% zoom, and 320 CSS-pixel reflow. Provide keyboard/time-input alternatives to timeline dragging and touch targets satisfying applicable WCAG requirements.

Test 375 × 812, tablet, 1440 × 900, and a wide desktop viewport. Do not use hover as the only path to actions. Format dates/numbers through locale-aware utilities, use explicit time zones where they matter, allow translated labels to grow, and prepare strings for localization without pretending untranslated languages are supported.

Use self-hosted licensed fonts, explicit media dimensions, compressed responsive images, route/feature splitting, and lazy-loaded editor/media features. Show poster assets before motion. Keep useful content available on an 8GB Windows machine and a mobile browser. Proposed initial budgets: Projects JavaScript at most 250 KiB gzip and its above-fold images/poster at most 400 KiB combined; document a measured exception if necessary. Profile CPU and memory during upload hashing and timeline use. Record actual build size and loading measurements rather than advertising unmeasured performance scores.

## 10. Verification, deliverables, and release boundary

**Stage 1 review:** one interactive Projects page; full-size desktop/mobile captures; a short motion demonstration; favicon at 16/32px; editable identity vectors; actual font files/licenses and tokens; measured contrast results; and a concise list of unfinished assets. Pause for the user’s requested visual approval.

**Complete frontend delivery:**

- Runnable source in a dedicated branch and reviewable PR, reproducible locked dependency install, static build, and exact run instructions.
- All core routes and journeys with working demo interactions, persistent drafts, realistic media, and no unexpected console errors, missing assets, dead links, or false success states.
- Shared component/token documentation; source asset manifest; `PLACEHOLDERS.md`; adapter/contract documentation; supported runtime capability matrix; and unresolved integration decisions.
- Focused interaction tests for critical journeys, upload resume/integrity behavior, session expiry, edit-plan validation/save, cancellation/recovery, and downloadable outputs. Use mocked providers in automated frontend tests; separately label real backend/hardware evidence.
- Browser/keyboard/contrast/reflow verification and screenshots of representative populated, empty, loading, error, and narrow-screen states. Test current Chrome/Edge, Firefox, and Safari where available; disclose untested targets.
- Repository gates: `npm ci`, `npm test`, `npm run build`, `npm run build:server`, and `npm audit --omit=dev` from the resolved application directory, plus the new focused frontend checks. Update `PROGRESS.md` and `docs/ACCEPTANCE.md` with results actually obtained.
- Aura Canvas and revision identifiers, what source/assets were imported, review URL if available, and a record of the tested revision. No invented preview URLs.

Frontend acceptance requires completed sample journeys and explicit replacement boundaries. Live-release acceptance additionally requires real-adapter integration tests, authentic login/session behavior, storage/error recovery, provider safeguards, and the appropriate Windows/OBS checks. A public multi-user service also requires actual user isolation and account infrastructure; the inspected shared-token server does not provide it.

Merging main deploys this repository to its VPS. Keep deployment separate from review and preserve the existing runtime environment and persistent volume. Never report a mock, browser fixture, or Linux test as a Windows, hardware, provider, or production pass.

## Reference material

- [Aura MCP — official connection and capability page](https://www.aura.build/mcp), inspected 25 September 2026.
- [OpenAI — MCP setup and hosted/local client boundaries](https://learn.chatgpt.com/docs/extend/mcp).
- [DesignCode — live visual reference](https://designcode.io/); the user’s supplied redesign brief informs the visual requirements reproduced above.
- Riverside reference interfaces supplied in the conversation: workflow reference, not assets to copy or evidence of Vistralo capabilities.
- [Vistralo rebranding PR #4](https://github.com/Rezx100/obs-companion/pull/4), runtime contracts inspected at `22fb6be` and confirmed unchanged at `5c0e59b`.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
