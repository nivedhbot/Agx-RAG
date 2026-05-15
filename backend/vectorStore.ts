import { pipeline } from '@huggingface/transformers';
import fs from 'fs-extra';
import path from 'path';

interface Chunk {
  text: string;
  source: string;
  page: number;
  embedding?: number[];
  id?: string;
}

/**
 * TASK 3: Vector Store
 * Uses @huggingface/transformers (BAAI/bge-small-en-v1.5) for embeddings.
 * Implements a simple Flat Inner Product (FlatIP) search.
 */
export class VectorStore {
  private chunks: Chunk[] = [];
  private extractor: any = null;
  private readonly storePath = path.join(process.cwd(), 'vectorstore', 'index.json');

  constructor() {
    this.ensureDirectory();
  }

  private async ensureDirectory() {
    await fs.ensureDir(path.join(process.cwd(), 'vectorstore'));
  }

  private async getExtractor() {
    if (!this.extractor) {
      console.log('Initializing Embedding Model (bge-small-en-v1.5)...');
      this.extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
    }
    return this.extractor;
  }

  async addChunks(newChunks: Chunk[]) {
    const extractor = await this.getExtractor();
    
    console.log(`Generating embeddings for ${newChunks.length} chunks...`);
    
    // Batch process embeddings for significant speedup
    const texts = newChunks.map(c => c.text);
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    
    // output.data is a Float32Array containing all embeddings
    // output.dims is [batchSize, embeddingSize]
    const batchSize = output.dims[0];
    const embeddingSize = output.dims[1];
    
    for (let i = 0; i < batchSize; i++) {
      const startIndex = i * embeddingSize;
      const embedding = Array.from(output.data.slice(startIndex, startIndex + embeddingSize)) as number[];
      
      newChunks[i].embedding = embedding;
      newChunks[i].id = Math.random().toString(36).substring(7);
      this.chunks.push(newChunks[i]);
    }
    
    await this.save();
    return newChunks;
  }

  async search(query: string, topK: number = 20) {
    const extractor = await this.getExtractor();
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data) as number[];

    const results = this.chunks.map(chunk => {
      const score = this.dotProduct(queryEmbedding, chunk.embedding!);
      return { ...chunk, score };
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  async save() {
    await fs.writeJson(this.storePath, this.chunks);
  }

  async load() {
    if (await fs.pathExists(this.storePath)) {
      this.chunks = await fs.readJson(this.storePath);
      console.log(`Loaded ${this.chunks.length} chunks from vector store.`);
    }
  }

  async clear() {
    this.chunks = [];
    if (await fs.pathExists(this.storePath)) {
      await fs.remove(this.storePath);
    }
  }

  getAllChunks() {
    return this.chunks;
  }
}

export const vectorStore = new VectorStore();
