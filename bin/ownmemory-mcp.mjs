#!/usr/bin/env node
/**
 * Cursor / Claude Desktop entrypoint for OwnMemory MCP (stdio).
 * Resolves paths relative to this repo so the shell cwd does not matter.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const server = path.join(root, "src", "mcp", "server.ts");

const child = spawn(process.execPath, [tsxCli, server], {
  stdio: "inherit",
  env: {
    ...process.env,
    OWNMEMORY_DATA_DIR:
      process.env.OWNMEMORY_DATA_DIR ||
      path.join(
        process.env.HOME || process.env.USERPROFILE || root,
        ".ownmemory",
      ),
  },
  cwd: root,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
