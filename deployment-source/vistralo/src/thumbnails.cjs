'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {assert, within, atomic, disk} = require('./core.cjs');
const {run} = require('./media.cjs');
const {selectedVideo, briefFile} = require('./workspace.cjs');
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[character]));

class Thumbnails {
  constructor(workspace) {this.workspace = workspace; this.pending = new Map();}
  async create(id) {
    this.workspace.requireLive(id);
    if (this.pending.has(id)) return this.pending.get(id);
    assert(this.pending.size < 2,'Preview generation is busy; try again shortly');
    this.workspace.editable(id);
    this.workspace.locks.add(id);
    const promise = this.generate(id).finally(() => {this.pending.delete(id); this.workspace.locks.delete(id);});
    this.pending.set(id, promise);
    return promise;
  }
  async generate(id) {
    const project = this.workspace.store.get(id), metadata = this.workspace.metadata(id), root = this.workspace.store.dir(id);
    const brief = metadata.type === 'brief' && briefFile(project);
    const source = brief || selectedVideo(project);
    assert(source, 'Add a recording or brief before generating a thumbnail');
    const input = within(root, source, true), stat = fs.statSync(input);
    disk(root,32 * 1024 ** 2);
    const key = crypto.createHash('sha256').update(source + ':' + stat.size + ':' + stat.mtimeMs + ':' + project.name + ':v2').digest('hex').slice(0, 20);
    if (metadata.thumbnail?.key === key && metadata.thumbnail.variants?.every(variant => fs.existsSync(within(root, variant.file)))) return metadata.thumbnail;
    const base = 'thumbnails/' + key;
    fs.mkdirSync(within(root, 'thumbnails'), {recursive: true});
    let result;
    if (brief) {
      assert(stat.size <= 4 * 1024 ** 2,'Brief is too large for an automatic preview');
      // This preview is real brief content, escaped as text, with no executable or remote SVG references.
      const contents = fs.readFileSync(input, 'utf8');
      const headings = contents.split(/\r?\n/).filter(line => /^#{1,4}\s/.test(line)).map(line => line.replace(/^#+\s*/, '')).slice(0, 5);
      const title = headings.shift() || project.name;
      const lines = [title, ...headings].map(line => line.slice(0, 68));
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 461" width="820" height="461"><rect width="820" height="461" fill="#f7f8fa"/><rect x="104" y="28" width="612" height="560" rx="4" fill="#fff" stroke="#e3e5ea"/><g font-family="Inter,Segoe UI,Arial,sans-serif" fill="#14161c">' + lines.map((line, index) => '<text x="140" y="' + (index ? 130 + index * 57 : 88) + '" font-size="' + (index ? 17 : 23) + '" font-weight="600">' + escape(line) + '</text>').join('') + '</g><g stroke="#e3e5ea" stroke-width="6">' + [148, 205, 262, 319, 376].map(y => '<path d="M140 ' + y + 'H670"/>').join('') + '</g></svg>';
      atomic(within(root, base + '.svg'), svg);
      result = {key, file: base + '.svg', variants: [{file: base + '.svg', width: 820, type: 'image/svg+xml'}], width: 820, height: 461, source, selection: 'brief-content'};
    } else {
      const media = this.workspace.service.media;
      const info = await this.workspace.mediaInfo(id, source);
      assert(info.width > 0 && info.height > 0 && info.width * info.height <= 3840 * 2160 && info.duration > 0, 'Automatic previews support video up to 3840 × 2160 pixels');
      const range = Math.min(info.duration * .2, 60);
      // Compare adjacent 500 ms samples. Select the earliest calm one-second window.
      // This is a reproducible motion heuristic, not semantic menu/cursor detection.
      const localInput = ['-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm','-threads','2'];
      const samples = await run(media.ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...localInput, '-t', String(Math.max(range, .1)), '-i', input, '-vf', 'fps=2,scale=64:36:flags=area,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-an', '-f', 'null', '-']);
      const values = [...samples.matchAll(/pts_time:([\d.]+)[\s\S]*?lavfi\.signalstats\.YAVG=([\d.]+)/g)].map(match => ({time: Number(match[1]), change: Number(match[2])}));
      let at = Math.min(.5, Math.max(0, info.duration / 10)), selection = 'pre-interaction-fallback';
      for (let index = 1; index < values.length - 1; index++) {
        if (Math.max(values[index - 1].change, values[index].change, values[index + 1].change) <= 2.5 && values[index].time >= .5) {at = values[index].time; selection = 'first-low-motion-window'; break;}
      }
      const cropWidth = Math.min(info.width, Math.floor(info.height * 16 / 9));
      const widths = [...new Set([480, 820, 1240].filter(width => width <= cropWidth).concat(cropWidth < 480 ? [cropWidth] : []))];
      const variants = [];
      for (const width of widths) {
        const height = Math.max(1, Math.round(width * 9 / 16));
        const filter = 'crop=min(iw\\,ih*16/9):min(ih\\,iw*9/16),scale=' + width + ':' + height + ':flags=lanczos,unsharp=3:3:0.3';
        const webp = base + '-' + width + '.webp';
        await run(media.ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...localInput, '-ss', String(at), '-i', input, '-frames:v', '1', '-vf', filter, '-c:v', 'libwebp', '-quality', '82', '-y', within(root, webp)]);
        variants.push({file: webp, width, type: 'image/webp'});
        const avif = base + '-' + width + '.avif';
        try {
          await run(media.ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', ...localInput, '-ss', String(at), '-i', input, '-frames:v', '1', '-vf', filter, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '24', '-cpu-used', '6', '-y', within(root, avif)]);
          variants.push({file: avif, width, type: 'image/avif'});
        } catch {fs.rmSync(within(root, avif), {force: true});}
      }
      result = {key, file: variants.find(variant => variant.type === 'image/webp').file, variants, width: widths[0], height: Math.round(widths[0] * 9 / 16), source, frameAt: at, selection};
    }
    // Re-read metadata after asynchronous generation so a rename/pin is never lost.
    this.workspace.saveMetadata(id, {...this.workspace.metadata(id), thumbnail: result});
    return result;
  }
}
module.exports = {Thumbnails};
