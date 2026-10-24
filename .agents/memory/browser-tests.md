---
name: Browser testing on Nix
description: Chromium runtime requirements and regression isolation rationale
---

Prefer Nix-provided Chromium for local browser tests in this Replit environment.

**Why:** Playwright's downloaded Chromium failed to launch because it could not resolve system shared libraries; the configured Nix Chromium launched successfully.

**How to apply:** Keep a portable fallback to Playwright's browser for other hosts. Do not use apt-based installation commands in Replit.

Keep regression servers isolated from the live preview, including provider credentials and usage counters.

**Why:** The live app uses the user's paid Groq account and stores anonymous counters beside its source. Tests should neither incur provider usage nor alter those counters.

**How to apply:** Test the actual application sources in an isolated process and temporary directory, not a mocked server, without inheriting provider settings.
