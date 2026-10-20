#!/usr/bin/env node
/**
 * Cursor plugin MCP entry — resolves the OwnMemory repo root from this file.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const entry = path.join(root, "bin", "ownmemory-mcp.mjs");

const child = spawn(process.execPath, [entry], {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
