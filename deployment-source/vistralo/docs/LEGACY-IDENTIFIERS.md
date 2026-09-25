# Retained names in the Vistralo source transition

| Location | Identifier | Reason | Removal condition |
| --- | --- | --- | --- |
| `package.json`, `scripts/installer.nsi` | `dev.rezan.obscompanion`, `OBSCompanion` uninstall key | Previously shipped Windows upgrade identity | Tested migration from both historical packaging routes on Windows |
| `src/identity-paths.cjs`, `src/main.cjs` | `OBS Companion` project/userData, `OBS_COMPANION_TEST_ROOT` | Existing libraries and encrypted credentials | Explicit, validated migration with DPAPI and WAL/media path checks; test alias after clients update |
| `src/runtime-config.cjs`, `src/server-mcp.cjs` | `COMPANION_*` | Existing private VPS configuration and MCP clients | Configuration and clients migrated and tested |
| `src/server.cjs` | `obs_session` | Same in-memory session compatibility and logout cleanup | After legacy sessions naturally expire and clients sign in anew |
| `server-ui/app.js` | `obs-upload:` | Resumable upload checkpoint migration | After pending uploads have completed or expired |
| `src/obs.cjs`, `src/server-obs.cjs` | Companion profile, collection, scene and input names | Reuse existing OBS resources without duplicating capture/audio | Explicit, idle-only resource migration with settings and restoration checks |
| `deploy/compose.yaml`, `deploy/github-deploy.sh`, root workflow | `obs-companion` Compose project, volume, path, lock and forced-command key filename | Single scheduler, retained volume and serialized old/new deployments | Coordinated live cutover and rollback drill; legacy workflows/commands retired |
| Root `vps_deploy.py` | `obs-companion` VPS acceptance identifiers | Historical read-only inventory/status; mutating actions are disabled | Remove after historical tooling is archived |
| Historical evidence, LICENSE, dated audit/build handoffs | OBS Companion identifiers | Provenance and copyright | Permanently retained as historical records |
| `obs-*` upstream protocol/OBS installation names | OBS Studio names | Third-party recording engine | Permanently retained |
