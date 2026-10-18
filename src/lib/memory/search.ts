import { getDb } from "./db";
import { cosineSimilarity, embedText } from "./embed";
import { ensureSpace, listMemoriesWithEmbeddings } from "./store";
import type { ScoredMemory } from "./types";

function ftsQuery(raw: string): string {
  return raw
    .trim()
    .split(/[\s]+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, "")}"*`)
    .join(" OR ");
}

function keywordSearch(
  query: string,
  spaceId: string | undefined,
  limit: number,
): ScoredMemory[] {
  const db = getDb();
  const q = ftsQuery(query);
  if (!q) return [];

  try {
    const sql = spaceId
      ? `SELECT f.memory_id AS id, bm25(memories_fts) AS rank
         FROM memories_fts f
         JOIN memories m ON m.id = f.memory_id
         WHERE memories_fts MATCH ? AND f.space_id = ? AND m.forgotten = 0
         ORDER BY rank
         LIMIT ?`
      : `SELECT f.memory_id AS id, bm25(memories_fts) AS rank
         FROM memories_fts f
         JOIN memories m ON m.id = f.memory_id
         WHERE memories_fts MATCH ? AND m.forgotten = 0
         ORDER BY rank
         LIMIT ?`;

    const rows = (
      spaceId
        ? db.prepare(sql).all(q, spaceId, limit)
        : db.prepare(sql).all(q, limit)
    ) as Array<{ id: string; rank: number }>;

    const byId = new Map(
      listMemoriesWithEmbeddings(spaceId).map((m) => [m.id, m]),
    );

    const out: ScoredMemory[] = [];
    for (const row of rows) {
      const mem = byId.get(row.id);
      if (!mem) continue;
      // bm25 is lower-is-better; convert to 0..1-ish score
      const score = 1 / (1 + Math.max(0, row.rank));
      out.push({
        id: mem.id,
        spaceId: mem.spaceId,
        spaceName: mem.spaceName,
        content: mem.content,
        createdAt: mem.createdAt,
        updatedAt: mem.updatedAt,
        forgotten: mem.forgotten,
        score,
        match: "keyword",
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function semanticSearch(
  query: string,
  spaceId: string | undefined,
  limit: number,
): Promise<ScoredMemory[]> {
  const queryVec = await embedText(query);
  const candidates = listMemoriesWithEmbeddings(spaceId);

  const scored: ScoredMemory[] = [];
  for (const mem of candidates) {
    if (!mem.embedding) continue;
    const score = cosineSimilarity(queryVec, mem.embedding);
    if (score < 0.18) continue;
    scored.push({
      id: mem.id,
      spaceId: mem.spaceId,
      spaceName: mem.spaceName,
      content: mem.content,
      createdAt: mem.createdAt,
      updatedAt: mem.updatedAt,
      forgotten: mem.forgotten,
      score,
      match: "semantic",
    });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function hybridSearch(
  query: string,
  options?: {
    containerTag?: string;
    limit?: number;
  },
): Promise<{ results: ScoredMemory[]; mode: "hybrid" | "keyword" }> {
  const limit = options?.limit ?? 8;
  const space = options?.containerTag
    ? ensureSpace(options.containerTag)
    : undefined;

  const keyword = keywordSearch(query, space?.id, limit * 2);
  let semantic: ScoredMemory[] = [];
  let mode: "hybrid" | "keyword" = "keyword";

  try {
    semantic = await semanticSearch(query, space?.id, limit * 2);
    mode = "hybrid";
  } catch {
    mode = "keyword";
  }

  const merged = new Map<string, ScoredMemory>();

  for (const hit of keyword) {
    merged.set(hit.id, { ...hit, match: "keyword" });
  }

  for (const hit of semantic) {
    const existing = merged.get(hit.id);
    if (!existing) {
      merged.set(hit.id, hit);
      continue;
    }
    const score = Math.max(existing.score, hit.score) * 1.08;
    merged.set(hit.id, {
      ...existing,
      score: Math.min(score, 1),
      match: "hybrid",
    });
  }

  const results = [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { results, mode };
}
