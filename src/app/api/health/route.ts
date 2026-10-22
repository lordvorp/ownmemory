/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
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
  const { probeEmbedDevice } = await import("@/lib/memory/device");
  await probeEmbedDevice();
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
    },
  });
}
