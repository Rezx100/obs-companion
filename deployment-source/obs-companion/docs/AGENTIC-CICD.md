# Agentic GitHub CI/CD

The private GitHub repository is the only collaboration and deployment control plane agents need. Agents do not receive the VPS password, studio token, OBS WebSocket password, provider credentials, or an unrestricted server shell.

## Workflow

- Pull requests to `main` run the locked Node installation, all tests with system FFmpeg, both builds, production dependency audit, Compose validation, and deployment-script syntax checks.
- Pushes to `main` and manual runs from `main` repeat validation and then enter the `production` GitHub environment.
- Deployment concurrency is one. A second run waits instead of racing the active deployment.
- GitHub streams the reviewed application tree over SSH. No credentials are placed in the archive.
- The VPS forced command rejects archives over 50 MiB, traversal paths, links, `node_modules`, and `runtime.env`; preserves the existing private runtime configuration and volume; builds and recreates only `studio`; waits for authenticated composite health; and rolls back source/image state if health fails.

## GitHub configuration

The repository uses these production settings:

| Name | Type | Purpose |
| --- | --- | --- |
| `VPS_HOST` | Environment variable | VPS SSH hostname/address |
| `VPS_PORT` | Environment variable | VPS SSH port |
| `VPS_DEPLOY_KEY` | Environment secret | Dedicated private key whose public key is restricted to the deploy command |
| `VPS_KNOWN_HOSTS` | Environment secret | Pinned SSH host-key record |

GitHub collaborators with write access can create branches and pull requests. A collaborator permitted to merge to `main` or manually run the workflow can deploy. GitHub history records the actor, reviewed revision, validation, environment deployment, and logs.

## Rotation and revocation

To revoke deployment immediately, remove the dedicated line marked `obs-companion-github-actions` from `/root/.ssh/authorized_keys` on the VPS or delete `VPS_DEPLOY_KEY` from the production environment. Generate a new Ed25519 key, reinstall the public key with the same `restrict,command=...` options, and replace the GitHub secret to rotate it. Rotation does not affect studio/runtime credentials.

The deployment command installed on the VPS is the reviewed `deploy/github-deploy.sh`. Update the installed copy deliberately before relying on new deployer behavior; normal deployments cannot replace the root-owned forced command they are currently executing.

