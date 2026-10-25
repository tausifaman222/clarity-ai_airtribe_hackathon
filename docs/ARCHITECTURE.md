# Architecture

Clarity AI is a single Node.js service (Express) serving a plain-JavaScript single-page app and a JSON API. It runs either as a long-lived server (Replit, Render, Docker) or as one Vercel serverless function (`api/index.js`). The client needs no build step.

## Request flow for a practice review

```mermaid
sequenceDiagram
  participant B as Browser
  participant S as Server (orchestrator)
  participant L as Lead reviewer (LLM)
  participant E as Independent evaluator (LLM)
  B->>B: Speech → text (Web Speech or Whisper via /api/transcribe)
  B->>B: Presence analyst (MediaPipe, on device) → summary numbers
  B->>S: POST /api/judge {track, transcript, metrics(+presence)}
  S->>S: Delivery analyst: wpm, fillers, hedges, pauses; validate presence
  par in parallel
    S->>L: judge prompt
    S->>E: evaluator prompt
  end
  L-->>S: report JSON
  E-->>S: evaluation JSON
  S->>S: Referee: average scores, cautious checklist merge, apply the formula
  S->>S: Quote verifier: check every quote against the transcript
  S->>S: Save the private attempt (signed-in users)
  S-->>B: report + agentTrace
```

## Tracks: pitches and custom scenarios

Every practice is a **track** (`server/tracks.js`):
- **A startup-pitch stage** from `public/rubrics.js`: Idea, Pre-seed, Seed or Series A.
- **A custom scenario** from `public/scenarios.js` or the scenario designer. Its shape is `{ name, audience, persona, goal, intro, opener, timeLimitSec, items[] }`.

Custom scenarios are validated by `normalizeScenario()` on both client and server. The prompts adapt their wording to the track through `ctxOf()`.

## Agents

| Agent | Where | Notes |
|---|---|---|
| Scenario designer | `POST /api/scenario` in `server.js` | Strict JSON, validated; falls back to the closest template |
| Warm-up coach | `POST /api/coach` | Cumulative checklist coverage |
| Lead reviewer and evaluator | `POST /api/judge` | Run in parallel; the evaluator can't block the report |
| Referee and quote verifier | `mergeEvaluation()`, `server/agent-team.js` | Deterministic |
| Practice planner | `server/agents.js` | Tool step (database history) → deterministic analysis → LLM plan → rubric validation |
| Drill coach and follow-up interviewer | `server/agents.js` | Short, strict JSON |
| Presence analyst | `public/presence*.js` | Browser only; the pure maths in `presence-metrics.js` is unit tested |

Every LLM call goes through `llm.js`:
- It accepts strict JSON only, and retries once if parsing fails.
- It switches to a fallback provider if one is configured.
- Its presets cover Groq, Gemini, OpenRouter, Anthropic and any OpenAI-compatible API.

## Data model (Postgres)

| Table | Purpose |
|---|---|
| `clarity_auth_users` | Username accounts and/or Google identity (`google_sub`) |
| `clarity_auth_sessions` | Hashed session tokens with expiry |
| `clarity_auth_login_limits` | Login and sign-up throttling |
| `clarity_attempts` | Saved AI reports; `published` and `display_name` for the leaderboard; stage `custom` for scenarios |
| `clarity_event_counts`, `clarity_visitors` | Anonymous usage counters (hashed visitor ids) |

`db/schema.sql` is idempotent. Apply it with `npm run db:migrate`.

## Degradation, by design

| Missing | Behaviour |
|---|---|
| AI key | Labelled offline mode using keyword rules |
| Evaluator response | The lead review stands alone, and the report says so |
| Live speech recognition | Whisper (if configured), otherwise typing |
| ElevenLabs | Browser voice |
| Camera or WebGL | The camera coach explains why; practice continues |
| Database | Guest mode; account buttons are hidden |
