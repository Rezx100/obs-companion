# OBS Companion

OBS Companion is an authenticated browser studio that runs Chromium, OBS Studio, FFmpeg, project storage, and an MCP bridge on a VPS. The laptop acts as a thin browser/SSH-tunnel client for server-side website capture and rendering.

The application source, tests, and deployment documentation are in [`deployment-source/obs-companion`](deployment-source/obs-companion). See [`docs/SERVER-DEPLOYMENT.md`](deployment-source/obs-companion/docs/SERVER-DEPLOYMENT.md) for operation and [`docs/AGENTIC-CICD.md`](deployment-source/obs-companion/docs/AGENTIC-CICD.md) for the GitHub workflow.

## Contribution flow

1. Create a branch and edit through GitHub, Codespaces, or a local clone.
2. Open a pull request. CI installs the locked dependencies, runs all 27 tests with FFmpeg, builds both interfaces, audits production dependencies, and validates Compose.
3. Merge to `main`. The same checks run again, then GitHub deploys through a restricted forced-command SSH key.
4. The VPS rebuilds and recreates only the `studio` service, preserves its data volume and private runtime configuration, waits for authenticated OBS/HTTP health, and automatically rolls back source/image state if the new service fails.

No VPS password, application token, OBS password, or provider key is stored in Git.

