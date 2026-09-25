# Vistralo legal publication gate

**Drafts only — not approved legal notices. Do not copy these to a public page or describe Vistralo as legally compliant.** The desktop and browser studio currently have no legal-policy links. The MIT software license and upstream notices remain in place; they do not replace a service privacy notice or customer terms.

The drafts here map observed product behavior to information a reviewer needs. Replace every `{{FIELD}}` with verified operator facts, confirm the architecture and business model, obtain jurisdiction-appropriate legal review, then publish versioned notices and link them from the desktop onboarding/settings, browser studio login/footer, and any marketing or signup page **before** public signups or personal-data collection. Show material updates to existing users and retain the prior versions.

## Verified product data map (source branch, 25 September 2026)

| Operation | Data and location | Disclosure question |
| --- | --- | --- |
| Desktop recording | Video/audio, website evidence, project names and job history in a SQLite library under Documents; settings and encrypted provider credentials under Electron userData | Who has access to the local Windows account and backups? What deletion/export process is supported? |
| VPS studio | Uploaded recordings, evidence, project/job records and outputs under `/data/projects`; OBS state under `/data/home` in one persistent Docker volume | Hosting country, retention/backup period, deletion after request, access controls and disaster recovery |
| Browser authentication | `vistralo_session` HttpOnly, SameSite=Strict session cookie, normally 12 hours; browser localStorage holds a resumable-upload ID keyed by project/kind/file digest | Confirm exact cookie expiry and retention; old cookie is cleared on login/logout |
| Website capture | Fresh isolated Chromium profile, visited public site URLs, screenshots, measured DOM/styles/animation metadata and recording | Recordings can contain third-party personal data; customer must have authority to capture and upload |
| Optional AI analysis | User-approved selected frames, manifest/measurements and task prompt sent to OpenAI Responses with `store:false` in the request | Confirm OpenAI account terms, actual provider retention, transfer mechanism and subprocessor role |
| Optional speech | User-approved script sent to HeyGen; returned audio saved to the project | Confirm provider contract, data location, retention and voice authorization |
| Operational data | Server may hold project IDs, uploaded filenames, checksums, IP/session data during requests and standard container logs | Inventory actual logs, host access, backup location and retention; avoid claiming logs contain no personal data |

There is no account system for 500 separate users in this version: the studio uses a shared token and in-memory sessions. Do not launch it as a multi-user service based on these draft notices. No analytics or advertising SDK was found in the inspected source; reassess when a marketing site, telemetry or payment service is added. “No sale/share” and “no model training” are not legal statements until all provider terms and actual operations have been checked.

## Decisions required before publication

1. Legal operator name, registration and postal address; privacy/support email; role as controller or processor for each data set; age/audience; whether service is sold to US, EEA or UK residents.
2. Hosting and backup countries; exact retention/deletion schedule for projects, uploads, sessions, logs, backups and provider data; rights request identity-check and response workflow.
3. OpenAI/HeyGen and host contracts, subprocessors, international transfer safeguards, and whether EU and UK representatives or a DPO are required.
4. Whether California CCPA/CPRA applies to the operator and whether data is sold/shared; other US state thresholds and rights if public service expands.
5. Commercial terms: service owner, payments/refunds (if any), acceptable use, customer recording rights, service availability, support, termination, dispute venue and liability provisions.
6. Tested account deletion/export paths and separate user authentication before multi-user release. A statement in a policy cannot substitute for an implemented request process.

## Regulatory references

- EU GDPR, Articles 13–14, 27 and 28: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679
- UK ICO privacy information checklist: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/checklists/
- UK ICO storage/access technologies: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/
- California current statute and regulations: https://cppa.ca.gov/regulations/
- FTC guidance on truthful privacy representations: https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/01/ai-companies-uphold-your-privacy-confidentiality-commitments
