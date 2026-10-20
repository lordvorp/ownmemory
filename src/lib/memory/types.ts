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
