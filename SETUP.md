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

## Fastest: the setup wizard (Vercel)

On your computer, with [Node.js 20+](https://nodejs.org) installed:

```bash
git clone https://github.com/tausifaman222/clarity-ai_airtribe_hackathon.git
cd clarity-ai_airtribe_hackathon
npm install
npm run setup
```

The wizard:
1. Asks for your Groq, ElevenLabs and Gemini keys (typing is hidden).
2. **Tests each key with a tiny real call** and tells you exactly what's wrong: key rejected, out of credits, rate limited, or model not available.
3. Saves them to `.env`, which is git-ignored and never committed, and generates `SESSION_SECRET` for you.
4. Optionally links your Vercel project, uploads the keys, creates the database tables, deploys, and checks the live app.

Your keys only go to your own computer, your Vercel project and the providers themselves. To use Replit or Render instead, answer "n" at the Vercel step and copy the values from `.env` into that host's Secrets page.

If you'd rather click through the dashboards, follow the manual steps below.

---

## 1. Get your keys (5 min)

| What | Where | Env var |
|---|---|---|
| **AI (required)**: open-source models, free | [console.groq.com](https://console.groq.com) → API Keys | `LLM_API_KEY` |
| Session secret (required for accounts) | Run `openssl rand -base64 48`, or type 40+ random characters | `SESSION_SECRET` |
| Database (for accounts, history, leaderboard) | Neon (via Vercel), Supabase, Replit or Render Postgres | `DATABASE_URL` |
| Natural voices (optional) | [elevenlabs.io](https://elevenlabs.io) → Developers → API keys | `ELEVENLABS_API_KEY` |
| Backup AI (optional) | [aistudio.google.com](https://aistudio.google.com) → Get API key (Gemini) | `FALLBACK_LLM_API_KEY` |

Add these provider settings too, exactly as shown:

```
LLM_PROVIDER=groq
```

That alone selects Groq with `openai/gpt-oss-120b`, and the same key powers Whisper speech-to-text. To use Gemini as the main model instead, set `LLM_PROVIDER=gemini` and put your Gemini key in `LLM_API_KEY`.

For the backup provider, use these values:

```
FALLBACK_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
FALLBACK_LLM_MODEL=gemini-flash-latest
```

---

## 2. Deploy: choose one

### A. Vercel (recommended)

1. Go to **vercel.com → Add New → Project** and import your GitHub repo.
   - Framework preset: **Other**.
   - Leave the build settings empty; `vercel.json` handles them.
2. Open **Storage → Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL` / `POSTGRES_URL`.
3. Under **Settings → Environment Variables**, add `LLM_PROVIDER`, `LLM_API_KEY`, `SESSION_SECRET`, and any optional keys.
4. Nothing to run for the tables: the app creates them automatically the first time it starts with a database (check `"database": "ready"` in `/api/health`). To manage them yourself instead, set `AUTO_MIGRATE=0` and run `npm run db:migrate`.
5. Click **Deploy**. Every `git push` redeploys automatically.

### B. Replit

1. Choose **Create → Import from GitHub** and pick the repo.
2. Open **Tools → Database** and create a PostgreSQL database. This sets `DATABASE_URL`.
3. Open **Tools → Secrets** and add `LLM_API_KEY` and `SESSION_SECRET`. `.replit` already sets the Groq provider.
4. Open the **Shell** and run `npm install` (tables are created automatically on first start).
5. Click **Run** to test, then **Publish** (Autoscale or Reserved VM).

### C. Render, Railway, Fly or any Docker host

- **Render:** choose **New → Blueprint**, pick the repo, and fill in the keys it asks for. `render.yaml` creates the web app **and** a Postgres database, connects them, generates `SESSION_SECRET`, and creates the tables on every deploy, so you don't need to run the migration yourself. It uses the Starter web plan and the basic-256mb database (about $13/month together, no cold starts); see the comment at the top of the file for a free-tier version.
- **Anything with Docker:** run `docker build -t clarity-ai . && docker run -p 5000:5000 --env-file .env clarity-ai`.

Tables are created automatically on first start.

---

## 3. Check it works (1 min)

Open `https://YOUR-APP/api/health?deep=1`. You want to see:

```json
{ "ai": true, "stt": "whisper", "accounts": true,
  "llm": { "ok": true, "main": { "model": "openai/gpt-oss-120b", "ok": true } },
  "voice": { "provider": "elevenlabs", "ok": true } }
```

- `"ai": false`: no AI key is set. The app still works in offline mode.
- `llm.main.ok: false`: a real test call failed; `error` says why (key rejected, rate limited, model not found). If `llm.fallback.ok` is true, users are served by the backup.
- `"accounts": false`: either `DATABASE_URL` is missing or `SESSION_SECRET` is shorter than 32 characters.
- `voice.ok: false`: the `error` field says why (wrong or restricted key, no credits). Users hear the free **Kokoro** voice instead: an open-source model (Apache-2.0) that downloads once (~90 MB) and runs on their device, English only. On data-saver, slow connections or low-memory phones, and for other languages, the browser voice is used.

Then try a template from the home page in Chrome with the camera coach on, and once in Safari to check the Whisper path.

---

## 4. Sign-in with Google, GitHub, LinkedIn and Microsoft (optional, all free)

Username and password sign-in works as soon as the database is connected. Each provider below adds a **Continue with …** button. Add any or all of them; none of them costs anything.

Replace `YOUR-DOMAIN` with your live address, for example `clarity-ai-airtribe-hackathon.vercel.app`. Every provider needs the exact callback URL shown. Add one for each address you use (for example the `.vercel.app` one **and** your own subdomain).

Then set `PUBLIC_URL=https://YOUR-DOMAIN` and redeploy. `/api/health` lists the providers that are switched on in `"sso"`.

### Google
1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Open **APIs & Services → OAuth consent screen**:
   - choose **External**;
   - fill in the app name, support email and authorised domain;
   - set the privacy policy to `https://YOUR-DOMAIN/privacy` and terms to `https://YOUR-DOMAIN/terms`;
   - add the scopes `openid`, `email` and `profile`.
3. Open **Credentials → Create credentials → OAuth client ID → Web application**:
   - origin: `https://YOUR-DOMAIN`
   - redirect URI: `https://YOUR-DOMAIN/auth/google/callback`
4. Copy the keys into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Click **Publish app** on the consent screen, so everyone can sign in, not just your test users.

### GitHub
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps → New OAuth App**.
2. Fill in:
   - Homepage URL: `https://YOUR-DOMAIN`
   - Authorization callback URL: `https://YOUR-DOMAIN/auth/github/callback`
3. Click **Generate a new client secret**.
4. Copy the keys into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

A GitHub OAuth app accepts only one callback URL. For a second domain, create a second OAuth app.

### LinkedIn
1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → **Create app**. It needs a LinkedIn Page; your own or a new free one works.
2. On the app's **Products** tab, request **Sign In with LinkedIn using OpenID Connect**. It's approved instantly.
3. On the **Auth** tab, add the redirect URL `https://YOUR-DOMAIN/auth/linkedin/callback`.
4. Copy the keys into `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.

### Microsoft (personal, work and school accounts)
1. Go to [entra.microsoft.com](https://entra.microsoft.com) → **App registrations → New registration**. A free Microsoft account works.
2. Fill in:
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI: **Web**, `https://YOUR-DOMAIN/auth/microsoft/callback`.
3. Under **Certificates & secrets → New client secret**, copy the secret **Value**, not its ID.
4. Copy the **Application (client) ID** and that value into `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.

Microsoft client secrets expire, after 24 months at most, so set a reminder to replace yours.

### How accounts work
- Each sign-in method is tied to that provider's own user ID, **never to the email address**. Someone using the same email on a different provider can't get into your account.
- To use several methods on one account, sign in once, then use **Continue with …** for another provider while you're signed in. It's added to the same account.
- A provider account that's already attached to a different Clarity AI account can't be moved over.

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
- [ ] Set `CONTACT_WHATSAPP` (your WhatsApp number with country code, digits only) so the contact page works. Optional: `CONTACT_NAME`, and `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` from Cloudflare Turnstile (free) for a stronger bot check.
- [ ] Optional: add Airtribe's official logo as `public/airtribe-logo.png`.
- [ ] The Google consent screen is **published**, not in testing.
- [ ] Optional: set `MCP_TOKEN` if you don't want the `/mcp` tools to be public.
- [ ] Check `RATE_LIMIT` (AI calls per IP per 10 min, default 80) and your Groq free-tier limits. Add a fallback provider for launch-day traffic.
- [ ] Do one full run on a phone (Chrome on Android, Safari on iPhone) and one on a laptop.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Accounts aren't available" | Set `DATABASE_URL` and a 32+ character `SESSION_SECRET`, then redeploy. `/api/health` shows `"database"`: `"ready"`, or the error that stopped the automatic setup. |
| "cannot insert multiple commands into a prepared statement" | You pasted `db/schema.sql` into a one-statement query box (such as Vercel's Storage tab). You don't need to: the app sets up its tables itself. |
| `redirect_uri_mismatch` or "redirect URI isn't valid" (any provider) | The exact URL `https://YOUR-DOMAIN/auth/<provider>/callback` must be registered with that provider, and `PUBLIC_URL` must match it. |
| No transcript in Safari | `"stt"` must be `"whisper"` in `/api/health`; it needs a Groq key. |
| Camera coach "couldn't start" | The browser blocked the camera, or the device lacks WebGL/WebAssembly. Practice still works without it. |
| Reports time out on Vercel | `vercel.json` sets a 60 s function limit. Groq is usually done in 5–15 s. Check the function logs for `judge:` lines. |
| "Offline mode" pill | The AI key is missing or invalid; check `/api/health`. |
