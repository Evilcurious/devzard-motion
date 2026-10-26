# Relay on your laptop + Neon Postgres

Neon **is PostgreSQL**, hosted for you. Relay still runs on your laptop and Ollama can still run locally, but your saved chats, workflows, preferences and encrypted API credentials live in Neon. You do not need a PostgreSQL installation on your laptop or a Vercel deployment.

## 1. Get the latest Relay code

Extract the new ZIP into a new folder. Copy your existing private `.env.local` into that folder. Keep a backup of it. Never commit or share the file.

In a terminal in the folder containing `package.json`:

```sh
npm ci
npm run setup
```

Setup creates only missing security values. **Do not replace an existing SESSION_SECRET**: it is needed to decrypt saved credentials. `APP_PASSWORD` is your Relay website login, not your database password. Find it in `.env.local`.

## 2. Copy a connection string from Neon

1. Open Neon Console and create/select your project.
2. Click **Connect**.
3. Choose the database and role you want Relay to use. A dedicated project/database is recommended.
4. Turn on **connection pooling** and copy the full PostgreSQL connection string.
5. Paste it into `.env.local`:

```dotenv
DATABASE_URL="paste-the-complete-connection-string-from-Neon-here"
APP_URL=http://localhost:3000
```

Replace the placeholder with the actual URL. Keep the database name Neon provides—commonly `neondb`. Do not change it to `relay` unless a database named `relay` exists in that project.

The structure resembles this **non-working example**, not a real account:

```text
postgresql://YOUR_ROLE:YOUR_PASSWORD@YOUR_ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Copy it as **plain text**, not `[text](mailto:...)` link markup. Use `&`, not `&amp;`. Keep SSL/channel-binding parameters. Relay uses certificate-verified TLS for Neon and enables channel-binding support in its PostgreSQL driver. It works with either a pooled or direct Neon endpoint; pooled is recommended for the app.

If you previously posted a database password in chat, screenshots or a repository, reset it in Neon first and copy a fresh connection string. This project does not contain your password.

## 3. Create the tables

```sh
npm run db:migrate
npm run db:check
```

The migration is safe to run again. It creates tables inside your selected database; it does not create a missing database. The connection check reports provider, pooling/TLS settings and whether Relay's tables exist. Neither command prints the connection string or password.

Stop any old Relay process with Ctrl+C and start the updated app:

```sh
npm run dev
```

Open http://localhost:3000, sign in with your `APP_PASSWORD`, then open **Settings → Database → Check database connection**. It should show **Neon Postgres — Connected**.

For production-mode local use, run `npm run build` then `npm start` instead.

## 4. Keep Ollama local

Keep Ollama running and use these environment defaults:

```dotenv
AI_PROVIDER=ollama
AI_MODEL=qwen2.5:7b
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=
```

In Relay choose **Settings → AI model → Use server defaults → Test saved connection** if a previous saved provider is overriding the environment. A tunnel is **not** needed when Relay and Ollama run on the same laptop.

## Existing data

- Existing data in the **same Neon database** is preserved. The first connection imports browser history only when the database workspace is empty.
- Switching DATABASE_URL to a **different** database does not transfer the old database's data. Keep the old URL/secret and back up the old database. Use PostgreSQL backup/restore tooling to move it if needed; don't delete the old database first.
- Existing local PostgreSQL configurations remain supported. This update makes Neon the recommended setup, not a new storage format.
- API credentials previously stored only in browser cookies must be re-saved after enabling database mode. Reconnect Google as needed.
- Reload another browser/device to see new changes. Conflicting edits are rejected rather than silently overwriting history.

## If you later deploy Relay to Vercel

Set the same `DATABASE_URL` in Vercel's server Environment Variables, along with `APP_PASSWORD`, `APP_URL` for the deployed domain, and the **same SESSION_SECRET** when sharing this database. Don't use a `NEXT_PUBLIC_` variable for credentials. Redeploy after changing variables.

On Vercel, sign in to Relay, open Settings → Database, and choose “Initialize or repair Relay tables”. This hosted, idempotent action creates missing tables without deleting existing rows; no local commands are needed. For self-hosted Node.js, use `npm run db:migrate` and `npm run db:check`. Vercel cannot reach laptop Ollama via localhost—use the separate secure-tunnel guide or a hosted AI API.

## Troubleshooting

- **Sign-in failed:** reset the Neon role password and copy a fresh URL. This is separate from Relay's APP_PASSWORD.
- **Database does not exist:** select the real database in Neon → Connect and recopy the URL. Often `/neondb`, not `/relay`.
- **Link/HTML formatting error:** remove Markdown/mailto formatting, use `&` rather than `&amp;`, or copy directly from Neon again.
- **Connected but tables missing:** on Vercel, download your browser draft, then open Settings → Database and use “Initialize or repair Relay tables”. On a self-hosted Node.js install, use `npm run db:migrate` against the same URL. The migration does not delete existing rows.
- **Cannot reach the database:** check your internet connection, Neon project state and any network restrictions. Cold starts may take a few seconds; retry the check.
- **Saved credentials cannot be decrypted:** restore your original SESSION_SECRET. Don't generate a replacement to try to fix it.

Neon connectivity cannot be validated offline. Chat/database saving requires internet even when Ollama inference is local. The app never silently claims a failed database save succeeded.
