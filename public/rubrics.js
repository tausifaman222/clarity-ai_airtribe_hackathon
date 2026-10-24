// Single source of truth for stage rubrics (§9). Imported by the browser AND the server.
export const STAGES = [
  { id: "idea", name: "Idea", oneLiner: "You have a problem worth solving and a hunch about how.", wants: "A sharp problem, real insight, why you",
    backs: "investors back the founder's insight and the problem's pain", items: [
      { id: "problem", title: "The problem", must: true, good: "A specific, painful problem with a real story or example. Who loses what today?" },
      { id: "customer", title: "Who has it", must: true, good: "A clearly defined first customer, not \"everyone\"." },
      { id: "insight", title: "Your insight", must: false, good: "What you understand that others miss, and why now (tech, behaviour, or regulation shift)." },
      { id: "solution", title: "The idea", must: false, good: "What you'd build, in one plain sentence." },
      { id: "founderFit", title: "Why you", must: true, good: "Personal experience or skills that make you the one to solve it." },
      { id: "validation", title: "How you'll validate", must: false, good: "The first experiment or signal you'll look for." },
    ] },
  { id: "preseed", name: "Pre-seed", oneLiner: "Building an MVP, maybe a few early users.", wants: "Problem, market size, founder fit, first signals",
    backs: "investors back team, market, and early signals", items: [
      { id: "problem", title: "Problem + story", must: true, good: "A vivid, specific pain, ideally told as a real story." },
      { id: "solution", title: "Solution", must: true, good: "What it does and how it's different, possibly with a demo or MVP." },
      { id: "whyNow", title: "Why now", must: false, good: "What changed that makes this possible or urgent today." },
      { id: "market", title: "Market size", must: true, good: "TAM/SAM/SOM, ideally bottom-up (customers × price)." },
      { id: "team", title: "Team & founder-market fit", must: true, good: "Why this team wins." },
      { id: "signals", title: "Early signals", must: false, good: "Waitlist, LOIs, pilots, user interviews, first users." },
      { id: "ask", title: "The ask", must: false, good: "Amount, use of funds, and the milestones it gets you to in 12–18 months." },
    ] },
  { id: "seed", name: "Seed", oneLiner: "Live product, early traction, looking for fit.", wants: "Traction, retention, business model, clear ask",
    backs: "investors back evidence of product-market fit", items: [
      { id: "problem", title: "Problem", must: true, good: "Specific, and validated by real customers." },
      { id: "solution", title: "Solution & differentiation", must: false, good: "Why it's 10x better than the alternatives." },
      { id: "traction", title: "Traction", must: true, good: "Users or revenue, growth rate (MoM %), retention or engagement." },
      { id: "businessModel", title: "Business model", must: true, good: "Who pays, how much, pricing logic." },
      { id: "market", title: "Market", must: false, good: "Size and the beachhead segment." },
      { id: "competition", title: "Competition", must: false, good: "An honest landscape and your edge." },
      { id: "gtm", title: "Go-to-market", must: false, good: "How customers find you, and which channel works." },
      { id: "team", title: "Team", must: false, good: "Key people and gaps." },
      { id: "ask", title: "The ask", must: true, good: "Amount, runway, and the 18-month milestones (for example, the metric that sets up Series A)." },
    ] },
  { id: "seriesa", name: "Series A", oneLiner: "Product-market fit, ready to scale.", wants: "Growth metrics, unit economics, repeatable GTM",
    backs: "investors back a repeatable, scalable engine", items: [
      { id: "problemMarket", title: "Problem & market", must: false, good: "A large market with a clear wedge, sized credibly." },
      { id: "traction", title: "Traction & growth", must: true, good: "Revenue/ARR, growth trajectory (for example, 2–3x YoY), key customers." },
      { id: "unitEconomics", title: "Unit economics", must: true, good: "CAC, LTV, payback period, gross margin." },
      { id: "retention", title: "Retention", must: false, good: "Cohort retention or net revenue retention." },
      { id: "gtm", title: "Repeatable go-to-market", must: true, good: "Proven channels that scale with spend." },
      { id: "moat", title: "Competition & moat", must: false, good: "Why you keep winning as you scale." },
      { id: "team", title: "Team", must: false, good: "The leadership in place, and the hiring plan." },
      { id: "ask", title: "The ask & use of funds", must: true, good: "Amount, an 18–24 month plan, and what it unlocks." },
    ] },
];
export const PRO_TIPS = "Open with a story or a striking fact. Use numbers, not adjectives. Say the problem before the solution. End with one clear ask.";
export const stageById = (id) => STAGES.find(s => s.id === id) || null;
export const checklistText = (stage) => stage.items.map(i => `${i.id}: ${i.title}${i.must ? " ★" : ""}: ${i.good}`).join("\n");

// Delivery metric word lists (§8). Multi-word phrases are matched first so they aren't double counted.
export const FILLERS = ["basically na", "kya bolte hain", "so yeah", "you know", "i mean", "kind of", "umm", "um", "uh", "like", "basically", "actually", "matlab", "yaani", "toh", "na", "haan", "woh"];
export const HEDGES = ["ho sakta hai", "lagta hai", "i think", "sort of", "kind of", "i guess", "try to", "maybe", "probably", "hopefully", "shayad"];

export function countPhrases(text, phrases) {
  let t = ` ${String(text || "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ")} `;
  const counts = {};
  for (const p of [...phrases].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<=\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s)`, "g");
    const n = (t.match(re) || []).length;
    if (n) { counts[p] = n; t = t.replace(re, " ".repeat(p.length)); }
  }
  return counts;
}
export const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
export const wordCount = (t) => (String(t || "").trim().match(/\S+/g) || []).length;

// Sample Hinglish Seed pitch for ?demo=1 (fictional company, for live-demo backup only).
export const DEMO_PITCH = "Hi Meera. Pichle saal meri cousin Priya ne Patna mein teen brand deals kiye, aur uske paise 90 din baad aaye. India mein lakhs of small creators ke saath yahi hota hai. Hum bana rahe hain Setu, ek app jo brand ke DM ko deal, invoice aur payment link mein badal deta hai, do minute mein. Abhi humare paas 1,200 creators hain, aur pichle teen mahine se hum 30 percent month on month grow kar rahe hain. Creators free use karte hain, brands har deal pe 8 percent fee dete hain. Hamare competitors bade agencies hain jo sirf top creators ke saath kaam karte hain. Hum WhatsApp communities se creators laate hain, CAC almost zero hai. Team mein main aur mera co-founder, dono ex-fintech. Hum 1.5 crore raise kar rahe hain, 18 months runway ke liye, aur goal hai 20,000 creators aur 50 lakh monthly GMV.";
