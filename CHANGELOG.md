# Changelog

## 2.0.0 (2026-10-25)

### Added
- **Practise anything:** a scenario designer agent builds a custom practice from a plain-language description. There are also 8 templates (job interview, salary negotiation, presentation, client pitch, viva, speech, difficult conversation, self-introduction).
- **Multi-agent review:** an independent evaluator, a referee and a quote verifier join the lead reviewer. Each report shows its agent trace.
- **Agentic practice loop:**
  - a practice planner (history → analysis → plan → validation);
  - a 60–90 s drill coach;
  - a follow-up interviewer.
- **On-device camera coach (MediaPipe):** live nudges and a body-language score.
- **Voice:**
  - open-source Whisper speech-to-text for Safari and Firefox;
  - a real ElevenLabs health check, with automatic voice re-selection.
- **Languages and AI providers:**
  - 16 practice languages;
  - Groq, Gemini and OpenRouter presets;
  - an automatic fallback LLM provider.
- **Accounts:** Google sign-in (OAuth with PKCE), a progress page, saved reports, PDF export and account deletion.
- **Pages:** privacy policy and terms of use.
- **MCP server** at `/mcp`.
- **Deployment:** configs for Vercel, Render and Docker. Usage stats are stored in Postgres, and migrations are idempotent (`npm run db:migrate`).
- **Repo:** CI, issue and PR templates, and Dependabot.

### Fixed
- The dependency lockfile pointed at Replit-only package mirrors, which broke installs on other hosts.
- Usage counters were written to a local file that serverless hosts discard.
- Gaze direction maths, and the first camera nudge being suppressed.

### Removed
- The unused Clerk authentication stack, the mockup sandbox and stray archives.

## 1.0.0 (2026-10-24)
- Hackathon build at Airtribe AI Builders Day: a startup-pitch coach, an AI investor interview and reports.
