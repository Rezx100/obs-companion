'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const baseline = require('../marketing/story.json');
const { validateEvidence } = require('../marketing/evidence.cjs');

const fresh = () => structuredClone(baseline);
const outputText = 'The nav is 56 pixels and stays put. The hero makes one promise and shows one action. Structure and references form the brief.';

function fixture(t, ids = ['capture']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vistralo-evidence-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const publicDir = path.join(root, 'public');
  fs.mkdirSync(path.join(publicDir, 'story'), { recursive: true });
  const put = (asset, contents = 'synthetic unit-test fixture, never marketing evidence') => {
    const output = path.join(publicDir, asset.slice(1));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, contents);
    return output;
  };
  const manifest = fresh();
  Object.assign(manifest.capture, { id: 'unit-test-capture', productRevision: 'unit-test-revision', rightsConfirmed: true, redesignedProductApproved: true, sha256: 'a'.repeat(64) });
  manifest.features.agents = ['Unit Test Agent'];
  manifest.features.rebrand = ids.includes('brand');
  Object.assign(manifest.narration, { mp4: '/story/narration.mp4', webm: '/story/narration.webm', vtt: '/story/narration.vtt', transcript: '/story/transcript.txt', approved: true });
  put(manifest.narration.mp4);
  put(manifest.narration.webm);
  put(manifest.narration.vtt, 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nThe nav is 56 pixels and stays put.\n');
  put(manifest.narration.transcript, outputText);
  Object.assign(manifest.compare, { original: '/story/original.avif', rebuilt: '/story/rebuilt.avif', uneditedAgentOutput: true });
  put(manifest.compare.original);
  put(manifest.compare.rebuilt);
  for (const scene of manifest.scenes.filter((candidate) => ids.includes(candidate.id))) {
    scene.enabled = true;
    scene.desktopPoster = `/story/${scene.id}-d.avif`;
    scene.mobilePoster = `/story/${scene.id}-m.avif`;
    put(scene.desktopPoster);
    put(scene.mobilePoster);
    Object.assign(scene.evidence, { captureId: manifest.capture.id, productRevision: manifest.capture.productRevision, approved: true, outputPath: `/story/${scene.id}-output.txt` });
    put(scene.evidence.outputPath, outputText);
    for (const key of Object.keys(scene.evidence.capabilities)) scene.evidence.capabilities[key] = key === 'supportedAgent' ? 'Unit Test Agent' : true;
    if (['observe', 'judgment'].includes(scene.id)) scene.captions = [{ text: 'The nav is 56 pixels and stays put.', start: 0.1, sourceText: 'The nav is 56 pixels and stays put.' }];
    for (let frame = scene.range[0]; frame <= scene.range[1]; frame++) {
      for (const device of ['desktop', 'mobile']) {
        for (const key of ['template', 'fallback']) put(manifest.frames[device][key].replace('{frame}', String(frame).padStart(4, '0')));
      }
    }
  }
  return { root, publicDir, manifest, put };
}

test('default preview cuts all unverified scenes and remains explicitly unready', (t) => {
  const { publicDir } = fixture(t, []);
  const result = validateEvidence(fresh(), publicDir);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ready, false);
  assert.match(result.warnings.join('\n'), /Golden Capture id is missing/);
  assert.match(result.warnings.join('\n'), /scene.brand is cut/);
  assert.equal(baseline.scenes.filter((scene) => scene.enabled).length, 0);
});

test('release refuses an empty preview rather than treating a successful build as launch readiness', (t) => {
  const { publicDir } = fixture(t, []);
  const result = validateEvidence(fresh(), publicDir, { release: true });
  assert.equal(result.ready, false);
  for (const id of ['observe', 'brief', 'build']) assert.match(result.errors.join('\n'), new RegExp(`Core scene ${id} is not ready`));
  assert.match(result.errors.join('\n'), /rights are unconfirmed/);
});

test('a structurally complete core story passes the release contract with optional scenes cut', (t) => {
  const { publicDir, manifest } = fixture(t, ['capture', 'observe', 'brief', 'build']);
  const result = validateEvidence(manifest, publicDir, { release: true });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ready, true);
  assert.match(result.warnings.join('\n'), /scene.brand is cut/);
  assert.match(result.warnings.join('\n'), /Pricing is omitted/);
});

test('release permits the narrated hero fallback when live capture is cut', (t) => {
  const { publicDir, manifest } = fixture(t, ['observe', 'brief', 'build']);
  const result = validateEvidence(manifest, publicDir, { release: true });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ready, true);
  assert.match(result.warnings.join('\n'), /scene.capture is cut/);
});

test('mobile callouts require a separately mapped rectangle inside the reframed capture', (t) => {
  const { publicDir, manifest } = fixture(t, ['observe', 'brief', 'build']);
  const scene = manifest.scenes.find((item) => item.id === 'observe');
  scene.callouts = [{ label: 'The nav is 56 pixels and stays put.', start: 0.1, x: 100, y: 50, width: 400, height: 56 }];
  let result = validateEvidence(manifest, publicDir);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ready, false);
  assert.match(result.warnings.join('\n'), /independently mapped mobile geometry/);
  assert.match(validateEvidence(manifest, publicDir, { release: true }).errors.join('\n'), /independently mapped mobile geometry/);
  scene.callouts[0].mobile = { x: 20, y: 40, width: 680, height: 56 };
  result = validateEvidence(manifest, publicDir, { release: true });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ready, true);
  for (const invalid of [{ x: 700, y: 0, width: 30, height: 10 }, { x: 0, y: 1270, width: 10, height: 30 }, { x: -1, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 100 }]) {
    scene.callouts[0].mobile = invalid;
    assert.match(validateEvidence(manifest, publicDir, { release: true }).errors.join('\n'), /positive rectangle inside the mobile frame dimensions/);
  }
});

test('enabled scenes must share approved source capture and product revision', (t) => {
  const { publicDir, manifest } = fixture(t);
  const capture = manifest.scenes[0];
  capture.evidence.productRevision = 'another-build';
  manifest.capture.redesignedProductApproved = false;
  let result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /approved provenance must match/);
  assert.match(result.errors.join('\n'), /redesigned product has not been approved/);
  capture.evidence.productRevision = manifest.capture.productRevision;
  manifest.capture.redesignedProductApproved = true;
  capture.evidence.capabilities.liveCapture = false;
  result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /liveCapture is unverified/);
});

test('unsafe URLs, traversal, encoded traversal and symlinks cannot escape public assets', (t) => {
  const { publicDir, root, manifest } = fixture(t);
  for (const unsafe of ['https://example.com/frame.avif', '//example.com/frame.avif', '/story/../secret.txt', '/story/%2e%2e/secret.txt', '/story/x.avif?x=1', '/story\\secret.txt', 'file:///tmp/frame']) {
    manifest.scenes[0].desktopPoster = unsafe;
    assert.match(validateEvidence(manifest, publicDir).errors.join('\n'), /safe local asset path|safe root-relative path/, unsafe);
  }
  const outside = path.join(root, 'secret.txt');
  fs.writeFileSync(outside, 'not a public asset');
  fs.symlinkSync(outside, path.join(publicDir, 'story', 'escape.avif'));
  manifest.scenes[0].desktopPoster = '/story/escape.avif';
  assert.match(validateEvidence(manifest, publicDir).errors.join('\n'), /symlink escapes public directory/);
  const disabled = fresh();
  disabled.narration.mp4 = 'https://example.com/narration.mp4';
  assert.match(validateEvidence(disabled, publicDir).errors.join('\n'), /narration.mp4 must be null or a safe/);
});

test('enabled scenes require both device posters and both sequence codecs', (t) => {
  const { publicDir, manifest } = fixture(t);
  fs.unlinkSync(path.join(publicDir, 'story/stage-m-0012.webp'));
  manifest.scenes[0].desktopPoster = null;
  const result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /desktopPoster: asset is required/);
  assert.match(result.errors.join('\n'), /frames.mobile.fallback\[12\]: asset does not exist/);
});

test('narration must include a real measured caption, transcript and WebVTT track', (t) => {
  const { publicDir, manifest, put } = fixture(t, ['observe']);
  const scene = manifest.scenes.find((item) => item.id === 'observe');
  scene.captions[0].text = 'The site looks beautiful and clean.';
  scene.captions[0].sourceText = 'The site looks beautiful and clean.';
  put(manifest.narration.vtt, 'not a subtitle track');
  let result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /verbatim excerpt of real output/);
  assert.match(result.errors.join('\n'), /real section measurement/);
  assert.match(result.errors.join('\n'), /must be a WebVTT caption track/);
  scene.captions[0] = { text: outputText, start: 0.1 };
  result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /at most 22 words/);
  scene.captions = [{ text: 'The nav is 56 pixels and stays put.', start: 1.2 }];
  assert.match(validateEvidence(manifest, publicDir).errors.join('\n'), /progress values within 0..1/);
});

test('brief token claims and build output are gated independently', (t) => {
  const { publicDir, manifest, put } = fixture(t, ['brief', 'build']);
  const brief = manifest.scenes.find((scene) => scene.id === 'brief');
  brief.evidence.capabilities.extractedTokens = false;
  brief.captions = [{ text: 'Colour tokens are extracted.', start: 0.2 }];
  put(brief.evidence.outputPath, 'Colour tokens are extracted.');
  manifest.compare.uneditedAgentOutput = false;
  manifest.features.agents = [];
  const result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /token claims require shipped token extraction/);
  assert.match(result.errors.join('\n'), /real unedited agent output/);
  assert.match(result.errors.join('\n'), /explicitly supported agent/);
});

test('budgets count unique frame assets once including the shared judgment frame', (t) => {
  const { publicDir, manifest } = fixture(t, ['observe', 'judgment']);
  const file = path.join(publicDir, 'story/stage-d-0068.avif');
  fs.truncateSync(file, 5 * 1024 * 1024);
  assert.deepEqual(validateEvidence(manifest, publicDir).errors, []);
  fs.truncateSync(file, 8 * 1024 * 1024 + 1);
  assert.match(validateEvidence(manifest, publicDir).errors.join('\n'), /frames.desktop.template: .*exceeds/);
  fs.truncateSync(file, 1);
  fs.truncateSync(path.join(publicDir, 'story/stage-m-0068.webp'), 4 * 1024 * 1024 + 1);
  assert.match(validateEvidence(manifest, publicDir).errors.join('\n'), /frames.mobile.fallback: .*exceeds/);
});

test('duplicated frame symlinks do not satisfy the unique-asset contract', (t) => {
  const { publicDir, manifest } = fixture(t);
  const first = path.join(publicDir, 'story/stage-d-0000.avif');
  const second = path.join(publicDir, 'story/stage-d-0001.avif');
  fs.unlinkSync(second);
  fs.symlinkSync(first, second);
  assert.match(validateEvidence(manifest, publicDir).errors.join('\n'), /every frame index needs its own asset/);
});

test('free claims require verified access and documented approved limits', (t) => {
  const { publicDir, manifest, put } = fixture(t, []);
  manifest.cta = { label: 'Start free', href: '/app', trialVerified: false };
  manifest.pricing.freeLimits = 'Unlimited recordings';
  let result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /verified trial flow/);
  assert.match(result.errors.join('\n'), /not a guessed string/);
  manifest.cta.trialVerified = true;
  manifest.pricing.approved = true;
  manifest.pricing.freeLimits = { description: 'One recording per month.', evidencePath: '/story/free-limits.txt' };
  put(manifest.pricing.freeLimits.evidencePath, 'One recording per month.');
  assert.deepEqual(validateEvidence(manifest, publicDir).errors, []);
  manifest.pricing.plans = [{ id: 'paid', name: 'Paid', amount: -20, currency: 'usd', period: 'forever', inclusions: ['One workspace'], href: '/app' }];
  result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /finite nonnegative amount, ISO currency, and valid billing period/);
});

test('malformed scene metadata is rejected instead of silently shifting the frame timeline', (t) => {
  const { publicDir } = fixture(t, []);
  const manifest = fresh();
  manifest.frames.count = 181;
  manifest.scenes[0].range = [0, 36];
  manifest.scenes[1].scrollVh = 100;
  manifest.scenes[2].evidence.capabilities.generatedCaption = 'yes';
  manifest.scenes.push(structuredClone(manifest.scenes[0]));
  const result = validateEvidence(manifest, publicDir);
  assert.match(result.errors.join('\n'), /180 unique source frames/);
  assert.match(result.errors.join('\n'), /range or scroll distance/);
  assert.match(result.errors.join('\n'), /generatedCaption has an invalid value/);
  assert.match(result.errors.join('\n'), /duplicate scene/);
  assert.equal(validateEvidence(null, publicDir).ready, false);
});
