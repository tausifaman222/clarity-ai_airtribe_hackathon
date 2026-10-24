---
name: Clerk provisioning and imported project titles
description: Provisioning can reject an imported archive-style project title before creating any auth tenant
---

Replit-managed Clerk provisioning derives its application name from the Replit project title. An imported archive-style title ending in `.zip` can be rejected as a URL.

**Why:** Provisioning failed with an invalid-application-name error before any Clerk tenant or keys were created.

**How to apply:** Ask the user to rename the project title in the editor header to a normal product name, then retry the managed setup. Changing package metadata or the web page title does not fix the platform project title. Do not switch to external Clerk or request credentials to work around this.
