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

import path from "node:path";
import { NextResponse } from "next/server";
import {
  ensureEngine,
  getEmbeddingError,
  whoAmI,
} from "@/lib/memory/engine";

export const runtime = "nodejs";

export async function GET() {
  ensureEngine();
  const info = whoAmI();
  const mcpEntry = path.join(process.cwd(), "bin/ownmemory-mcp.mjs");
  return NextResponse.json({
    ok: true,
    ...info,
    embeddingError: getEmbeddingError(),
    mcp: {
      type: "stdio",
      command: "node",
      args: [mcpEntry],
      env: {
        OWNMEMORY_DATA_DIR: info.dataDir,
      },
    },
  });
}
