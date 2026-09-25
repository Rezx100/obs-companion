'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCENES = Object.freeze({
  capture: { range: [0, 35], scrollVh: 140, capabilities: ['liveCapture'] },
  observe: { range: [36, 83], scrollVh: 160, capabilities: ['realMeasurements', 'realNarration'] },
  judgment: { range: [68, 68], scrollVh: 100, capabilities: ['generatedCaption'] },
  brief: { range: [84, 107], scrollVh: 140, capabilities: ['shippedBrief', 'extractedTokens'] },
  build: { range: [108, 155], scrollVh: 180, capabilities: ['supportedAgent', 'uneditedAgentOutput'] },
  brand: { range: [156, 179], scrollVh: 100, capabilities: ['shippedRebrand'] },
});
// The handoff permits the narrated walkthrough as the hero when live capture
// cannot be shown. Observe, brief, and build still carry the core promise.
const CORE_SCENES = ['observe', 'brief', 'build'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const isLocalPath = (value) => typeof value === 'string' && /^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(value)
  && value.split('/').every((part) => part !== '.' && part !== '..');
const isSafeLink = (value) => typeof value === 'string'
  && (/^#[a-zA-Z][\w-]*$/.test(value) || isLocalPath(value) || /^mailto:[\w.+-]+@[\w.-]+\.[a-z]{2,}(?:\?subject=[\w% .-]+)?$/i.test(value));

/**
 * Checks the publishable evidence contract. Preview tolerates absent, disabled
 * scenes. Enabling a claim always validates its assets and provenance; release
 * additionally requires the full core argument. This validates submitted proof,
 * not the truth of approvals: a human must review the actual Golden Capture.
 *
 * Captions: {text, start, end?, sourceText?}; start/end use scene progress 0..1.
 * Text must be a verbatim excerpt of the real transcript or scene output file.
 * Callouts: {label, start, end?, sourceText?, x?, y?, width?, height?, mobile?}.
 * Mobile reframing needs its own {x,y,width,height} in 720 × 1280 coordinates.
 * Plans: {id, name, amount, currency, period, inclusions, href}.
 * Free limits: {description, evidencePath}. A guess or bare string is invalid.
 */
function validateEvidence(manifest, publicDir, { release = false } = {}) {
  const errors = [];
  const warnings = [];
  const blockers = [];
  const error = (message) => errors.push(message);
  const missing = (message, required = false) => {
    blockers.push(message);
    (release || required ? errors : warnings).push(message);
  };
  const result = () => ({ errors: [...new Set(errors)], warnings: [...new Set(warnings)], ready: errors.length === 0 && blockers.length === 0 });
  if (!isObject(manifest)) { error('Manifest must be an object.'); return result(); }
  if (manifest.version !== 1) error('Manifest version must be 1.');
  if (typeof publicDir !== 'string' || !publicDir) { error('A public asset directory is required.'); return result(); }
  const publicRoot = path.resolve(publicDir);
  const rootReal = fs.existsSync(publicRoot) ? fs.realpathSync(publicRoot) : publicRoot;
  const checkedAssets = new Map();
  function asset(value, label, required = true) {
    if (value == null) { if (required) error(`${label}: asset is required.`); return null; }
    if (!isLocalPath(value)) { error(`${label}: asset must be a safe root-relative path without traversal, encoding, query, or remote URLs.`); return null; }
    const filePath = path.resolve(publicRoot, value.slice(1));
    if (checkedAssets.has(filePath)) return checkedAssets.get(filePath);
    let found = null;
    try {
      const real = fs.realpathSync(filePath);
      const relative = path.relative(rootReal, real);
      if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
        error(`${label}: asset symlink escapes public directory.`);
      } else {
        const stat = fs.statSync(real);
        if (!stat.isFile() || stat.size === 0) error(`${label}: asset must be a nonempty file.`);
        else found = { path: real, bytes: stat.size };
      }
    } catch { error(`${label}: asset does not exist: ${value}.`); }
    checkedAssets.set(filePath, found);
    return found;
  }
  function objectField(key) {
    if (!isObject(manifest[key])) { error(`${key} must be an object.`); return {}; }
    return manifest[key];
  }
  const capture = objectField('capture');
  const frames = objectField('frames');
  const narration = objectField('narration');
  const compare = objectField('compare');
  const features = objectField('features');
  const pricing = objectField('pricing');
  const cta = objectField('cta');
  const analytics = objectField('analytics');
  for (const [label, value] of Object.entries({ 'capture.rightsConfirmed': capture.rightsConfirmed, 'capture.redesignedProductApproved': capture.redesignedProductApproved, 'narration.approved': narration.approved, 'compare.uneditedAgentOutput': compare.uneditedAgentOutput, 'features.rebrand': features.rebrand, 'pricing.approved': pricing.approved, 'cta.trialVerified': cta.trialVerified })) {
    if (typeof value !== 'boolean') error(`${label} must be a boolean.`);
  }
  for (const [label, value] of Object.entries({ 'narration.mp4': narration.mp4, 'narration.webm': narration.webm, 'narration.vtt': narration.vtt, 'narration.transcript': narration.transcript, 'compare.original': compare.original, 'compare.rebuilt': compare.rebuilt })) {
    if (value != null && !isLocalPath(value)) error(`${label} must be null or a safe root-relative asset path.`);
  }
  for (const key of ['id', 'productRevision', 'sha256']) {
    if (capture[key] != null && !hasText(capture[key])) error(`capture.${key} must be null or a nonempty string.`);
  }
  if (capture.sha256 != null && !/^[a-f\d]{64}$/i.test(capture.sha256)) error('capture.sha256 must be a 64-character SHA-256 digest.');
  if (frames.count !== 180) error('frames.count must be 180 unique source frames.');
  for (const [device, size] of Object.entries({ desktop: [1280, 800], mobile: [720, 1280] })) {
    const spec = frames[device];
    if (!isObject(spec)) { error(`frames.${device} must be an object.`); continue; }
    if (spec.width !== size[0] || spec.height !== size[1]) error(`frames.${device} must declare ${size.join(' × ')} dimensions.`);
    for (const [field, ext] of [['template', 'avif'], ['fallback', 'webp']]) {
      if (typeof spec[field] !== 'string' || (spec[field].match(/\{frame\}/g) || []).length !== 1 || !isLocalPath(spec[field].replace('{frame}', '0000')) || !spec[field].endsWith(`.${ext}`)) {
        error(`frames.${device}.${field} requires one {frame} in a safe local .${ext} path.`);
      }
    }
  }
  if (!Array.isArray(features.agents) || features.agents.some((name) => !hasText(name)) || new Set(features.agents).size !== features.agents.length) error('features.agents must contain unique supported agent names.');
  if (!Array.isArray(features.team)) error('features.team must be an array.');
  else features.team.forEach((item, index) => {
    if (!isObject(item) || !hasText(item.title) || !hasText(item.caption) || item.approved !== true || item.captureId !== capture.id || item.productRevision !== capture.productRevision) error(`features.team[${index}] needs approved title, caption, and Golden Capture provenance.`);
    if (isObject(item)) asset(item.image, `features.team[${index}].image`);
  });
  if (analytics.endpoint != null && !isLocalPath(analytics.endpoint)) error('analytics.endpoint must be null or a same-origin root-relative path.');
  if (!hasText(cta.label) || !isSafeLink(cta.href)) error('cta needs a nonempty label and a safe local, anchor, or mailto href.');
  const trialClaim = /\b(free|trial)\b/i.test(`${cta.label || ''} ${cta.href || ''}`);
  if (trialClaim && cta.trialVerified !== true) error('A free or trial CTA requires a verified trial flow.');
  if (!Array.isArray(pricing.plans)) error('pricing.plans must be an array.');
  else if (pricing.plans.length) {
    if (pricing.approved !== true) error('Published pricing plans require approval.');
    const planIds = new Set();
    pricing.plans.forEach((plan, index) => {
      const label = `pricing.plans[${index}]`;
      if (!isObject(plan)) { error(`${label} must be an object.`); return; }
      if (!hasText(plan.id) || planIds.has(plan.id)) error(`${label} needs a unique id.`);
      planIds.add(plan.id);
      if (!hasText(plan.name) || !Number.isFinite(plan.amount) || plan.amount < 0 || !/^[A-Z]{3}$/.test(plan.currency || '') || !['month', 'year', 'once'].includes(plan.period)) error(`${label} needs a name, finite nonnegative amount, ISO currency, and valid billing period.`);
      if (!Array.isArray(plan.inclusions) || !plan.inclusions.length || plan.inclusions.some((line) => !hasText(line))) error(`${label}.inclusions must list real plan limits and features.`);
      if (!isSafeLink(plan.href)) error(`${label}.href must be a safe purchase or contact link.`);
      if (plan.amount === 0 && (cta.trialVerified !== true || !pricing.freeLimits)) error(`${label}: a free plan needs verified access and real free limits.`);
    });
  } else warnings.push('Pricing is omitted until approved plans exist.');
  if (pricing.freeLimits != null) {
    if (pricing.approved !== true || !isObject(pricing.freeLimits) || !hasText(pricing.freeLimits.description)) error('pricing.freeLimits requires approved documented limits, not a guessed string.');
    if (isObject(pricing.freeLimits)) {
      const proof = asset(pricing.freeLimits.evidencePath, 'pricing.freeLimits.evidencePath');
      if (proof && hasText(pricing.freeLimits.description) && !normalize(fs.readFileSync(proof.path, 'utf8')).includes(normalize(pricing.freeLimits.description))) error('pricing.freeLimits.description must appear in its evidence file.');
    }
  }
  if (trialClaim && !pricing.freeLimits) error('A free or trial CTA requires documented freeLimits.');
  if (!Array.isArray(manifest.scenes)) { error('scenes must be an array.'); return result(); }
  const seen = new Set();
  const enabled = [];
  for (const scene of manifest.scenes) {
    if (!isObject(scene) || !Object.hasOwn(SCENES, scene.id)) { error('Every scene must use a known scene id.'); continue; }
    const expected = SCENES[scene.id];
    const label = `scene.${scene.id}`;
    if (seen.has(scene.id)) error(`${label}: duplicate scene.`);
    seen.add(scene.id);
    if (!hasText(scene.title) || !hasText(scene.support)) error(`${label}: title and support are required.`);
    if (typeof scene.enabled !== 'boolean') error(`${label}.enabled must be a boolean.`);
    if (scene.scrollVh !== expected.scrollVh || !Array.isArray(scene.range) || scene.range.length !== 2 || scene.range.some((n, index) => n !== expected.range[index])) error(`${label}: range or scroll distance does not match the Golden Capture sequence.`);
    if (!Array.isArray(scene.captions) || !Array.isArray(scene.callouts)) error(`${label}: captions and callouts must be arrays.`);
    const evidence = isObject(scene.evidence) ? scene.evidence : {};
    if (!isObject(scene.evidence) || typeof evidence.approved !== 'boolean' || !isObject(evidence.capabilities)) error(`${label}: evidence needs an approval boolean and capabilities object.`);
    for (const key of ['captureId', 'productRevision', 'outputPath']) if (evidence[key] != null && !hasText(evidence[key])) error(`${label}.evidence.${key} must be null or a nonempty string.`);
    for (const key of expected.capabilities) {
      const value = evidence.capabilities?.[key];
      if (key === 'supportedAgent' ? value !== null && !hasText(value) : typeof value !== 'boolean') error(`${label}.evidence.capabilities.${key} has an invalid value.`);
    }
    // Even a disabled scene cannot store a future unsafe asset URL.
    for (const [key, value] of Object.entries({ desktopPoster: scene.desktopPoster, mobilePoster: scene.mobilePoster, outputPath: evidence.outputPath })) {
      if (value != null && !isLocalPath(value)) error(`${label}.${key} must be a safe local asset path.`);
    }
    if (scene.enabled === true) enabled.push(scene);
    else warnings.push(`${label} is cut until its real product evidence is approved.`);
  }
  for (const id of Object.keys(SCENES)) if (!seen.has(id)) error(`scene.${id} is missing from the manifest; retain it with enabled:false when cut.`);
  for (const id of CORE_SCENES) if (!enabled.some((scene) => scene.id === id)) missing(`Core scene ${id} is not ready.`);
  const hasEnabled = enabled.length > 0;
  for (const [okay, message] of [
    [hasText(capture.id), 'Golden Capture id is missing.'],
    [hasText(capture.productRevision), 'Golden Capture product revision is missing.'],
    [capture.rightsConfirmed === true, 'Golden Capture reference-site rights are unconfirmed.'],
    [capture.redesignedProductApproved === true, 'The redesigned product has not been approved for marketing.'],
    [/^[a-f\d]{64}$/i.test(capture.sha256 || ''), 'Golden Capture SHA-256 provenance is missing.'],
  ]) if (!okay) missing(message, hasEnabled);
  let transcript = '';
  const needsNarration = enabled.some((scene) => ['observe', 'judgment'].includes(scene.id));
  if (needsNarration) {
    if (narration.approved !== true) error('Narration must be approved real product output.');
    for (const key of ['mp4', 'webm', 'vtt', 'transcript']) {
      const proof = asset(narration[key], `narration.${key}`);
      if (proof && key === 'transcript') transcript = normalize(fs.readFileSync(proof.path, 'utf8'));
      if (proof && key === 'vtt' && !fs.readFileSync(proof.path, 'utf8').replace(/^\uFEFF/, '').startsWith('WEBVTT')) error('narration.vtt must be a WebVTT caption track.');
    }
  } else warnings.push('Narrated walkthrough video, captions, and transcript are not enabled.');
  const frameIndices = new Set();
  for (const scene of enabled) {
    const label = `scene.${scene.id}`;
    const evidence = scene.evidence || {};
    const capabilities = evidence.capabilities || {};
    if (evidence.approved !== true || !capture.id || evidence.captureId !== capture.id || !capture.productRevision || evidence.productRevision !== capture.productRevision) error(`${label}: approved provenance must match the Golden Capture and product revision.`);
    const output = asset(evidence.outputPath, `${label}.evidence.outputPath`);
    const source = `${transcript}\n${output ? normalize(fs.readFileSync(output.path, 'utf8')) : ''}`;
    asset(scene.desktopPoster, `${label}.desktopPoster`);
    asset(scene.mobilePoster, `${label}.mobilePoster`);
    for (const key of SCENES[scene.id].capabilities.filter((key) => !['extractedTokens', 'supportedAgent'].includes(key))) if (capabilities[key] !== true) error(`${label}: shipped capability ${key} is unverified.`);
    if (scene.id === 'brand' && features.rebrand !== true) error('scene.brand requires the shipped rebrand feature.');
    if (scene.id === 'build') {
      if (!hasText(capabilities.supportedAgent) || !Array.isArray(features.agents) || !features.agents.includes(capabilities.supportedAgent)) error('scene.build requires an explicitly supported agent.');
      if (compare.uneditedAgentOutput !== true) error('scene.build requires real unedited agent output.');
      const original = asset(compare.original, 'compare.original');
      const rebuilt = asset(compare.rebuilt, 'compare.rebuilt');
      if ((compare.original && compare.original === compare.rebuilt) || (original && rebuilt && original.path === rebuilt.path)) error('Compare original and rebuilt assets must be different files.');
    }
    const captions = Array.isArray(scene.captions) ? scene.captions : [];
    if (['observe', 'judgment'].includes(scene.id) && !captions.length) error(`${label}: real narration captions are required.`);
    function timing(item, itemLabel) {
      if (!Number.isFinite(item.start) || item.start < 0 || item.start > 1 || (item.end != null && (!Number.isFinite(item.end) || item.end <= item.start || item.end > 1))) error(`${itemLabel}: start/end must be ordered progress values within 0..1.`);
    }
    captions.forEach((caption, index) => {
      const itemLabel = `${label}.captions[${index}]`;
      if (!isObject(caption) || !hasText(caption.text)) { error(`${itemLabel}: caption text is required.`); return; }
      if (caption.text.trim().split(/\s+/).length > 22) error(`${itemLabel}: split the real line into captions of at most 22 words.`);
      timing(caption, itemLabel);
      const text = normalize(caption.text);
      if (!source.includes(text)) error(`${itemLabel}: text must be a verbatim excerpt of real output; do not write a replacement.`);
      if (caption.sourceText != null && (!hasText(caption.sourceText) || !normalize(caption.sourceText).includes(text) || !source.includes(normalize(caption.sourceText)))) error(`${itemLabel}.sourceText must match the captured product output.`);
      if (scene.id === 'brief' && /\b(tokens?|type scale|colour|color|swatches)\b/i.test(caption.text) && capabilities.extractedTokens !== true) error('scene.brief: token claims require shipped token extraction; cut the caption otherwise.');
    });
    if (scene.id === 'observe' && !captions.some((caption) => /\b\d+(?:\.\d+)?\s*(?:px|pixels?|ms|milliseconds?|seconds?|rem|em)\b/i.test(caption?.text || ''))) error('scene.observe needs a real section measurement in its narration captions.');
    const callouts = Array.isArray(scene.callouts) ? scene.callouts : [];
    if (callouts.length > 0 && !callouts.some((callout) => isObject(callout?.mobile))) missing(`${label}: mobile callouts need independently mapped mobile geometry for the reframed capture.`);
    for (const [index, callout] of callouts.entries()) {
      const itemLabel = `${label}.callouts[${index}]`;
      if (!isObject(callout) || !hasText(callout.label)) { error(`${itemLabel}: label is required.`); continue; }
      timing(callout, itemLabel);
      if (!source.includes(normalize(callout.sourceText || callout.label))) error(`${itemLabel}: label needs a source excerpt from the captured product output.`);
      for (const key of ['x', 'y', 'width', 'height']) if (callout[key] != null && (!Number.isFinite(callout[key]) || callout[key] < 0 || callout[key] > 1280)) error(`${itemLabel}.${key} is outside Stage coordinates.`);
      if (callout.mobile != null) {
        const box = callout.mobile;
        const mobileWidth = frames.mobile?.width;
        const mobileHeight = frames.mobile?.height;
        if (!isObject(box) || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(box[key])) || box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 || box.x + box.width > mobileWidth || box.y + box.height > mobileHeight) error(`${itemLabel}.mobile must contain a positive rectangle inside the mobile frame dimensions.`);
      }
    }
    const [start, end] = SCENES[scene.id].range;
    for (let frame = start; frame <= end; frame++) frameIndices.add(frame);
  }
  // Shared held frame 0068 contributes to each codec budget only once.
  for (const [device, budget] of Object.entries({ desktop: 8_000_000, mobile: 4_000_000 })) {
    for (const key of ['template', 'fallback']) {
      const template = frames[device]?.[key];
      if (typeof template !== 'string' || !template.includes('{frame}')) continue;
      let bytes = 0;
      const paths = new Set();
      for (const index of frameIndices) {
        const proof = asset(template.replace('{frame}', String(index).padStart(4, '0')), `frames.${device}.${key}[${index}]`);
        if (proof) {
          if (paths.has(proof.path)) error(`frames.${device}.${key}: every frame index needs its own asset.`);
          else { bytes += proof.bytes; paths.add(proof.path); }
        }
      }
      if (bytes > budget) error(`frames.${device}.${key}: ${bytes} bytes exceeds the ${budget}-byte sequence budget.`);
    }
  }
  return result();
}

module.exports = { validateEvidence, SCENES, CORE_SCENES };
