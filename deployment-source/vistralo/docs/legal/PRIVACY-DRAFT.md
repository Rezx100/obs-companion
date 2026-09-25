# Vistralo privacy notice — DRAFT, NOT PUBLISHED

Effective date: `{{EFFECTIVE_DATE}}` · Operator: Dynamix LTD · Address: Mirpur 12, Eastern Housing, Road10, House 123, 2nd Floor, Bangladesh · Privacy contact: `{{PRIVACY_EMAIL}}`

This draft describes the current local desktop application and single-operator browser studio. It must be verified against the deployed service before publication. Dynamix LTD must identify when it acts as controller for account/operational data and when it processes customer recordings on a customer's instructions. If the product remains personal/self-hosted software, rewrite this notice to reflect that deployment model.

## What Vistralo handles

The desktop stores project names, recordings, audio, screenshots, captured website measurements, edit plans, job records and exports on the user's computer. Provider API credentials are stored separately using the operating system's protected storage on the same Windows account. The server studio stores uploaded media and projects on its private server volume, including partial uploads for resume. A capture can incidentally include people, voices, page text, account details or other personal information visible in a recording. The customer chooses what to record and upload.

The browser studio uses a required authentication session cookie and local browser storage for an upload resume reference. At login, the server issues a session ID that normally expires in 12 hours; sessions are held in server memory and end after a server restart. The upload reference contains an upload ID associated with project, media kind and file checksum. Dynamix LTD must inventory actual web/server access logs before stating what IP addresses, device details or diagnostics it retains.

## Purposes and legal basis — complete after operator review

| Purpose | Data | Legal basis for EEA/UK processing | Retention |
| --- | --- | --- | --- |
| Deliver recording, upload, editing, rendering and downloads | Customer content and project/job records | `{{BASIS_AND_CONTROLLER_PROCESSOR_ROLE}}` | `{{PROJECT_RETENTION}}` |
| Authenticate and protect the studio | Session ID, access attempts and operational logs | `{{BASIS}}` | `{{SESSION_AND_LOG_RETENTION}}` |
| Perform optional approved AI analysis | Selected frames and evidence sent to OpenAI | `{{BASIS}}` | `{{PROVIDER_RETENTION}}` |
| Perform optional approved voice generation | Approved script sent to HeyGen | `{{BASIS}}` | `{{PROVIDER_RETENTION}}` |
| Respond to support/privacy requests | Contact details and request records | `{{BASIS}}` | `{{SUPPORT_RETENTION}}` |

Provider calls require explicit user approval in the product. The OpenAI request sets `store:false`; that request option alone is not a complete promise about provider retention or training. Confirm current provider terms before making a stronger statement. There is no marketing or analytics integration in the inspected application source.

## Recipients and transfers

Server hosting and backups: `{{HOST_AND_BACKUP_SUBPROCESSORS_COUNTRIES}}`. Optional OpenAI and HeyGen processing occurs only when approved: `{{PROVIDER_ENTITIES_LOCATIONS_TRANSFER_SAFEGUARDS}}`. Add any support, payment, email, telemetry or marketing vendors actually used. If EEA/UK data moves abroad, state the applicable adequacy decision or transfer mechanism and how users can obtain it. List `{{EU_REPRESENTATIVE_IF_REQUIRED}}`, `{{UK_REPRESENTATIVE_IF_REQUIRED}}` and `{{DPO_IF_REQUIRED}}` where applicable.

## Retention, protection and requests

Define actual deletion periods for complete and incomplete uploads, recordings, outputs, session records, logs and backups. Explain whether deleting a project removes all replicas and when a backup ages out: `{{DELETION_AND_BACKUP_POLICY}}`. The current server uses a private volume and loopback-only HTTP accessed over an SSH tunnel; do not claim end-to-end encryption or independently restorable backups without verification. The desktop vault uses Electron safeStorage on Windows, while recordings and project files are separate from that vault.

People may have rights to access, correct, erase, restrict, object, port data or withdraw consent depending on their location and applicable legal basis. Send requests to `{{PRIVACY_EMAIL}}`; describe verification, response time and any customer-controller routing at `{{RIGHTS_PROCESS}}`. EEA users can complain to a relevant data protection authority; UK users can complain to the ICO. Add California and other applicable US state rights, appeal/opt-out methods and notices after applicability and actual practices are confirmed. Do not imply a “Do Not Sell or Share” mechanism exists when it has not been implemented.

Contact: Dynamix LTD, Mirpur 12, Eastern Housing, Road10, House 123, 2nd Floor, Bangladesh; email `{{PRIVACY_EMAIL}}`. Material changes: `{{NOTICE_CHANGE_PROCESS}}`.
