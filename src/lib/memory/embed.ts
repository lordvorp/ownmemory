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
import type { EmbedderProfile } from "./embedders";
import { getCacheDir } from "./paths";
import { resolveActiveEmbedder } from "./settings";

export type EmbedRole = "query" | "document";

type FeatureExtractor = (
  text: string,
  options?: {
    pooling?: "mean" | "cls";
    normalize?: boolean;
  },
) => Promise<{ data: Float32Array }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;
let loadedProfileKey: string | null = null;
let ready = false;
let lastError: string | null = null;

function activeProfile(): EmbedderProfile {
  return resolveActiveEmbedder().profile;
}

function profileKey(profile: EmbedderProfile): string {
  return `${profile.hfModel}|q=${profile.quantized ? 1 : 0}`;
}

function configureEnv(): void {
  env.cacheDir = getCacheDir();
  env.allowLocalModels = true;
  env.allowRemoteModels = process.env.OWNMEMORY_OFFLINE !== "1";
}

async function getExtractor(): Promise<{
  extractor: FeatureExtractor;
  profile: EmbedderProfile;
}> {
  const profile = activeProfile();
  const key = profileKey(profile);
  if (!extractorPromise || loadedProfileKey !== key) {
    configureEnv();
    loadedProfileKey = key;
    extractorPromise = (async () => {
      const pipe = (await pipeline("feature-extraction", profile.hfModel, {
        quantized: profile.quantized,
      })) as unknown as FeatureExtractor;
      ready = true;
      lastError = null;
      return pipe;
    })().catch((err: unknown) => {
      extractorPromise = null;
      loadedProfileKey = null;
      ready = false;
      lastError = err instanceof Error ? err.message : String(err);
      throw err;
    });
  }
  return { extractor: await extractorPromise, profile };
}

/** Drop cached pipeline so the next call loads the active settings/env model. */
export function resetEmbeddings(): void {
  extractorPromise = null;
  loadedProfileKey = null;
  ready = false;
  lastError = null;
}

export function isEmbeddingReady(): boolean {
  return ready;
}

export function getEmbeddingError(): string | null {
  return lastError;
}

export function getEmbeddingModelName(): string {
  return activeProfile().hfModel;
}

export function getActiveEmbedderProfile(): EmbedderProfile {
  return activeProfile();
}

/** Warm the model in the background so the first search is faster. */
export function warmEmbeddings(): void {
  void getExtractor().catch(() => {
    // surfaced via getEmbeddingError / health endpoint
  });
}

/**
 * Embed with the active profile's pooling / query-prefix rules.
 * Existing save/recall call sites are unchanged; only the active model differs.
 */
export async function embedText(
  text: string,
  role: EmbedRole = "document",
): Promise<Float32Array> {
  const { extractor, profile } = await getExtractor();
  const input =
    role === "query" && profile.queryPrefix
      ? `${profile.queryPrefix}${text}`
      : text;
  const output = await extractor(input, {
    pooling: profile.pooling,
    normalize: true,
  });
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
