# Cookies and device storage — DRAFT, NOT PUBLISHED

The browser studio currently uses `vistralo_session`, a first-party HttpOnly, SameSite=Strict authentication cookie with a nominal 12-hour maximum age (Secure when every allowed origin is HTTPS). Logout clears it. A legacy `obs_session` cookie is cleared on login/logout during migration. Browser localStorage stores a resumable upload reference associated with project, media kind and SHA-256; it is removed when an upload completes or is invalidated. The desktop uses local project/settings/credential storage and is not a browser cookie deployment.

There are no advertising or analytics scripts in the inspected application source. Verify the production reverse proxy, marketing site and any future third-party scripts before publishing this statement. Explain these essential storage operations in the final privacy/cookie notice. If non-essential analytics, tracking or similar device storage is added, assess EU/UK consent requirements and implement controls **before** setting it; a generic banner alone does not make the practice compliant.

Operator Dynamix LDT · Contact `{{PRIVACY_EMAIL}}` · Effective `{{EFFECTIVE_DATE}}`.
