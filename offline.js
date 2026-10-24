// Offline mode: used ONLY when no LLM key is configured, so the app still runs end to end.
// Simple keyword heuristics, clearly labelled "Offline mode" in the UI. Not a substitute for the AI judge.
import { FILLERS, HEDGES, countPhrases, sum } from "./public/rubrics.js";

const KW = {
  problem: /problem|pain|struggl|frustrat|wast|lose|losing|loss|dikkat|pareshan|mushkil|issue|late|delay|nahi milt|baad aa|der se/i,
  customer: /customer|users?\b|creators?|students?|shop|kirana|smbs?|founders?|teachers?|parents?|freelancer|grahak|merchants?|doctors?|farmers?|for (small|busy|indian)/i,
  insight: /insight|realis|realiz|notic|why now|nobody|no one|pehli baar|samajh aaya/i,
  solution: /we('| a)?re build|we build|app\b|platform|tool|product|bana rahe|banaya|solution|lets you|helps|turns/i,
  founderFit: /\bi (have|was|worked|spent|built|ran)|my (experience|background|cousin|family|years)|\bex-|maine|mera|meri|years (at|in)/i,
  validation: /validat|experiment|test|interview|pilot|survey|waitlist|signal/i,
  whyNow: /why now|now that|recently|\bupi\b|\bai\b|regulation|aaj kal|ab sab/i,
  market: /market|\btam\b|\bsam\b|\bsom\b|billion|crore|lakh|million|size/i,
  team: /team|co-?founder|\bcto\b|\bceo\b|engineer|hum do|we are (two|three)/i,
  signals: /waitlist|\blois?\b|pilot|signed|interview|beta|early users|first users/i,
  ask: /rais|funding|invest|runway|\bask\b|seeking/i,
  traction: /\d[\d,.]*\s*(users|customers|creators|clients|downloads)|revenue|\bmrr\b|\barr\b|grow|month on month|\bmom\b|retention|%|percent/i,
  businessModel: /pricing|price|subscription|fee|commission|charge|per month|revenue model|monetis|monetiz|₹|rs\.?\s?\d/i,
  competition: /compet|alternative|unlike|versus|\bvs\b|incumbent|agenc/i,
  gtm: /channel|go.to.market|\bgtm\b|acqui|sales|marketing|whatsapp|communit|referral|partnership|\bcac\b/i,
  unitEconomics: /\bcac\b|\bltv\b|payback|margin|unit economics/i,
  retention: /retention|retain|cohort|churn|\bnrr\b|repeat/i,
  moat: /moat|defensib|network effect|data advantage|switching cost|proprietary/i,
};
KW.problemMarket = new RegExp(`${KW.problem.source}|${KW.market.source}`, "i");

const isHinglish = (t) => (String(t).toLowerCase().match(/\b(hai|hain|hum|mein|kya|nahi|aur|ke|ki|ko|se|bana|raha|rahe|kar|toh|yeh|woh|abhi)\b/g) || []).length >= 3;
const isHindi = (t) => (String(t).match(/[ऀ-ॿ]/g) || []).length > String(t).length * 0.3;
const sentences = (t) => String(t).split(/(?<=[.!?।])\s+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 4);
const hit = (id, t) => (KW[id] ? KW[id].test(t) : false);

const ASK = {
  en: {
    problem: "What exactly is the problem, and who loses what today? Give me one real example.",
    customer: "Who is your very first customer? Be specific, not everyone.",
    insight: "What do you understand that others miss, and why is now the moment?",
    solution: "Say what you're building in one plain sentence.",
    founderFit: "Why are you the one to solve this? What have you lived or built?",
    validation: "What's the first experiment that would prove you right?",
    whyNow: "Why now? What changed that makes this possible today?",
    market: "How big is this? Try bottom-up: number of customers times price.",
    team: "Tell me about the team. Why do you win?",
    signals: "Any early signals? Waitlist, pilots, interviews, first users?",
    ask: "What's your ask? Amount, what it funds, and the milestone it gets you to.",
    traction: "Give me your traction in numbers: users or revenue, and growth per month.",
    businessModel: "Who pays, how much, and why that price?",
    competition: "Who else solves this today, and what's your honest edge?",
    gtm: "How do customers find you? Which channel actually works?",
    unitEconomics: "Walk me through CAC, LTV, payback and gross margin.",
    retention: "How well do customers stick? Any cohort or net revenue retention?",
    moat: "Why do you keep winning as you scale?",
    problemMarket: "Frame the problem and the size of the market in two sentences.",
  },
  hi: {
    problem: "Problem exactly kya hai, aur aaj kaun kya lose kar raha hai? Ek real example do.",
    customer: "Aapka pehla customer kaun hai? Specific batao, sab log nahi.",
    insight: "Aap kya samajhte ho jo baaki miss kar rahe hain, aur abhi hi kyun?",
    solution: "Ek simple line mein batao aap kya bana rahe ho.",
    founderFit: "Yeh problem aap hi kyun solve karoge? Aapka experience kya hai?",
    validation: "Pehla experiment kya hoga jo prove kare ki aap sahi ho?",
    whyNow: "Abhi kyun? Kya badla hai jo aaj yeh possible hai?",
    market: "Market kitna bada hai? Bottom-up try karo: customers times price.",
    team: "Team ke baare mein batao. Aap kyun jeetoge?",
    signals: "Koi early signals? Waitlist, pilots, interviews, pehle users?",
    ask: "Aapka ask kya hai? Kitna amount, kis pe kharch, aur kaunsa milestone?",
    traction: "Traction numbers mein batao: users ya revenue, aur monthly growth.",
    businessModel: "Paisa kaun deta hai, kitna, aur yeh price kyun?",
    competition: "Aaj yeh kaun solve kar raha hai, aur aapka honest edge kya hai?",
    gtm: "Customers aap tak kaise pahunchte hain? Kaunsa channel kaam karta hai?",
    unitEconomics: "CAC, LTV, payback aur gross margin batao.",
    retention: "Customers kitna tikte hain? Cohort ya net revenue retention?",
    moat: "Scale pe bhi aap kyun jeette rahoge?",
    problemMarket: "Do lines mein problem aur market size batao.",
  },
};

export function offlineCoach(stage, history, userText, prevCovered) {
  const all = [...history.filter(m => m.role === "user").map(m => m.text), userText].join(" ");
  const covered = stage.items.filter(i => prevCovered.includes(i.id) || hit(i.id, all)).map(i => i.id);
  const fresh = stage.items.filter(i => covered.includes(i.id) && !prevCovered.includes(i.id));
  const missing = stage.items.filter(i => !covered.includes(i.id));
  const next = missing.find(i => i.must) || missing[0];
  const hi = isHinglish(userText) || isHindi(userText);
  const hedges = sum(countPhrases(userText, HEDGES));
  let reply;
  if (hi) {
    reply = fresh.length ? `Badhiya, ${fresh.map(i => i.title.toLowerCase()).join(" aur ")} clear aaya. ` : "Theek hai, aage badhte hain. ";
    if (hedges >= 2) reply += "Thoda confidence se bolo, 'shayad' kam karo. ";
    reply += next ? ASK.hi[next.id] : "Saare points cover ho gaye. Ab investor verdict lo, ya Showtime try karo.";
  } else {
    reply = fresh.length ? `Nice, your ${fresh.map(i => i.title.toLowerCase()).join(" and ")} came through. ` : "Okay, keep going. ";
    if (hedges >= 2) reply += "Separate what you've observed from what you're still testing. ";
    reply += next ? ASK.en[next.id] : "You've covered the essentials. Ask for the investor verdict, or try Showtime.";
  }
  return { reply, covered, nextFocus: next?.id || null };
}

export function offlineVerdict(stage, history) {
  const all = history.filter(m => m.role === "user").map(m => m.text).join(" ");
  const cov = stage.items.filter(i => hit(i.id, all)), miss = stage.items.filter(i => !hit(i.id, all));
  const mustMiss = miss.filter(i => i.must);
  const verdict = !mustMiss.length && miss.length <= 2 ? "ready" : mustMiss.length <= 1 ? "almost" : "needs_work";
  const hi = isHinglish(all);
  return {
    verdict,
    headline: hi ? (verdict === "ready" ? "Kaafi clear hai. Showtime mein daalo." : "Idea interesting hai, par kuch zaroori cheezein missing hain.")
      : (verdict === "ready" ? "This is clear enough to pitch. Take it to Showtime." : "There's something here, but key pieces are still missing."),
    clear: cov.slice(0, 3).map(i => `${i.title}: mentioned`),
    missing: miss.slice(0, 3).map(i => `${i.title}${i.must ? " ★" : ""}: ${i.good}`),
    fixFirst: (mustMiss[0] || miss[0]) ? ASK[hi ? "hi" : "en"][(mustMiss[0] || miss[0]).id] : "Rehearse it once end to end in Showtime.",
  };
}

export function offlineJudge(stage, transcript, metrics) {
  const sents = sentences(transcript);
  const find = (id) => sents.find(s => hit(id, s));
  const checklist = stage.items.map(i => {
    const q = find(i.id);
    return { id: i.id, status: q ? (/\d/.test(q) || !i.must ? "covered" : "weak") : "missing", evidence: q || "Not mentioned",
      note: q ? "Detected by keywords (offline mode)." : i.good };
  });
  const coverage = checklist.filter(c => c.status !== "missing").length / stage.items.length;
  const numbers = (transcript.match(/\d[\d,.]*/g) || []).length;
  const f = metrics.fillers.total / Math.max(1, metrics.wordCount) * 100, h = metrics.hedges.total;
  const paceOk = metrics.paceLabel === "Great" || metrics.typed;
  const structure = Math.round(2 + coverage * 7), clarity = Math.round(sents.length >= 4 ? 6 : 4);
  const substance = Math.min(9, Math.round(2 + numbers * 0.8 + coverage * 2)), delivery = Math.max(2, Math.round((paceOk ? 8 : 5) - f * 0.5 - h * 0.5));
  const withNum = sents.filter(s => /\d/.test(s));
  const weak = sents.filter(s => sum(countPhrases(s, HEDGES)) + sum(countPhrases(s, FILLERS)) > 0);
  const missingItems = stage.items.filter(i => checklist.find(c => c.id === i.id).status === "missing");
  return {
    investorReaction: "This is a checklist-based review, not a full AI assessment. Use the improvement plan to work through the points that may need a clearer explanation.",
    pitchInOneLine: (find("solution") || sents[0] || transcript.slice(0, 160)),
    scores: {
      structure: { score: structure, reason: `${Math.round(coverage * 100)}% of the ${stage.name} checklist detected.` },
      clarity: { score: clarity, reason: "Estimated from sentence structure (offline mode)." },
      substance: { score: substance, reason: `${numbers} number${numbers === 1 ? "" : "s"} detected.` },
      delivery: { score: delivery, reason: `${metrics.wpm} wpm, ${metrics.fillers.total} fillers, ${h} hedges.` },
    },
    checklist,
    strengths: withNum.slice(0, 3).map(q => ({ title: "Specific number", quote: q, why: "Numbers make claims credible." })),
    fixes: [...weak.slice(0, 2).map(q => ({ title: "Cut the hedging and fillers", youSaid: q, try: "[Say the same point without the filler words, as a fact]", why: "Hedges lower conviction." })),
      ...missingItems.slice(0, 3).map(i => ({ title: `Add: ${i.title}`, youSaid: "Not mentioned", try: `[${i.good}]`, why: i.must ? "This is a must-have at this stage." : "Strengthens the pitch." }))].slice(0, 3),
    toughestQuestion: { question: missingItems[0] ? ASK.en[missingItems[0].id] : "What's the biggest risk in this plan?", howToAnswer: "Answer with one number and one example." },
    rewrite: stage.items.map(i => { const c = checklist.find(x => x.id === i.id); return c.status !== "missing" ? c.evidence : `[${i.title}]`; }).join(" "),
  };
}
