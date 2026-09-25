'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {assert, within, disk, hash} = require('./core.cjs');

// Uploads are kept out of projects until all bytes and the client digest agree.
// The filesystem size is authoritative after a process restart or lost response.
class Uploads {
  constructor(service, {maxBytes = 20 * 1024 ** 3, freeFloor = 5 * 1024 ** 3} = {}) {
    this.service = service;
    this.root = path.join(service.store.root, 'incoming');
    fs.mkdirSync(this.root, {recursive: true, mode: 0o700});
    this.maxBytes = maxBytes;
    this.freeFloor = freeFloor;
    this.busy = new Set();
    this.completing = new Set();
    this.cancelling = new Map();
    service.store.db.exec(`CREATE TABLE IF NOT EXISTS uploads(
      id TEXT PRIMARY KEY, project TEXT NOT NULL, kind TEXT NOT NULL,
      extension TEXT NOT NULL, size INTEGER NOT NULL, digest TEXT NOT NULL,
      state TEXT NOT NULL, result TEXT, created TEXT NOT NULL)`);
  }
  get(id) {
    assert(typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id), 'Invalid upload ID');
    const row = this.service.store.db.prepare('SELECT * FROM uploads WHERE id=?').get(id);
    assert(row, 'Upload not found');
    const file = within(this.root, id + row.extension);
    return {...row, file, offset: fs.existsSync(file) ? fs.statSync(file).size : row.state === 'Complete' ? row.size : 0};
  }
  public(id) {
    const {size, offset, state, result, project, kind, digest} = this.get(id);
    return {id, size, offset, state, project, kind, digest, result: result ? JSON.parse(result) : null};
  }
  create({id: project, kind, filename, size, digest}) {
    this.service.assertEditable(project);
    const ext = path.extname(String(filename)).toLowerCase();
    const allowed = {video: ['.mp4', '.mkv', '.webm', '.mov'], audio: ['.wav', '.mp3', '.m4a'], captions: ['.srt', '.vtt']};
    assert(allowed[kind]?.includes(ext), 'Unsupported media extension');
    assert(Number.isSafeInteger(size) && size > 0 && size <= this.maxBytes, 'Invalid upload size');
    assert(typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest), 'SHA-256 required');
    const reserved = this.service.store.db.prepare("SELECT COALESCE(SUM(size),0) AS bytes FROM uploads WHERE state='Uploading'").get().bytes;
    assert(reserved + size <= this.maxBytes, 'Finish or remove incomplete uploads before uploading more');
    disk(this.root, this.freeFloor + reserved + size);
    const id = crypto.randomUUID();
    fs.closeSync(fs.openSync(within(this.root, id + ext), 'wx', 0o600));
    this.service.store.db.prepare('INSERT INTO uploads VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id, project, kind, ext, size, digest, 'Uploading', null, new Date().toISOString());
    return this.public(id);
  }
  async chunk(id, offset, bytes) {
    assert(!this.cancelling.has(id), 'Upload cancellation requested');
    assert(!this.busy.has(id), 'Upload busy');
    this.busy.add(id);
    try {
      const row = this.get(id);
      assert(row.state === 'Uploading', 'Upload already complete');
      assert(Number.isSafeInteger(offset) && offset === row.offset, 'Offset conflict; query upload status and resume');
      assert(bytes.length > 0 && bytes.length <= 8 * 1024 ** 2 && offset + bytes.length <= row.size, 'Invalid chunk size');
      disk(this.root, this.freeFloor + bytes.length);
      const handle = await fs.promises.open(row.file, 'a');
      try {await handle.writeFile(bytes); await handle.sync();} finally {await handle.close();}
      return this.public(id);
    } finally {this.busy.delete(id);}
  }
  async complete(id) {
    assert(!this.cancelling.has(id), 'Upload cancellation requested');
    assert(!this.busy.has(id), 'Upload busy');
    this.busy.add(id);
    this.completing.add(id);
    try {
      const row = this.get(id);
      if (row.state === 'Complete') return JSON.parse(row.result);
      this.service.assertEditable(row.project);
      assert(row.offset === row.size, 'Upload incomplete');
      assert(await hash(row.file) === row.digest, 'Upload checksum mismatch');
      if (row.kind !== 'captions') {
        const media = await this.service.media.probe(row.file);
        assert(media.streams.some(stream => stream.codec_type === row.kind) && Number(media.format?.duration) > 0, 'Upload has no usable ' + row.kind + ' stream');
      }
      this.service.assertEditable(row.project);
      // Stable destination makes completion idempotent across crash boundaries.
      const rel = 'imports/upload-' + id + row.extension;
      const target = within(this.service.store.dir(row.project), rel);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      if (!fs.existsSync(target)) fs.linkSync(row.file, target);
      assert(await hash(target) === row.digest, 'Existing import checksum differs');
      this.service.assertEditable(row.project);
      const result = {file: rel, sha256: row.digest};
      this.service.store.db.exec('BEGIN IMMEDIATE');
      try {
        this.service.store.update(row.project, 'Needs Review', row.kind === 'video' ? {video: rel, imported: result} : row.kind === 'audio' ? {narration: rel} : {captions: rel});
        this.service.store.db.prepare("UPDATE uploads SET state='Complete', result=? WHERE id=?").run(JSON.stringify(result), id);
        this.service.store.db.exec('COMMIT');
      } catch (error) {this.service.store.db.exec('ROLLBACK'); throw error;}
      fs.unlinkSync(row.file);
      return result;
    } finally {this.busy.delete(id); this.completing.delete(id);}
  }
  cancel(id) {
    if (this.cancelling.has(id)) return this.cancelling.get(id);
    const row = this.get(id);
    assert(row.state === 'Uploading', 'Completed source files cannot be cancelled');
    assert(!this.completing.has(id), 'Upload verification is already finishing; wait for completion');
    // Mark synchronously, before yielding, to stop a queued or subsequent chunk.
    const task = Promise.resolve().then(async () => {
      while (this.busy.has(id)) await new Promise(resolve => setTimeout(resolve, 10));
      return this.remove(id, true);
    }).finally(() => this.cancelling.delete(id));
    this.cancelling.set(id, task);
    return task;
  }
  remove(id, cancellation = false) {
    if (!cancellation && this.cancelling.has(id)) return this.cancelling.get(id);
    assert(!this.busy.has(id), 'Upload busy');
    const row = this.get(id);
    assert(row.state === 'Uploading', 'Completed source files cannot be deleted here');
    fs.rmSync(row.file, {force: true});
    this.service.store.db.prepare('DELETE FROM uploads WHERE id=?').run(id);
    return {removed: true};
  }
}
module.exports = {Uploads};
