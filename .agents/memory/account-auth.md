---
name: Account authentication and score privacy
description: User-selected account model for leaderboard access and score visibility
---

**Rule:** Accounts use unique usernames and passwords with salted database-backed password hashes. Save a founder's scores privately by default; publishing a leaderboard score is an explicit choice. Show Google sign-in as “Coming soon” unless it has actually been configured and tested.

**Why:** The user chose individual username/password accounts to support the leaderboard and requested Google sign-in remain future-facing until ready.

**How to apply:** Never store readable passwords or claim Google works before setup. Username-only accounts have no verified password-recovery route, so keep that limitation visible unless ownership verification is introduced.
