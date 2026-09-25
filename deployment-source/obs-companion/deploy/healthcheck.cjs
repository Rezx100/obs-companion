'use strict';
const {verifyObs} = require('./obs-ready.cjs');

(async () => {
  const obs = await verifyObs();
  if (!obs.obsVersion || !obs.obsWebSocketVersion) throw new Error('OBS version response is incomplete');
  const response = await fetch('http://127.0.0.1:8787/');
  if (!response.ok) throw new Error(`Studio HTTP health failed: ${response.status}`);
  console.log(JSON.stringify({httpStatus:response.status, obsVersion:obs.obsVersion, obsWebSocketVersion:obs.obsWebSocketVersion, recordingActive:obs.recordOutputActive, streamingActive:obs.streamOutputActive}));
})().catch(error => { console.error(error.message); process.exit(1); });
