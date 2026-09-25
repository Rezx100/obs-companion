# Provider configuration and spending

Recording, website evidence and local editing require no cloud credentials. The app does not inherit ChatGPT connector credentials, subscriptions or billing.

## HeyGen

Exact voice: `02dbea5e083144c884525b7d9260bec6`, **Rezan Ferdous -- 62**, the user's Boya clone. Read-only connector checks on 2026-09-25 confirmed its identity and appearance in the private Starfish voice list. The older Rezan Original voice is never a fallback.

Add a standalone HeyGen API key in Settings, then Verify voice access. The adapter checks the direct voice endpoint and paginated Starfish-compatible private list. Speech uses `POST /v3/voices/speech`, plain text, speed 1.0 and the exact voice ID. A generation is at most 5,000 characters. Response handling and live billing remain unverified until an explicitly approved paid acceptance call is made through this app.

Selective mouth editing in existing presenter footage has no verified integration in this release. No generated/recreated talking head is substituted. Voice-only replacement deliberately leaves the video stream untouched and can leave lip mismatch.

## Visual analysis

Add an OpenAI API key and choose a model that your account actually supports for visual input. No “Astra” endpoint is assumed. The adapter uses the Responses API, sends selected reviewed evidence frames plus bounded metadata, disables storage and tools, and caps response output tokens at 4,000. This does not itself provide an exact dollar cap. The returned model and evidence selection are persisted. Generated analysis is a review draft; it is never executable instructions or an automatic edit plan.

## Per-request approval

No paid generation was performed during this build. Obtain current prices for the exact account/API/model and conservatively estimate the entire request including image input and output. Enter the quote/rate source, estimate, and cap in the UI. Set a provider-side account/project budget where supported. The app's cap checks the declared estimate; **it cannot guarantee that a third-party provider's charge will remain below a user-entered estimate**. This is a remaining production limitation, not a verified spend-control guarantee.

Before submission the app writes a unique fingerprint and reservation to SQLite. Concurrent duplicate submissions are rejected. A network timeout, cancellation after submission, 5xx or crash with uncertain outcome stays Unknown, and is not automatically retried. Reconcile unknown requests through the provider's account/support using recorded request/job IDs. This preview does not automatically reconcile an unknown provider request or resume a failed download after a successful speech charge. Do not create a new project to bypass uncertainty.

Keys are encrypted with Electron safeStorage (Windows DPAPI on Windows) in application user data, not in project folders. Do not paste API keys into scripts, quotes, project names or evidence. No usage logs contain keys or raw provider error bodies. Clear/reconfigure credentials only on the intended Windows account.

Provider references checked during build: https://www.heygen.com/blog/heygen-api-guide ; https://platform.openai.com/docs/api-reference/responses . Production pricing and selective lip-sync contracts require fresh verification before enabling those workflows.
