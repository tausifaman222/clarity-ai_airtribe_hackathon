# Clarity AI on Replit

## Run
- Use the **Start application** workflow (the Run button), or run `npm start`.
- The Express server serves the frontend and API on `0.0.0.0:5000` by default. `PORT` can override the port.
- Dependencies are installed with npm and recorded in `package-lock.json`. `npm start` builds the small React authentication client, then starts Express.
- Keep the existing Express and plain JavaScript practice UI. React is confined to the authentication client in `client/auth.jsx`.
- The home and inline stage/mode setup follow the approved Clarity AI canvas mockup. Communication confidence is the mission; startup pitching is the first available practice scenario.
- Preserve existing `sayso.*` browser-storage keys so the rename doesn't discard saved sessions and reports.

## Configuration
- This project uses Groq through its OpenAI-compatible endpoint: `LLM_PROVIDER=openai`, `LLM_BASE_URL=https://api.groq.com/openai/v1`, and `LLM_MODEL=openai/gpt-oss-120b`. The key stays in `LLM_API_KEY`.
- Without an AI API key, the app runs in its explicitly labelled offline mode. Feedback is keyword-based, not a real AI assessment.
- Live AI requires a supported provider key (`LLM_API_KEY`, or the provider-specific alternatives documented in `llm.js`). Set `LLM_MODEL` to a valid model supported by that provider. OpenAI-compatible services also use `LLM_PROVIDER=openai` and, when needed, `LLM_BASE_URL`.
- ElevenLabs voice output is optional and requires `ELEVENLABS_API_KEY`. Without it, the app uses browser speech synthesis.
- Add credentials through Replit Secrets, never source files. Restart the workflow after configuration changes.
- `GET /api/health` reports AI mode and voice configuration.
- Google sign-in uses Replit-managed Clerk. The canonical proxy is mounted before body parsing. Provision through the Clerk setup flow, not hand-edited keys. Without configuration, sign-in shows an explicit setup-incomplete page; guest practice remains available.
- Authentication assets are rebuilt at startup into ignored `generated-artifacts/auth/` so production receives its own managed key/proxy settings.

## Browser and storage
- Chrome is recommended for speech recognition. Microphone permission is required; typed input is also available.
- Reports use browser session storage. Anonymous counters are written to `data/stats.json`; this is not a database.
- Stop saves the current practice in this tab; Resume restores it, including a timed pitch's active duration and draft. Reload never automatically restarts the microphone. Reset requires confirmation and does not remove completed reports.
- Verified, signed-in AI pitch scores are stored privately in PostgreSQL. The development schema reference is `db/schema.sql`; production schema changes use Replit Publish, never startup DDL.
- Leaderboard publishing is opt-in and uses a chosen public name, never an email. Only server-produced AI scores are eligible; offline and sample demo reports are excluded. Compare best scores within the same stage and spoken/typed group.

## Regression checks
- Run `npm test` for disposable PostgreSQL leaderboard checks and Playwright regression tests. Replit uses the configured Nix Chromium; other hosts without system Chromium should run `npm run test:install` once first.
- `npm run test:api` checks server contracts without a browser; `npm run test:browser` checks the typed-pitch UI.
- Tests use an isolated source copy on port 5011, with no inherited provider keys and outbound fetch blocked. They never switch the live app to offline mode or write its usage counters.
- Failure artifacts go in ignored `generated-artifacts/test-results/`. See README.md for scope and setup.
