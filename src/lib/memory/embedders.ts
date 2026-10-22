/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 */

/** Catalog of on-device embedding models (transformers.js / ONNX). */

export type EmbedderId = "minilm" | "arctic-s" | "arctic-l";

export type EmbedderProfile = {
  id: EmbedderId;
  /** Hugging Face model id */
  hfModel: string;
  label: string;
  description: string;
  dims: number;
  /** Approximate download size for the ONNX weights we load */
  approxMB: number;
  pooling: "mean" | "cls";
  /** Prefix applied only to query-role embeddings; null = none */
  queryPrefix: string | null;
  /** transformers.js pipeline option */
  quantized: boolean;
  role: "default" | "fallback" | "gpu";
};

export const ARCTIC_QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: ";

export const EMBEDDER_CATALOG: Record<EmbedderId, EmbedderProfile> = {
  minilm: {
    id: "minilm",
    hfModel: "Xenova/all-MiniLM-L6-v2",
    label: "MiniLM (fallback)",
    description:
      "Smallest footprint (~23MB quantized). Mean pooling. Max compatibility.",
    dims: 384,
    approxMB: 23,
    pooling: "mean",
    queryPrefix: null,
    quantized: true,
    role: "fallback",
  },
  "arctic-s": {
    id: "arctic-s",
    hfModel: "Snowflake/snowflake-arctic-embed-s",
    label: "Arctic-S (default)",
    description:
      "Compact + strong retrieval (~67MB quantized). CLS + arctic query prefix.",
    dims: 384,
    approxMB: 67,
    pooling: "cls",
    queryPrefix: ARCTIC_QUERY_PREFIX,
    quantized: true,
    role: "default",
  },
  "arctic-l": {
    id: "arctic-l",
    hfModel: "Snowflake/snowflake-arctic-embed-l",
    label: "Arctic-L (CUDA)",
    description:
      "Larger arctic (~1.3GB ONNX, 1024-d). Requires CUDA EP + enough free VRAM; otherwise falls back to Arctic-S.",
    dims: 1024,
    approxMB: 1300,
    pooling: "cls",
    queryPrefix: ARCTIC_QUERY_PREFIX,
    quantized: false,
    role: "gpu",
  },
};

export const DEFAULT_EMBEDDER_ID: EmbedderId = "arctic-s";
export const FALLBACK_EMBEDDER_ID: EmbedderId = "minilm";

export function listEmbedders(): EmbedderProfile[] {
  return Object.values(EMBEDDER_CATALOG);
}

export function getEmbedderProfile(id: string | undefined | null): EmbedderProfile {
  if (id && id in EMBEDDER_CATALOG) {
    return EMBEDDER_CATALOG[id as EmbedderId];
  }
  return EMBEDDER_CATALOG[DEFAULT_EMBEDDER_ID];
}

/** Resolve profile from a raw HF model string (env override). */
export function profileFromHfModel(hfModel: string): EmbedderProfile | null {
  const hit = listEmbedders().find((p) => p.hfModel === hfModel);
  return hit ?? null;
}
