# Contributing to Clarity AI

Thanks for helping people speak with confidence! Bug fixes, new scenarios, languages and docs are all welcome.

## Getting started

```bash
git clone https://github.com/tausifaman222/clarity-ai_airtribe_hackathon.git && cd clarity-ai_airtribe_hackathon
npm install
cp .env.example .env              # an AI key is optional: offline mode works for most UI work
node --watch --env-file=.env server.js
npm run test:install && npm test  # please run before opening a pull request
```

## Ground rules

- **Never judge grammar, accent or appearance.** Feedback is about substance and delivery.
- **Never fake anything.** That means no invented users, scores or quotes, and no features that pretend to work. Offline mode must stay clearly labelled.
- **Privacy:** video stays on the device, audio is never stored, and keys stay on the server.
- **No build step:** the client is plain ES modules in `public/`. Keep dependencies minimal and prefer open-source tools.
- **Tests:** add or update tests for behaviour changes. API and browser tests run offline with outbound network blocked.

## Common contributions

- **A new scenario template:** add it to `SCENARIOS` in `public/scenarios.js`. Each needs 4–7 checklist items (2–3 marked `must`) and `kw` keyword hints for offline mode. The unit tests validate every template.
- **A new practice language:** add it to `LANGS` in `public/app.js`.
- **A new LLM provider preset:** add it to `PRESETS` in `llm.js`.
- **A new agent:** add it to `AGENT_TEAM` in `server/agent-team.js` and expose it via a route, plus an MCP tool if it's useful to other AI clients.

## Pull requests

- Keep each pull request focused on one change, and fill in the template.
- Use clear commit messages, for example `feat: add viva scenario template` or `fix: gaze ratio direction`.
- UI changes need a screenshot at phone width (390 px) and on desktop.
