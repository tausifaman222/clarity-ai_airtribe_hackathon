# API reference

All endpoints take and return JSON unless noted.

**Tracks.** Wherever a body has `stage`, it is either:
- a pitch stage: `idea`, `preseed`, `seed` or `seriesa`; or
- `"custom"` together with a `scenario` object (see `public/scenarios.js`).

An optional `lang` field (BCP-47, e.g. `es-ES`) helps the AI reply in the user's language.

## Practice

| Method and path | Body | Returns |
|---|---|---|
| `POST /api/scenario` | `{ description, lang? }` | `{ scenario }` or `{ kind: "pitch", stage }` |
| `POST /api/coach` | `{ stage, scenario?, history[], userText, covered[] }` | `{ reply, covered[], nextFocus }` |
| `POST /api/verdict` | `{ stage, scenario?, history[] }` | `{ verdict, headline, clear[], missing[], fixFirst }` |
| `POST /api/judge` | `{ stage, scenario?, transcript, metrics: { durationSec, longPauses?, longestPauseSec?, typed?, presence? } }` | Full report with `scores`, `checklist[]`, `strengths[]`, `fixes[]`, `toughestQuestion`, `rewrite`, `metrics`, `agent`, `agentTrace[]`, `leaderboardStatus` |
| `POST /api/agent/plan` | `{ stage, scenario?, recent[]? }` | `{ analysis, plan: { focus, why, drills[3], milestone }, trace[] }` |
| `POST /api/drill` | `{ stage, scenario?, checklistId, transcript }` | `{ verdict, score, whatWorked, improve, tryLine }` |
| `POST /api/followup` | `{ stage, scenario?, question, answer }` | `{ verdict, score, reaction, feedback, betterAnswer }` |

## Voice

| Method and path | Notes |
|---|---|
| `POST /api/tts` | `{ text, voice: "meera" \| "coach" }` → `audio/mpeg` (ElevenLabs) |
| `POST /api/transcribe?lang=` | Raw audio body (`audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`, ≤ 8 MB) → `{ text, segments[], duration }` |

## Accounts and community

| Method and path | Notes |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` | Same-origin only |
| `GET /auth/google`, `GET /auth/google/callback` | Google OAuth (PKCE) |
| `GET /api/auth/me` | `{ user: { username, displayName, avatarUrl, google } \| null }` |
| `DELETE /api/me` | Deletes the account and all saved reports |
| `GET /api/me/attempts`, `GET /api/me/attempts/:id` | The signed-in user's reports |
| `GET /api/leaderboard?stage=&input=` | Public, opt-in pitch scores |
| `POST /api/leaderboard/publish`, `DELETE /api/leaderboard/entries` | Publish or remove your scores |

## Platform

| Method and path | Notes |
|---|---|
| `GET /api/health[?deep=1]` | Configuration status; `deep=1` also proves the voice provider works |
| `GET /api/agents` <a id="agents"></a> | Agent team manifest |
| `GET /api/stats` | Anonymous usage counts |
| `POST /mcp` | MCP (JSON-RPC 2.0): `initialize`, `tools/list`, `tools/call` |
