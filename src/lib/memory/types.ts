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
  mode: "local";
  dataDir: string;
  dbPath: string;
  embeddingModel: string;
  embeddingReady: boolean;
  spaces: Space[];
  totalMemories: number;
};
