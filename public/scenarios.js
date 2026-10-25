// Practice scenarios beyond startup pitches. These templates are instant starting points and the offline
// fallback; with AI on, the scenario agent builds a custom one from the user's own description.
// Shared by the browser and the server.

export const SCENARIOS = [
  { id: "job-interview", emoji: "💼", name: "Job interview", kind: "interview", blurb: "Answer like the best candidate in the room.",
    audience: "a hiring manager", personaName: "Ananya Rao", personaRole: "hiring manager", timeLimitSec: 240,
    goal: "Show you understand the role, back your claims with specific examples and results, and leave the interviewer wanting to move you forward.",
    intro: "Hi, I'm Ananya. Thanks for coming in. To start, tell me about yourself and why this role.",
    opener: "Let's get you interview-ready. What role are you interviewing for, and what's the one thing you most want them to remember about you?",
    items: [
      { id: "intro", title: "A crisp introduction", must: true, good: "Who you are, your relevant experience and why this role, in under a minute.", kw: "i am|i'm|my name|currently|experience|years" },
      { id: "roleFit", title: "Fit for the role", must: true, good: "Connect two or three of your skills directly to what the role needs.", kw: "role|position|team|skills|responsib" },
      { id: "story", title: "A concrete example", must: true, good: "One real situation told clearly: the situation, what you did, and the result (STAR).", kw: "when i|for example|once|project|situation|led|handled" },
      { id: "impact", title: "Measurable impact", must: false, good: "Numbers or clear outcomes: time saved, revenue, users, quality, people helped.", kw: "\\d|percent|%|increased|reduced|saved|grew" },
      { id: "motivation", title: "Why this company", must: false, good: "A specific, genuine reason for this company, not a generic compliment.", kw: "your company|mission|product|culture|because" },
      { id: "close", title: "A strong close", must: false, good: "Summarise your fit and ask a thoughtful question or state your interest clearly.", kw: "question|excited|next step|look forward|thank" },
    ] },
  { id: "salary", emoji: "🤝", name: "Salary or raise negotiation", kind: "negotiation", blurb: "Ask for what you're worth, calmly and clearly.",
    audience: "your manager or a recruiter", personaName: "David Mehta", personaRole: "manager", timeLimitSec: 180,
    goal: "State a clear number, justify it with evidence of value and market data, handle pushback calmly, and agree a concrete next step.",
    intro: "Hi, I'm David. You wanted to talk about your compensation. Go ahead, I'm listening.",
    opener: "Let's prepare your ask. What are you asking for, and what's the strongest evidence that you've earned it?",
    items: [
      { id: "ask", title: "A clear number", must: true, good: "State a specific figure or range early, without apologising.", kw: "\\d|lakh|salary|raise|package|ctc|per annum|k\\b" },
      { id: "value", title: "Evidence of your value", must: true, good: "Two or three concrete achievements with results.", kw: "delivered|achieved|led|saved|grew|impact|result" },
      { id: "market", title: "Market data", must: false, good: "A credible benchmark: comparable roles, offers or published salary ranges.", kw: "market|benchmark|industry|similar roles|glassdoor|levels" },
      { id: "pushback", title: "Handling pushback", must: false, good: "A calm, prepared response if they say no or not now.", kw: "understand|if that's not possible|alternatively|budget" },
      { id: "alternatives", title: "Other options", must: false, good: "Non-salary levers you'd accept: title, equity, bonus, learning budget, review date.", kw: "bonus|equity|title|review|flexib|budget" },
      { id: "nextStep", title: "A concrete next step", must: true, good: "Agree what happens next and by when.", kw: "next step|by when|follow up|revisit|timeline" },
    ] },
  { id: "presentation", emoji: "📊", name: "Presentation or demo", kind: "presentation", blurb: "Hold the room from first line to last.",
    audience: "your team, leadership or a client", personaName: "Sara Iyer", personaRole: "audience member", timeLimitSec: 300,
    goal: "Open strongly, deliver one clear message with a logical structure and evidence, and end with a specific call to action.",
    intro: "Hi, I'm Sara. The floor is yours whenever you're ready.",
    opener: "Let's sharpen your presentation. Who is your audience, and what should they think or do differently when you finish?",
    items: [
      { id: "hook", title: "A strong opening", must: true, good: "A question, story or striking fact that earns attention in the first 20 seconds.", kw: "imagine|what if|today|story|did you know" },
      { id: "message", title: "One key message", must: true, good: "The single idea you want remembered, stated plainly.", kw: "the key|main point|in short|most important|message" },
      { id: "structure", title: "Clear structure", must: false, good: "Signposting so listeners always know where they are: first, then, finally.", kw: "first|second|then|next|finally|three" },
      { id: "evidence", title: "Evidence", must: false, good: "Data, examples or a demo that supports the message.", kw: "\\d|data|example|for instance|results|demo" },
      { id: "action", title: "Call to action", must: true, good: "Exactly what you want the audience to decide or do next.", kw: "ask|decide|approve|next step|please|need you" },
    ] },
  { id: "sales", emoji: "🛍️", name: "Sales or client pitch", kind: "sales", blurb: "Win the client without sounding salesy.",
    audience: "a prospective customer", personaName: "Priya Nair", personaRole: "prospective client", timeLimitSec: 240,
    goal: "Show you understand the client's need, explain value in their terms with proof, handle an objection, and secure a next step.",
    intro: "Hi, I'm Priya. I've got a few minutes. What can you do for us?",
    opener: "Let's prep your client pitch. Who's the client, and what problem of theirs do you solve?",
    items: [
      { id: "need", title: "Their need", must: true, good: "Show you understand the client's specific situation and pain.", kw: "you|your team|currently|challenge|struggle" },
      { id: "value", title: "Value in their terms", must: true, good: "Outcomes they care about: money, time, risk, growth.", kw: "save|increase|reduce|help you|so that" },
      { id: "proof", title: "Proof", must: false, good: "A case study, numbers or a recognisable customer.", kw: "\\d|customer|client|case|results|for example" },
      { id: "objection", title: "Handling an objection", must: false, good: "Address price, timing or switching cost before they raise it.", kw: "concern|worried|price|cost|risk|switch" },
      { id: "nextStep", title: "A clear next step", must: true, good: "A specific, low-friction next step: trial, demo, call with a date.", kw: "trial|demo|next week|schedule|start|pilot" },
    ] },
  { id: "viva", emoji: "🎓", name: "Viva, thesis or exam defence", kind: "academic", blurb: "Explain your work with calm authority.",
    audience: "an examiner or panel", personaName: "Dr. Kavita Menon", personaRole: "examiner", timeLimitSec: 300,
    goal: "Summarise the work clearly, justify the method, present results honestly with limitations, and state the contribution.",
    intro: "Good morning. I'm Dr. Menon. Please summarise your work and what you found.",
    opener: "Let's prepare your defence. What's your work about, in one sentence, and what are you most nervous to be asked?",
    items: [
      { id: "summary", title: "One-sentence summary", must: true, good: "The question you answered and the answer, in plain words.", kw: "this work|my thesis|i studied|we found|research" },
      { id: "method", title: "Method and why", must: true, good: "How you did it and why this method fits the question.", kw: "method|approach|we used|data|experiment|survey|model" },
      { id: "results", title: "Results", must: true, good: "The key findings, with numbers where possible.", kw: "\\d|found|results|showed|significant" },
      { id: "limits", title: "Limitations", must: false, good: "Honest limits and how they affect the conclusions.", kw: "limitation|however|only|sample|bias|future" },
      { id: "contribution", title: "Contribution", must: false, good: "What's new and why it matters to the field.", kw: "contribut|novel|first|new|implication|matters" },
    ] },
  { id: "speech", emoji: "🎤", name: "Speech or toast", kind: "speech", blurb: "Weddings, farewells, awards: make it memorable.",
    audience: "a live audience", personaName: "Rohan", personaRole: "guest in the audience", timeLimitSec: 180,
    goal: "Open warmly, tell one vivid story around a clear theme, keep it brief and end on a line people remember.",
    intro: "Hi, I'm Rohan, sitting in the front row. Whenever you're ready.",
    opener: "Let's write and rehearse your speech. What's the occasion, and who is it about?",
    items: [
      { id: "opening", title: "A warm opening", must: true, good: "Introduce yourself and your connection in one or two lines.", kw: "i'm|my name|for those|i've known|good evening" },
      { id: "story", title: "One vivid story", must: true, good: "A specific moment with detail that shows who the person is.", kw: "remember|when|once|story|time" },
      { id: "theme", title: "A clear theme", must: false, good: "One quality or idea that ties the speech together.", kw: "always|because|what makes|that's who|kind|generous" },
      { id: "brevity", title: "Brevity", must: false, good: "Under three minutes, no inside jokes most people won't get.", kw: "" },
      { id: "closing", title: "A memorable close", must: true, good: "A toast, wish or line that lands, and a clear end.", kw: "raise|toast|cheers|wish|congratulations|thank you" },
    ] },
  { id: "difficult", emoji: "🧭", name: "Difficult conversation", kind: "conversation", blurb: "Feedback, conflict or bad news, handled with care.",
    audience: "a colleague, report or client", personaName: "Neha", personaRole: "colleague", timeLimitSec: 180,
    goal: "State the purpose, describe specific behaviour and its impact without blame, listen to their view, and agree a way forward.",
    intro: "Hi, it's Neha. You wanted to talk?",
    opener: "Let's prepare this conversation. Who is it with, and what outcome do you want?",
    items: [
      { id: "purpose", title: "Clear purpose", must: true, good: "Say why you're talking, kindly and directly, at the start.", kw: "wanted to talk|i'd like to|about|reason" },
      { id: "facts", title: "Specific facts", must: true, good: "Describe the behaviour or situation, not the person's character.", kw: "when|on|yesterday|last week|i noticed|in the meeting" },
      { id: "impact", title: "Impact", must: false, good: "Explain the effect on you, the team or the work.", kw: "impact|affected|meant|result|felt" },
      { id: "listen", title: "Invite their view", must: true, good: "Ask an open question and show you're willing to listen.", kw: "how do you see|what do you think|your view|help me understand" },
      { id: "agreement", title: "A way forward", must: false, good: "Agree a specific change and when you'll check in.", kw: "going forward|agree|next time|check in|plan" },
    ] },
  { id: "intro", emoji: "👋", name: "Self-introduction or networking", kind: "networking", blurb: "Introduce yourself with confidence, in any language.",
    audience: "someone new at an event or call", personaName: "Leo", personaRole: "new contact", timeLimitSec: 90,
    goal: "Say who you are and what you do in plain words, share something memorable, and make a clear, easy ask or connection.",
    intro: "Hi, I'm Leo. Nice to meet you. So, what do you do?",
    opener: "Let's build your introduction. Who will you meet, and what would make the conversation a win for you?",
    items: [
      { id: "who", title: "Who you are", must: true, good: "Name and role, in one plain sentence.", kw: "i'm|i am|my name|i work" },
      { id: "what", title: "What you do, simply", must: true, good: "What you work on and who it helps, without jargon.", kw: "help|build|work on|focus|people" },
      { id: "hook", title: "Something memorable", must: false, good: "A result, story or detail that makes you easy to remember.", kw: "recently|proud|\\d|story|just" },
      { id: "ask", title: "An easy ask", must: false, good: "A specific, low-pressure next step or question.", kw: "would love|could we|are you|connect|coffee|question" },
    ] },
];

export const scenarioById = id => SCENARIOS.find(s => s.id === id) || null;

// Turns any scenario (template or AI-built) into the "track" shape the practice rooms use.
export function scenarioTrack(s) {
  if (!s) return null;
  return { id: "custom", custom: true, name: s.name, oneLiner: s.blurb || s.goal, wants: s.goal, items: s.items, scenario: s,
    persona: { name: s.personaName, role: s.personaRole, initials: initials(s.personaName), intro: s.intro }, timeLimitSec: s.timeLimitSec };
}
export const initials = name => String(name || "AI").replace(/^dr\.?\s+/i, "").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "AI";

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// Server-side validation for scenarios sent by the browser or produced by the AI.
export function normalizeScenario(input) {
  if (!input || typeof input !== "object") return null;
  const seen = new Set();
  const items = (Array.isArray(input.items) ? input.items : []).slice(0, 8).map((it, i) => {
    let id = str(it?.id, 32).replace(/[^a-zA-Z0-9]/g, "") || `point${i + 1}`;
    if (!/^[a-zA-Z]/.test(id)) id = `p${id}`;
    while (seen.has(id)) id = `${id}${i}`;
    seen.add(id);
    return { id, title: str(it?.title, 60), good: str(it?.good, 240), must: !!it?.must, kw: str(it?.kw, 200) };
  }).filter(it => it.title && it.good);
  if (items.length < 3) return null;
  if (!items.some(i => i.must)) items[0].must = true;
  const name = str(input.name, 80);
  if (!name) return null;
  const limit = Math.round(Number(input.timeLimitSec) || 180);
  return {
    id: str(input.id, 40) || "custom", name, emoji: str(input.emoji, 4) || "🎯", kind: str(input.kind, 24) || "other",
    blurb: str(input.blurb, 160), audience: str(input.audience, 120) || "your listener",
    personaName: str(input.personaName, 40) || "Alex", personaRole: str(input.personaRole, 40) || "practice partner",
    goal: str(input.goal, 400) || "Explain your point clearly and confidently.",
    intro: str(input.intro, 300) || "Hi, I'm listening whenever you're ready.",
    opener: str(input.opener, 300) || "Let's practise. What do you want to get across, and to whom?",
    timeLimitSec: Math.min(600, Math.max(60, limit)), items,
    tips: str(input.tips, 400), language: str(input.language, 12),
  };
}
