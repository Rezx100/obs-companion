'use strict';
const OBSWebSocket = require('obs-websocket-js').default;

async function verifyObs() {
  const password = process.env.OBS_WEBSOCKET_PASSWORD;
  if (!password || password.length < 32) throw new Error('OBS WebSocket password is missing');
  const obs = new OBSWebSocket();
  try {
    await obs.connect('ws://127.0.0.1:4455', password, {rpcVersion: 1, eventSubscriptions: 0});
    const version = await obs.call('GetVersion');
    if (!version.availableRequests?.includes('StartRecord')) throw new Error('OBS recording API is unavailable');
    const record = await obs.call('GetRecordStatus');
    const stream = await obs.call('GetStreamStatus');
    return {...version, recordOutputActive:record.outputActive === true, streamOutputActive:stream.outputActive === true};
  } finally {
    await obs.disconnect().catch(() => {});
  }
}

module.exports = {verifyObs};
