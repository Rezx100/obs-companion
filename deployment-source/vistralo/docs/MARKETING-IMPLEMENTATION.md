# Vistralo marketing implementation

Status: reviewable implementation; **not approved for public launch**.

Source baseline: `codex/vistralo-web-app` at `34e3b8b36de9f55bdb7b19a00aa07458f453ac5d` (PR #7). Both user handoffs are v1.0, 25 September 2026; the HTML is the formatted companion to the Markdown, not a Golden Capture asset package.

## What this change implements

- A static, progressively enhanced marketing route in the existing esbuild project. The React workspace, Electron product, OBS runtime, provider protections, and production deployment gate are preserved. No framework migration is needed for this static surface.
- Shared dashboard color tokens, Inter, self-hosted JetBrains Mono, responsive layouts, native scrolling, real HTML FAQ disclosures, working documentation/support destinations, and a truthful Request access conversion action.
- One continuous Stage, with a hero-to-full-frame transform, data-driven scenes, GSAP ScrollTrigger pin/scrub, AVIF/WebP decode fallback, a bounded 10-frame bitmap cache, captions, callouts, comparison input, narration modal, static transcript, no-JS and reduced-motion output.
- Owned original Fernhill Goods reference site at `/reference/fernhill/`. It is clearly identified as a fictional reference. Its pricing belongs to the fictional reference and is not a Vistralo plan.
- A release contract checking capture provenance, product approval, supported capabilities, exact transcript excerpts, real measurement captions, both-device assets, mobile callout coordinates, safe paths, asset budgets, and evidenced trial/pricing claims.
- Static Hostinger combination build: marketing at `/`, existing cloud workspace at `/studio/`, auth callback still opens the workspace. It validates release evidence **before** modifying the existing distribution.

## Commands

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run build:server
npm run typecheck:web
npm audit --omit=dev
npm run build:marketing
npm run test:marketing
npm run build:marketing:release
npm run build:hostinger:marketing
```

`build:marketing` generates `dist-marketing` for review, with `noindex,nofollow` and disallowed crawling. It does not constitute access control and must not be uploaded to a public production document root as an approved launch.

The release commands intentionally fail while the manifest is unready. The current production app/build commands continue to work independently. The combined Hostinger command also needs the existing Supabase public build variables; never provide service-role credentials to the frontend.

Serve the preview with the built-in static server: `npm run preview:marketing`. This mounts the existing local workspace build at `/studio/`; cloud authentication requires building it with the already configured public Supabase settings. The marketing copy does not claim self-service registration.

## Source layout

- `marketing/messages.json`: current, source-supported marketing copy and FAQ.
- `marketing/story.json`: requested scene headings/timings and evidence state. All scenes currently disabled.
- `marketing/evidence.cjs`: release gate; approval flags are human review inputs, not independent proof.
- `marketing/render.cjs`: pre-rendered page structure, supporting pages, and static scene output.
- `marketing/client.js`, `frame-loader.js`: progressively enhanced controls and scroll engine.
- `marketing/styles/marketing.css`: marketing sizes/layouts over unchanged dashboard palette.
- `marketing/reference/`: owned capture reference.
- `scripts/marketing-browser-test.cjs`: responsive, axe, fallback, and synthetic engine checks. Temporary neutral images/video test code paths; they are not product recordings and never ship.
- `scripts/extract-marketing-frames.cjs`: raw extraction from separately supplied approved source captures; see MARKETING-ASSETS.md.

## Why the requested story is disabled

The handoff says not to ship without a real narrated scene identifying real sections and measurements. Source inspection found:

| Requirement | Current evidence |
| --- | --- |
| Redesigned shipped product approval | Not supplied; PR #7 remains a draft |
| 90-second Golden Capture | Not supplied |
| Narrated walkthrough + exact transcript + VTT | Not supplied; cloud providers are disabled |
| Editable brief | Markdown editing exists; structured extracted-token editing is not established |
| Agent rebuild from that same brief | No complete automatic build result; named agents unverified |
| Original/rebuild comparison | No approved pair from one uncorrected agent output |
| Rebrand scene | No shipped website rebrand capability found; optional scene cut |
| Team comments/workspace permissions | Not shipped; team scene omitted |
| Testimonials and measured proof | None supplied; proof section omitted |
| Plans, free limits and self-service trial | None verified; Request access replaces Start free |
| Approved public legal policies | Drafts exist only; information pages are explicitly not finalized policies |

The existing `sample-walkthrough.mp4` is an authored silent fixture. `server-ui/assets/sample-README.md` explicitly disclaims browser capture, live analysis, OBS and provider evidence. It is not used in this marketing implementation.

No paid provider jobs were submitted. No public production deployment, merge, DNS change, or replacement of `vistralo.com` was performed.

## Acceptance limitations

Automated synthetic interaction checks establish component behavior, not narration quality, full-site build fidelity, real-device frame rate, legal readiness or supported-agent compatibility. Hardware smoothness on the specified MacBook/Android, NVDA/VoiceOver, field INP, a 4G LCP measurement, and two-week analytics baselines remain unverified.

Analytics emits the specified `vistralo:analytics` DOM event names. A collector is deliberately unconfigured; when an approved same-origin endpoint is supplied it receives identifier-free events through sendBeacon. No cookies or persistent browser identifiers are added. Baselines cannot be claimed until collection is deployed and observed.

The repository forbids committing recordings and project data. Keep Golden Capture masters outside git, and deliver approved public derivatives through the asset publishing process after content review.
