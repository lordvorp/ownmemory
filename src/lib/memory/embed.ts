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

import { env, pipeline } from "@xenova/transformers";
import { EMBEDDING_MODEL, getCacheDir } from "./paths";

/** Arctic-embed query prefix — documents must not use this. */
export const QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: ";

export type EmbedRole = "query" | "document";

type FeatureExtractor = (
  text: string,
  options?: {
    pooling?: "mean" | "cls";
    normalize?: boolean;
  },
) => Promise<{ data: Float32Array }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;
let ready = false;
let lastError: string | null = null;

function configureEnv(): void {
  env.cacheDir = getCacheDir();
  env.allowLocalModels = true;
  // Allow one-time model download from Hugging Face; after that, fully local.
  env.allowRemoteModels = process.env.OWNMEMORY_OFFLINE !== "1";
}

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    configureEnv();
    extractorPromise = (async () => {
      // Default quantized ONNX (~67MB) for snowflake-arctic-embed-s.
      const pipe = (await pipeline(
        "feature-extraction",
        EMBEDDING_MODEL,
      )) as unknown as FeatureExtractor;
      ready = true;
      lastError = null;
      return pipe;
    })().catch((err: unknown) => {
      extractorPromise = null;
      ready = false;
      lastError = err instanceof Error ? err.message : String(err);
      throw err;
    });
  }
  return extractorPromise;
}

export function isEmbeddingReady(): boolean {
  return ready;
}

export function getEmbeddingError(): string | null {
  return lastError;
}

export function getEmbeddingModelName(): string {
  return EMBEDDING_MODEL;
}

/** Warm the model in the background so the first search is faster. */
export function warmEmbeddings(): void {
  void getExtractor().catch(() => {
    // surfaced via getEmbeddingError / health endpoint
  });
}

/**
 * Embed text with CLS pooling + L2 normalize.
 * Use role "query" for search/forget matching; "document" when storing memories.
 */
export async function embedText(
  text: string,
  role: EmbedRole = "document",
): Promise<Float32Array> {
  const input = role === "query" ? `${QUERY_PREFIX}${text}` : text;
  const extractor = await getExtractor();
  const output = await extractor(input, { pooling: "cls", normalize: true });
  return new Float32Array(output.data);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
