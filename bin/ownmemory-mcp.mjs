#!/usr/bin/env node

/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
 */

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
  // Leave OWNMEMORY_* unset so src/lib/memory/paths.ts applies defaults
  // (~/.ownmemory + Snowflake/snowflake-arctic-embed-s) unless the user set them.
  env: { ...process.env },
  cwd: root,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
