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
