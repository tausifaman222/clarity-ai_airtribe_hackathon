# Sayso: AI Communication Simulator (MVP: Pitch an Idea)

**Say it so it lands.** Founders rehearse a startup pitch out loud with an AI coach, then pitch to an AI investor
(Meera Kapoor, fictional) and get a full report. It judges substance and delivery, never grammar.
English, Hindi, or Hinglish; the AI replies in the mix you used.

Flow: Home → Stage (Idea / Pre-seed / Seed / Series A) → Mode → **Coach Room** (live checklist + investor verdict)
or **Showtime** (briefing → 3-2-1 → 2-minute pitch) → **Report** (sections A–H).

## Deploy on Replit (about 5 minutes)
1. Create a Repl → **Import** → upload this folder (you don't need `node_modules`). Press **Run**.
2. Open **Secrets** and add:
   - `LLM_API_KEY`: your Anthropic key. The default model is `claude-sonnet-5-5`.
   - Optional: `LLM_MODEL`, to override the model.
   - Other providers: set `LLM_PROVIDER=openai`, `LLM_BASE_URL` (for example `https://api.x.ai/v1` for Grok),
     `LLM_MODEL` (that provider's model id) and `LLM_API_KEY`. Any OpenAI-compatible API works.
   - Optional: `RATE_LIMIT`, the number of AI calls per IP per 10 minutes (default 80).
   - **ElevenLabs voices (recommended):** `ELEVENLABS_API_KEY`. Optional extras:
     - `ELEVENLABS_VOICE_MEERA` and `ELEVENLABS_VOICE_COACH`: voice IDs from your ElevenLabs Voice Library. Pick
       Indian-accent voices that speak Hindi well. The defaults are ElevenLabs' stock voices.
     - `ELEVENLABS_MODEL`: default `eleven_flash_v2_5`, which is fast and handles Hindi and Hinglish. For richer
       but slower audio, use `eleven_multilingual_v2`.
     - The key stays on the server, and repeated lines are cached. If ElevenLabs fails or runs out of credits, the
       app switches to the browser voice automatically.
3. Click **Deploy**. Pick **Reserved VM** if you want the usage counter to survive redeploys.
4. Open the URL in **Chrome** (voice needs it; other browsers can type) and allow the microphone.

Check it is working: `GET /api/health` returns `"ai": true`. With no key, the app still runs in a clearly labelled
**Offline mode** that uses simple keyword rules. Use that for smoke tests only, never for judging.

## Links
| Link | What |
|---|---|
| `/` | Home |
| `/?demo=1` | Hidden live-demo backup: jumps to the Seed Showtime briefing with a sample Hinglish pitch pre-filled (fictional company, labelled "Sample" on the report) |
| `/#/stats` | Proof of Life: anonymous live counts (visitors, coach turns, verdicts, reports). It stores no transcripts and no personal data |
| `/api/health` | Shows whether the AI is configured, which voice is in use (`"tts": "elevenlabs"` or `"browser"`) |

## How it's built
- **Express + plain JavaScript** (no build step), with the dark design system from the spec (Inter, `#7C5CFF` accent, 88px mic).
- **Single source of truth:** `public/rubrics.js` holds the stage checklists (★ must-haves), the pro tips, and the filler
  and hedge lists. Both the browser and the server import it, so tooltips, the coach panel, the briefing, the report and
  all three prompts stay in sync.
- **API routes:**
  - `POST /api/coach {stage, history, userText}` → `{reply, covered[], nextFocus}`
  - `POST /api/verdict {stage, history}` → the coach verdict
  - `POST /api/judge {stage, transcript, metrics}` → the full report
  - The prompts are taken word for word from the spec.
- **Strict JSON:** the server strips code fences, parses inside try/catch, and retries once with "Return only valid JSON."
  It then validates the shape and enforces the scoring itself:
  - overall = round((structure×0.3 + clarity×0.25 + substance×0.3 + delivery×0.15)×10), minus 10 if a ★ item is missing.
  - The verdict is then recomputed from that rule, so the model can't inflate it.
- **Voice:**
  - Input uses `webkitSpeechRecognition` (continuous, interim results, `en-IN` / `hi-IN` toggle) and records a timestamp
    for each final segment. A Web Audio `AnalyserNode` drives the live mic ring.
  - Output uses ElevenLabs through `POST /api/tts` (Meera and the Coach each have their own voice). Without a key it
    uses the browser's `speechSynthesis` at rate 1.05, with an `en-IN` voice, or `hi-IN` when the reply is mostly Devanagari.
  - The mic stops while the AI speaks and resumes afterwards.
- **Metrics** (computed client-side and re-checked on the server): duration, word count, WPM, fillers, hedges, and long
  pauses (gaps over 2.5s between segments).
- **No auth, no database:** all user state lives in `sessionStorage`, so a refresh keeps your report. The only thing
  written to disk is the anonymous counter in `data/stats.json`.

## Two judges: Meera + the Pitch Evaluator agent
Every Showtime pitch is judged by two agents in parallel, using the same LLM key:
- **Meera:** gives the investor reaction, the fixes and the rewrite.
- **Pitch Evaluator:** an evidence-first rubric engine. It marks an item covered only if it can quote the founder, caps vague claims, and lists red flags.

The server merges the two:
- Scores are averaged.
- Where the judges disagree on a checklist item, it leans cautious.
- The spec formula re-computes the overall score and verdict.

The report shows the evaluator's verdict, its agreement with Meera, its confidence, and its red flags. If the evaluator fails, the report uses Meera alone and says so.

## Edge cases covered
- Mic denied: a card with fix steps, a Retry button, and the type fallback.
- Browser without speech recognition: the Chrome banner, and the app still works by typing.
- A pitch under 20 words skips the LLM and shows "Meera didn't hear enough to judge."
- LLM error: the toast "Our investor stepped out for a second. Retrying…", then one automatic retry, then a Retry button.
  The saved pitch is never lost.
- Keyboard: every control is reachable, and Space toggles the mic in both rooms.
- Layout tested at 1366px and 375px.

## Honest limits
- Speech recognition quality depends on the browser (Chrome is best). Hindi in Devanagari works through the `hi-IN` toggle.
- Report time depends on the model: usually a few seconds, sometimes longer.
- Meera Kapoor and Northstar Ventures are fictional. The AI gives practice feedback, not investment advice.
