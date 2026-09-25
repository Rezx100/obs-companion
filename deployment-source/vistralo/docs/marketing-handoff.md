# Vistralo marketing site: scroll-led story handoff

Version 1.0 · 2026-09-25 · Owner: Rezan Ferdous · For: marketing front-end team and any AI builder that implements it

This document is the build brief for vistralo.com's home page. It inherits the design system from the dashboard redesign brief (tokens, type, icons, motion rules) and adds what a marketing surface needs on top. Read sections 1 to 3 before anything else. Section 4 is the shot-by-shot story. Everything after it is specification.

---

## 1. What this page has to do

**The one question the page answers:** "I found a website I love. How do I get my own version, built properly, without hiring a designer to explain it and a developer to rebuild it from scratch?"

**Who must act:** a founder, product designer or marketing lead who already has a reference site in mind and can start a free trial today.

**What they must believe by the footer:**
1. Vistralo records the site and explains its design decisions the way a creative director would, in real terms, not generic AI filler.
2. That explanation becomes a brief a team can act on.
3. A coding agent can build from that brief, and the result is faithfully close to the reference in structure and motion, with the customer's own content and brand.

**Success metrics:** trial starts per 1,000 visitors; scroll completion of the story (reached scene 6); "Listen to the narration" plays; compare-slider drags. Baseline and targets are set in section 13.

**Mode:** Persuade. Design is the product here. It may be cinematic. It may not be dishonest, inaccessible or slow.

---

## 2. Non-negotiables

These come from the audit of the dashboard and of the DesignCode reference page. They are rules, not preferences.

### 2.1 The value test
Every section must answer a customer question. The question is written at the top of each scene in section 4. If a section cannot show real evidence for its answer, the section is cut. Do not fill the gap with a slogan, a 3D object or a stock illustration.

### 2.2 Real product only
- Every product visual is a capture of the shipped product. No mock-ups, no Figma frames, no "coming soon" states.
- Capture the redesigned dashboard, not the current preview build. The preview build has 67 confirmed defects and must never appear in marketing.
- The narration text, the brief and the agent's code shown on the page are real outputs of one real session (the Golden Capture, section 8.1). If the product cannot produce it, the page cannot show it.
- Demo content uses a reference site we own or have written permission to record. Never a third-party brand's site. See section 12 on legal.

### 2.3 Motion that is impressive because it is precise
- The story is scroll-driven. The user's scroll is the timeline. Nothing plays on its own except a video the user starts, and that video has controls.
- No looping animation without a visible pause control. No marquee, no rotating headline word, no countdown, no slot wheel. (The reference page fails WCAG 2.2.2 on exactly this, and Microsoft would not ship it.)
- No blur on text, no film grain, no glow, no glass effects. Text is sharp at every frame.
- Scrolling stays native. No scroll hijacking, no wheel multipliers. Keyboard paging and screen-reader navigation work through the whole story.
- `prefers-reduced-motion` turns the story into stacked still frames with captions. It must still make the argument.

### 2.4 Accessibility and performance are ship gates
- WCAG 2.2 AA throughout. Text 4.5:1 or better, UI 3:1, visible focus everywhere, targets 24 px minimum.
- Largest Contentful Paint 2.5 s or better on a mid-range phone on 4G. Cumulative Layout Shift under 0.05. Interaction to Next Paint under 200 ms.
- The pinned story has a "Skip story" control. The page is readable and usable with JavaScript disabled (posters and copy render in order).

### 2.5 Honesty
- No invented numbers. If we do not have a measured metric or a permitted logo, the proof section does not exist.
- No fake urgency, no strikethrough anchor prices, no "N left".
- "Clone" is not marketing copy. We say "rebuild" and we say what is rebuilt (structure and motion) and what is the customer's (content and brand).

---

## 3. The idea in one paragraph

One screen, seven states. A single product frame sits in the middle of the page and never cuts away. As the visitor scrolls, that frame turns from the Vistralo dashboard into a live recording of a reference site, into a narrated walkthrough with callouts drawn on the real UI, into the brief, into the build, into a side-by-side of the original and the rebuild, and finally into the customer's own branded version. Copy stays out of the way: one headline per scene and one caption line at a time. The impressiveness comes from continuity and precision, not from effects.

We call that frame **the Stage**.

---

## 4. The story, scene by scene

Scroll distances are in viewport heights (vh) of pinned scroll. Progress `p` runs 0 to 1 within each scene. Desktop values first; mobile adjustments are in section 6.6. Frame counts refer to the scrubbed image sequence (section 8.3).

### Scene 0: Navigation
- 56 px sticky bar. Left: logo mark + wordmark. Centre: How it works · Pricing · Docs. Right: Log in (ghost), Start free (primary, 36 px).
- Transparent over the hero; gains `--bg-page` at 92% opacity plus a 1 px `--stroke-divider` after 80 px of scroll (160 ms transition).
- While the story is pinned, a "Skip story" ghost button appears at the right of the nav (aria-label "Skip to pricing"). It jumps to scene 7 and moves focus there.

### Scene 1: The hero
**Customer question:** "What is this, and what do I do with it?"
**Pinned scroll:** 0 to 140 vh. **Frames:** 36 (Golden Capture 0:00 to 0:09).

**On screen at rest (p = 0):**
- Left column (40%): headline, subhead, two buttons.
- Right column (60%): the Stage, showing the real dashboard with a recording in progress. The reference site is visible inside Vistralo's capture frame, a red "Recording 0:03" pill is live, the cursor is mid-move. This is the first frame of the Golden Capture.
- Below the fold line nothing else. No logo strip, no eyebrow, no floating pill.

**Copy:**
- Label (14 px, sentence case): "For teams that start from a reference"
- H1 (64/68): "Turn any website you admire into a brief your team can build."
- Subhead (20/30, max 60 ch): "Record it in Vistralo. It explains every design decision like a creative director, writes the brief, and hands your coding agent the build."
- Primary: "Start free". Secondary: "See how it works", which smooth-scrolls into scene 2.
- Under the buttons (13 px, `--fg-3`): "No credit card. Works with Cursor, Claude Code and VS Code agents." (Only list agents that are actually supported at launch.)

**Motion (scrubbed by p):**
- p 0.00 to 0.55: the recording advances (frames 0 to 36). The cursor moves through the reference site's hero and nav. The "Recording" timer counts.
- p 0.35 to 1.00: the dashboard chrome recedes. Sidebar and header fade to 0 opacity and translate 24 px outward; the capture frame scales from its card size to fill the Stage (FLIP transition on one element, `transform` and `clip-path` only). The left text column fades out over p 0.6 to 0.9.
- Text entrance on load (not scroll): headline lines rise 12 px and fade in over 240 ms with a 60 ms stagger; the Stage fades in over 320 ms after the poster is decoded. Nothing starts at opacity 0 for longer than 400 ms after load.

**Assets:** frames 0000 to 0035 desktop and mobile; poster = frame 0000 as an `<img>` with `fetchpriority="high"`.
**Kill criteria:** if the capture flow cannot be shown live in the product (recording pill, timer, capture frame), the hero uses the narrated walkthrough view instead and scene 2 starts at p = 0.

### Scene 2: It watches like a creative director
**Customer question:** "What does it see that a screenshot can't tell me?"
**Pinned scroll:** 140 to 300 vh. **Frames:** 48 (Golden Capture 0:09 to 0:24).

**On screen:** the Stage is now the full recording. The reference site scrolls under the cursor. As each real section passes, Vistralo's callouts draw onto the UI: a bracket outline, a leader line and a label in the product's own callout style. A caption strip sits under the Stage: one narration line at a time, never more than two lines, never more than 22 words. At the strip's left, a small "Narrated by Vistralo" label and a mono timecode. At its right, a "Listen" button (section 4, scene 2, audio).

**Copy:** H2 above the Stage (44/50): "It names what it sees. In real terms." One line of support (18/28): "Sections, spacing, motion, type, and why each choice works."

**Narration captions** (must be real product output; these are the target lines for the demo site):
1. "The nav is 56 pixels and stays put. It blurs the page beneath it so content never competes with the menu."
2. "The hero makes one promise and shows one action. Everything else waits until you scroll."
3. "Cards reveal in a 40-millisecond stagger. It reads as one row arriving, not six things blinking."
4. "The price sits 24 pixels under the plan name, and it is the only saturated element in view. That is why the eye lands there second."

**Callouts (one per caption):** "Sticky nav · 56 px", "Hero · one promise, one action", "Card stagger · 40 ms", "Price · only saturated element".

**Motion (scrubbed):**
- Frames advance linearly with p.
- Caption i becomes active at p = 0.10, 0.34, 0.58, 0.82 with 0.03 of hysteresis. Swap is a 200 ms crossfade; the outgoing line rises 6 px.
- Each callout draws over 0.06 of p: the bracket's `stroke-dashoffset` runs to 0, then the label fades in over the next 0.03. Callouts persist until the section leaves the frame, then fade over 0.04.
- A thin progress line under the caption strip fills with p. It doubles as the timecode's visual.

**Audio:** the "Listen" button opens a modal with the real 60-second narrated walkthrough video (captions on by default, full controls, focus trapped, Esc closes). Audio never plays from scroll.

**Assets:** frames 0036 to 0083; the four narration lines as text in the DOM (also read by screen readers); callout SVGs; the 60-second narrated MP4/WebM with a VTT caption track.
**Kill criteria:** if the product's narration cannot name a real section and a real measurement, this scene is cut and the page loses its core argument. Do not ship the page without it.

### Scene 3: Not generic narration
**Customer question:** "Why would its opinion be any good?"
**Pinned scroll:** 300 to 400 vh. **Frames:** 1 (a held frame from 0:19, the pricing section of the reference site).

**On screen:** the Stage holds one frame. A vertical wipe, scrubbed by scroll, moves from left to right. Left of the wipe, the frame carries a grey, generic caption. Right of the wipe, the same frame carries Vistralo's caption and callout.

**Copy:**
- H2: "Same frame. Different eyes."
- Left caption, labelled "Generic AI narration": "This section features a clean, modern design with a clear call-to-action button."
- Right caption, labelled "Vistralo": "The price sits 24 pixels under the plan name and is the only saturated element in view. The eye lands on it second."
- Under the Stage, three chips (24 px badges, neutral): "Names real sections" · "Measures spacing and timing" · "Explains why it converts".
- One line of support (18/28): "Vistralo is trained on the craft rules that top design educators and conversion teams use." (This claim needs substantiation before launch. See section 12.)

**Motion:** the wipe position equals p. At p > 0.9 the whole frame is the Vistralo version and the chips rise in with a 40 ms stagger.
**Assets:** frame 0060 at 2x; the two caption strings.
**Kill criteria:** the right-hand caption must be a real generated line for that frame. Never hand-write it.

### Scene 4: The walkthrough becomes a brief
**Customer question:** "What do I actually receive?"
**Pinned scroll:** 400 to 540 vh. **Frames:** 24 (Golden Capture 0:55 to 1:03, the brief opening).

**On screen:** the video frame shrinks to the top of a document. Beneath it the real Visual brief assembles: the section list (Structure, Type, Colour, Motion, Components), extracted tokens (swatches with hex values, the type scale, the spacing scale), a reference grid of captured moments (thumbnails with timecodes), and the component inventory. This is a capture of the product's brief view, not a designed illustration.

**Copy:**
- H2: "The brief writes itself. You edit it."
- Support: "Every observation becomes a section your team can act on. Tokens are extracted, not guessed."
- Caption (one at a time, scrubbed): "Structure · 5 sections", "Type scale · 7 steps", "Colour · 6 tokens", "Motion · 4 rules", "14 references, each with a timecode".

**Motion:** frames advance with p. Where the product's own entrance animation exists in the capture, use it. Do not add extra motion on top of the capture.
**Assets:** frames 0084 to 0107; a 2x still of the full brief page for the reduced-motion version.
**Kill criteria:** the brief view must exist in the product with real extracted tokens. If token extraction is not shipped, cut the token caption and show only the sections and references.

### Scene 5: Your agent builds it
**Customer question:** "Does it actually build the thing, and how close is it?"
**Pinned scroll:** 540 to 720 vh. **Frames:** 48 (Golden Capture 1:05 to 1:20 for the build, plus a held compare frame).

**On screen, part A (p 0 to 0.5):** the brief slides to the left third. The right two-thirds becomes the Build view: the agent's stream on top (real output, real file names), a live preview beneath it rendering the rebuilt page as files land. Use whichever surface ships: Vistralo's own Build view, or the supported IDE integration recorded on screen.

**On screen, part B (p 0.5 to 1.0):** the Stage becomes a split comparison. Left: the original recording. Right: the rebuilt page at the same scroll position. A vertical divider with a handle. Its position is scrubbed by p from 0.15 to 0.85, and it is also draggable by pointer and keyboard (arrow keys, 2% steps).

**Copy:**
- H2: "Hand it to your agent. Get the build back."
- Support: "Structure and motion are rebuilt from the brief. Content and brand are yours."
- Caption over the compare: left "Original recording", right "Rebuilt from the brief".
- Under the Stage: "Works with [supported agents]." Only real names.

**Motion:** frames for part A scrub linearly. In part B the divider tracks p; when the user drags, the drag wins and scroll stops moving it until the next scene.
**Assets:** frames 0108 to 0155; compare pair at 2x (original and rebuild rendered at identical scroll offsets); agent stream capture.
**Kill criteria:** the rebuild shown must be the real output of the real brief, unedited except for the customer's content. If the agent's output needed manual fixes to look right, do not show it until it does not.

### Scene 6: Make it yours
**Customer question:** "Will my site look like a copy of someone else's?"
**Pinned scroll:** 720 to 820 vh. **Frames:** 24 (Golden Capture 1:22 to 1:30).

**On screen:** the rebuilt page fills the Stage. Token swatches in a small panel change to the customer's brand; the page repaints (colour, logo, headline text). The Stage then unpins and the rebuilt page scrolls out of the story into the normal page flow.

**Copy:**
- H2: "Your content. Your brand. Their craft."
- Caption: "Swap the tokens and the copy. Keep the structure and the motion."

**Motion:** frames scrub with p. At p = 1 the pin releases with no jump: the Stage's final frame and the next section share the same scroll position.
**Assets:** frames 0156 to 0179.
**Kill criteria:** if the rebrand step is not a real product feature, cut the scene and end the story on the compare view.

### Scene 7: Share it, review it, ship it
**Customer question:** "How does my team work with this?"
**Not pinned.** Normal flow, three real screenshots in a row, each with a two-line caption.
1. The dashboard grid with Draft, Ready and Analyzing states.
2. The Share dialog with access states (Only you · Workspace · Anyone with the link).
3. A brief with a comment thread.

**Copy:** H2: "Made for the whole team." Captions: "Every project shows its state." · "Share with the people who need it." · "Comment on the brief, not in a chat."
**Motion:** entrance only: fade and 8 px rise over 200 ms, 60 ms stagger, triggered once at 30% visibility. Nothing scrubs.
**Kill criteria:** show only the features that ship at launch. Two screenshots are fine. One is not a section; fold it into the FAQ.

### Scene 8: Proof
**Customer question:** "Who else uses this, and did it work?"
**Not pinned.** Three real testimonials (name, role, company, photo with permission) and up to two measured numbers with their measurement method in a tooltip ("Median time from recording to first build, 240 sessions, August 2026").
**Copy:** H2: "Teams that started from a reference."
**Kill criteria:** no permitted logos and no measured numbers and fewer than two real testimonials means this section does not exist. Never "Trusted by 120,000+".

### Scene 9: Pricing
**Customer question:** "How much, and what is included?"
**Not pinned.** Two or three plan cards with the same anatomy: name, price with billing period, six inclusion lines, one button. Monthly/annual toggle if annual exists. No countdown, no struck price, no "most popular" unless it is measured.
**Copy:** H2: "Simple pricing." Plans and prices are placeholders until section 12 is resolved.

### Scene 10: FAQ
**Customer question:** the objections we know about.
Six items, accordion, one open at a time, full keyboard support.
1. "Which websites can I record?" Any site you can open in a browser. You are responsible for having the right to use a site as a reference. Vistralo rebuilds structure and motion; it never copies content.
2. "Is it legal to rebuild a site I admire?" Layout patterns and interaction behaviour are generally not protected. Copy, images, logos and distinctive brand elements are. The brief separates the two, and the build uses your content. Check with your own counsel for your case.
3. "Do I need to code?" No. The brief is readable by anyone. The build step needs a coding agent (list the supported ones) and a place to run it.
4. "What does the agent get?" The brief as structured files, the extracted tokens, and the reference frames with timecodes.
5. "Who can see my recordings?" Only the people you share them with. Recordings are private by default. (Link the privacy page.)
6. "Can I edit the brief?" Yes. Every section, token and reference is editable before the build.

### Scene 11: Closing call and footer
**Copy:** H2: "Start with a site you love." Button: "Start free". Support: "Free plan includes [real limits]."
**Footer:** four columns (Product, Resources, Company, Legal), social links, copyright. No taglines. The brand appears once, as the wordmark.

---

## 5. The Stage: technical design

- One DOM element, `#stage`, 16:10, max 1280 × 800 on desktop, pinned with GSAP ScrollTrigger (`pin: true, scrub: 0.6`) for scenes 1 to 6. Total pinned distance 820 vh on desktop.
- Layers inside the Stage, all absolutely positioned and sized to the Stage:
  1. `canvas.frames`: the scrubbed image sequence, drawn with `drawImage` from decoded `ImageBitmap`s.
  2. `svg.callouts`: brackets, leaders and labels. Drawn in Stage coordinates so they scale with it.
  3. `div.captions`: the caption strip. Real text in the DOM, one `<p>` per line, only the active one visible (`hidden` attribute on the rest).
  4. `div.compare`: the split view for scene 5, with an `<input type="range">` as the accessible divider control.
  5. `div.chrome`: the dashboard chrome of scene 1 (a real screenshot, not a rebuilt UI), which recedes.
- Transitions between layers use `opacity`, `transform` and `clip-path` only. Never animate `width`, `height`, `top` or `left`.
- The Stage has `role="img"` while scrubbing and an `aria-label` per scene ("Scene 2 of 6: narrated walkthrough of the reference site's hero"). The narration and callout text also exists as ordinary text after the Stage for screen readers and for search engines (`.story-transcript`, visually hidden, not `display:none`).
- Frame timing: the scroll progress maps to a frame index with `Math.round`. Draw only when the index changes. Use `requestAnimationFrame`, never `scroll` handlers.

---

## 6. Design system for the marketing site

Inherit the dashboard tokens unchanged. The additions below are the only marketing-specific values.

### 6.1 Colour (dark-first, same tokens as the product)
- Surfaces: `--bg-page #0B0D12`, `--bg-card #181C25`, `--bg-elevated #20242F`.
- Text: `--fg-1 #F4F5F8`, `--fg-2 #B9BDC8`, `--fg-3 #8E93A3` (the floor for any text that carries information).
- Strokes: `--stroke-divider #2E313C`, `--stroke-card rgba(255,255,255,0.08)`.
- Accent: `--accent #4B52CF`, `--accent-hover #5A61D8`, `--accent-pressed #3F46B8`, `--accent-soft #A8ADFD`. Focus ring `#8B8FFF`.
- Callouts on the Stage use `--accent-soft` on a `rgba(11,13,18,0.72)` label plate so they read on any frame.
- One permitted atmosphere: a single radial light behind the Stage, `--accent` at 6% opacity, 1200 px radius, static. No grain, no beam, no gradient text.
- Light theme is supported for the docs and legal pages; the home page ships dark-first and must still pass contrast if the OS forces light. Provide the light tokens from the dashboard brief.

### 6.2 Type
One family: Inter (fallback: Segoe UI Variable, system-ui). Tabular numerals everywhere numbers appear.
- Display (H1): 64/68, -0.02 em, semibold. 48/52 on tablet, 36/40 on mobile.
- H2: 44/50, -0.015 em, semibold. 32/38 mobile.
- H3: 28/36, semibold.
- Body-L: 20/30 regular (subheads). 18/28 mobile.
- Body: 16/24.
- Caption: 14/20 (labels, captions under screenshots). Never smaller than 13 px anywhere; the Stage caption strip is 18/26.
- Mono: JetBrains Mono 13/18 for timecodes and measurement chips only.
- Line length 60 ch maximum. Headings use `text-wrap: balance`. No hard line breaks in strings.

### 6.3 Spacing and layout
- 4 px base. Section padding: 128 px desktop, 96 px tablet, 64 px mobile.
- Container: 1200 px max, 24 px side gutters (16 px mobile).
- Stage: 16:10, 1280 × 800 max, centred. Hero splits 40/60 at 1200 px and stacks below 900 px.
- Radii: 8 controls and thumbnails, 12 cards, 16 the Stage. Pill for badges.

### 6.4 Components
Reuse product components wherever they exist so the site speaks the product's language: Button (primary 40 px, secondary, ghost), Badge, Card. New for marketing: Nav, Stage, CaptionStrip, Callout, CompareSlider, BriefCard, PlanCard, FAQItem, Footer. Each new component ships with hover, focus-visible, active and reduced-motion states documented in Storybook.

### 6.5 Icons
Fluent System Icons Regular, 20 px in buttons, 16 px inline. Open-in-new appears only on links that leave the site.

### 6.6 Mobile
- The Stage becomes 9:16 at 100% width, max 420 × 746. Frames are a separate mobile sequence reframed from the desktop capture (section 8.4).
- Pinned distance halves (410 vh). One callout per scene. Captions 16/24.
- Scene 3's wipe becomes a tap toggle ("Generic" / "Vistralo"). Scene 5's compare becomes stacked before/after with a tap toggle and a swipeable divider.
- The hero stacks: headline, subhead, buttons, then the Stage.

---

## 7. Motion system

- Easing: `cubic-bezier(0.2, 0, 0, 1)` for every timed animation. Linear for scrubbed mappings.
- Timed durations: hover and press 120 to 150 ms; entrances 160 to 240 ms; caption crossfade 200 ms; stagger 30 to 60 ms, capped at 8 items.
- Scrubbed motion: `scrub: 0.6` smoothing on ScrollTrigger so fast scrolls do not skip frames visibly. Frame index rounding, never interpolation between frames.
- Library: GSAP 3 with ScrollTrigger (pin, scrub, snap disabled). Native CSS scroll-driven animations may replace GSAP for the unpinned entrances. No Lenis or any smooth-scroll library.
- Hysteresis: every threshold that toggles a caption or callout has 0.03 of progress hysteresis so nothing flickers at the boundary.
- Reduced motion: `prefers-reduced-motion: reduce` disables pinning and scrubbing. Each scene renders as a static composition (poster frame + callouts + caption) stacked in order, with 96 px between scenes. Entrances become instant. The compare slider remains draggable.
- A visible "Pause motion" control is not needed because nothing moves on its own; the "Skip story" control covers impatience.
- Banned: autoplay loops, marquees, rotating text, countdowns, blur filters on text, scroll-linked parallax on text, tilt or sway effects, grain, glow, glass, and anything that keeps moving after the user stops scrolling.

---

## 8. Asset production

### 8.1 The Golden Capture
One continuous 90-second session in the shipped product, recorded once and used for every frame on the page so lighting, cursor and content stay consistent.

| Timecode | What happens in the product | Used by |
|---|---|---|
| 0:00 to 0:09 | Dashboard open; user starts "Record screen"; capture frame appears with the reference site; recording pill counts | Scene 1 |
| 0:09 to 0:24 | Browsing the reference site: nav, hero, feature cards, pricing | Scene 2 |
| 0:19 | Pricing section fully in view (held frame) | Scene 3 |
| 0:24 to 0:40 | Stop recording; "Analyzing" state; narrated walkthrough plays with callouts | Scene 2 modal video |
| 0:55 to 1:03 | Brief opens; sections, tokens and references assemble | Scene 4 |
| 1:05 to 1:20 | Build view; agent stream; preview renders | Scene 5A |
| 1:20 | Original and rebuild side by side at the same scroll offset | Scene 5B |
| 1:22 to 1:30 | Rebrand: tokens and copy swapped; page repaints | Scene 6 |

Capture spec: 1440 × 900 logical viewport at 2× (2880 × 1800), 60 fps, ProRes 422 or H.264 at 50 Mbps, cursor smoothing on, no click ripples, no zoom effects. Tools: Screen Studio or OBS. Product state: real demo workspace, fictitious reference site we own, no personal data.

### 8.2 The reference site used in the demo
Build and host a fictitious but realistic SaaS marketing site (working name: Fernhill Goods, a storefront tool). It must have a sticky nav, a one-message hero, a staggered feature row and a pricing table, so the narration lines in scene 2 are true of it. We own it, so there is no licensing question. It must not resemble any real brand.

### 8.3 Frame extraction and encoding
- Extract frames with ffmpeg at the timecodes above. Desktop: 180 frames total (36 + 48 + 1 + 24 + 48 + 24 minus shared frames). Name them `stage-d-0000.avif` and up.
- Encode AVIF at quality 55 (target 30 to 45 KB per desktop frame) with WebP fallback at quality 80. Total desktop sequence budget: 8 MB. Mobile sequence: 720 × 1280, target 20 KB per frame, 4 MB.
- Load in chunks: frames 0 to 23 with the page (the hero), the rest on `requestIdleCallback` or when the story enters the viewport, whichever is first. Show the poster until frame 0 is decoded.
- Stills for reduced motion and for Open Graph: 2× PNG or AVIF of frames 0000, 0060, 0107, 0155, 0179, and the full brief page.

### 8.4 Higgsfield pipeline
Rezan's Higgsfield account handles every visual transform that is not a raw capture. The Higgsfield connector in this workspace needs to be authorized before these steps can run from here; until then, run them in the Higgsfield app. Tools by name:
- `upscale_video` on any capture below 2×, before frame extraction. Never upscale after AVIF encoding.
- `reframe` to produce the 9:16 mobile sequence from the desktop capture, anchored on the cursor path so the callouts stay in frame.
- `generate_image` for exactly three non-product visuals: the Open Graph card backplate (1200 × 630, dark, no text baked in), the radial stage light (a soft, single-colour asset if CSS cannot match it), and the FAQ section's empty divider art if design wants one. Nothing else on the page is generated.
- `generate_audio` with `create_voice` only if the product's own narration voice is the same pipeline. If the product ships a different voice, the demo uses the product's voice, not a Higgsfield voice, or the demo is misleading.
- `video_analysis_create` on the Golden Capture to flag cursor jitter, dropped frames and hitches before extraction.
- `virality_predictor` on the 60-second narrated video before it is cut for social. Optional.
- Do not use presets that add grain, glow, lens flares, light leaks or camera shake. Every transform is checked against section 2.3.

### 8.5 Naming and delivery
`/public/story/stage-d-0000.avif` (desktop), `/public/story/stage-m-0000.avif` (mobile), `/public/story/poster-d.avif`, `/public/story/narration-60s.mp4` + `.webm` + `.vtt`, `/public/story/compare-original.avif` + `compare-rebuild.avif`, `/public/og/home.png`. A `story.json` lists every scene's frame range, thresholds and captions so copy edits do not touch code.

---

## 9. Copy deck

Voice: sentence case, verbs first, no slogans, no exclamation marks, concrete nouns. Numbers are real or absent.

- Title tag: "Vistralo: from a website you admire to a brief your team can build"
- Meta description: "Record any website. Vistralo explains its design decisions, writes the brief, and hands your coding agent the build. Start free."
- Nav: How it works · Pricing · Docs · Log in · Start free
- Scene copy: see section 4 for every string.
- Buttons: "Start free", "See how it works", "Listen", "Skip story", "Compare", "Show generic", "Show Vistralo", "Choose plan", "Read the docs".
- Empty and error strings for the page's own forms (newsletter or contact, if any): "Enter an email address like name@company.com." · "Thanks. Check your inbox."
- Footer: Product (How it works, Pricing, Changelog, Status) · Resources (Docs, Guides, Support) · Company (About, Careers, Contact) · Legal (Privacy, Terms, Security). "© 2026 Vistralo".

---

## 10. Technical architecture

- Framework: Next.js (App Router) with static generation, or Astro with a React island for the Stage. Either is fine; pick what the product team already runs.
- Story engine: one `Story` component that reads `story.json`, creates the ScrollTrigger timeline, owns the frame loader and the canvas. Scenes are data, not components.
- Frame loader: fetch AVIF chunks, decode with `createImageBitmap`, keep decoded frames in memory (≤ 180 × ~3 MB is too much at full size; decode at Stage size, not source size, using `resizeWidth`).
- Progressive enhancement: with JavaScript off, the page renders the poster, the six scene stills and all copy in order.
- Analytics: `story_scene_reached {scene}`, `story_skipped {scene}`, `narration_played`, `compare_dragged`, `cta_clicked {location}`, `pricing_viewed`, `faq_opened {question}`.
- i18n: all strings in `story.json` and a messages file; no text in images; layouts tolerate 40% expansion.
- Hosting: static assets on a CDN with immutable cache headers; frames served with `Accept` negotiation for AVIF/WebP.

---

## 11. Quality gates

| Gate | Target | How it is checked |
|---|---|---|
| LCP | ≤ 2.5 s on Moto G-class device, 4G | Lighthouse CI, WebPageTest |
| CLS | < 0.05 | Lighthouse CI |
| INP | < 200 ms during the story | Chrome DevTools, field data after launch |
| JS | ≤ 150 KB gzipped on the home route | bundle analyzer in CI |
| Frames | ≤ 8 MB desktop, ≤ 4 MB mobile, lazy after the hero | asset budget script in CI |
| Accessibility | WCAG 2.2 AA, axe with zero violations, Lighthouse a11y ≥ 95 | axe in CI, manual screen-reader pass (NVDA and VoiceOver) |
| Keyboard | Every control reachable; Skip story works; compare divider moves with arrow keys | manual |
| Reduced motion | Story renders as stills, argument still complete | screenshot test with the media query forced |
| Viewports | 390 × 844, 768 × 1024, 1280 × 720, 1440 × 900, 1920 × 1080 | screenshot tests |
| Content | No mock-ups, no third-party brands, every caption is real output | manual review against the Golden Capture |
| Copy | No string under 13 px, no slogans, no invented numbers | lint rule + editorial review |

---

## 12. Decisions needed before build

1. **Legal wording.** "Rebuild" versus "clone". Recommendation: never use "clone" in marketing. Counsel to review scene 5 and FAQ item 2.
2. **The demo reference site.** Confirm we build and host Fernhill Goods (or another site we own). Confirm no real third-party site appears anywhere on the page.
3. **Third-party names.** The line "trained on the craft rules that top design educators and conversion teams use" must be substantiated or removed. Do not name Meng To, DesignCode, Impeccable or any other person or product without written permission.
4. **Which agents and IDEs are supported at launch.** Only those names appear in the hero footnote, scene 5 and the FAQ.
5. **Narration voice.** Confirm the product's own voice pipeline. Section 8.4 explains why a different Higgsfield voice would be misleading.
6. **Proof.** Which testimonials, logos and measured numbers exist with permission. If none, scene 8 is cut and pricing follows scene 7.
7. **Pricing.** Plans, prices, billing periods and free-plan limits.
8. **Rebrand feature.** Confirm scene 6 is a shipped feature; otherwise the story ends on the compare view.
9. **Higgsfield authorization.** Authorize the connector in this workspace so the pipeline in 8.4 can run from here, or run it in the app.

---

## 13. Definition of done

- The six pinned scenes run from the Golden Capture with no mock-ups and no cuts, on desktop and mobile, at 60 fps on a 2020 MacBook Air and without dropped frames longer than 50 ms on a mid-range Android.
- A visitor who reads only the headlines and captions can restate the three beliefs in section 1.
- Every section on the page answers its written customer question with real evidence, and every section that failed its kill criteria is absent.
- The story has a working Skip control, a complete transcript for screen readers, and a reduced-motion version that still makes the argument.
- All quality gates in section 11 pass in CI and in one manual pass.
- Baseline metrics are recorded in the first two weeks: trial starts per 1,000 visitors, scene 6 reach rate, narration plays, compare drags. Targets are set after the baseline, not before.
