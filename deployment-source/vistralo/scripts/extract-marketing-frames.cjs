#!/usr/bin/env node
'use strict';

// Raw frame extraction only. This script neither creates nor approves product
// evidence, performs reframing/upscaling, nor contacts a media provider.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RANGES = Object.freeze([
  { scene: 'capture', first: 0, last: 35, start: 0, end: 9 },
  { scene: 'observe', first: 36, last: 83, start: 9, end: 24 },
  { scene: 'brief', first: 84, last: 107, start: 55, end: 63 },
  { scene: 'build', first: 108, last: 155, start: 65, end: 80 },
  { scene: 'brand', first: 156, last: 179, start: 82, end: 90 },
]);
const HELD_FRAME = 68;
const POSTERS = Object.freeze({ capture: 0, observe: 60, judgment: HELD_FRAME, brief: 107, build: 155, brand: 179 });
const BUDGETS = Object.freeze({ desktop: 8_000_000, mobile: 4_000_000 });

function parseArgs(argv) {
  const args = { out: path.join(ROOT, 'marketing/public/story'), avifCrf: 28, inspect: false };
  const names = new Map([['--capture', 'capture'], ['--mobile', 'mobile'], ['--out', 'out'], ['--mobile-approval', 'mobileApproval'], ['--avif-crf', 'avifCrf']]);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') { args.help = true; continue; }
    if (flag === '--inspect') { args.inspect = true; continue; }
    const key = names.get(flag);
    if (!key || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error(`Unknown option or missing value: ${flag}`);
    if (Object.hasOwn(args, key) && !['out', 'avifCrf'].includes(key)) throw Error(`Duplicate option: ${flag}`);
    args[key] = argv[++i];
  }
  args.avifCrf = Number(args.avifCrf);
  if (!Number.isInteger(args.avifCrf) || args.avifCrf < 0 || args.avifCrf > 63) throw Error('--avif-crf must be an integer from 0 to 63.');
  return args;
}

function noSymlinks(filePath) {
  if (!path.isAbsolute(filePath)) throw Error('All input/output paths must be absolute.');
  const normalized = path.resolve(filePath);
  const parsed = path.parse(normalized);
  let current = parsed.root;
  for (const part of normalized.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw Error(`Symlink paths are not accepted: ${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return normalized;
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function inputFile(value, label) {
  if (typeof value !== 'string') throw Error(`${label} requires an absolute path to an existing file.`);
  const result = noSymlinks(value);
  const stat = fs.statSync(result);
  if (!stat.isFile() || stat.size === 0) throw Error(`${label} must be a nonempty regular file.`);
  return result;
}

async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function run(binary, args) {
  // Argument arrays with shell:false preserve spaces and shell metacharacters.
  try {
    return execFileSync(binary, args, { encoding: 'utf8', shell: false, timeout: 120_000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim().slice(-1600) : error.message;
    throw Error(`${binary} failed: ${detail}`);
  }
}

function rational(value) {
  const [numerator, denominator = '1'] = String(value).split('/');
  return Number(numerator) / Number(denominator);
}

function inspectVideo(file, device) {
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,r_frame_rate,duration,sample_aspect_ratio:stream_tags=rotate:stream_side_data=rotation:format=duration', '-of', 'json', file]));
  const video = probe.streams?.[0];
  if (!video) throw Error(`${device}: source has no video stream.`);
  const duration = Number(video.duration || probe.format?.duration);
  const fps = rational(video.avg_frame_rate);
  const nominalFps = rational(video.r_frame_rate);
  const rotation = Number(video.tags?.rotate || video.side_data_list?.find((item) => item.rotation != null)?.rotation || 0);
  if (!Number.isFinite(duration) || duration < 90 - 1 / 60 || duration > 90.5) throw Error(`${device}: expected a continuous 90-second master (one-frame early/0.5-second late tolerance); found ${duration}s.`);
  const minimumFps = device === 'desktop' ? 59.9 : 23.9;
  if (!Number.isFinite(fps) || fps < minimumFps || fps > 60.1 || !Number.isFinite(nominalFps) || nominalFps < minimumFps || nominalFps > 60.1 || Math.abs(fps - nominalFps) > 0.1) throw Error(`${device}: expected ${device === 'desktop' ? '60' : '24–60'} fps, found average ${fps}, nominal ${nominalFps}. Do not fabricate frames.`);
  if (rotation % 360 !== 0) throw Error(`${device}: source rotation must already be baked into the approved master.`);
  if (video.sample_aspect_ratio && !['1:1', 'N/A'].includes(video.sample_aspect_ratio)) throw Error(`${device}: only square-pixel sources are accepted.`);
  const [minimumWidth, minimumHeight] = device === 'desktop' ? [2880, 1800] : [720, 1280];
  if (video.width < minimumWidth || video.height < minimumHeight) throw Error(`${device}: source is ${video.width}×${video.height}; requires at least ${minimumWidth}×${minimumHeight}. Obtain a separately approved master; extraction never upscales.`);
  if (video.width * minimumHeight !== video.height * minimumWidth) throw Error(`${device}: wrong aspect ratio. Extraction never crops, pads, or reframes.`);
  return { codec: video.codec_name, width: video.width, height: video.height, duration, fps, nominalFps };
}

function framePlan(manifest) {
  if (manifest.frames?.count !== 180 || !Array.isArray(manifest.scenes)) throw Error('story.json must declare 180 frames and its scenes.');
  const frames = [];
  for (const range of RANGES) {
    const scene = manifest.scenes.find((item) => item.id === range.scene);
    if (!scene || scene.range?.[0] !== range.first || scene.range?.[1] !== range.last) throw Error(`story.json ${range.scene} range differs from the Golden Capture map.`);
    const count = range.last - range.first + 1;
    for (let index = range.first; index <= range.last; index++) {
      // Half-open intervals avoid the nonexistent frame at exactly 90s EOF.
      const timestamp = range.start + (index - range.first) * (range.end - range.start) / count;
      frames.push({ index, scene: range.scene, timestamp: Number(timestamp.toFixed(6)) });
    }
  }
  const judgment = manifest.scenes.find((item) => item.id === 'judgment');
  if (!judgment || judgment.range?.[0] !== HELD_FRAME || judgment.range?.[1] !== HELD_FRAME) throw Error('story.json judgment must reuse frame 68 at 19.000s. Frame 60 is 16.500s with this sequence; it is not the requested held pricing frame.');
  for (const [device, code, width, height] of [['desktop', 'd', 1280, 800], ['mobile', 'm', 720, 1280]]) {
    const spec = manifest.frames[device];
    if (spec?.width !== width || spec?.height !== height || spec.template !== `/story/stage-${code}-{frame}.avif` || spec.fallback !== `/story/stage-${code}-{frame}.webp`) throw Error(`story.json ${device} frame contract differs from the extraction filenames or dimensions.`);
  }
  return frames;
}

function verifyReframeReceipt(file, captureHash, mobileHash) {
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (receipt.method !== 'higgsfield-reframe' || receipt.captureSha256 !== captureHash || receipt.mobileSha256 !== mobileHash) throw Error('Mobile approval receipt must name higgsfield-reframe and match both master SHA-256 hashes.');
  if (typeof receipt.approvedBy !== 'string' || !receipt.approvedBy.trim() || typeof receipt.approvedAt !== 'string' || !Number.isFinite(Date.parse(receipt.approvedAt)) || Date.parse(receipt.approvedAt) > Date.now()) throw Error('Mobile approval receipt needs a named reviewer and a valid, nonfuture approvedAt timestamp.');
  return { method: receipt.method, approvalSupplied: true, approvalIndependentlyVerified: false };
}

function writeExclusive(file, content) {
  noSymlinks(file);
  fs.writeFileSync(file, content, { flag: 'wx' });
}

async function extract(args) {
  const capture = inputFile(args.capture, '--capture');
  const mobile = inputFile(args.mobile, '--mobile');
  const approval = inputFile(args.mobileApproval, '--mobile-approval');
  const out = noSymlinks(args.out);
  if (capture === mobile || (fs.statSync(capture).ino === fs.statSync(mobile).ino && fs.statSync(capture).dev === fs.statSync(mobile).dev)) throw Error('Desktop and mobile masters must be different files.');
  for (const file of [capture, mobile, approval]) if (inside(out, file) || inside(file, out)) throw Error('Output must not overlap either source master or the approval receipt.');
  if (fs.existsSync(out) && (!fs.statSync(out).isDirectory() || fs.readdirSync(out).length)) throw Error('Output must be absent or an empty directory. Existing assets are never overwritten.');
  const manifestPath = path.join(ROOT, 'marketing/story.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const frames = framePlan(manifest);
  const [captureHash, mobileHash, approvalHash, manifestHash] = await Promise.all([capture, mobile, approval, manifestPath].map(sha256));
  const inputs = {
    desktop: { sha256: captureHash, ...inspectVideo(capture, 'desktop') },
    mobile: { sha256: mobileHash, ...inspectVideo(mobile, 'mobile') },
  };
  if (Math.abs(inputs.desktop.duration - inputs.mobile.duration) > 1 / 30) throw Error('Mobile duration differs from desktop by more than one 30-fps frame; reframe must preserve timing.');
  const mobileApproval = { ...verifyReframeReceipt(approval, captureHash, mobileHash), receiptSha256: approvalHash };
  const encoders = run('ffmpeg', ['-hide_banner', '-encoders']);
  if (!/\blibaom-av1\b/.test(encoders) || !/\blibwebp\b/.test(encoders)) throw Error('ffmpeg needs libaom-av1 and libwebp encoders.');
  const receipt = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'validated-inputs',
    productApproved: false, rightsVerified: false, readyForPublication: false,
    storySha256: manifestHash, inputs, mobileApproval,
    tool: { ffmpeg: run('ffmpeg', ['-version']).split('\n')[0], ffprobe: run('ffprobe', ['-version']).split('\n')[0] },
    sampling: { interval: 'half-open', frames, heldJudgment: { index: HELD_FRAME, timestamp: 19 }, note: 'Frame 60 remains a 16.500-second observation still, never the held 19-second pricing frame.' },
    encoding: { avif: { encoder: 'libaom-av1', crf: args.avifCrf, quality55Approximation: args.avifCrf === 28, cpuUsed: 6 }, webp: { encoder: 'libwebp', quality: 80 }, pixelFormat: 'yuv420p', processConcurrency: 1, encoderThreads: 2, upscale: false },
    posters: {}, files: [], budgets: {},
    unverified: ['Product approval, capture rights, and source content truth.', 'Dropped frames, cursor jitter, and perceptual quality.', 'Narration/video/VTT, full brief page, real compare pair, and 2× editorial stills.'],
  };
  if (args.inspect) { console.log(JSON.stringify(receipt, null, 2)); return receipt; }
  fs.mkdirSync(out, { recursive: true });
  noSymlinks(out);
  const lock = path.join(out, '.extraction-in-progress');
  writeExclusive(lock, `${process.pid}\n`);
  try {
    for (const [device, code, source, width, height] of [['desktop', 'd', capture, 1280, 800], ['mobile', 'm', mobile, 720, 1280]]) {
      const sums = { avif: 0, webp: 0 };
      for (const frame of frames) {
        const name = `stage-${code}-${String(frame.index).padStart(4, '0')}`;
        const avif = path.join(out, `${name}.avif`);
        const webp = path.join(out, `${name}.webp`);
        noSymlinks(out); noSymlinks(avif); noSymlinks(webp);
        if (fs.existsSync(avif) || fs.existsSync(webp)) throw Error('An output appeared during extraction; refusing to overwrite.');
        const filter = `scale=${width}:${height}:flags=lanczos,setsar=1`;
        run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-ss', String(frame.timestamp), '-i', source,
          '-map', '0:v:0', '-frames:v', '1', '-vf', filter, '-an', '-sn', '-dn', '-c:v', 'libaom-av1', '-crf', String(args.avifCrf), '-b:v', '0', '-cpu-used', '6', '-still-picture', '1', '-threads', '2', '-pix_fmt', 'yuv420p', avif,
          '-map', '0:v:0', '-frames:v', '1', '-vf', filter, '-an', '-sn', '-dn', '-c:v', 'libwebp', '-q:v', '80', '-compression_level', '6', '-threads', '2', '-pix_fmt', 'yuv420p', webp]);
        for (const [codec, file] of [['avif', avif], ['webp', webp]]) {
          const size = fs.statSync(file).size;
          if (!size) throw Error(`Empty encoded asset: ${path.basename(file)}`);
          sums[codec] += size;
          receipt.files.push({ name: path.basename(file), device, index: frame.index, timestamp: frame.timestamp, codec, bytes: size, sha256: await sha256(file) });
        }
        if ((frame.index + 1) % 24 === 0 || frame.index === 179) console.log(`${device}: ${frame.index + 1}/180 frames`);
      }
      receipt.budgets[device] = Object.fromEntries(Object.entries(sums).map(([codec, bytes]) => [codec, { bytes, maximumBytes: BUDGETS[device], passed: bytes <= BUDGETS[device] }]));
      receipt.posters[device] = {};
      for (const [scene, index] of Object.entries(POSTERS)) {
        receipt.posters[device][scene] = {};
        for (const codec of ['avif', 'webp']) {
          const name = scene === 'capture' ? `poster-${code}.${codec}` : `poster-${scene}-${code}.${codec}`;
          const sourceFrame = path.join(out, `stage-${code}-${String(index).padStart(4, '0')}.${codec}`);
          const target = path.join(out, name);
          noSymlinks(target);
          fs.copyFileSync(sourceFrame, target, fs.constants.COPYFILE_EXCL);
          receipt.posters[device][scene][codec] = { name, index, timestamp: frames[index].timestamp, bytes: fs.statSync(target).size, sha256: await sha256(target) };
        }
      }
    }
    if (await sha256(capture) !== captureHash || await sha256(mobile) !== mobileHash) throw Error('A source master changed during extraction. Output is invalid.');
    if (await sha256(manifestPath) !== manifestHash) throw Error('story.json changed during extraction. Review the extraction plan before use.');
    receipt.status = Object.values(receipt.budgets).every((codecs) => Object.values(codecs).every((item) => item.passed)) ? 'extracted-within-byte-budgets' : 'extracted-over-byte-budget';
    writeExclusive(path.join(out, 'extraction-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    const budgetRows = Object.entries(receipt.budgets).flatMap(([device, codecs]) => Object.entries(codecs).map(([codec, value]) => `| ${device} | ${codec} | ${value.bytes} | ${value.maximumBytes} | ${value.passed ? 'Pass' : 'Fail'} |`)).join('\n');
    writeExclusive(path.join(out, 'README.md'), `# Golden Capture frame extraction\n\nExtraction result: ${receipt.status}. Product approval, capture rights, and publication readiness remain unverified. No story manifest was changed.\n\nDesktop SHA-256: \`${captureHash}\`\n\nMobile SHA-256: \`${mobileHash}\`\n\n180 frames per device and codec; masters preserved. One ffmpeg process at a time; two encoder threads. AVIF CRF ${args.avifCrf} is an encoder approximation, not an exact AVIF quality-55 setting. WebP quality is 80.\n\n| Device | Codec | Bytes | Budget | Result |\n| --- | --- | ---: | ---: | --- |\n${budgetRows}\n\nPosters are independent copies and excluded from sequence budgets. See extraction-receipt.json for their additional bytes, SHA-256 digests, and source timestamps. Held judgment is frame 0068 at 19.000s; frame 0060 is 16.500s.\n\nThese are Stage-size posters, not 2× editorial stills. The full brief page, compare pair, narrated video, captions, and real outputs still require separate approved capture. Review the frames for sharpness, correct content, mobile callout visibility, jitter, and timing before editing story.json. Never commit raw captures or this README as proof of product approval.\n`);
    fs.unlinkSync(lock);
    console.log(`Extraction complete: ${receipt.status}. Receipt: ${path.join(out, 'extraction-receipt.json')}`);
    if (receipt.status === 'extracted-over-byte-budget') process.exitCode = 2;
    return receipt;
  } catch (error) {
    // Keep partial output and the lock for diagnosis; never erase user files or
    // mistake a failed run for an approved asset set.
    try { writeExclusive(path.join(out, 'EXTRACTION-FAILED.txt'), 'Extraction did not complete. Do not publish this output. Re-run into a new empty directory after resolving the error.\n'); } catch {}
    throw error;
  }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node scripts/extract-marketing-frames.cjs --capture /absolute/golden.mov --mobile /absolute/approved-mobile.mov --mobile-approval /absolute/mobile-approval.json [--out /absolute/output] [--avif-crf 28] [--inspect]\n\n--inspect validates source metadata, hashes, reframe receipt, story mapping, and encoders without writing or encoding. See docs/MARKETING-ASSETS.md.');
      return;
    }
    return extract(args);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { parseArgs, framePlan, inspectVideo, noSymlinks, inside, RANGES, HELD_FRAME };
