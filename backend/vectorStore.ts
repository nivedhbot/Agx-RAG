import { pipeline } from '@huggingface/transformers';
import { pickBackend, type VectorBackend, type StoredChunk } from './vectorBackends.js';

interface Chunk {
  text: string;
  source: string;
  page: number;
  embedding?: number[];
  id?: string;
}

/**
 * Vector store with pluggable persistence (Postgres + pgvector, or JSON file).
 * Uses @huggingface/transformers (bge-small-en-v1.5, 384-dim) for embeddings.
 * Keeps an in-memory mirror of all chunks so the synchronous callers
 * (server.ts, metrics) don't have to become async.
 */
export class VectorStore {
  private chunks: Chunk[] = [];
  private extractor: any = null;
  private backend: VectorBackend | null = null;

  private async getExtractor() {
    if (!this.extractor) {
      console.log('Initializing Embedding Model (bge-small-en-v1.5)...');
      this.extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    }
    return this.extractor;
  }

  // Load and cache the embedding model ahead of the first query so queries
  // don't pay the cold-start cost. Safe to call multiple times — the instance
  // is reused once initialised.
  async warmup() {
    await this.getExtractor();
  }

  private async getBackend(): Promise<VectorBackend> {
    if (!this.backend) this.backend = await pickBackend();
    return this.backend;
  }

  backendName(): 'postgres' | 'json' | 'unknown' {
    return this.backend?.name ?? 'unknown';
  }

  async addChunks(newChunks: Chunk[]) {
    const extractor = await this.getExtractor();
    const backend = await this.getBackend();

    console.log(`Generating embeddings for ${newChunks.length} chunks...`);

    const texts = newChunks.map(c => c.text);
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const batchSize = output.dims[0];
    const embeddingSize = output.dims[1];

    const stored: StoredChunk[] = [];
    for (let i = 0; i < batchSize; i++) {
      const startIndex = i * embeddingSize;
      const embedding = Array.from(output.data.slice(startIndex, startIndex + embeddingSize)) as number[];
      newChunks[i].embedding = embedding;
      newChunks[i].id = Math.random().toString(36).substring(7);
      this.chunks.push(newChunks[i]);
      stored.push({
        id: newChunks[i].id!,
        text: newChunks[i].text,
        source: newChunks[i].source,
        page: newChunks[i].page,
        embedding,
      });
    }

    await backend.add(stored);
    return newChunks;
  }

  async search(query: string, topK: number = 20) {
    const extractor = await this.getExtractor();
    const backend = await this.getBackend();
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data) as number[];

    // Delegate to backend. Postgres uses pgvector's <#> operator; JSON does
    // an in-memory linear scan.
    const results = await backend.searchTopK(queryEmbedding, topK);
    return results.map(r => ({
      id: r.id,
      text: r.text,
      source: r.source,
      page: r.page,
      embedding: r.embedding,
      score: r.score,
    }));
  }

  async load() {
    const backend = await this.getBackend();
    const all = await backend.loadAll();
    this.chunks = all.map(c => ({
      id: c.id,
      text: c.text,
      source: c.source,
      page: c.page,
      embedding: c.embedding,
    }));
    if (this.chunks.length > 0) {
      console.log(`Loaded ${this.chunks.length} chunks from ${backend.name} backend.`);
    }
  }

  async clear() {
    this.chunks = [];
    const backend = await this.getBackend();
    await backend.clear();
  }

  getAllChunks() {
    return this.chunks;
  }
}

export const vectorStore = new VectorStore();
