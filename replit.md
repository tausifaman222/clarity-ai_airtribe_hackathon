# Clarity AI on Replit

## Run
- Click **Run** (runs `npm start` → `node server.js` on port 5000). No build step.
- Database: create Replit PostgreSQL (sets `DATABASE_URL`), then run `npm run db:migrate` once in the Shell. The schema in `db/schema.sql` is idempotent. Publish applies changes from the development database to production.
- Secrets: `LLM_API_KEY` (Groq), `SESSION_SECRET` (32+ characters). Optional: `ELEVENLABS_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL`, `FALLBACK_LLM_*`, `MCP_TOKEN`. See `.env.example` and `SETUP.md`.
- Check `/api/health?deep=1` after any configuration change.

## Product rules (keep these)
- The mission is communication confidence for any conversation. Startup pitching is one track; custom scenarios (`public/scenarios.js` plus the scenario agent) cover everything else.
- Feedback is on substance and delivery, never grammar, accent or appearance. Never invent facts: rewrites use [placeholders], and the quote verifier labels paraphrases.
- The camera coach is opt-in and runs on the device. Never upload video. Only `presence` summary numbers are sent.
- Offline mode must stay clearly labelled. Never show fake users, scores or Google sign-in when it isn't configured (the UI reads `/api/health`).
- Leaderboard publishing is opt-in, uses a chosen public name, and is for startup-pitch AI reports only (not offline, demo or custom).
- Accounts: username/password (scrypt) or Google OAuth (PKCE), with HttpOnly session cookies. Users can delete their account and data from Progress.

## Code map
- `server.js`: routes and the multi-agent orchestration (judge, evaluator, referee, verifier).
- `server/`: accounts, Google sign-in, community, agents (planner, drill, follow-up), voice (ElevenLabs, Whisper), stats, MCP, tracks.
- `public/`: plain-JS SPA. `app.js` holds the rooms and report; `presence*.js` the camera coach; `speech.js` the Whisper recorder; `scenarios.js` the templates.
- Tests: `npm test`. Unit tests use PGlite; API and browser tests use Playwright and an offline server with outbound fetch blocked.
