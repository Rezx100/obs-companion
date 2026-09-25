# Repository agent guide

The deployable application is in `deployment-source/obs-companion`. Read its `AGENTS.md` before changing application code.

Use a branch and pull request for normal work. Run `npm ci`, `npm test`, `npm run build`, `npm run build:server`, and `npm audit --omit=dev` from the application directory. Update acceptance evidence when behavior changes.

Merging to `main` runs the same validation and deploys only OBS Companion to the production VPS. A maintainer can also run the `Agentic CI/CD` workflow manually from `main`. Deployment must preserve `deploy/runtime.env` and the `obs-companion_studio-data` volume.

Never commit credentials, private keys, `runtime.env`, provider tokens, recordings, or user project data. GitHub Actions receives only a restricted deployment key; do not broaden its forced command or add general-purpose remote-shell behavior.

