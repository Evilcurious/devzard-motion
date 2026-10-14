# Relay — a personal AI agent workspace

A self-hostable, single-owner agent built with **Next.js 16, React 19 and TypeScript**. Run it on your PC, on a Node.js host, or on Vercel. Bring an OpenAI API key, an OpenAI-compatible provider, or your own Ollama model.

## What works

- **Chat:** persistent browser-side conversations, search, follow-ups, stop response and clear history.
- **Documents:** extract text from PDF, TXT, CSV, Markdown and JSON; attach it to a conversation. The original file is processed in memory, not saved to disk.
- **Gmail:** search/read messages and prepare outgoing emails for review.
- **Google Sheets:** extract structured rows from a document or instructions, then append them to an existing spreadsheet.
- **Explicit approval:** every email send or spreadsheet write requires an approval-card click. The server executes the encrypted proposal, not client-supplied replacement arguments.
- **Workflows:** create, save and manually launch reusable prompts. Three useful starters are included.
- **Activity:** a local log of document reads and submitted actions.
- **Model settings:** select OpenAI, Ollama or an OpenAI-compatible endpoint; securely save an API key, choose a model and test the connection.
- **Responsive UI:** desktop/mobile navigation, searchable workspace, setup guide and connection status.

There is **no fake AI or fake connected account**. Without configuration, the app explains what to connect. No AI or Google credentials are bundled.

## Run on your computer

Requires **Node.js 20.9+** (Node 22 recommended).

```sh
npm install
cp .env.example .env.local
# Windows PowerShell: Copy-Item .env.example .env.local
```

Generate a secret (works on Windows too):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `.env.local`:

```dotenv
SESSION_SECRET=your-generated-random-secret-at-least-32-characters
APP_PASSWORD=choose-a-strong-workspace-password
APP_URL=http://localhost:3000
```

Then run:

```sh
npm run dev
```

Open **http://localhost:3000**. Enter your workspace password, then open **Settings**.

> The dev/start commands bind to `0.0.0.0` for container and preview compatibility. Use a password and a firewall even on your own computer if other devices can reach it. For loopback-only development use `npx next dev --hostname 127.0.0.1`.

### Choose an AI provider

**OpenAI** — enter your API key and model in Settings, or set these server variables:

```dotenv
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
AI_API_KEY=your-api-key
```

**Local Ollama** — install [Ollama](https://github.com/ollama/ollama), start it, and pull a model:

```sh
ollama pull qwen2.5:7b
```

```dotenv
AI_PROVIDER=ollama
AI_MODEL=qwen2.5:7b
AI_BASE_URL=http://localhost:11434/v1
```

Use a model with tool-calling support for Google actions. Smaller models may be less reliable at structured extraction and tool use. Ollama supplies its OpenAI-compatible API at `/v1`.

**Other providers / self-hosted inference**:

```dotenv
AI_PROVIDER=compatible
AI_BASE_URL=https://your-inference-server.example/v1
AI_MODEL=your-model-id
AI_API_KEY=your-key-if-required
```

The inference server must implement OpenAI-style `/chat/completions`, including function tools for integrations. Endpoint URLs are configured **only on the server**, not from untrusted requests. When switching between providers in the UI, `OLLAMA_BASE_URL` can override the Ollama endpoint independently of `AI_BASE_URL`.

Saved UI settings take precedence over environment defaults in that browser. An empty API-key field preserves the existing key for the same provider. Secrets are encrypted with AES-256-GCM in HTTP-only, SameSite cookies; they are not written to localStorage or Git. Clearing cookies or signing out removes these overrides. A stable `SESSION_SECRET` of at least 32 characters is required for saving connections. Restart/redeploy after changing environment variables.

### Connect Gmail and Google Sheets

1. Create a Google Cloud project.
2. Enable the **Gmail API** and **Google Sheets API**.
3. Configure the OAuth consent screen. For a private development app, leave it in testing and add your own Google email as a test user.
4. Create an OAuth client of type **Web application**.
5. Add this exact authorized redirect URI:
   ```text
   http://localhost:3000/api/google/callback
   ```
6. Add the credentials to `.env.local`:
   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
7. Restart the app. Open **Connections → Connect Gmail** (or Sheets) and authorize Google.

One connection authorizes both tools. Requested scopes: `openid`, `email`, `gmail.readonly`, `gmail.send`, and `spreadsheets`. The Google Sheets scope permits editing spreadsheets accessible to your account; Relay's current tool is restricted to appending rows. Broad Gmail scopes may require Google verification for distribution to other users; this starter is intended for a private owner/test account. Google testing-mode refresh tokens may expire after seven days.

Disconnect removes the local encrypted session. To revoke the OAuth grant altogether, remove the app from your Google account's third-party access settings.

### Try a real task

- **Email:** “Write an email to alex@example.com saying the report is ready. Subject: October report.” Review the recipient, subject and full body, then choose **Approve & send**.
- **Inbox:** “Summarize my unread emails from this week and help me prepare replies.” Relay reads up to 10 search results per call; it asks for approval before sending.
- **PDF → Sheets:** attach a text-based PDF, give the spreadsheet URL/ID, tab and desired columns. For example: “Extract invoice number, customer, date and total. Append them to Sheet1!A:D in this spreadsheet: …”. Review every row before approving.
- **Reusable task:** create a workflow containing your instructions, then choose **Start workflow** to load it into a new conversation. You still press Send to run it.

Outgoing reply content is sent as a **new email**, not a Gmail-threaded reply.

## Deploy on Vercel

1. Import this repository into Vercel using the Next.js preset.
2. Set `APP_PASSWORD`, a stable `SESSION_SECRET`, `APP_URL=https://your-app-domain`, and the AI configuration variables.
3. Add Google client credentials if needed and register `https://your-app-domain/api/google/callback` in Google Cloud.
4. Deploy. The app refuses authenticated operations on Vercel without a password and a sufficiently long secret.

**Vercel runs the web app, not Ollama or an LLM runtime.** Use an AI API or a separately hosted inference server. A cloud deployment cannot access Ollama on your PC using `localhost`. Use a secured, HTTPS, publicly reachable inference endpoint or host the app and Ollama together on your own server. Never expose an unauthenticated Ollama port to the internet.

API routes use the Node runtime. The chat route requests a 60-second execution budget; your plan's limits still apply. PDFs are capped at **3 MB**, below Vercel's request-size limit.

For another Node host:

```sh
npm run build
npm start
```

Use HTTPS, a strong password, an appropriate reverse proxy, and external rate limiting for internet-facing deployments. Ensure the proxy preserves the request Host/Origin; `APP_URL` should match your public origin exactly, without a trailing slash.

## Data and security model

This is a **single-owner starter**, not a multi-tenant SaaS or an unattended autonomous worker.

| Data                                             | Location                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| API/environment secrets                          | Server environment, or encrypted HTTP-only cookie for UI overrides                       |
| Google access/refresh tokens                     | Encrypted HTTP-only cookie; refreshed server-side                                        |
| Chats, document text, custom workflows, activity | Browser localStorage; no cross-device sync                                               |
| Original document                                | Request memory only; not saved by the app                                                |
| Pending write capability                         | Encrypted, account-bound token; 15-minute expiry; not persisted to localStorage          |
| AI context                                       | Sent to the chosen inference provider, including attached text and relevant tool results |

- All API mutations require a same-origin request. All tools check workspace authentication.
- Uploaded text and email bodies are labeled as untrusted data. Prompt injection is still possible; **read every proposed recipient, message and row**. Read access to connected mail does not require per-message approval.
- Email headers are validated to prevent newline injection. Sheets use `RAW` values, not formula evaluation.
- Arbitrary shell commands, filesystem browsing, code execution and unrestricted browsing are **not implemented**.
- Side-effect requests are never automatically retried. The UI disables repeated clicks; signed used-action cookies and a process-local cache reject ordinary replay. **These are not durable distributed idempotency.** For multi-instance production workers, add a transactional database/queue with unique action IDs before enabling unattended execution. After an ambiguous network failure, check Gmail/Sheets before proposing a replacement action.
- Changing `SESSION_SECRET` invalidates existing sessions, connections and approvals. Set at least 32 random characters. Public deployments require HTTPS.
- Sign-out removes server-session cookies, **not browser history**. Use Activity → Clear local data before leaving a shared computer.
- Login throttling is process-local; use platform/WAF rate limiting for distributed deployments.

## Deliberate first-version limits

- **No scheduler, automatic inbox polling, webhooks, or unattended email auto-replies yet.** Workflows are manually triggered templates. Scheduled auto-replies require a background worker, durable credential storage, task queue, duplicate protection and explicit recipient/content rules.
- No OCR: scanned/image-only PDFs must be OCR'd first. At most the first 50 PDF pages and 40,000 characters are extracted; truncation is shown in the UI.
- One attachment per message. Up to 24 recent non-error messages are sent as context; very long conversations can exceed request/model limits, so start a new chat when needed.
- No arbitrary desktop control, WhatsApp, browser automation, Google Drive discovery or spreadsheet creation. Supply the existing spreadsheet URL and tab.
- Chat returns complete responses, not token streaming. “Stop” cancels the browser's wait; an in-flight inference request may still incur cost. Chat itself never executes writes.
- Local activity is capped at 200 records. Large document histories may fill localStorage. Clearing history is available in Activity.

## Extend the agent

```text
app/api/chat/route.ts             Model/tool orchestration and approval preparation
app/api/actions/route.ts          Verified approval execution
app/api/upload/route.ts           Text/PDF extraction
app/api/google/                   OAuth connect, callback, disconnect
app/api/config/route.ts           Encrypted model settings
app/api/auth/                     Workspace password session
lib/tools.ts                     Tool schemas, validators and executors
lib/google.ts                    Token refresh and Google requests
lib/security.ts                  Encryption, auth and same-origin checks
components/workspace.tsx         Chat, workflows, connections and activity UI
components/settings.tsx          Model settings and setup documentation
```

To add a capability, define a constrained function schema in `lib/tools.ts`, validate arguments, and implement its executor. Read-only tools use `readTool`; writes must go through `validateAction` and approval cards. Update the `WriteAction` union, UI review card and tests. Never trust model-produced arguments without validation.

For unattended automation later, introduce a database-backed credential vault, durable queue and separate worker. Vercel Cron can enqueue work, but should not be treated as a long-running agent. Add minimum scopes, allowlists, audit logs, retry policies, deduplication and a kill switch before granting automatic send permissions.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm audit
```

Browser tests assume the dev server is running with **no AI credentials/password configured**:

```sh
npx playwright install chromium
npm run dev
# In a second terminal:
npm run test:e2e
```

Set `TEST_BASE_URL` for another test server and `CHROMIUM_PATH` to use an existing browser. Tests cover real PDF/text extraction, local persistence, workflow creation, search, responsive navigation, origin checks, invalid approvals, and approval/cancel UI with mocked AI/Google responses. Unit tests cover encrypted capability tampering/expiry, header injection and constrained tool schemas.

Live provider calls and Google OAuth/send/append require your own credentials and network access. The preview environment may restrict outbound AI/Google connections even when the local app works; deploy or run on your own machine for live integration testing.
