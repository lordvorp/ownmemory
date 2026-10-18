#!/usr/bin/env node

/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 2.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
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
