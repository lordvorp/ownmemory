/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
 */

export type Space = {
  id: string;
  name: string;
  createdAt: string;
};

export type Memory = {
  id: string;
  spaceId: string;
  spaceName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  forgotten: boolean;
  /** Optional structured fields (0.3+); absent/null on older rows */
  metaType?: string | null;
  pinned?: boolean;
  branch?: string | null;
  meta?: Record<string, unknown> | null;
};

export type ScoredMemory = Memory & {
  score: number;
  match: "semantic" | "keyword" | "hybrid";
};

export type Profile = {
  spaceName: string;
  stable: string[];
  recent: Memory[];
  summary: string;
  memoryCount: number;
};

export type WhoAmI = {
  product: string;
  version: string;
  mode: "local";
  dataDir: string;
  dbPath: string;
  embeddingModel: string;
  embeddingReady: boolean;
  embedderId?: string;
  embedderLabel?: string;
  reembedRequired?: boolean;
  inferMode?: string;
  /** Catalog id requested (may differ from embedderId when GPU gate falls back). */
  requestedEmbedderId?: string;
  gpuFallbackReason?: string | null;
  embedDevice?: {
    cudaAvailable: boolean;
    reason: string;
    gpuName: string | null;
    vramTotalMiB: number | null;
    vramFreeMiB: number | null;
    vramHeadroomMiB: number;
  } | null;
  spaces: Space[];
  totalMemories: number;
};
