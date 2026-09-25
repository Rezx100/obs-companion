# Third-party runtime components

The container installs OBS Studio, FFmpeg and their dependencies from Ubuntu packages. Their respective licenses and source availability apply. OBS Studio remains a separate executable controlled using its WebSocket API; this project does not relicense OBS Studio.

`seccomp_profile.json` is copied unchanged from Microsoft Playwright v1.58.2:
https://raw.githubusercontent.com/microsoft/playwright/v1.58.2/utils/docker/seccomp_profile.json

SHA-256: `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`.
Its Apache-2.0 license is included as `LICENSE.playwright`.

The browser upload checksum worker bundles crypto-js 4.2.0 (MIT); the installed dependency contains its license. See package-lock.json for all Node dependency versions and integrities. Rebuild the worker with `npm run build:server`.

Base images are version-tagged, not yet verified/pinned by digest. Ubuntu package versions are recorded inside a successful build in `/app/deploy/installed-packages.txt`. A deployed image digest/export is still required for byte-for-byte container reproduction; no such build is claimed from this workspace.
