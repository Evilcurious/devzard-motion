# Devzard Motion

An AI automation platform that runs the five jobs a small business actually needs automated — on **Vercel or your laptop**, powered by **any AI API key or a model running locally**.

| # | Job | What it does |
|---|-----|--------------|
| 1 | **AI chatbot** | Embeddable website widget that answers only from the knowledge you feed it |
| 2 | **Gmail auto-reply** | New mail → AI drafts a grounded reply straight into Gmail Drafts; approve in the inbox or auto-send |
| 3 | **Customers + budget spend + profit in Google Sheets** | Two-way sync of customers, income/expenses and a live profit summary |
| 4 | **WhatsApp auto support** | Meta Cloud API webhooks → same brain, same inbox, auto or approved replies |
| 5 | **Instagram auto support** | Instagram DMs on the identical pipeline |

One inbox, one knowledge base, one brain — every channel.

---

## Why it answers *your* way

Every reply is grounded by retrieval over **your** knowledge base (BM25 over chunked sources). No embedding API, no vector database, no extra cost — so it behaves identically whether you're paying OpenAI or running Ollama on a laptop.

If nothing in your knowledge base matches, the model is instructed to use your fallback line and the conversation is flagged for a human.

---

## Quick start (local)

```bash
git clone https://github.com/Evilcurious/devzard-motion.git
cd devzard-motion
npm install
cp .env.example .env.local     # optional — the app boots with nothing set
npm run dev
```

Open http://localhost:3000 → **Dashboard** (login `admin` / `admin`).

Storage is a SQLite file at `.data/devzard.db` (built-in `node:sqlite`, no native build). Set `DATABASE_URL` and it switches to Postgres with the same schema.

### Try the pipeline with zero AI keys

A stub OpenAI-compatible server ships in the repo so you can watch the whole flow before wiring a real model:

```bash
node scripts/mock-ai-server.mjs &
AI_PROVIDER=custom CUSTOM_BASE_URL=http://localhost:4000/v1 CUSTOM_MODEL=devzard-mock npm run dev
```

Then hit **Simulate inbound** on the Overview page.

---

## Connect an AI brain

Settings → **AI brain**, or environment variables. One dropdown, ten providers:

| Provider | Env var | Local? |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | |
| Google Gemini | `GEMINI_API_KEY` | |
| Anthropic Claude | `ANTHROPIC_API_KEY` | |
| OpenRouter | `OPENROUTER_API_KEY` | |
| Groq | `GROQ_API_KEY` | |
| DeepSeek | `DEEPSEEK_API_KEY` | |
| Mistral | `MISTRAL_API_KEY` | |
| **Ollama** | `OLLAMA_BASE_URL` (default `http://localhost:11434`) | ✅ free |
| **LM Studio** | `LMSTUDIO_BASE_URL` (default `http://localhost:1234/v1`) | ✅ free |
| **Custom** (llama.cpp / vLLM / LocalAI / any OpenAI-compatible) | `CUSTOM_BASE_URL`, `CUSTOM_API_KEY`, `CUSTOM_MODEL` | ✅ free |

```bash
AI_PROVIDER=ollama
AI_MODEL=llama3.1
```

- **Test connection** button calls the live model and prints its reply.
- **List** pulls models from the provider (`/api/tags` for Ollama, `/models` for OpenAI-compatible).
- **Fallback provider** runs automatically if the primary errors.
- Keys are encrypted at rest with `APP_SECRET` (AES-256-GCM).
- Local models are costed at $0 in the money dashboard.

> Local models are unreachable from Vercel unless you expose them publicly (tunnel, LAN IP with a proxy). For a fully free hosted setup, run this app on a box you control and point `CUSTOM_BASE_URL` at your Ollama.

---

## Connect Google (Gmail + Sheets)

1. Google Cloud Console → enable **Gmail API** and **Google Sheets API**.
2. Create credentials → **OAuth client ID** → type *Web application*.
3. Add this **Authorised redirect URI**:
   ```
   http://localhost:3000/api/google/oauth/callback
   ```
4. Settings → paste Client ID + Client secret → **Connect Google account**.

Scopes requested: `gmail.readonly`, `gmail.compose`, `gmail.send`, `gmail.modify`, `spreadsheets`, `drive.file`, `userinfo.email/profile`.

**Email flow** — new inbound mail is polled (Vercel Cron every 10 min, the **Sync Gmail** button, or `npm run worker` locally). Each thread gets an AI reply written **into Gmail Drafts** in the correct thread. Nothing is sent until you press *Approve & send* — unless you enable auto-send above a confidence threshold, or write a rule for it.

**Sheets flow** — the first sync creates a spreadsheet with four tabs:

| Tab | Contents |
|---|---|
| `Customers` | id, name, email, phone, company, channel, tags, notes, created |
| `Transactions` | id, date, type, category, amount, currency, customer, description, source |
| `Conversations` | last 200 inbound messages with their AI reply and status |
| `Summary` | income, expenses, profit, margin, month-to-date, budget used/left, AI spend, last sync |

Sync is **two-way**: edit a row in the sheet and *Pull from sheet* brings it back into the app. Rows are upserted by internal id, so syncing is idempotent.

---

## Connect WhatsApp + Instagram

Both run in **sandbox mode** until credentials are added — messages are simulated and logged, so you can rehearse the whole flow before Meta app review.

1. Meta for Developers → create an app → add **WhatsApp** and/or **Instagram** products.
2. Webhook URL:
   ```
   https://your-app.vercel.app/api/webhooks/meta
   ```
3. Verify token → set the same string in Settings (default `devzard-motion`).
4. Paste the **phone number ID** + **access token** (WhatsApp) and/or **Instagram account ID** + **access token**.
5. Subscribe to the `messages` field.

Signature verification (`X-Hub-Signature-256`) turns on automatically once you paste an **App secret**.

---

## Deploy to Vercel

```bash
vercel deploy
```

Then set in **Project → Settings → Environment Variables**:

```
APP_SECRET          # openssl rand -hex 32  — REQUIRED, encrypts tokens and signs sessions
APP_URL             # https://your-app.vercel.app
ADMIN_USER          # change from admin
ADMIN_PASSWORD      # change from admin
CRON_SECRET         # protects /api/cron/*
DATABASE_URL        # Neon / Supabase / Vercel Postgres — required on Vercel (serverless FS is ephemeral)
AI_PROVIDER / AI_MODEL  (+ the matching key, or a public Ollama URL)
```

`vercel.json` already declares the crons:

| Path | Schedule | Job |
|---|---|---|
| `/api/cron/gmail` | every 10 min | poll Gmail, draft replies |
| `/api/cron/sheets` | hourly | push + pull the spreadsheet |

> On Vercel you **must** set `DATABASE_URL` — the filesystem is not persistent, so the SQLite file would be wiped between invocations.

Local equivalent without cron:

```bash
npm run worker   # polls Gmail + syncs Sheets on a loop
```

---

## How a message flows

```
inbound (web · email · whatsapp · instagram)
   │
   ├─ upsert customer + conversation
   ├─ store message
   ├─ match automation rule  (channel / keyword / confidence)
   ├─ retrieve knowledge  ── BM25 over your KB chunks
   ├─ call the AI  ── provider → fallback provider → graceful fallback reply
   ├─ score confidence + decide handoff
   └─ auto-send  OR  stage as draft (Gmail Drafts / Inbox queue)
                          │
                          └─ you approve → deliver on the original channel
```

Everything is logged to the activity feed and costed into the money dashboard.

---

## Layout

```
src/app/
  dashboard/            overview · inbox · knowledge · customers · money · chatbot · automations · settings
  api/
    chat/               public widget endpoint + widget config
    webhooks/meta/      WhatsApp + Instagram verify + inbound
    google/oauth|sheets|sync/gmail
    kb/  kb/test        knowledge CRUD + grounded retrieval test
    conversations/  messages/[id]/approve
    customers/  finance/  automations/  settings/  ai/test
    cron/gmail  cron/sheets
  embed/                standalone widget host page
public/widget.js        drop-in chat widget (no dependencies)
src/lib/
  ai/                   provider registry, pricing, catalog
  rag/                  chunking, BM25 retrieval, prompt building
  google/               OAuth, Gmail, Sheets
  pipeline.ts           the inbound message pipeline
  finance.ts  sync/     money maths + Sheets sync
  db/                   SQLite/Postgres driver + schema
scripts/
  mock-ai-server.mjs    OpenAI-compatible stub for local testing
  worker.ts             local cron replacement
```

## API quick reference

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/chat` | Public: widget message → grounded reply |
| `GET` | `/api/chat` | Public: widget config |
| `GET/POST` | `/api/webhooks/meta` | Meta verify + inbound messages |
| `POST` | `/api/simulate` | Inject a fake inbound message (demo) |
| `GET` | `/api/health` | DB / AI / Google / Meta status |
| `POST` | `/api/kb/test` | Ask a question, see answer + sources |
| `POST` | `/api/google/sync/gmail` | Poll Gmail and draft replies |
| `POST/PUT/GET` | `/api/google/sheets` | Sync / create / read the spreadsheet |
| `POST` | `/api/messages/:id/approve` | Approve and send a drafted reply |
| `GET` | `/api/cron/gmail`, `/api/cron/sheets` | Cron endpoints |

## Security notes

- Dashboard session is an HMAC-signed, httpOnly cookie; every API route re-checks it in the Node runtime.
- OAuth refresh tokens and API keys are AES-256-GCM encrypted with `APP_SECRET`.
- Change `ADMIN_PASSWORD` and `APP_SECRET` before deploying.
- `/api/chat` is public by design (it's the widget) and rate-limited per IP in memory — put a KV-backed limiter in front of it for heavy production traffic.

## Roadmap ideas

- Real Ollama/llama.cpp **embeddings** as an optional retrieval boost alongside BM25
- Attachments and images in the inbox
- Multi-seat dashboard accounts
- Telegram and Facebook Messenger adapters (the pipeline is channel-agnostic)
- Per-customer AI spend attribution
