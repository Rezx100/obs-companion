'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {assert, within, atomic, disk} = require('./core.cjs');

const now = () => new Date().toISOString();
const blocked = /\.partial|\.tmp|credentials|browser-profile/i;
const busyStates = new Set(['Recording', 'Paused', 'Stopping', 'Processing']);
function cleanText(value, max, label, empty = false) {
  assert(typeof value === 'string' && value.trim().length <= max && (empty || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), 'Invalid ' + label);
  return value.trim();
}
function safeURL(value) {
  if (!value) return null;
  assert(typeof value === 'string' && value.length <= 2048, 'Invalid source URL');
  const url = new URL(value);
  assert(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'Use an HTTP(S) URL without embedded credentials');
  return url.href;
}
function selectedVideo(project) {
  return project.data.output?.file || project.data.sources?.screen?.file || project.data.video || project.data.master || null;
}
function briefFile(project) {
  return project.data.brief || project.data.analysis || (project.data.manifest ? path.posix.dirname(project.data.manifest) + '/implementation-brief.md' : null);
}

class Workspace {
  constructor(service, {active = () => null, uploads} = {}) {
    this.service = service;
    this.store = service.store;
    this.active = active;
    this.uploads = uploads;
    this.locks = new Set();
    this.summaries = new Map();
    this.store.db.exec(`CREATE TABLE IF NOT EXISTS workspace_projects(project TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workspace_settings(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workspace_shares(id TEXT PRIMARY KEY, project TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, files TEXT NOT NULL, created TEXT NOT NULL, expires TEXT NOT NULL, revoked TEXT);
      CREATE INDEX IF NOT EXISTS workspace_shares_project ON workspace_shares(project);`);
  }
  metadata(id) {
    const project = this.store.get(id);
    const stored = this.store.db.prepare('SELECT data FROM workspace_projects WHERE project=?').get(id);
    const data = stored ? JSON.parse(stored.data) : {};
    return {type: project.mode === 'walkthrough' ? 'brief' : 'walkthrough', source: project.mode === 'walkthrough' ? 'web' : project.data.imported ? 'upload' : 'screen', url: null, folder: '', pinned: false, lastOpened: null, trashedAt: null, status: null, ...data};
  }
  saveMetadata(id, metadata) {
    this.store.db.prepare('INSERT INTO workspace_projects(project,data) VALUES(?,?) ON CONFLICT(project) DO UPDATE SET data=excluded.data').run(id, JSON.stringify(metadata));
  }
  isBusy(id) {
    return this.locks.has(id) || this.active()?.project === id || this.service.running.has(id) || this.service.capture.active === id || busyStates.has(this.store.get(id).state) || !!this.store.db.prepare("SELECT id FROM uploads WHERE project=? AND state='Uploading'").get(id);
  }
  editable(id, {allowTrashed = false} = {}) {
    const project = this.store.get(id);
    assert(allowTrashed || !this.metadata(id).trashedAt, 'Restore this project from Trash first');
    assert(!this.isBusy(id), 'Finish or cancel the active project operation first');
    return project;
  }
  requireLive(id) {
    this.store.get(id);
    assert(!this.metadata(id).trashedAt, 'Restore this project from Trash first');
  }
  cacheEvidence(id, manifest) {
    const summary = {manifest:manifest.path || this.store.get(id).data.manifest, url:manifest.url || null,
      referenceCount:(manifest.sessions || []).reduce((count,session) => count + (session.frames?.length || 0),0), sectionCount:manifest.sessions?.length || 0};
    this.saveMetadata(id,{...this.metadata(id),evidenceSummary:summary});
    return summary;
  }
  manifest(project, metadata) {
    if (!project.data.manifest) return null;
    if (metadata.evidenceSummary?.manifest === project.data.manifest) return metadata.evidenceSummary;
    try {
      const file = within(this.store.dir(project.id),project.data.manifest,true), stat = fs.statSync(file), fingerprint = file + ':' + stat.size + ':' + stat.mtimeMs;
      const cached = this.summaries.get(project.id);
      if (cached?.fingerprint === fingerprint) return cached.summary;
      // Legacy recordings may contain many timing samples. A dashboard poll never reads an unbounded manifest.
      const manifest = stat.size <= 16 * 1024 ** 2 ? JSON.parse(fs.readFileSync(file,'utf8')) : null;
      const summary = manifest ? this.cacheEvidence(project.id,manifest) : null;
      if (this.summaries.size >= 500) this.summaries.delete(this.summaries.keys().next().value);
      this.summaries.set(project.id,{fingerprint,summary});
      return summary;
    } catch {return null;}
  }
  enrich(project) {
    const meta = this.metadata(project.id), manifest = this.manifest(project,meta);
    const upload = this.store.db.prepare("SELECT id FROM uploads WHERE project=? AND state='Uploading' ORDER BY created DESC LIMIT 1").get(project.id);
    const currentUpload = upload && this.uploads?.public(upload.id);
    const active = this.active()?.project === project.id || this.service.running.has(project.id);
    const hasOutput = !!(project.data.output || briefFile(project));
    const status = currentUpload ? 'uploading' : active || busyStates.has(project.state) ? 'processing' : ['Failed', 'Interrupted'].includes(project.state) ? 'failed' : meta.status || (hasOutput ? 'ready' : 'draft');
    const shares = this.shares(project.id);
    const workspace = {...meta, url: meta.url || manifest?.url || null, status, progress: currentUpload ? Math.min(100, Math.floor(currentUpload.offset / currentUpload.size * 100)) : null,
      uploadId: currentUpload?.id || null, error: status === 'failed' ? project.data.error || 'The operation did not finish. Review the project before retrying.' : null,
      duration: Number(project.data.output?.duration || meta.mediaInfo?.duration) || null, referenceCount: manifest?.referenceCount || 0,
      sectionCount: manifest?.sectionCount || (briefFile(project) ? 1 : 0), thumbnail: meta.thumbnail || null,
      access: shares.some(share => !share.revokedAt && Date.parse(share.expiresAt) > Date.now()) ? 'link' : 'private'};
    return {...project, workspace, shares};
  }
  list() {return this.store.list().map(project => this.enrich(project));}
  update(id, patch) {
    this.requireLive(id);
    assert(patch && typeof patch === 'object' && !Array.isArray(patch), 'Project changes required');
    const keys = ['name', 'type', 'source', 'url', 'folder', 'pinned', 'lastOpened', 'status'];
    for (const key of Object.keys(patch)) assert(keys.includes(key), 'Unsupported project change: ' + key);
    const metadata = this.metadata(id);
    if ('name' in patch) patch = {...patch, name: cleanText(patch.name, 120, 'project name')};
    if ('type' in patch) {assert(['walkthrough', 'brief'].includes(patch.type), 'Invalid project type'); metadata.type = patch.type;}
    if ('source' in patch) {assert(['screen', 'web', 'upload'].includes(patch.source), 'Invalid project source'); metadata.source = patch.source;}
    if ('url' in patch) metadata.url = safeURL(patch.url);
    if ('folder' in patch) metadata.folder = cleanText(patch.folder, 80, 'folder', true);
    if ('pinned' in patch) {
      assert(typeof patch.pinned === 'boolean', 'Invalid pin state');
      if (patch.pinned && !metadata.pinned) assert(this.store.list().filter(p => {const m = this.metadata(p.id); return m.pinned && !m.trashedAt;}).length < 5, 'You can pin up to five projects');
      metadata.pinned = patch.pinned;
    }
    if ('lastOpened' in patch) {
      assert(patch.lastOpened === true || (typeof patch.lastOpened === 'string' && Number.isFinite(Date.parse(patch.lastOpened))), 'Invalid open date');
      metadata.lastOpened = now();
    }
    if ('status' in patch) {this.editable(id); assert(['draft', 'ready'].includes(patch.status), 'Choose Draft or Ready'); metadata.status = patch.status;}
    const touched = Object.keys(patch).some(key => key !== 'lastOpened');
    this.store.db.exec('BEGIN IMMEDIATE');
    try {
      this.saveMetadata(id, metadata);
      if (touched) this.store.db.prepare('UPDATE projects SET name=?,updated=? WHERE id=?').run(patch.name || this.store.get(id).name, now(), id);
      this.store.event(id, 'workspace-update', {fields: Object.keys(patch)});
      this.store.db.exec('COMMIT');
    } catch (error) {this.store.db.exec('ROLLBACK'); throw error;}
    if (touched) this.store.snapshot(id);
    return this.enrich(this.store.get(id));
  }
  ids(ids) {
    assert(Array.isArray(ids) && ids.length > 0 && ids.length <= 100 && new Set(ids).size === ids.length, 'Choose 1–100 different projects');
    for (const id of ids) this.store.get(id);
    return ids;
  }
  trash(ids) {
    this.ids(ids).forEach(id => this.editable(id));
    const at = now();
    this.store.db.exec('BEGIN IMMEDIATE');
    try {
      for (const id of ids) {
        this.saveMetadata(id, {...this.metadata(id), trashedAt: at, pinned: false});
        this.store.db.prepare('UPDATE workspace_shares SET revoked=? WHERE project=? AND revoked IS NULL').run(at, id);
        this.store.event(id, 'workspace-trash', {});
      }
      this.store.db.exec('COMMIT');
    } catch (error) {this.store.db.exec('ROLLBACK'); throw error;}
    return {ids, trashedAt: at};
  }
  restore(ids) {
    this.ids(ids).forEach(id => {this.editable(id, {allowTrashed: true}); assert(this.metadata(id).trashedAt, 'Project is not in Trash');});
    for (const id of ids) {this.saveMetadata(id, {...this.metadata(id), trashedAt: null}); this.store.event(id, 'workspace-restore', {});}
    return {ids, restored: true};
  }
  remove(ids, confirmation) {
    assert(confirmation === 'DELETE', 'Confirm permanent deletion with DELETE');
    this.ids(ids).forEach(id => {this.editable(id, {allowTrashed: true}); assert(this.metadata(id).trashedAt, 'Only projects in Trash can be permanently deleted');});
    const staged = [];
    try {
      for (const id of ids) {
        const source = this.store.dir(id), target = path.join(this.store.root, '.deleting-' + id + '-' + crypto.randomUUID());
        // Rename and unlink only this directory; shared hardlinks elsewhere retain their bytes.
        assert(!fs.lstatSync(source).isSymbolicLink(), 'Project directory cannot be a symlink');
        fs.renameSync(source, target); staged.push({id, source, target});
      }
      this.store.db.exec('BEGIN IMMEDIATE');
      try {
        for (const id of ids) for (const table of ['workspace_shares', 'workspace_projects', 'uploads', 'jobs', 'events']) this.store.db.prepare(`DELETE FROM ${table} WHERE project=?`).run(id);
        for (const id of ids) this.store.db.prepare('DELETE FROM projects WHERE id=?').run(id);
        this.store.db.exec('COMMIT');
      } catch (error) {this.store.db.exec('ROLLBACK'); throw error;}
    } catch (error) {for (const entry of staged.reverse()) fs.renameSync(entry.target, entry.source); throw error;}
    for (const entry of staged) fs.rmSync(entry.target, {recursive: true, force: true});
    return {ids, deleted: true};
  }
  async duplicate(id) {
    const source = this.editable(id), sourceRoot = this.store.dir(id);
    const entries = [];
    const collect = (dir, relative = '') => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const rel = relative ? relative + '/' + entry.name : entry.name;
        assert(!entry.isSymbolicLink(), 'Cannot duplicate a project containing symlinks');
        if (blocked.test(rel) || rel === 'project.json' || rel === 'job-history.json') continue;
        if (entry.isDirectory()) collect(path.join(dir, entry.name), rel);
        else if (entry.isFile()) entries.push({rel, size: fs.statSync(within(sourceRoot, rel, true)).size});
      }
    };
    collect(sourceRoot);
    disk(this.store.root, entries.reduce((sum, entry) => sum + entry.size, 0) + 64 * 1024 ** 2);
    const project = this.store.create((source.name.slice(0, 113) + ' (copy)'), source.mode);
    this.locks.add(id); this.locks.add(project.id);
    try {
      for (const entry of entries) {
        const target = within(this.store.dir(project.id), entry.rel);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        await fs.promises.copyFile(within(sourceRoot, entry.rel, true), target, fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE);
      }
      const metadata = this.metadata(id);
      this.saveMetadata(project.id, {...metadata, pinned: false, lastOpened: null, trashedAt: null});
      this.store.update(project.id, 'Needs Review', {...source.data, error: null});
      return this.enrich(this.store.get(project.id));
    } catch (error) {
      this.store.update(project.id, 'Failed', {error: 'Copy did not complete: ' + error.message});
      throw error;
    } finally {this.locks.delete(id); this.locks.delete(project.id);}
  }
  settings(patch) {
    const row = this.store.db.prepare('SELECT data FROM workspace_settings WHERE id=1').get();
    const settings = {name: "Rezan’s workspace", displayName: 'Rezan Ferdous', email: '', theme: 'dark', locale: 'en', plan: 'Private workspace', ...row && JSON.parse(row.data)};
    if (patch === undefined) return settings;
    assert(patch && typeof patch === 'object' && !Array.isArray(patch), 'Settings required');
    for (const key of Object.keys(patch)) assert(['name', 'displayName', 'email', 'theme', 'locale'].includes(key), 'Unsupported setting');
    for (const key of ['name', 'displayName']) if (key in patch) settings[key] = cleanText(patch[key], 80, key);
    if ('email' in patch) {const email = cleanText(patch.email, 254, 'email', true); assert(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Invalid email'); settings.email = email;}
    if ('theme' in patch) {assert(['dark', 'light', 'system'].includes(patch.theme), 'Invalid theme'); settings.theme = patch.theme;}
    if ('locale' in patch) {assert(typeof patch.locale === 'string' && patch.locale.length <= 40, 'Invalid locale'); try {new Intl.DateTimeFormat(patch.locale);} catch {throw Error('Invalid locale');} settings.locale = patch.locale;}
    this.store.db.prepare('INSERT INTO workspace_settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(settings));
    return settings;
  }
  async mediaInfo(id, file) {
    this.requireLive(id);
    assert(typeof file === 'string' && /\.(mp4|mkv|webm|mov|wav|mp3|m4a)$/i.test(file) && !blocked.test(file), 'Choose a project media file');
    const probe = await this.service.media.probe(within(this.store.dir(id), file, true));
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const value = {file, duration: Number(probe.format?.duration) || null, width: video?.width || null, height: video?.height || null, hasAudio: probe.streams.some(stream => stream.codec_type === 'audio')};
    if (file === selectedVideo(this.store.get(id))) this.saveMetadata(id, {...this.metadata(id), mediaInfo: value});
    return value;
  }
  briefSave(id, text) {
    this.editable(id);
    assert(typeof text === 'string' && Buffer.byteLength(text) <= 1024 * 1024, 'Brief must be at most 1 MiB');
    atomic(within(this.store.dir(id), 'brief.md'), text);
    this.saveMetadata(id, {...this.metadata(id), type: 'brief', thumbnail: null});
    this.store.update(id, 'Needs Review', {brief: 'brief.md'});
    return this.enrich(this.store.get(id));
  }
  shares(id) {
    this.store.get(id);
    return this.store.db.prepare('SELECT id,created,expires,revoked FROM workspace_shares WHERE project=? ORDER BY created DESC').all(id).map(row => ({id: row.id, createdAt: row.created, expiresAt: row.expires, revokedAt: row.revoked}));
  }
  shareCreate(id, expiresInDays = 7) {
    const project = this.editable(id), meta = this.metadata(id);
    assert([1, 7, 30].includes(expiresInDays), 'Choose a share expiry of 1, 7 or 30 days');
    const video = meta.type === 'walkthrough' ? selectedVideo(project) : null;
    const brief = meta.type === 'brief' ? briefFile(project) : null;
    assert(video || brief, 'Add a recording or brief before sharing');
    assert(!video || /\.(mp4|webm|mov|mkv)$/i.test(video), 'Unsupported shared video');
    assert(!brief || /\.md$/i.test(brief), 'Unsupported shared brief');
    const files = [...new Set([video, brief, meta.thumbnail?.file, ...(meta.thumbnail?.variants || []).map(item => item.file)].filter(Boolean))];
    for (const file of files) {assert(!blocked.test(file) && /\.(mp4|webm|mov|mkv|md|svg|jpg|png|webp|avif)$/i.test(file), 'Unsupported share file'); within(this.store.dir(id), file, true);}
    const token = crypto.randomBytes(32).toString('base64url'), shareId = crypto.randomUUID(), createdAt = now(), expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
    this.store.db.prepare('INSERT INTO workspace_shares VALUES(?,?,?,?,?,?,NULL)').run(shareId, id, crypto.createHash('sha256').update(token).digest('hex'), JSON.stringify({files, video, brief, thumbnail: meta.thumbnail || null}), createdAt, expiresAt);
    this.store.event(id, 'share-created', {id: shareId, expiresAt});
    return {id: shareId, token, path: '/share/' + token, createdAt, expiresAt};
  }
  shareRevoke(shareId) {
    assert(typeof shareId === 'string', 'Share ID required');
    const share = this.store.db.prepare('SELECT project FROM workspace_shares WHERE id=?').get(shareId);
    assert(share, 'Share not found');
    this.store.db.prepare('UPDATE workspace_shares SET revoked=COALESCE(revoked,?) WHERE id=?').run(now(), shareId);
    this.store.event(share.project, 'share-revoked', {id: shareId});
    return {id: shareId, revoked: true};
  }
  resolveShare(token) {
    assert(typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token), 'Share link unavailable');
    const row = this.store.db.prepare('SELECT * FROM workspace_shares WHERE token_hash=? AND revoked IS NULL AND expires>?').get(crypto.createHash('sha256').update(token).digest('hex'), now());
    assert(row && !this.metadata(row.project).trashedAt, 'Share link unavailable');
    return {...row, selected: JSON.parse(row.files)};
  }
  shareData(token) {
    const share = this.resolveShare(token), project = this.store.get(share.project), metadata = this.metadata(project.id);
    const brief = share.selected.brief ? fs.readFileSync(within(this.store.dir(project.id), share.selected.brief, true), 'utf8') : null;
    return {id: project.id, name: project.name, type: metadata.type, source: metadata.source, url: metadata.url, created: project.created, updated: project.updated, expiresAt: share.expires,
      video: share.selected.video, brief, briefFile: share.selected.brief, thumbnail: share.selected.thumbnail, files: share.selected.files,
      duration: Number(project.data.output?.duration || metadata.mediaInfo?.duration) || null, readOnly: true};
  }
  shareFile(token, file) {
    const share = this.resolveShare(token);
    assert(typeof file === 'string' && share.selected.files.includes(file) && !blocked.test(file), 'File is not part of this share');
    return within(this.store.dir(share.project), file, true);
  }
}
module.exports = {Workspace, safeURL, selectedVideo, briefFile};
