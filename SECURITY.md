# Security policy

## Reporting a vulnerability

Please **don't open a public issue**. Instead, report it privately using **GitHub → Security → Report a vulnerability** on this repository. Include steps to reproduce and the impact you see.

We aim to acknowledge reports within 3 days and to fix confirmed issues as quickly as possible.

## Scope and design notes

- **API keys:** keys for the LLM, ElevenLabs, Google and the database are read from environment variables on the server only. They are never sent to the browser.
- **Passwords:** hashed with scrypt (N=32768, per-account salt).
- **Sessions:** random 256-bit tokens in HttpOnly, SameSite=Lax, Secure cookies. Only their SHA-256 hashes are stored, they expire after 7 days, and they rotate on sign-in.
- **Google sign-in:** OAuth 2.0 authorization code flow with PKCE (S256) and an HMAC-signed, short-lived state cookie.
- **Request protection:** state-changing account routes require a same-origin `Origin` header.
- **Rate limits:**
  - AI routes: per IP (`RATE_LIMIT`).
  - Login: lockout after 5 failures in 15 minutes, by IP and by username.
  - Sign-up: capped per IP.
- **Model input:** practice transcripts are passed inside tags and treated as content to evaluate, never as instructions. Quotes in reports are verified against the transcript.
- **Camera:** video is processed on the device and never uploaded.
- **Audio:** sent once for transcription and not stored.
- **Supported versions:** only the latest `main` branch.
