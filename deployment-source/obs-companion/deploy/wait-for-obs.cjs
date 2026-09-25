'use strict';
const {spawn} = require('node:child_process');
const {verifyObs} = require('./obs-ready.cjs');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let lastError;
  for (let attempt = 1; attempt <= 90; attempt++) {
    try {
      const version = await verifyObs();
      console.log(`OBS ready: ${version.obsVersion}; WebSocket ${version.obsWebSocketVersion}`);
      const child = spawn(process.execPath, ['/app/src/server.cjs'], {stdio: 'inherit', env: process.env});
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
      child.on('exit', code => process.exit(code ?? 1));
      return;
    } catch (error) {
      lastError = error;
      if (attempt % 10 === 0) console.error(`Waiting for authenticated OBS WebSocket (${attempt}/90): ${error.message}`);
      await sleep(1000);
    }
  }
  throw lastError || new Error('OBS WebSocket did not become ready');
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
