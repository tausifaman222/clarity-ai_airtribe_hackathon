---
name: Groq provider choice
description: User-selected AI provider and model compatibility constraints
---

Use Groq for Sayso's live AI feedback.

**Why:** The user explicitly requested Groq. During setup, the account could not access Llama 3.3 70B; GPT-OSS 120B returned live responses.

**How to apply:** Preserve Groq unless the user requests a change. Groq reasoning models need room for reasoning tokens in addition to visible JSON; the short coach budget caused JSON generation failures without that allowance.
