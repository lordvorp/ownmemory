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

import { getDb, float32ToBuffer, bufferToFloat32 } from "./db";
import { embedText } from "./embed";
import type { Memory, Space } from "./types";

type MemoryRow = {
  id: string;
  space_id: string;
  space_name: string;
  content: string;
  created_at: string;
  updated_at: string;
  forgotten: number;
  embedding: Buffer | null;
};

function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    spaceId: row.space_id,
    spaceName: row.space_name,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    forgotten: row.forgotten === 1,
  };
}

const MEMORY_SELECT = `
  SELECT m.id, m.space_id, s.name AS space_name, m.content,
         m.created_at, m.updated_at, m.forgotten, m.embedding
  FROM memories m
  JOIN spaces s ON s.id = m.space_id
`;

export function listSpaces(): Space[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, created_at FROM spaces ORDER BY name COLLATE NOCASE`,
    )
    .all() as Array<{ id: string; name: string; created_at: string }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
  }));
}

export function ensureSpace(name: string): Space {
  const trimmed = name.trim() || "default";
  const db = getDb();
  const existing = db
    .prepare(`SELECT id, name, created_at FROM spaces WHERE name = ?`)
    .get(trimmed) as
    | { id: string; name: string; created_at: string }
    | undefined;

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      createdAt: existing.created_at,
    };
  }

  const space: Space = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO spaces (id, name, created_at) VALUES (?, ?, ?)`,
  ).run(space.id, space.name, space.createdAt);
  return space;
}

export async function saveMemory(
  content: string,
  containerTag?: string,
): Promise<Memory> {
  const text = content.trim();
  if (!text) {
    throw new Error("Memory content cannot be empty.");
  }

  const space = ensureSpace(containerTag || "default");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  let embedding: Buffer | null = null;
  try {
    embedding = float32ToBuffer(await embedText(text));
  } catch {
    // Keyword search still works without embeddings.
  }

  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO memories
        (id, space_id, content, embedding, created_at, updated_at, forgotten)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
    ).run(id, space.id, text, embedding, now, now);

    db.prepare(
      `INSERT INTO memories_fts (memory_id, space_id, content)
       VALUES (?, ?, ?)`,
    ).run(id, space.id, text);
  });
  tx();

  return {
    id,
    spaceId: space.id,
    spaceName: space.name,
    content: text,
    createdAt: now,
    updatedAt: now,
    forgotten: false,
  };
}

export async function forgetMemory(
  content: string,
  containerTag?: string,
): Promise<{ removed: Memory[]; note: string }> {
  const text = content.trim();
  if (!text) {
    throw new Error("Forget content cannot be empty.");
  }

  const space = containerTag ? ensureSpace(containerTag) : null;
  const candidates = listActiveMemories(space?.name, 500);
  const needle = text.toLowerCase();

  const exact = candidates.filter(
    (m) =>
      m.content.toLowerCase() === needle ||
      m.content.toLowerCase().includes(needle) ||
      needle.includes(m.content.toLowerCase()),
  );

  let toRemove = exact;

  if (toRemove.length === 0) {
    try {
      const queryVec = await embedText(text);
      const scored = candidates
        .map((m) => {
          const row = getMemoryRow(m.id);
          const vec = bufferToFloat32(row?.embedding ?? null);
          if (!vec) return null;
          let score = 0;
          const len = Math.min(queryVec.length, vec.length);
          for (let i = 0; i < len; i += 1) {
            score += queryVec[i]! * vec[i]!;
          }
          return { memory: m, score };
        })
        .filter((x): x is { memory: Memory; score: number } => x !== null)
        .sort((a, b) => b.score - a.score);

      toRemove = scored.filter((s) => s.score >= 0.72).map((s) => s.memory);
    } catch {
      // fall through
    }
  }

  if (toRemove.length === 0) {
    return {
      removed: [],
      note: "No matching memories found to forget.",
    };
  }

  const db = getDb();
  const mark = db.prepare(
    `UPDATE memories SET forgotten = 1, updated_at = ? WHERE id = ?`,
  );
  const dropFts = db.prepare(
    `DELETE FROM memories_fts WHERE memory_id = ?`,
  );
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    for (const mem of toRemove) {
      mark.run(now, mem.id);
      dropFts.run(mem.id);
    }
  });
  tx();

  return {
    removed: toRemove,
    note: `Forgot ${toRemove.length} memor${toRemove.length === 1 ? "y" : "ies"}.`,
  };
}

export function listActiveMemories(
  containerTag?: string | null,
  limit = 50,
  offset = 0,
): Memory[] {
  const db = getDb();
  if (containerTag) {
    const space = ensureSpace(containerTag);
    const rows = db
      .prepare(
        `${MEMORY_SELECT}
         WHERE m.forgotten = 0 AND m.space_id = ?
         ORDER BY m.updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(space.id, limit, offset) as MemoryRow[];
    return rows.map(mapMemory);
  }

  const rows = db
    .prepare(
      `${MEMORY_SELECT}
       WHERE m.forgotten = 0
       ORDER BY m.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as MemoryRow[];
  return rows.map(mapMemory);
}

export function countActiveMemories(containerTag?: string | null): number {
  const db = getDb();
  if (containerTag) {
    const space = ensureSpace(containerTag);
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM memories WHERE forgotten = 0 AND space_id = ?`,
      )
      .get(space.id) as { c: number };
    return row.c;
  }
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM memories WHERE forgotten = 0`)
    .get() as { c: number };
  return row.c;
}

export function getMemoryRow(id: string): MemoryRow | undefined {
  const db = getDb();
  return db
    .prepare(`${MEMORY_SELECT} WHERE m.id = ?`)
    .get(id) as MemoryRow | undefined;
}

export function listMemoriesWithEmbeddings(
  spaceId?: string,
): Array<Memory & { embedding: Float32Array | null }> {
  const db = getDb();
  const rows = (
    spaceId
      ? db
          .prepare(
            `${MEMORY_SELECT} WHERE m.forgotten = 0 AND m.space_id = ?`,
          )
          .all(spaceId)
      : db
          .prepare(`${MEMORY_SELECT} WHERE m.forgotten = 0`)
          .all()
  ) as MemoryRow[];

  return rows.map((row) => ({
    ...mapMemory(row),
    embedding: bufferToFloat32(row.embedding),
  }));
}

export function hardDeleteMemory(id: string): boolean {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM memories_fts WHERE memory_id = ?`).run(id);
    const result = db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
    return result.changes > 0;
  });
  return tx();
}
