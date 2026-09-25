'use strict';
// Opt-in local browser smoke test for the rebuilt web workspace.
// Run npm run build:server first. This is not part of npm test and a source
// update or syntax check is not a browser acceptance pass.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {createServer} = require('../src/server.cjs');
const {atomic, hash} = require('../src/core.cjs');
const {run} = require('../src/media.cjs');

async function main() {
  const token = crypto.randomBytes(32).toString('hex');
  const port = Number(process.env.VISTRALO_UI_TEST_PORT || 8788);
  assert(Number.isInteger(port) && port > 0 && port < 65536, 'VISTRALO_UI_TEST_PORT must be a valid local port');
  const origin = 'http://127.0.0.1:' + port;
  const evidenceDirectory = path.resolve('evidence');
  const receipt = path.join(evidenceDirectory, 'server-web-ui.json');
  const checks = [];
  const boundary = 'Local ' + process.platform + ' loopback HTTP server with Chromium and FFmpeg. This covers the rebuilt web workspace upload/edit/render path. It does not exercise website capture, browser screen permissions, native OBS hardware, Windows packaging, paid providers or production deployment.';
  fs.mkdirSync(evidenceDirectory, {recursive:true});
  fs.mkdirSync(path.resolve('work'), {recursive:true});
  const root = fs.mkdtempSync(path.resolve('work/server-web-ui-'));
  let app, browser;
  atomic(receipt, {suite:'rebuilt-web-workspace', passed:false, state:'started', at:new Date().toISOString(), checks, boundary});
  try {
    assert(fs.existsSync('server-ui/app.js') && fs.readFileSync('server-ui/index.html', 'utf8').includes('id="root"'), 'Build the current web workspace with npm run build:server before running this smoke test');
    app = createServer({root, token, origins:[origin], env:{FREE_DISK_FLOOR_BYTES:'1'}, uploadOptions:{freeFloor:0}});
    await new Promise((resolve, reject) => {
      app.server.once('error', reject);
      app.server.listen(port, '127.0.0.1', resolve);
    });
    const executablePath = process.env.VISTRALO_TEST_CHROMIUM || path.resolve('.cache/chromium/chromium');
    if (!process.env.VISTRALO_TEST_CHROMIUM) {
      assert.equal(process.platform, 'linux', 'Set VISTRALO_TEST_CHROMIUM to a compatible Chromium executable on this platform');
      fs.mkdirSync(path.dirname(executablePath), {recursive:true});
      fs.writeFileSync(executablePath, require('node:zlib').brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/chromium.br')));
      fs.chmodSync(executablePath, 0o755);
    }
    browser = await chromium.launch({executablePath, headless:true});
    const page = await browser.newPage({viewport:{width:1440, height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(15000);

    await page.goto(origin);
    await page.getByLabel('Studio access token', {exact:true}).fill(token);
    await page.getByRole('button', {name:'Open studio', exact:true}).click();
    await page.getByRole('heading', {name:'Projects', level:1, exact:true}).waitFor();
    checks.push('real HTTP token login into rebuilt Projects workspace');

    // Generated synthetic footage is the only input; no user recording is used.
    const fixture = path.join(root, 'test-upload.mp4');
    await run('ffmpeg', ['-v','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-t','2','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
    const sourceHash = await hash(fixture);
    await page.getByRole('button', {name:'New project', exact:true}).click();
    await page.getByRole('menuitem', {name:/^Upload (?:a )?recording/}).click();
    const dialog = page.getByRole('dialog', {name:'Upload recording', exact:true});
    await dialog.getByLabel(/Project name/).fill('Server web acceptance');
    await dialog.locator('input[type="file"]').setInputFiles(fixture);
    await dialog.getByRole('button', {name:'Create Walkthrough', exact:true}).click();
    await page.getByRole('heading', {name:'Server web acceptance', level:1, exact:true}).waitFor({timeout:60000});
    assert.equal(app.service.store.list().length, 1, 'The creation flow creates exactly one project');
    let project = app.service.store.list()[0];
    assert.equal(project.data.imported.sha256, sourceHash, 'Server import verifies the actual source hash');
    assert.equal(await hash(path.join(root, project.id, project.data.video)), sourceHash);
    checks.push('accessible upload dialog creates one persisted project', 'browser checksum upload verified against Node SHA-256');

    await page.getByRole('tab', {name:'Editor', exact:true}).click();
    await page.getByText(/^Source duration:/).waitFor();
    await page.getByLabel('Start (seconds)', {exact:true}).fill('0');
    await page.getByLabel('End (seconds)', {exact:true}).fill('1');
    const saved = page.waitForResponse(response => response.url() === origin + '/rpc' && response.request().postDataJSON()?.method === 'plan');
    await page.getByRole('button', {name:'Save trim plan', exact:true}).click();
    assert.equal((await saved).ok(), true, 'Trim plan save RPC succeeds');
    project = app.service.store.list()[0];
    assert.deepEqual(project.data.editPlan.clips, [{start:0, end:1}]);
    await page.getByRole('button', {name:'Save and render', exact:true}).click();
    await page.getByRole('link', {name:'Download output', exact:true}).waitFor({timeout:60000});
    project = app.service.store.list()[0];
    assert.ok(project.data.output?.file, 'A real rendered output is persisted');
    assert.notEqual(project.data.output.file, project.data.video, 'Render creates a separate file');
    const outputInfo = await app.service.media.probe(path.join(root, project.id, project.data.output.file));
    assert.ok(Math.abs(Number(outputInfo.format.duration) - 1) < 0.15, 'Rendered output matches the reviewed one-second cut');
    assert.equal(await hash(path.join(root, project.id, project.data.video)), sourceHash, 'The original source survives rendering unchanged');
    checks.push('finite-duration trim plan persists from Editor', 'real FFmpeg render matches reviewed one-second cut', 'original upload SHA-256 preserved after render');

    await page.getByRole('navigation', {name:'Breadcrumb', exact:true}).getByRole('button', {name:'Projects', exact:true}).click();
    await page.getByRole('heading', {name:'Projects', level:1, exact:true}).waitFor();
    await page.locator('.project-card').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No desktop horizontal overflow');
    await page.screenshot({path:path.join(evidenceDirectory, 'server-web-dashboard-desktop.png'), fullPage:true});
    await page.setViewportSize({width:390, height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No mobile horizontal overflow');
    await page.screenshot({path:path.join(evidenceDirectory, 'server-web-dashboard-mobile.png'), fullPage:true});
    checks.push('1440×900 and 390×844 server dashboard screenshots', 'no horizontal overflow in those two dashboard states');

    // Exercise the worker across its 1 MiB boundary, independently of fixture size.
    const expected = crypto.createHash('sha256').update(Buffer.alloc(2 * 1024 * 1024 + 7, 0x61)).digest('hex');
    const actual = await page.evaluate(() => new Promise((resolve, reject) => {
      const worker = new Worker('/hash-worker.js');
      worker.onmessage = event => {
        if (event.data.digest) { worker.terminate(); resolve(event.data.digest); }
        else if (event.data.error) { worker.terminate(); reject(new Error(event.data.error)); }
      };
      worker.onerror = () => { worker.terminate(); reject(new Error('Browser hash worker failed')); };
      worker.postMessage(new File([new Uint8Array(2 * 1024 * 1024 + 7).fill(0x61)], 'hash.bin'));
    }));
    assert.equal(actual, expected, 'Multi-chunk browser SHA-256 matches Node');
    assert.deepEqual(errors, [], 'No uncaught browser exceptions during the tested journey');
    checks.push('multi-chunk browser hash worker matches Node', 'no uncaught browser exceptions in the tested journey');
    atomic(receipt, {suite:'rebuilt-web-workspace', passed:true, state:'complete', at:new Date().toISOString(), checks, output:{file:project.data.output.file,duration:Number(outputInfo.format.duration),sha256:project.data.output.sha256}, boundary});
    console.log('Rebuilt server web workspace smoke test passed');
  } catch (error) {
    // Do not expose even the ephemeral studio token in locator call logs.
    const message = String(error?.message || error).split(token).join('[redacted token]');
    atomic(receipt, {suite:'rebuilt-web-workspace', passed:false, state:'failed', at:new Date().toISOString(), checks, error:message, boundary});
    throw new Error(message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (app) await app.close();
    fs.rmSync(root, {recursive:true, force:true});
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
