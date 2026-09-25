# Vistralo

Vistralo is an authenticated browser studio that runs Chromium, OBS Studio, FFmpeg, project storage, and an MCP bridge on a VPS. The laptop acts as a thin browser/SSH-tunnel client for server-side website capture and rendering.

The application source, tests, and deployment documentation are in [`deployment-source/vistralo`](deployment-source/vistralo). See [`docs/SERVER-DEPLOYMENT.md`](deployment-source/vistralo/docs/SERVER-DEPLOYMENT.md) for operation and [`docs/AGENTIC-CICD.md`](deployment-source/vistralo/docs/AGENTIC-CICD.md) for the GitHub workflow.

## Contribution flow

1. Create a branch and edit through GitHub, Codespaces, or a local clone.
2. Open a pull request. CI installs the locked dependencies, runs the test suite with FFmpeg, builds both interfaces, audits production dependencies, and validates Compose.
3. Merge to `main`. Production deploy remains gated by `VISTRALO_CUTOVER_READY=true` until the [cutover procedure](deployment-source/vistralo/docs/VISTRALO-CUTOVER.md) passes.
4. When enabled, the VPS rebuilds and recreates only the `studio` service, preserves its data volume and private runtime configuration, waits for authenticated OBS/HTTP health, and automatically rolls back source/image state if the new service fails.

No VPS password, application token, OBS password, or provider key is stored in Git.

