// Model Context Protocol (MCP) server over Streamable HTTP at POST /mcp, so AI assistants and agents
// (Claude, ChatGPT, Cursor, custom agents) can use Clarity AI's coaching tools. JSON-RPC 2.0, JSON responses.
// Optional MCP_TOKEN: when set, clients must send "Authorization: Bearer <token>".
import { SCENARIOS } from "../public/scenarios.js";
import { STAGES } from "../public/rubrics.js";

const PROTOCOL = "2025-06-18";
const scenarioOrStage = {
  stage: { type: "string", description: `A startup-pitch stage (${STAGES.map(s => s.id).join(", ")}) or "custom" to use a scenario.` },
  scenario: { type: "object", description: "A scenario from list_scenarios or design_scenario (required when stage is \"custom\")." },
  lang: { type: "string", description: "BCP-47 practice language, e.g. en-IN, hi-IN, es-ES." },
};
const TOOLS = [
  { name: "list_scenarios", description: "List ready-made practice scenarios (job interview, salary negotiation, presentation, sales pitch, viva, speech, difficult conversation, self-introduction) and startup-pitch stages.", inputSchema: { type: "object", properties: {} } },
  { name: "design_scenario", description: "Understand a speaking situation described in plain words (any language) and design a tailored practice: checklist, practice partner, goal and time limit.", inputSchema: { type: "object", properties: { description: { type: "string" }, lang: { type: "string" } }, required: ["description"] } },
  { name: "coach_turn", description: "Get one spoken-style coaching reply on what the user just said, plus which checklist points are now covered.", inputSchema: { type: "object", properties: { ...scenarioOrStage, userText: { type: "string" }, history: { type: "array", items: { type: "object" } }, covered: { type: "array", items: { type: "string" } } }, required: ["stage", "userText"] } },
  { name: "review_practice", description: "Review a full practice transcript with the multi-agent reviewer (lead review, independent evaluator, referee, quote verifier). Returns scores, checklist evidence, fixes and a rewrite.", inputSchema: { type: "object", properties: { ...scenarioOrStage, transcript: { type: "string" }, durationSec: { type: "number" } }, required: ["stage", "transcript"] } },
  { name: "plan_practice", description: "Plan the next practice session (focus + 3 drills) from one or more previous review results.", inputSchema: { type: "object", properties: { ...scenarioOrStage, recent: { type: "array", items: { type: "object" } } }, required: ["stage"] } },
  { name: "grade_answer", description: "Grade an answer to a tough follow-up question, in character as the practice partner.", inputSchema: { type: "object", properties: { ...scenarioOrStage, question: { type: "string" }, answer: { type: "string" } }, required: ["stage", "question", "answer"] } },
];

// Runs a registered route's handler chain in-process with a minimal request/response pair.
function invoke(routes, path, body, outer) {
  const fns = routes.get(path);
  if (!fns) return Promise.reject(new Error(`No route ${path}`));
  return new Promise((resolve, reject) => {
    let code = 200;
    const req = { body, ip: outer.ip, query: {}, headers: {}, method: "POST", path, get: () => undefined, is: () => true };
    const res = { status(c) { code = c; return res; }, set() { return res; }, setHeader() {}, append() {},
      json(data) { (code >= 400 ? reject(Object.assign(new Error(data?.error || data?.message || `HTTP ${code}`), { data })) : resolve(data)); return res; },
      send(data) { return res.json(data); }, end() { resolve(null); } };
    let i = 0;
    const next = (err) => { if (err) return reject(err); const fn = fns[i++]; if (!fn) return reject(new Error("No handler")); Promise.resolve(fn(req, res, next)).catch(reject); };
    next();
  });
}

export function registerMcp(app, { routes } = {}) {
  app.get("/mcp", (req, res) => res.status(405).set("Allow", "POST").json({ error: "Use POST with JSON-RPC 2.0 (MCP Streamable HTTP)." }));
  app.post("/mcp", async (req, res) => {
    const token = (process.env.MCP_TOKEN || "").trim();
    if (token && req.get("authorization") !== `Bearer ${token}`) return res.status(401).json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } });
    const msg = req.body || {};
    const reply = (result) => res.json({ jsonrpc: "2.0", id: msg.id ?? null, result });
    const error = (code, message) => res.json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
    if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return error(-32600, "Invalid JSON-RPC request");
    if (msg.id === undefined) return res.status(202).end(); // notifications (e.g. notifications/initialized)
    switch (msg.method) {
      case "initialize":
        return reply({ protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "clarity-ai", version: "2.0.0" },
          instructions: "Clarity AI coaches people to speak confidently: interviews, negotiations, presentations, pitches and speeches. Feedback is on substance and delivery, never grammar or accent." });
      case "ping": return reply({});
      case "tools/list": return reply({ tools: TOOLS });
      case "tools/call": {
        const { name, arguments: args = {} } = msg.params || {};
        const call = (path, body) => invoke(routes, path, body, req);
        try {
          let data;
          if (name === "list_scenarios") data = { scenarios: SCENARIOS, startupStages: STAGES.map(s => ({ id: s.id, name: s.name, oneLiner: s.oneLiner })) };
          else if (name === "design_scenario") data = await call("/api/scenario", args);
          else if (name === "coach_turn") data = await call("/api/coach", { ...args, history: args.history || [], covered: args.covered || [] });
          else if (name === "review_practice") data = await call("/api/judge", { ...args, metrics: { durationSec: args.durationSec || 120, typed: !args.durationSec } });
          else if (name === "plan_practice") data = await call("/api/agent/plan", args);
          else if (name === "grade_answer") data = await call("/api/followup", args);
          else return error(-32602, `Unknown tool: ${name}`);
          return reply({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false });
        } catch (e) {
          return reply({ content: [{ type: "text", text: `Clarity AI couldn't complete ${name}: ${e.message}` }], isError: true });
        }
      }
      default: return error(-32601, `Method not found: ${msg.method}`);
    }
  });
}
