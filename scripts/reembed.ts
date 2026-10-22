/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
 */

/**
 * Re-embed all active memories with the current embedding model.
 * Operates on OWNMEMORY_DATA_DIR / OWNMEMORY_DB_PATH (default ~/.ownmemory).
 */
import { float32ToBuffer, getDb } from "../src/lib/memory/db";
import { probeEmbedDevice } from "../src/lib/memory/device";
import { embedText, getEmbeddingModelName } from "../src/lib/memory/embed";
import { resolveActiveEmbedder } from "../src/lib/memory/settings";

async function main() {
  const device = await probeEmbedDevice();
  const resolved = resolveActiveEmbedder();
  console.log(`model: ${getEmbeddingModelName()} (${resolved.profile.id})`);
  console.log(
    `device: cuda=${device.cudaAvailable}` +
      (device.gpuName ? ` gpu=${device.gpuName}` : "") +
      (device.vramFreeMiB != null
        ? ` vramFree=${device.vramFreeMiB}MiB`
        : ""),
  );
  console.log(`device note: ${device.reason}`);
  if (resolved.gpuFallbackReason) {
    console.error(
      `refusing re-embed: requested ${resolved.requestedId} but active is ${resolved.profile.id}: ${resolved.gpuFallbackReason}`,
    );
    process.exit(2);
  }
  if (resolved.profile.role === "gpu" && !device.cudaAvailable) {
    console.error("refusing re-embed: GPU-role model without CUDA");
    process.exit(2);
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, content FROM memories WHERE forgotten = 0 ORDER BY updated_at`,
    )
    .all() as Array<{ id: string; content: string }>;

  console.log(`re-embedding ${rows.length} active memories…`);

  const update = db.prepare(
    `UPDATE memories SET embedding = ?, updated_at = ? WHERE id = ?`,
  );

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    try {
      const vec = await embedText(row.content, "document");
      update.run(float32ToBuffer(vec), new Date().toISOString(), row.id);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `failed ${row.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
    if ((i + 1) % 25 === 0 || i + 1 === rows.length) {
      console.log(`  ${i + 1}/${rows.length} (ok=${ok} failed=${failed})`);
    }
  }

  console.log(`done: ok=${ok} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
