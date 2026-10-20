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
 * Re-embed all active memories with the current embedding model.
 * Operates on OWNMEMORY_DATA_DIR / OWNMEMORY_DB_PATH (default ~/.ownmemory).
 */
import { float32ToBuffer, getDb } from "../src/lib/memory/db";
import { embedText, getEmbeddingModelName } from "../src/lib/memory/embed";

async function main() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, content FROM memories WHERE forgotten = 0 ORDER BY updated_at`,
    )
    .all() as Array<{ id: string; content: string }>;

  console.log(`model: ${getEmbeddingModelName()}`);
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
