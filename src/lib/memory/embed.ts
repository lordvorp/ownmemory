import { env, pipeline } from "@xenova/transformers";
import { EMBEDDING_MODEL, getCacheDir } from "./paths";

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

export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
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
