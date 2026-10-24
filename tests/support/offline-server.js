// Run an exact source copy so anonymous test events cannot change real counters.
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), "sayso-regression-"));
let child;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGTERM");
    const force = setTimeout(() => child.kill("SIGKILL"), 2000);
    await exited;
    clearTimeout(force);
  }
  await rm(directory, { recursive: true, force: true });
  process.exit(code);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
try {
  for (const file of ["server.js", "llm.js", "offline.js", "public", "package.json"]) {
    await cp(path.join(root, file), path.join(directory, file), { recursive: true });
  }
  await symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir");
  // Deliberate allowlist: inherit no provider keys, URLs, models, or NODE_OPTIONS.
  // This affects only the child process, never the project's saved configuration.
  child = spawn(process.execPath, ["--import", path.join(root, "tests/support/no-network.js"), "server.js"], {
    cwd: directory,
    env: { PATH: process.env.PATH, PORT: "5011", NODE_ENV: "test" },
    stdio: "inherit",
  });
  child.once("error", error => { console.error(error); void stop(1); });
  child.once("exit", code => { if (!stopping) void stop(code || 1); });
} catch (error) {
  console.error(error);
  await stop(1);
}
