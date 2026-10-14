# Relay — your personal AI workspace

A self-hostable, **single-owner** AI agent built with Next.js 16, React 19, TypeScript and optional PostgreSQL. Run it on your laptop, a Node.js host, or Vercel. Connect Ollama, OpenAI or another OpenAI-compatible API.

## What's included

- Chat, searchable history, PDF/text uploads and reusable, manually triggered workflows.
- **PostgreSQL persistence:** conversations, document text, workflows, activity and theme survive browser changes.
- **Encrypted connections:** AI API keys, Google OAuth client secrets and Google access/refresh tokens are encrypted at rest in PostgreSQL. Saved secrets are never returned by the settings API.
- **AI settings:** provider, model, API key and editable endpoint; save, reset, and test the saved connection.
- **Google APIs settings:** save a Google OAuth client ID/secret, then authorize Gmail and Google Sheets.
- **Gmail:** search/read messages and prepare outgoing emails. **Google Sheets:** append reviewed rows to an existing spreadsheet.
- Approval is required for every email send and spreadsheet write. PostgreSQL prevents a submitted approval ID from being executed again by another server instance.
- **Six themes:** green/white, black/white, red/white, blue/white, yellow/white and gold/white.
- Database health checks, visible save status, conflict protection and a downloadable backup when syncing fails.

Without `DATABASE_URL`, Relay still works with browser-local history and encrypted HTTP-only cookies for saved connections. There are no bundled AI keys, Google accounts or simulated successful actions.

## Laptop setup — Windows, macOS or Linux

Install **Node.js 22 LTS** (minimum 20.9). Extract the project ZIP and open a terminal in the folder containing `package.json`.

```sh
npm ci
npm run setup
```

The setup command creates `.env.local` from `.env.example` if needed and generates missing `SESSION_SECRET` and `APP_PASSWORD` values. It preserves existing settings. **Open `.env.local` to find your workspace password.** Never upload this file or send it in chat.

For development:

```sh
npm run dev
```

Open **http://localhost:3000** and sign in with `APP_PASSWORD`.

For everyday production-mode use:

```sh
npm run build
npm start
```

Keep the terminal open. Press Ctrl+C to stop. After changing `.env.local`, restart the server. If changing code, rebuild before using `npm start` again.

> The commands bind to `0.0.0.0` for preview/container compatibility. Keep password protection enabled, use your firewall and do not expose the app publicly without HTTPS. For loopback-only development: `npx next dev --hostname 127.0.0.1`.

### If saving an API key previously failed

Run `npm run setup`, restart Relay, sign in and try saving again. Saving connections requires a stable `SESSION_SECRET` of at least 32 characters. If you already set a shorter secret manually, replace it with a generated strong value **before** using encrypted persistence. Never rotate a working encryption key without backing up/decrypting its saved credentials first.

## PostgreSQL: make chats and API settings permanent

### 1. Create a database

Install PostgreSQL locally (the Windows installer includes pgAdmin), or create a hosted PostgreSQL database. In pgAdmin, create a database named **`relay`**. Use a dedicated database/user for this app.

### 2. Configure the server

Add your connection string to `.env.local`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@localhost:5432/relay
APP_URL=http://localhost:3000
```

Use the username/password you created during PostgreSQL setup. URL-encode special characters in the username or password. Hosted providers should supply a TLS-enabled connection string; use their recommended pooled URL for Vercel/serverless hosts. Certificate verification is not disabled by the app.

Keep the generated `APP_PASSWORD` and `SESSION_SECRET`. Both are required in database mode because every authorized browser accesses the same owner workspace.

### 3. Initialize tables and restart

```sh
npm run db:migrate
npm run dev
```

For production mode, stop the old server, run `npm run build`, then `npm start`.

The migration is safe to rerun; it doesn't delete existing data. It creates `relay_settings`, `relay_workspace`, and `relay_action_claims`.

### 4. Verify

Open **Settings → Database → Check database connection**. The status should be Connected. After editing chats or themes, wait for **Saved to PostgreSQL** before closing the page.

Important behavior:

- On the first connection, browser history is imported **only if the database workspace is empty**. Existing database data takes priority.
- Existing cookie-only API/Google credentials are not automatically migrated. Re-save AI and Google client settings, then reconnect Google, after enabling PostgreSQL.
- Database history is loaded after sign-in. Another device can access it with the same workspace password and app URL; reload that device to see new changes. This is not real-time collaborative editing.
- Every save uses a revision number. If two tabs edit the same workspace, a stale save is rejected rather than overwriting the newer data. Download your unsaved backup before reloading to resolve a conflict.
- If the database is unavailable, the app shows an error; it does **not** pretend to save or silently fall back to cookie-based credentials. A browser copy of history is retained for recovery.
- Activity → Clear workspace data removes shared chat/history/workflows after the next successful database save. It leaves API credentials intact.
- Back up PostgreSQL **and** `SESSION_SECRET`. Changing the secret makes stored credentials unreadable. Restore the original secret or remove and re-enter saved connections.

## Connect an AI

### Ollama on your laptop

Install and start Ollama, then download a model:

```sh
ollama pull qwen2.5:7b
```

In **Settings → AI model**, select Ollama:

- Model: `qwen2.5:7b`
- API endpoint: `http://localhost:11434/v1`
- No API key required.

Choose **Save connection**, then **Test saved connection**. If needed, start Ollama with `ollama serve` in another terminal. A port-in-use error normally means it's already running.

Or configure environment defaults:

```dotenv
AI_PROVIDER=ollama
AI_MODEL=qwen2.5:7b
AI_BASE_URL=http://localhost:11434/v1
```

Use a model with function/tool-calling support for Gmail and Sheets. Small models can be less reliable at structured extraction. Ollama and its model must be installed separately; they are not included in this repository.

### OpenAI

Select OpenAI, enter the model and API key, then save and test. Alternatively:

```dotenv
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
AI_API_KEY=your-api-key
```

API usage may incur provider charges. A blank key field preserves the saved key for the same provider. **Use server defaults** removes the saved model connection and restores environment settings.

### Another OpenAI-compatible API

Allow the endpoint's exact origin in `.env.local`, then restart:

```dotenv
AI_ALLOWED_ORIGINS=https://your-inference-host.example
```

In Settings select Other API and enter:

- API endpoint: `https://your-inference-host.example/v1`
- Model: your provider's model ID
- API key: if required by that provider

The endpoint must support `/chat/completions`, with function tools for Google actions. OpenAI, local Ollama and origins from `AI_BASE_URL`/`OLLAMA_BASE_URL` are already allowed. Origins are exact matches, not arbitrary URLs. URL credentials/query strings/fragments and redirects are rejected. Only trusted server administrators should edit the allowlist.

Environment-only configuration is also available:

```dotenv
AI_PROVIDER=compatible
AI_BASE_URL=https://your-inference-host.example/v1
AI_MODEL=your-model-id
AI_API_KEY=your-key-if-required
```

Saved Settings take precedence over environment defaults. For a separate Ollama endpoint when switching providers, use `OLLAMA_BASE_URL`.

## Gmail API and Google Sheets API

**A Google API key alone cannot access your private inbox or spreadsheets.** These integrations use OAuth authorization.

1. In Google Cloud, create a project and enable **Gmail API** and **Google Sheets API**.
2. Configure the OAuth consent screen. For private testing, add your Google email as a test user.
3. Create an OAuth client of type **Web application**.
4. Register this redirect URI for local use:
   ```text
   http://localhost:3000/api/google/callback
   ```
5. In Relay, open **Settings → Google APIs**. Enter the client ID and client secret and choose **Save Google credentials**.
6. Click **Connect Google account** and authorize your account. You can also connect from Connections.

With PostgreSQL configured, both client credentials and tokens are encrypted in the database, so the account remains available after signing in from a different browser. Without PostgreSQL, they are kept in encrypted HTTP-only cookies for up to 30 days.

Environment credentials are also supported:

```dotenv
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

Requested scopes: `openid`, `email`, `gmail.readonly`, `gmail.send`, `spreadsheets`. Gmail scopes may require verification for public distribution; this starter is intended for one private owner/test account. Google's testing-mode refresh tokens may expire after seven days.

Disconnect removes saved account tokens. Removing saved Google credentials also disconnects the account, with any environment credentials remaining available. To revoke the grant completely, remove Relay in your Google account's third-party access settings.

### Example tasks

- “Draft an email to alex@example.com saying the report is ready. Subject: October report.” Review the full recipient, subject and body, then approve.
- “Find my unread emails from this week and help me prepare replies.” Reading doesn't require individual approval; sending does.
- Attach a selectable-text PDF: “Extract invoice number, customer, date and total, then append rows to Sheet1!A:D in this spreadsheet: [your URL].” Review every row before approving.

Outgoing reply content is sent as a **new email**, not a threaded Gmail reply. Supply an existing spreadsheet URL/ID and tab; spreadsheet creation and Drive discovery aren't implemented.

## Choose a theme

Open **Settings → Appearance**. Choose **Green & white, Black & white, Red & white, Blue & white, Yellow & white, or Gold & white**. The theme applies to the entire app immediately. It is stored with the workspace in PostgreSQL, or locally if no database is configured. All six are light themes with a white canvas, not dark mode.

## Vercel and other hosting

Import the repository into Vercel using the Next.js preset and the branch containing this code. Set:

- `APP_PASSWORD`, stable `SESSION_SECRET`, and `APP_URL=https://your-domain`
- `DATABASE_URL` for hosted PostgreSQL (optional, recommended)
- AI/environment settings and endpoint allowlist as needed

Run `npm run db:migrate` against that database once from your machine or deployment tooling. Do not put migrations into every request. Set the matching HTTPS Google callback URI in Google Cloud. Use a pooled database URL with serverless hosting; each app instance uses up to three connections.

**Vercel hosts the app, not Ollama or the AI model.** A cloud deployment cannot reach your laptop at `localhost`. Use an API or a separately hosted, secured inference server. Never expose an unauthenticated Ollama port to the internet.

On another Node.js host, run `npm run build` then `npm start`. Use HTTPS, a firewall/reverse proxy and external rate limiting. The proxy must preserve Host/Origin; `APP_URL` must match the public origin without a trailing slash. Chat requests request a 60-second budget; actual hosting-plan limits still apply.

## Storage and security

| Data                                                 | With PostgreSQL                                      | Without PostgreSQL                  |
| ---------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| Chats, extracted text, workflows, activity, theme    | Database JSON workspace + browser backup             | Browser localStorage                |
| AI keys, Google client secret, access/refresh tokens | AES-256-GCM encrypted database values, purpose-bound | Encrypted HTTP-only SameSite cookie |
| Original document                                    | Request memory only                                  | Request memory only                 |
| Pending approval token                               | Memory only; 15-minute expiry                        | Memory only; 15-minute expiry       |
| Used approval ID                                     | Unique PostgreSQL claim, retained across restarts    | Process cache and signed cookie     |

- This is a **single-owner app**, not a multi-tenant SaaS. Every signed-in browser uses the same database workspace/accounts.
- All server mutations require same-origin requests and workspace authentication. Password protection is mandatory on Vercel and in database mode.
- Model/Google API responses return saved-state flags, never secret values. API calls happen server-side. Database errors avoid exposing connection strings.
- Chats themselves are not application-encrypted; use encrypted storage/backups and appropriate database access controls. Attached text and relevant email results go to the selected AI provider.
- Treat documents/emails as untrusted. Prompt injection is still possible: read every proposed action carefully. Arbitrary shell commands, browsing and desktop control are not implemented.
- Gmail headers reject newlines. Sheets writes use RAW values, so formulas aren't evaluated.
- Approval claims are inserted atomically **before** calling Google. An uncertain failure remains claimed; there's no automatic retry of a side effect. Check Gmail/Sheets before preparing another action. Database idempotency prevents replay of the same ID, not a user creating a new duplicate proposal.
- Signing out clears auth and cookie-only connections, but leaves PostgreSQL connections/history and browser history. Clear browser data before using a shared computer.
- Login throttling is process-local. For public use, add WAF/platform rate limits and monitoring.

## Current limits

- No scheduler, automatic polling or unattended email auto-replies yet. Workflows are manual prompts. A durable worker/queue, recipient/content rules and a kill switch are needed before automatic sending.
- No OCR. PDFs must have selectable text. Uploads are limited to 3 MB, first 50 PDF pages and 40,000 extracted characters; truncation is shown.
- One attachment per message; up to 24 recent non-error messages are sent to the model.
- A saved workspace is limited to approximately 3.4 MB, 300 conversations, 500 messages per conversation, 200 workflows and 200 activity events. Export/clear large histories if needed.
- Responses aren't token-streamed. Stopping cancels the browser wait; an in-flight model call can still incur cost.
- No real-time multi-tab sync: refresh to see changes from another tab/device. A conflict is surfaced and never overwritten automatically.

## Extend and test

```text
lib/db.ts, db/schema.sql          PostgreSQL connection, schema and action claims
lib/secrets.ts                   Purpose-bound at-rest credential encryption
lib/connection-store.ts          Database or encrypted-cookie connection storage
lib/ai.ts, lib/endpoint.ts       Model configuration and endpoint allowlist
lib/google*.ts                  Google client configuration, sessions and requests
lib/workspace-data.ts            Validated history payloads; approval tokens stripped
app/api/workspace/               Revision-controlled workspace load/save
app/api/config/, google/config/  AI and Google credential settings APIs
app/api/chat/, actions/          Model tool orchestration and approved execution
components/use-workspace-storage.ts  Autosave, browser backup and conflict handling
components/settings-extras.tsx  Google, database and appearance controls
app/themes.css                  Six color theme tokens
```

Add constrained tools in `lib/tools.ts`, validate all model-generated arguments and route writes through approval cards. Introduce a separate durable worker and tightly controlled permissions before enabling unattended automation.

```sh
npm run typecheck
npm test
npm run build
npm audit
```

Browser tests assume an unconfigured dev server on port 3000:

```sh
npx playwright install chromium
npm run dev
# In a second terminal:
npm run test:e2e
```

`TEST_BASE_URL` changes the base URL; `CHROMIUM_PATH` uses an existing Chromium executable. Real PDF extraction, settings UI, themes, approval/cancel UI, history and responsive navigation are tested; model/Google action UI uses mocks where marked.

Opt-in real PostgreSQL integration tests require a **dedicated database named `relay_test`** and a separate configured test app. They reset test tables. Set `TEST_DATABASE_URL`, `TEST_SERVER_URL`, `TEST_APP_PASSWORD` and `TEST_SESSION_SECRET`, then run `npm test`. For PostgreSQL browser tests also set `TEST_DB_APP_URL` and `TEST_APP_PASSWORD` when running `npm run test:e2e`. Never point these tests at your real workspace.

Live Google authorization, Gmail sends/Sheets appends and real provider inference still require your own credentials and internet access. No live emails are sent by the test suite.
