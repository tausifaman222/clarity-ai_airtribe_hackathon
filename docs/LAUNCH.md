# Product Hunt launch kit

**Contents**
- [Basics](#basics)
- [Description](#description-260-characters)
- [Maker's first comment](#makers-first-comment)
- [Gallery](#gallery-in-this-order)
- [Launch day](#launch-day)
- [Answers for common questions](#answers-for-common-questions)

## Basics

- **Name:** Clarity AI
- **Tagline (60 characters max):** Rehearse any big conversation with an AI agent team
- **Other tagline options:**
  - Speak confidently. Be understood. Practise any conversation
  - Your AI rehearsal room for interviews, pitches and speeches
- **Topics:** Artificial Intelligence, Productivity, Education, Career, Public Speaking
- **Links:** your live URL (for example `https://clarityai.geekypmtausif.com`) and the GitHub repo
- **Thumbnail:** `public/icon-512.png`
- **Social image:** `public/og.png`

## Description (260 characters)

> Describe what you're preparing for: an interview, a raise, a pitch, a toast. Clarity AI's agent team builds a custom practice, listens by voice (16 languages), reads your body language on-device, and gives evidence-checked feedback. Not grammar. Clarity.

## Maker's first comment

> Hi Product Hunt! 👋 We're Ashish and Tausif. We built Clarity AI at the Airtribe AI Builders Day hackathon, because knowing *what* to say is rarely the problem. Saying it clearly, under pressure, often is.
>
> **How it works**
> 1. Tell it what you're preparing for, in your own words and any language. A scenario agent designs the practice: what you'll be judged on, a realistic practice partner, and a time limit. You can also pick a template (job interview, salary negotiation, presentation, sales pitch, viva, speech, difficult conversation) or the startup-pitch track.
> 2. Warm up with a voice coach, then do the real thing without interruptions.
> 3. Get a report from a *team* of agents:
>    - two independent AI reviewers;
>    - a referee that merges their reviews;
>    - a quote verifier that checks every quote against your transcript, so feedback never invents what you said.
> 4. A planner agent sets your next three 90-second drills.
>
> **Things we care about**
> - 🗣️ Feedback on substance and delivery, never your grammar or accent. Speak English, Hindi, Hinglish, Spanish, Japanese and more.
> - 📷 The optional camera coach runs entirely on your device (MediaPipe). Your video is never uploaded.
> - 🧩 Built on open models and tools: gpt-oss and Whisper via Groq, plus MediaPipe. There's even an MCP server, so your AI assistant can coach you too.
>
> It's free to try, with no sign-up needed. We'd love to hear what you practise and what we should add next!

## Gallery (in this order)

Record at 1270×760. Use real practice runs, not mockups.

1. **Home:** "What are you preparing for?" with a description typed in, e.g. "PM interview at a fintech next week".
2. **Scenario review:** the AI-built checklist and practice partner.
3. **Live practice:** the practice partner, the camera coach preview showing a live nudge ("Look at the camera…"), and live captions.
4. **Report:** the score ring, the four scores, and the body-language tiles.
5. **"How this feedback was made":** the agent trace.
6. **Practice plan:** three drills, then the drill screen with feedback.
7. **Short video (about 60 s):** describe, practise, report, drill. Turn subtitles on.

## Launch day

- [ ] Go live at **12:01 am PT**, which is 12:31 pm IST. Ask early supporters to visit through the PH link and leave real comments, not just upvotes.
- [ ] Before launch: make sure `/api/health?deep=1` is all green, add a fallback LLM provider for traffic spikes, and set `RATE_LIMIT`.
- [ ] Share on LinkedIn and X with the og image. Tag @Airtribe and #AIBuildersDay.
- [ ] Reply to every comment within an hour. Turn feature requests into GitHub issues.
- [ ] Watch `/#/stats` for live usage. It shows anonymous counts only.

## Answers for common questions

- **Is my video stored?** No. It's analysed in your browser, and only numbers like "eye contact 64%" are sent.
- **Is my voice stored?** No. In Chrome, captions come from the browser. In other browsers, the audio is transcribed and then discarded.
- **Which AI?** Open-weight gpt-oss-120b on Groq by default. It also works with Gemini, OpenRouter, Anthropic or any OpenAI-compatible model.
- **Is it free?** Yes to try. Accounts save your history and progress.
- **Can I self-host?** Yes. It runs on Vercel, Replit, Render or Docker; see SETUP.md.
