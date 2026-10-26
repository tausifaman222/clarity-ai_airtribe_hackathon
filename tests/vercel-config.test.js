// Guards the Vercel routing that the local server can't exercise.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const cfg = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

test("no rewrite points at a .html file when cleanUrls is on (Vercel would 404)", () => {
  if (!cfg.cleanUrls) return;
  for (const r of cfg.rewrites) assert.doesNotMatch(r.destination, /\.html$/, `${r.source} → ${r.destination}`);
});

test("sign-in, sign-up, auth, api and mcp routes reach the app server", () => {
  for (const source of ["/sign-in", "/sign-up", "/auth/:path*", "/api/:path*", "/mcp"])
    assert.equal(cfg.rewrites.find(r => r.source === source)?.destination, "/api/index", source);
});

test("every static rewrite destination exists in the output directory", async () => {
  for (const r of cfg.rewrites.filter(r => !r.destination.startsWith("/api/")))
    await access(new URL(`../${cfg.outputDirectory}${r.destination}${cfg.cleanUrls ? ".html" : ""}`, import.meta.url));
});
