# Relay — your personal AI workspace

An owner-managed AI workspace built with Next.js 16, React 19, TypeScript and **Neon Postgres** (hosted PostgreSQL). The owner keeps full control and can invite isolated user accounts. Relay can run on Vercel or another Node.js host. Connect Ollama, OpenAI, OpenRouter’s unified model API or another OpenAI-compatible API.

## What's included

- Chat, searchable history, PDF/text uploads and reusable, manually triggered workflows.
- **Neon Postgres persistence:** owner and invited-user conversations, activity, settings and encrypted credentials are separated by account; browser drafts are namespaced by account.
- **Encrypted connections:** AI API keys, Google OAuth client secrets and access/refresh tokens, and Vercel access tokens are encrypted at rest in PostgreSQL. Saved secrets are never returned by the settings API.
- **Multi-provider model router:** discover eligible models, pin an explicitly selected model to every reply, or auto-select and fail over only while Auto-pick is enabled.
- **Models & providers:** provider, model, API key and editable endpoint; save, reset and test the saved connection.
- **One-click Google OAuth:** sign in once to connect Gmail and Google Sheets; deployment-level OAuth configuration is handled by the Relay owner.
- **Gmail:** search/read messages and prepare outgoing emails. **Google Sheets:** append reviewed rows to an existing spreadsheet.
- **Vercel connection:** securely connect an account, select a project, and inspect recent deployment states/links.
- Approval is required for every email send, spreadsheet write and GitHub code push. GitHub changes go to a new branch; Relay never changes the default branch directly.
- **Personalized appearance:** eight balanced light/dark and softly tinted themes, a color picker, eight font families and custom WOFF2/WOFF/TTF/OTF font uploads.
- **Chat-first workspace:** readable assistant/user layout, automatic model selection, image generation, Firecrawl web search with sources, and Relay answers creator questions with “Faizan made me.”
- **Generated code bundles:** ask Relay for code or a website to receive a downloadable ZIP. A self-contained `index.html` can be opened in a five-minute, isolated browser preview; this is not a public URL or deployment.
- **Invited accounts:** the owner chooses allowed models and a monthly token allowance; each invitee chooses their own username and password. Capped users are served only when the provider reports actual token usage; unknown usage is never estimated or charged against the cap.
- **Private provider access:** users may be limited to admin-assigned models or, when enabled, add their own provider keys. Admin-owned keys and provider settings are never shown to users.
- **Account-scoped analytics:** each user sees their own reported token usage; the owner can review account usage and manage access.
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

## Neon Postgres: save chats and API settings without a local database server

See **[docs/NEON-SETUP.md](docs/NEON-SETUP.md)** for the complete laptop setup. Neon hosts PostgreSQL; Relay and Ollama can continue running on your laptop. Existing standard PostgreSQL installations remain compatible.

### 1. Create/select a Neon project

Open Neon Console, click **Connect**, choose an existing database and role, enable connection pooling, and copy the full PostgreSQL connection string. No local PostgreSQL installation is needed.

### 2. Configure the server

Add the copied string to your private `.env.local`:

```dotenv
DATABASE_URL="paste-your-full-Neon-connection-string-here"
APP_URL=http://localhost:3000
```

The example is a placeholder, not a working account. Keep the actual database name from Neon (often `neondb`) and its SSL/channel-binding parameters. Do not change the name to `relay` unless you created that database. Copy plain text: no Markdown/mailto links and use `&`, not `&amp;`.

Relay detects Neon pooled/direct endpoints, requires certificate-verified TLS, and enables channel-binding support. Keep your original `SESSION_SECRET` and your Relay `APP_PASSWORD`. Both are required in database mode; the Relay password is separate from your Neon database password. Never commit a connection string containing a real password.

### 3. Initialize tables and restart

```sh
npm run db:migrate
npm run db:check
npm run dev
```

For production mode, stop the old server, run `npm run build`, then `npm start`.

The migration is safe to rerun; it does not delete existing data or move data from a different database. It creates the Relay settings, workspace, action, analytics, user, and invitation tables, and adds account ownership to existing analytics rows without replacing them.

### 4. Verify

Open **Settings → Database → Check database connection**. The status should be Connected. After editing chats or themes, wait for **Saved to Neon Postgres** before closing the page.

Important behavior:

- On the first connection, browser history is imported **only if the database workspace is empty**. Existing database data takes priority.
- Existing cookie-only API/Google account credentials are not automatically migrated. Re-save AI keys as needed, configure the deployment-level Google OAuth environment once, then reconnect Google after enabling PostgreSQL.
- Database history is loaded after sign-in. Another device can access it with the same workspace password and app URL; reload that device to see new changes. This is not real-time collaborative editing.
- Every save uses a revision number. If two tabs edit the same workspace, a stale save is rejected rather than overwriting the newer data. Download your unsaved backup before reloading to resolve a conflict.
- If the database is unavailable, the app shows an error; it does **not** pretend to save or silently fall back to cookie-based credentials. A browser copy of history is retained for recovery.
- Activity → Clear workspace data removes shared chat/history/workflows after the next successful database save. It leaves API credentials intact.
- Back up PostgreSQL **and** `SESSION_SECRET`. Changing the secret makes stored credentials unreadable. Restore the original secret or remove and re-enter saved connections.

## Owner and invited user accounts

Keep the existing owner `APP_PASSWORD`, stable `SESSION_SECRET`, and shared Neon `DATABASE_URL` configured on the Vercel project. Initialize or repair the Relay schema from **Settings → Database** before creating users. The migration is idempotent and preserves existing workspace history and settings.

As the owner, open **Settings → Accounts** to create a one-time invitation. Choose whether the user may use admin-assigned models only or may also add personal providers, select the assigned models, and set a monthly token allowance. Share the generated link privately; it expires after 24 hours and can be redeemed only once. The invitee chooses a unique username and password. Disabling an account revokes its sessions.

Each account has its own Neon workspace row, encrypted connection namespace, analytics scope, and browser-draft namespace. Users do not configure or connect a database. Users with a monthly cap can receive responses only from providers that report both input and output token usage; responses with unknown usage are blocked and do not consume a guessed amount. Personal OpenAI keys are billed by OpenAI separately from Relay’s token allowance. Reported usage from blocked over-limit responses is retained because the provider may have charged for it.

## Connect an AI

### Ollama on your laptop

Install and start Ollama, then download a model:

```sh
ollama pull qwen2.5:7b
```

In **Models & providers**, select Ollama:

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

### Local FreeLLMAPI server

For a FreeLLMAPI server running on the same computer as Relay, open **Models & providers → Use FreeLLMAPI settings**. The preset uses:

```text
http://127.0.0.1:31415/v1
```

Enter your API key, click **Load FreeLLMAPI models**, and select the exact model ID exposed by the local server. Then choose **Save connection → Test saved connection**. Relay checks `GET /v1/models`, calls the OpenAI-compatible `/chat/completions` route, and stores the key encrypted through its normal settings flow. If the local server does not implement model listing, enter its configured model ID manually. The loopback endpoint is narrowly trusted by default; no `AI_ALLOWED_ORIGINS` entry is needed. This URL points to the computer running Relay, so it will **not** reach your laptop's server when Relay is hosted on Vercel.

### OpenRouter (including free models)

OpenRouter provides one OpenAI-compatible API key and endpoint for its model catalog. In **Models & providers**, click **Use OpenRouter settings**, enter your OpenRouter API key, and keep the suggested model `openrouter/free` to let OpenRouter route to an eligible free model. The preset uses the exact base URL below and is trusted by default—no `AI_ALLOWED_ORIGINS` entry is needed.

```text
https://openrouter.ai/api/v1
```

Then choose **Save connection → Test saved connection**. Free-model availability, rate limits, context and tool support vary by the model OpenRouter routes to and by your OpenRouter account. If you use Gmail/Sheets actions and the selected free model does not support tools, choose a listed tool-capable model from OpenRouter and enter its model ID instead. Relay sends your key as a private bearer credential; it is never returned to the browser. Never paste it into chat or commit it.

### Multi-provider model router

Open **Models & providers** from the sidebar or click the model control in chat. Relay keeps this multi-provider catalog separate from the existing Settings connection. OpenRouter is included and an existing saved OpenRouter key is reused; you do not need to replace it. Up to five API keys per provider can be stored server-side in the existing encrypted cookie/Postgres secret store; key values are never returned to the browser. When a provider rejects one key for authentication, quota, or rate limits, Relay tries the other saved keys before moving to another eligible model. Each provider has a fixed HTTPS API host in code rather than a user-editable URL.

The catalog supports Google Gemini API, OpenRouter, SiliconFlow, Ollama Cloud, Kilo Gateway, OVH AI Endpoints, Agnes AI, Routeway, BazaarLink, Requesty, AI Horde, Electron Hub, xKiro, Septor Labs, BluesMinds, and an expanded set of OpenAI-compatible gateways from the FreeLLMAPI provider registry (including Speka, Kenari, KiosAPI, Typhoon, Plugsky, Inferbase, SimpleLLM, LLMTR, Gizmo, BlockRun, Experiential Labs, Router9, CLōD, BlazeAPI, Lucidity, Api.Airforce, DreamPrompting, Waterfall, Logfare, APINex, Onomeo, IteraCompute, B.AI, AnyAPI, LLM7, AINative, Aion Labs, NavyAI, NaraRouter, SEA-LION, OrcaRouter, UnoRouter, Baidu Qianfan, Volcengine Ark, LongCat, and iFlytek Spark). Select **Refresh models** to call each provider's model-list API; listings require a saved key where that provider requires one. After saving a model-provider key, Relay opens a provider-scoped model picker; the catalog also has an **All providers** / provider-specific filter. For BluesMinds, choose one of the model IDs returned for your saved key and click **Use model** to set it as Relay's active agent model. BluesMinds may omit quota fields from its model list, so authenticated account-listed models are selectable; your provider's own access and billing terms apply. Models returned by an authenticated Google Gemini key are selectable even when Google's model list omits quota metadata; your Google account's billing and limits remain authoritative. Relay also verifies and caches FreeLLMAPI's signed public catalog to enrich matching connected-provider routes with context, capabilities, and published monthly-budget labels. Those labels are reference metadata, not live remaining quota, and do not determine route eligibility; live balances and provider errors continue to come from each provider. Model Hub also displays account-credit balances reported by OpenRouter and SiliconFlow when those APIs return them; currencies are labeled and credits are not converted into token counts. For Ollama Cloud, Relay checks the official `/api/balance` endpoint and recognizes the documented free-usage-credit models—beam, gemma4:31b, gpt-oss:120b, gpt-oss:20b, nemotron-3-nano:30b, nemotron-3-super, and nemotron-3-ultra—when returned by the authenticated model list and included credits remain. Positive purchased credits apply to models returned by the authenticated list. A provider credit/quota error temporarily removes a model from auto-selection. Provider hosts and adapters are implementation templates and have not been live-validated against every account/region. The expanded FreeLLMAPI registry is an OpenAI-compatible gateway integration, not complete feature parity: Relay uses the shared chat API and provider-specific token-usage adapters for common OpenAI, Ollama, and Gemini response shapes. It also honors bounded `Retry-After` values from provider rate-limit/quota errors when cooling down a model. This is not an exhaustive port of every source-specific quota endpoint, authentication/header quirk, or image/audio/video adapter, and provider hosts/templates have not been live-validated against every account or region. AI Horde is volunteer-powered and can be slow; it does not support Relay's tool calls. Anonymous routes may be rate-limited.

Choose **Auto select** or **Fusion** in Models & providers. Auto select uses only models listed by the connected provider API that are explicitly free, report positive remaining tokens, or report positive account-level credits in a recognized response field (OpenRouter also uses its live balance/key endpoints). In chat, a manually selected model is pinned: only that model is tried, and an error is shown instead of silently switching. The chat composer includes Fast, Balanced and Deep agent profiles: Fast uses the faster output budget and observed-speed ranking, Balanced uses Relay’s default budget/ranking, and Deep uses a larger output budget with the largest-context route preference. These are routing/budget presets—not guarantees about model reasoning quality. The Route selector remains available for custom rankings. Relay also fits conversation history to the selected model’s known context window by prioritizing the newest complete turns; when it shortens context, the reply’s activity steps report the approximate reduction. Fastest and Most reliable use Relay’s observed successful requests over the last 30 days; reliability is ranked only after three observed calls. These preferences affect ordering only, never eligibility. Each assistant reply identifies the model that answered. Chat uses Server-Sent Events for token-by-token text streaming when the selected OpenAI-compatible endpoint supports it; tool-call deltas are assembled server-side and external actions still require the existing review/approval flow. Safe Auto-pick requests may hedge a second provider after 700 ms only when two distinct routes are explicitly marked free, no premium token allowance is being enforced, and the latest prompt is a plain informational request without attachments, web search, or an apparent tool/action intent. The faster successful route wins and the other request is aborted; hedged requests return the winner as a completed answer rather than live tokens. Paid routes and tool-like requests are never hedged. Provider quota/access can change between catalog checks, so provider errors remain possible. Fusion requests independent answers and asks a model to synthesize them; it makes additional provider requests and disables Gmail/Sheets tools and approval actions for that response.

Models are grouped only when their IDs match case-insensitively. Context is a model context-window limit, not account quota. The catalog summary totals only provider-reported, per-model remaining-token values; it omits unknown quotas and account-wide credits, and shared account limits can make a sum overlap. Relay shows observed success and latency from its own requests separately from provider-reported limits; it does not fabricate intelligence or guardrail scores or imply its observed traffic is a provider-wide rating.

Firecrawl, Parallel and KeenAble are displayed separately as search-provider connectors, not as chat models. The chat composer’s **Web search** option calls Firecrawl and adds clickable source links to the answer; save a Firecrawl API key in Models & providers first. Parallel and KeenAble remain credential-only connectors and are not invoked by Relay.

### Images, web search and video

Choose **Image** in the chat composer—or directly ask Chat to create/draw/generate an image, and Relay switches to Image mode for clear creation requests. Image mode calls a dedicated image-generation endpoint and model; it does not send the request to the selected chat model. Relay uses xKiro's `sensenova/sensenova-u1.5-lite` image model first, then tries another connected image provider for model, quota, authentication, rate-limit, or transient service errors. Image generation can consume a provider free allowance or account credits; xKiro image jobs are asynchronous and may take several minutes. Generated results are saved in conversation history. BluesMinds is added as an OpenAI-compatible chat/model provider; image generation is not assumed to be available through BluesMinds unless its API exposes a verified image endpoint. **Video** is shown but disabled because the connected providers do not currently expose a video-generation endpoint verified by Relay. Relay does not fabricate video clips or combine unrelated text responses into a video.

### Google Gemini

Gemini's official OpenAI-compatible endpoint is **allowed by default**. You no longer need an `AI_ALLOWED_ORIGINS` entry for Google Gemini.

1. Open **Models & providers → Use Gemini settings**. This chooses Other API and fills the correct base URL.
2. Enter your Gemini API key (or leave it blank to use an already-saved Gemini key), then click **Load Gemini models**. This fetches Google's current generation-model catalog server-side; it does not generate content or save your settings.
3. Choose a **text/chat** model from the dropdown. Image/audio-only models may also appear in the catalog; being listed does not guarantee compatibility, tool support or quota. You can also enter a current model ID manually from Google AI Studio. The preset leaves the model blank for new connections rather than guessing a model ID. `gemini-2.5-flash` in older releases and environment examples is only an example and may be unavailable.
4. Choose **Save connection**, then **Test saved connection**. The test uses the same OpenAI-compatible chat route as Relay's chat. It generates a short reply and may use quota.

The base URL must be exactly:

```text
https://generativelanguage.googleapis.com/v1beta/openai
```

Do not add `/v1`, `/chat/completions`, a `generateContent` path, or `?key=...`; Relay supplies the request path and sends the key server-side in the authorization header.

Environment-only setup is also supported:

```dotenv
AI_PROVIDER=compatible
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.5-flash
AI_API_KEY=your-gemini-api-key
```

After editing environment settings, restart the local app or redeploy Vercel. Existing saved model settings override environment defaults; choose **Use server defaults** if you intend to use only the environment configuration.

If you still see the old “origin is not allowed” error, stop the old process and start the **updated project folder**, not an older extracted ZIP. For production mode, rebuild with `npm run build` before `npm start`. On Vercel, deploy the latest commit on the project branch. Keep your existing `.env.local` and `SESSION_SECRET` when updating. Never paste the Gemini key in chat or commit it.

#### Gemini returns 404 after saving

A 404 means the requested model or API route was not found; it is not the usual quota error (429). Check that **Other API** and the exact base URL above are saved. In **Models & providers**, use **Load Gemini models**, select a current **text/chat** model, then **Save connection → Test saved connection**. Do not paste `models/` or a full API URL into Model name. A listed generation model is not necessarily supported by Google's OpenAI-compatible chat API; choose another text/chat model if the test returns 404. No key or raw upstream error body is returned to the browser.

Saved Settings override `AI_MODEL` in `.env.local`. Editing the file alone will not replace the saved model. If the Load Gemini models button is missing, update the project and restart it from the updated folder (or rebuild/redeploy production). If you need help, share only the model ID, endpoint and error status—never your API key.

### Another OpenAI-compatible API

Allow the endpoint's exact origin in `.env.local`, then restart:

```dotenv
AI_ALLOWED_ORIGINS=https://your-inference-host.example
```

In **Models & providers**, select Other API and enter:

- API endpoint: `https://your-inference-host.example/v1`
- Model: your provider's model ID
- API key: if required by that provider

The endpoint must support `/chat/completions`, with function tools for Google actions. OpenAI, Google Gemini, local Ollama and origins from `AI_BASE_URL`/`OLLAMA_BASE_URL` are already allowed. Origins are exact matches, not arbitrary URLs. URL credentials/query strings/fragments and redirects are rejected. Only trusted server administrators should edit the allowlist.

Environment-only configuration is also available:

```dotenv
AI_PROVIDER=compatible
AI_BASE_URL=https://your-inference-host.example/v1
AI_MODEL=your-model-id
AI_API_KEY=your-key-if-required
```

Saved Settings take precedence over environment defaults. For a separate Ollama endpoint when switching providers, use `OLLAMA_BASE_URL`.

## Settings hub

The main sidebar is intentionally focused on **Chat**, **Settings**, and recent conversations. AI models and provider keys, Google/GitHub/Vercel connections, workflows, activity, analytics, appearance, and database status are organized under Settings. Open **Settings → Models & providers** to configure providers such as OpenRouter and enter their API keys; open **Settings → Connections** to configure and connect integrations.

## Gmail API and Google Sheets API

**A Google API key alone cannot access your private inbox or spreadsheets.** Relay uses Google's OAuth sign-in, so account users never enter a Google password. The workspace owner configures the OAuth client credentials once in Settings.

Open **Settings → Connections → Google · Gmail and Sheets** to enter the Google OAuth Client ID, Client Secret, and public Relay site URL. The Client Secret is write-only; Relay encrypts these settings in Neon when configured, or in an encrypted HTTP-only cookie for the current browser. In Google Cloud, enable the **Gmail API** and **Google Sheets API**, configure the OAuth consent screen, create a **Web application** OAuth client, and add the redirect URI shown in Relay. Set a stable `SESSION_SECRET` in the server environment (Vercel project Environment Variables) so encrypted settings survive deployments. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_URL` environment values remain supported as defaults.

Once configured, use **Sign in with Google** in the same Settings section, choose an account, and approve the requested access. One login enables both Gmail and Sheets. Requested scopes are `openid`, `email`, `gmail.readonly`, `gmail.send`, and `spreadsheets`. Email sends and sheet writes still require approval in chat. Gmail scopes may require verification for public distribution; Google's testing-mode refresh tokens may expire after seven days.

With PostgreSQL configured, Google account tokens are encrypted in the database; otherwise, they are kept in encrypted HTTP-only cookies for up to 30 days. Disconnect removes the saved account tokens. To revoke the grant completely, remove Relay in your Google account's third-party access settings.

## ZIP downloads and temporary website previews

Ask the chat agent to create code/files or build a website. It packages up to 30 text files (300 KB total) into a ZIP that you can download from the response. If the bundle includes a standalone root `index.html`, choose **Preview site · 5 min** to render it locally in your browser. The preview timer begins when opened; close it or wait five minutes to end that preview session. Open it again to start another session.

The preview is deliberately sandboxed: generated scripts cannot access the Relay page or its storage, and network requests, external assets, forms and popups are blocked. Use inline styles/scripts and embedded data assets for the preview. It does not install dependencies, run a server/build, create a public preview URL, or deploy the project. For full repository changes, use the reviewed GitHub branch flow below; for hosted Vercel deployments, use Vercel's normal Git integration after reviewing the branch.

## GitHub code generation and Vercel previews

Relay connects through a **GitHub App installation**, not a pasted personal access token. Create a GitHub App, grant **Metadata: read** and **Contents: read/write**, and make it available to the intended GitHub accounts. Open **Settings → Connections → GitHub App** and enter the App ID, URL slug, private key PEM, and public Relay URL. The private key is write-only and encrypted in Neon when configured, or in an encrypted HTTP-only cookie for the current browser. In the GitHub App settings, use the Setup URL shown in Relay. Keep a stable `SESSION_SECRET` in Vercel Environment Variables; existing `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, and `APP_URL` environment settings remain supported as defaults.

After saving the app settings, choose **Install & connect GitHub** and grant repository access in GitHub. Choose a writable repository in **Settings → Connections** or from the GitHub selector in chat; one accessible repository is selected automatically when there is only one. The agent receives a bounded file list and selected safe source snippets from that repository through your chosen AI model; common secret formats are redacted, but review sensitive repositories before connecting them. In chat, ask Relay to create or change the selected project. Relay prepares a structured multi-file proposal with a full content preview. After explicit approval, it creates a `relay/<id>` branch based on the repository's default branch. It does not write directly to the default branch, execute generated code, include secret files, or add GitHub Actions workflows.

In **Settings → Connections**, Vercel can be connected with an access token created in Vercel account settings and an optional team ID. Relay encrypts the token, lists projects, and shows recent deployment state and links for one selected project. The token is sent only to Vercel's API from Relay's server and is never returned to the browser. When Vercel and a project are connected, the agent can also list projects and read recent deployment status in chat; these tools are read-only and do not create projects, change Vercel settings, or trigger deployments. If a GitHub repository is linked to Vercel, Vercel's normal Git integration may create a **Preview Deployment** for a new `relay/` branch. Preview builds execute repository scripts, so keep production secrets out of preview environments. Review and merge the branch in GitHub when ready; do not assume a preview is production-ready.

### Example tasks

- “Draft an email to alex@example.com saying the report is ready. Subject: October report.” Review the full recipient, subject and body, then approve.
- “Find my unread emails from this week and help me prepare replies.” Reading doesn't require individual approval; sending does.
- Attach a selectable-text PDF: “Extract invoice number, customer, date and total, then append rows to Sheet1!A:D in this spreadsheet: [your URL].” Review every row before approving.

Outgoing reply content is sent as a **new email**, not a threaded Gmail reply. Supply an existing spreadsheet URL/ID and tab; spreadsheet creation and Drive discovery aren't implemented.

## Personalize colors and fonts

Open **Settings → Appearance**. Choose **Light · pure white** or **Dark · pure black** for a monochrome canvas, or select one of the accent themes. Use **Accent color** to customize highlights; **Reset to theme color** clears the override.

Choose one of eight built-in font families (Arial, Georgia, Palatino, Times New Roman, Trebuchet MS, Verdana, Tahoma or Courier New), or upload your own WOFF2, WOFF, TTF or OTF font up to 1 MB. Uploaded font data is stored inside your workspace preferences and browser backup; when Neon is configured, it syncs with the shared workspace. Only upload fonts you have permission to use. Your selected font and color apply across Relay immediately.

The chat uses a restrained ivory-and-brass, heritage-inspired visual style. If asked who made or founded Relay, it answers **“Faizan made me.”**

## Use laptop Ollama from Vercel through a secure tunnel

See **[docs/OLLAMA-TUNNEL.md](docs/OLLAMA-TUNNEL.md)** for the Windows/macOS/Linux instructions. This project includes a loopback-only, Bearer-authenticated gateway so you can tunnel it instead of exposing Ollama directly:

```sh
npm run ollama:setup
npm run ollama:gateway
# In a separate terminal after installing cloudflared:
cloudflared tunnel --url http://127.0.0.1:11435
```

Then point Vercel's OpenAI-compatible provider at the HTTPS tunnel's `/v1` endpoint, using the generated gateway token as `AI_API_KEY`. Keep your laptop awake and all three components running. Quick Tunnel URLs change across sessions. The gateway requires Node 22+, one configured model, and non-streaming requests; it never exposes Ollama's model-management API.

## Vercel and other hosting

Import the repository into Vercel using the Next.js preset and the branch containing this code. Set:

- `APP_PASSWORD`, stable `SESSION_SECRET`, and `APP_URL=https://your-domain`
- `DATABASE_URL` from Neon → Connect, with pooling enabled (optional, recommended)
- AI/environment settings and endpoint allowlist as needed

For a Vercel deployment, set `DATABASE_URL`, `APP_PASSWORD`, and a stable `SESSION_SECRET` in the project’s Environment Variables. Sign in, open **Settings → Database**, and choose **Initialize or repair Relay tables** when the database status needs attention. This authenticated, idempotent migration only creates missing tables and preserves existing rows; it does not require running commands on your laptop. For self-hosted Node.js, use `npm run db:migrate` and `npm run db:check`. Set the matching HTTPS Google callback URI in Google Cloud. Use a pooled database URL with serverless hosting; each app instance uses up to three connections.

**Vercel hosts the app, not Ollama or the AI model.** A cloud deployment cannot reach your laptop at `localhost`. Use an API or a separately hosted, secured inference server. Never expose an unauthenticated Ollama port to the internet.

On another Node.js host, run `npm run build` then `npm start`. Use HTTPS, a firewall/reverse proxy and external rate limiting. The proxy must preserve Host/Origin; `APP_URL` must match the public origin without a trailing slash. Chat requests request a 60-second budget; actual hosting-plan limits still apply.

## Analytics

The Analytics page records measured upstream model API requests, outcomes, response latency, and token counts only when the provider returns usage. It offers 24-hour, 7-day, 30-day, and 90-day views, a request trend, and provider/model breakdowns with success rate and latency. The Models & providers catalog also shows Relay-observed per-model performance from the last 30 days. Analytics uses `relay_analytics` when PostgreSQL is enabled; without a database, server-memory metrics are temporary. Historical provider calls are not backfilled. Current non-streaming calls cannot produce true TTFT, and Relay has no verified cross-provider price baseline, so those cards show unavailable rather than invented numbers.

## Storage and security

| Data                                                                  | With PostgreSQL                                      | Without PostgreSQL                  |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| Chats, extracted text, workflows, activity, theme                     | Database JSON workspace + browser backup             | Browser localStorage                |
| AI keys, Google client secret and access/refresh tokens, Vercel token | AES-256-GCM encrypted database values, purpose-bound | Encrypted HTTP-only SameSite cookie |
| GitHub App installation ID and selected repository                    | AES-256-GCM encrypted database values                | Encrypted HTTP-only SameSite cookie |
| Original document                                                     | Request memory only                                  | Request memory only                 |
| Pending approval token                                                | Memory only; 15-minute expiry                        | Memory only; 15-minute expiry       |
| Used approval ID                                                      | Unique PostgreSQL claim, retained across restarts    | Process cache and signed cookie     |

- This is an **owner-managed workspace**, not an open multi-tenant SaaS. The owner account and each invited user account have isolated workspace data, settings, credentials and analytics.
- All server mutations require same-origin requests and workspace authentication. Password protection is mandatory on Vercel and in database mode.
- Model/Google API responses return saved-state flags, never secret values. API calls happen server-side. Database errors avoid exposing connection strings.
- Chats themselves are not application-encrypted; use encrypted storage/backups and appropriate database access controls. Attached text and relevant email results go to the selected AI provider.
- Treat documents/emails as untrusted. Prompt injection is still possible: read every proposed action carefully. Arbitrary shell commands, browsing and desktop control are not implemented.
- Gmail headers reject newlines. Sheets writes use RAW values, so formulas aren't evaluated.
- Approval claims are inserted atomically **before** calling Google or GitHub. An uncertain failure remains claimed; there's no automatic retry of a side effect. Check the destination before preparing another action. Database idempotency prevents replay of the same ID, not a user creating a new duplicate proposal.
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
lib/db.ts, lib/postgres-config.mjs  Neon/PostgreSQL configuration, TLS and safe diagnostics
db/schema.sql                   Existing PostgreSQL schema and action claims
lib/secrets.ts                   Purpose-bound at-rest credential encryption
lib/connection-store.ts          Database or encrypted-cookie connection storage
lib/ai.ts, lib/endpoint.ts       Model configuration and endpoint allowlist
lib/google*.ts                  Google client configuration, sessions and requests
lib/vercel.ts                   Encrypted Vercel account and deployment requests
app/api/vercel/                 Vercel connect, project and deployment API
lib/workspace-data.ts            Validated history payloads; approval tokens stripped
app/api/workspace/               Revision-controlled workspace load/save
app/api/config/, google/config/  AI and Google credential settings APIs
app/api/chat/, actions/          Model tool orchestration and approved execution
components/use-workspace-storage.ts  Autosave, browser backup and conflict handling
components/settings-extras.tsx  Database and appearance controls
app/themes.css                  Eight semantic color theme palettes
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
