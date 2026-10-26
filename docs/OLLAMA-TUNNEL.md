# Vercel → secure tunnel → Ollama on your laptop

This lets the Relay website run on Vercel while your laptop performs inference. No router port forwarding is needed. It is intended for one trusted owner, not a public inference service.

```text
Your browser → Relay on Vercel
               → HTTPS Cloudflare Tunnel (Bearer token required by the gateway)
               → laptop gateway on 127.0.0.1:11435
               → Ollama on 127.0.0.1:11434
```

**Important:** do NOT tunnel Ollama's port `11434` directly. Ollama does not supply the API-key authentication this setup needs. The gateway checks a random secret and exposes only one model's non-streaming chat endpoint. Never share its token or commit `.env.ollama-gateway`.

## 1. Prepare your laptop

Install **Node.js 22 LTS**, Ollama and this project's latest code. In the project folder:

```sh
npm ci
ollama pull qwen2.5:7b
npm run ollama:setup
```

This creates `.env.ollama-gateway` with a generated token. Re-running setup does not replace an existing file/token. Open the file in Notepad or your editor:

```dotenv
OLLAMA_GATEWAY_TOKEN=the-generated-secret-already-in-your-file
OLLAMA_GATEWAY_MODEL=qwen2.5:7b
OLLAMA_LOCAL_URL=http://127.0.0.1:11434
OLLAMA_GATEWAY_PORT=11435
```

Do not replace the generated token with the example above. The model must exactly match the model you select in Relay, including its tag. You can choose a different, smaller tool-capable model if necessary.

Keep Ollama running. The desktop app normally starts it; if it is not running, use `ollama serve` in a terminal. If that says the port is already in use, it may already be running. Optionally warm up the model with `ollama run qwen2.5:7b`, then enter `/bye` to leave its chat.

## 2. Start the protected gateway

In a terminal in the project folder:

```sh
npm run ollama:gateway
```

Keep this terminal open. It listens only on loopback port `11435`. It never prints the secret and does not forward that secret to Ollama. It allows one inference at a time, up to 30 requests per minute, 300 KB requests and at most 3,000 output tokens. Slow or busy requests can fail; this is not an always-on hosted inference service.

## 3. Install and start Cloudflare Tunnel

Install `cloudflared` from its official distribution: https://github.com/cloudflare/cloudflared/releases . Select the binary for your operating system/architecture.

On Windows, Winget is another option:

```powershell
winget install --id Cloudflare.cloudflared -e
```

Open a **new terminal** after installing so the PATH is refreshed. Check the installation with `cloudflared --version`. Then run:

```sh
cloudflared tunnel --url http://127.0.0.1:11435
```

The command prints an HTTPS URL similar to:

```text
https://random-words.trycloudflare.com
```

Use the actual URL it prints, not this example. Leave the tunnel terminal open. This Quick Tunnel does not require registering a domain, but its hostname changes when recreated and it has no uptime guarantee. If a pre-existing cloudflared configuration prevents Quick Tunnel mode, use a separate Cloudflare profile or a named tunnel instead; do not delete an existing tunnel configuration blindly.

**The HTTPS URL is public, but the gateway requires the secret for every endpoint.** Cloudflare terminates HTTPS and carries the request through the outbound tunnel to your local client. Therefore this is not end-to-end encryption from Vercel to Ollama: Vercel and Cloudflare process the traffic. Avoid sending information those services should not handle.

## 4. Check that the public endpoint is protected

In a browser, open your actual tunnel URL followed by `/health`. It should show an authentication error. **This is correct**: an unauthenticated visitor must not be able to use your model.

To test authentication without pasting your token into shell history, run this from the project folder (Node 22+):

```sh
node --env-file=.env.ollama-gateway -e "fetch('https://YOUR-ACTUAL-TUNNEL.trycloudflare.com/health',{headers:{Authorization:'Bearer '+process.env.OLLAMA_GATEWAY_TOKEN}}).then(async r=>console.log(r.status,await r.text()))"
```

Replace only the URL. Expect HTTP 200 with `gateway: ready`. This checks authentication; Relay's connection test checks inference itself. Do not put the token in a URL or query parameter.

## 5. Configure Vercel

In your Vercel project's Environment Variables, use the actual HTTPS tunnel URL and token:

```dotenv
AI_PROVIDER=compatible
AI_MODEL=qwen2.5:7b
AI_BASE_URL=https://YOUR-ACTUAL-TUNNEL.trycloudflare.com/v1
AI_API_KEY=copy-the-value-of-OLLAMA_GATEWAY_TOKEN-from-your-laptop
```

Use **compatible**, not the local-only Ollama preset, so the gateway receives the Bearer key. The token belongs in `AI_API_KEY` on Vercel; you do not need to add `OLLAMA_GATEWAY_TOKEN` there.

Keep the normal Relay settings:

```dotenv
APP_PASSWORD=your-strong-workspace-password
SESSION_SECRET=your-existing-stable-random-secret-at-least-32-characters
APP_URL=https://your-relay-domain.vercel.app
```

**Do not replace an existing SESSION_SECRET** if you have encrypted credentials in PostgreSQL. It must stay stable. On Vercel, use a hosted PostgreSQL `DATABASE_URL`, not your laptop's `localhost:5432`.

Apply the variables to the environment you deploy and **redeploy**. In Relay open **Settings → AI model → Use server defaults → Test saved connection**. Saved database/cookie model settings otherwise override the Vercel environment. “Use server defaults” removes only the saved model configuration, not chat history or Google credentials.

Alternatively, add the exact tunnel origin to `AI_ALLOWED_ORIGINS` on Vercel and redeploy. Then choose **Other API** in Relay Settings, enter its `/v1` URL, model and gateway token, save, and test.

## 6. Use it / stop it

Keep the laptop awake, online, plugged in when appropriate, and keep Ollama, the gateway and cloudflared running. Closing the lid or losing internet can make the model unavailable. Your Vercel website can remain online even if the model is offline.

Press Ctrl+C in the tunnel terminal to remove remote access. Stop the gateway too when you are finished. No `npm run dev` is needed on the laptop for this setup: only the gateway and Ollama run there; Relay itself runs on Vercel.

On the next session:

1. Start Ollama.
2. Run `npm run ollama:gateway`.
3. In another terminal run the cloudflared command.
4. If the hostname changed, update `AI_BASE_URL` on Vercel and redeploy, or update the saved endpoint and its allowed origin.

For a stable hostname, configure a **named Cloudflare Tunnel** with your own domain, pointing the public hostname to `http://127.0.0.1:11435`. Keep gateway authentication enabled. This project does not automatically provision a tunnel, domain or Cloudflare account. An interactive Cloudflare Access login page will block server-to-server model calls unless you separately configure compatible service authentication; the gateway's Bearer authentication does not log into Access.

## Troubleshooting

| Symptom                            | What to check                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401 from the gateway               | Vercel's `AI_API_KEY` must exactly match the laptop token; don't include `Bearer ` in the setting.                                                                                                                              |
| Model error / 403                  | Relay's model ID must match `OLLAMA_GATEWAY_MODEL`.                                                                                                                                                                             |
| 429                                | The laptop is handling another request or hit the 30/minute cap. Wait and retry manually.                                                                                                                                       |
| 502 / tunnel error                 | Ensure Ollama, gateway and cloudflared are running, and that the URL is current.                                                                                                                                                |
| 504 / request timeout              | Warm up Ollama, shorten the request or use a smaller model. Relay currently budgets up to 45 seconds per inference call, 25 seconds for its connection test, and a 60-second chat function budget. Hosting limits can be lower. |
| It still calls OpenAI or localhost | Choose Use server defaults to remove the old saved model override, or edit the saved Other API configuration.                                                                                                                   |
| Endpoint origin is not allowed     | Set the correct Vercel `AI_BASE_URL` or `AI_ALLOWED_ORIGINS`, then redeploy. Never use a wildcard allowlist.                                                                                                                    |

If the token is exposed, replace it with a new cryptographically random value, restart the gateway and update the Vercel API key. Keep the laptop's Ollama port bound to loopback. The gateway has basic resource limits, but you should use an always-on secured inference service instead if you need a public, multi-user or high-availability deployment.
