# Setup guide: live in about 10 minutes

You need a **GitHub repo** with this code. Everything else has a free tier.

**Contents**
- [1. Get your keys](#1-get-your-keys-5-min)
- [2. Deploy: choose one](#2-deploy-choose-one): Vercel (recommended), Replit, or Render / Railway / Docker
- [3. Check it works](#3-check-it-works-1-min)
- [4. Google sign-in](#4-google-sign-in-optional-5-min)
- [5. Your own subdomain](#5-your-own-subdomain-hostinger)
- [6. Before launch checklist](#6-before-launch-checklist)
- [Troubleshooting](#troubleshooting)

---

## 1. Get your keys (5 min)

| What | Where | Env var |
|---|---|---|
| **AI (required)**: open-source models, free | [console.groq.com](https://console.groq.com) → API Keys | `LLM_API_KEY` |
| Session secret (required for accounts) | Run `openssl rand -base64 48`, or type 40+ random characters | `SESSION_SECRET` |
| Database (for accounts, history, leaderboard) | Neon (via Vercel), Supabase, Replit or Render Postgres | `DATABASE_URL` |
| Natural voices (optional) | [elevenlabs.io](https://elevenlabs.io) → Profile → API key | `ELEVENLABS_API_KEY` |
| Backup AI (optional) | [aistudio.google.com](https://aistudio.google.com) → Get API key (Gemini) | `FALLBACK_LLM_API_KEY` |

Add these provider settings too, exactly as shown:

```
LLM_PROVIDER=groq
```

That alone selects Groq with `openai/gpt-oss-120b`, and the same key powers Whisper speech-to-text. To use Gemini as the main model instead, set `LLM_PROVIDER=gemini` and put your Gemini key in `LLM_API_KEY`.

For the backup provider, use these values:

```
FALLBACK_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
FALLBACK_LLM_MODEL=gemini-2.5-flash
```

---

## 2. Deploy: choose one

### A. Vercel (recommended)

1. Go to **vercel.com → Add New → Project** and import your GitHub repo.
   - Framework preset: **Other**.
   - Leave the build settings empty; `vercel.json` handles them.
2. Open **Storage → Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL` / `POSTGRES_URL`.
3. Under **Settings → Environment Variables**, add `LLM_PROVIDER`, `LLM_API_KEY`, `SESSION_SECRET`, and any optional keys.
4. Create the tables, once. Either:
   - open Neon's **SQL Editor** and paste the contents of `db/schema.sql`, then run it; or
   - run `DATABASE_URL=... npm run db:migrate` from your computer.
5. Click **Deploy**. Every `git push` redeploys automatically.

### B. Replit

1. Choose **Create → Import from GitHub** and pick the repo.
2. Open **Tools → Database** and create a PostgreSQL database. This sets `DATABASE_URL`.
3. Open **Tools → Secrets** and add `LLM_API_KEY` and `SESSION_SECRET`. `.replit` already sets the Groq provider.
4. Open the **Shell** and run `npm install && npm run db:migrate`.
5. Click **Run** to test, then **Publish** (Autoscale or Reserved VM).

### C. Render, Railway, Fly or any Docker host

- **Render:** choose **New → Blueprint**, pick the repo, and fill in the keys it asks for (`render.yaml` is included). Add a Render Postgres database and paste its URL into `DATABASE_URL`.
- **Anything with Docker:** run `docker build -t clarity-ai . && docker run -p 5000:5000 --env-file .env clarity-ai`.

Then run `npm run db:migrate` once against your database.

---

## 3. Check it works (1 min)

Open `https://YOUR-APP/api/health?deep=1`. You want to see:

```json
{ "ai": true, "stt": "whisper", "accounts": true, "voice": { "provider": "elevenlabs", "ok": true } }
```

- `"ai": false`: the AI key or provider is wrong. The app still works in offline mode.
- `"accounts": false`: either `DATABASE_URL` is missing or `SESSION_SECRET` is shorter than 32 characters.
- `voice.ok: false`: the `error` field says why (wrong key, or no credits). Users hear the browser voice instead.

Then try a template from the home page in Chrome with the camera coach on, and once in Safari to check the Whisper path.

---

## 4. Google sign-in (optional, 5 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Open **APIs & Services → OAuth consent screen**:
   - choose **External**;
   - fill in the app name, support email, and your domain;
   - set the privacy policy to `https://YOUR-DOMAIN/privacy` and terms to `https://YOUR-DOMAIN/terms`;
   - add the scopes `openid`, `email` and `profile`.
3. Open **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://YOUR-DOMAIN`
   - Authorized redirect URIs: `https://YOUR-DOMAIN/auth/google/callback`
   - Add a pair for each address you use, for example the `.vercel.app` or `.replit.app` address **and** your custom domain.
4. Copy the client ID and secret into the env vars `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Set `PUBLIC_URL=https://YOUR-DOMAIN` so the redirect always uses your main domain. Then redeploy.
6. On the consent screen, click **Publish app**, so that people outside your test-user list can sign in.

---

## 5. Your own subdomain (Hostinger)

Example: `clarityai.geekypmtausif.com`. In **hPanel**, go to **Domains → geekypmtausif.com → DNS / Nameservers → DNS records**.

**On Vercel**
1. Open **Project → Settings → Domains** and add `clarityai.geekypmtausif.com`.
2. In Hostinger, add a record:
   - Type: `CNAME`
   - Name: `clarityai`
   - Target: `cname.vercel-dns.com`
   - TTL: default

**On Replit**
1. Open **Publishing → Domains → Link a domain**.
2. Add the **A** record and the **TXT** record that Replit shows, both with the name `clarityai`.

**On Render**
1. Open **Settings → Custom Domains** and add the domain.
2. Add the **CNAME** that Render shows.

**Then**
- Delete any older record named `clarityai` first, so the records don't conflict.
- Wait 5–30 minutes. HTTPS is issued automatically, and the mic and camera only work on `https://`.
- Update `PUBLIC_URL` and the Google redirect URI to the new domain.

---

## 6. Before launch checklist

- [ ] `/api/health?deep=1` is all green.
- [ ] In `public/privacy.html` and `public/terms.html`, replace `[your contact email]`.
- [ ] Optional: add Airtribe's official logo as `public/airtribe-logo.png`.
- [ ] The Google consent screen is **published**, not in testing.
- [ ] Optional: set `MCP_TOKEN` if you don't want the `/mcp` tools to be public.
- [ ] Check `RATE_LIMIT` (AI calls per IP per 10 min, default 80) and your Groq free-tier limits. Add a fallback provider for launch-day traffic.
- [ ] Do one full run on a phone (Chrome on Android, Safari on iPhone) and one on a laptop.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Accounts aren't available" | Set `DATABASE_URL` and a 32+ character `SESSION_SECRET`, then run `npm run db:migrate`. |
| Google says `redirect_uri_mismatch` | The exact URL `https://YOUR-DOMAIN/auth/google/callback` must be listed in Google Cloud, and `PUBLIC_URL` must match it. |
| No transcript in Safari | `"stt"` must be `"whisper"` in `/api/health`; it needs a Groq key. |
| Camera coach "couldn't start" | The browser blocked the camera, or the device lacks WebGL/WebAssembly. Practice still works without it. |
| Reports time out on Vercel | `vercel.json` sets a 60 s function limit. Groq is usually done in 5–15 s. Check the function logs for `judge:` lines. |
| "Offline mode" pill | The AI key is missing or invalid; check `/api/health`. |
