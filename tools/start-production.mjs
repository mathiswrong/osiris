import { spawn } from "node:child_process";
import { chown, mkdir } from "node:fs/promises";
import path from "node:path";

// Railway mounts volumes as root. Prepare the data directory, then drop all
// privileges before either the web server or collector starts.
const dataDirectory = process.env.INTELLIGENCE_DATA_DIR || path.resolve(".cache/intelligence");
await mkdir(dataDirectory, { recursive: true });
if (process.getuid?.() === 0) {
  await chown(dataDirectory, 1001, 1001);
  process.setgroups([]);
  process.setgid(1001);
  process.setuid(1001);
}

const children = new Set();
let stopping = false;
let exitCode = 0;
let deadline;

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  deadline = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(exitCode);
  }, 8_000);
  if (!children.size) process.exit(exitCode);
}

function start(label, script, env = process.env) {
  const child = spawn(process.execPath, [script], { stdio: "inherit", env });
  children.add(child);
  child.on("error", (error) => {
    console.error(`${label} could not start: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${label} stopped unexpectedly (${signal || code}). Restarting the service.`);
      shutdown(1);
    }
    if (stopping && !children.size) {
      clearTimeout(deadline);
      process.exit(exitCode);
    }
  });
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
start("Web server", "server.js");
if (process.env.INTELLIGENCE_COLLECTOR_ENABLED !== "0") {
  start("Intelligence collector", "tools/collect-intelligence.mjs", {
    ...process.env,
    INTELLIGENCE_URL: `http://127.0.0.1:${process.env.PORT || "3000"}`,
  });
}
