
import { vectorStore } from './vectorStore.js';
import { graphBuilder } from './graphBuilder.js';

interface ScoredChunk {
  text: string;
  source: string;
  id: string;
  score: number; // Semantic score (S)
  graphScore: number; // Gc
  relationalScore: number; // Rc (Bridging)
  contradictionPenalty: number; // Cp
  finalScore: number;
  embedding: number[];
}

/**
 * TASK 5: Hybrid Re-Ranking
 * Implements F(d) = α·S + β·Gc + γ·Rc − λ·Cp
 */
export class RagPipeline {
  private readonly ALPHA = 0.60;
  private readonly BETA = 0.20;
  private readonly GAMMA = 0.15;
  private readonly LAMBDA = 0.05;

  async process(query: string, topK: number = 20): Promise<ScoredChunk[]> {
    // 1. Initial Retrieval
    const initialChunks = await vectorStore.search(query, topK);
    
    // 2. Fetch Graph/Relational Components
    const graphScores = graphBuilder.getGraphScores(initialChunks as any, query);
    const bridgingIds = graphBuilder.getBridgingChunks(query);

    // Map to ScoredChunk structure
    const processedChunks: ScoredChunk[] = initialChunks.map((chunk, i) => ({
      text: chunk.text,
      source: chunk.source,
      id: chunk.id!,
      embedding: chunk.embedding!,
      score: chunk.score, // S
      graphScore: graphScores[i], // Gc
      relationalScore: bridgingIds.includes(chunk.id!) ? 1.0 : 0.0, // Rc
      contradictionPenalty: 0,
      finalScore: 0
    }));

    // 3. Contradiction Detection
    this.detectContradictions(processedChunks);

    // 4. Calculate Final Hybrid Score
    processedChunks.forEach(chunk => {
      chunk.finalScore = (this.ALPHA * chunk.score) + 
                         (this.BETA * chunk.graphScore) + 
                         (this.GAMMA * chunk.relationalScore) - 
                         (this.LAMBDA * chunk.contradictionPenalty);
    });

    return processedChunks.sort((a, b) => b.finalScore - a.finalScore);
  }

  private detectContradictions(chunks: ScoredChunk[]) {
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const c1 = chunks[i];
        const c2 = chunks[j];

        // Compute cosine similarity between chunks
        const sim = this.cosineSimilarity(c1.embedding, c2.embedding);

        // Logic: if sim < 0.35 and both score > 0.5 on query, assign Cp = 0.3 to lower-ranked
        if (sim < 0.35 && c1.score > 0.5 && c2.score > 0.5) {
          // The lower ranked chunk (the one with lower initial semantic score or index) gets the penalty
          const target = c1.score < c2.score ? c1 : c2;
          target.contradictionPenalty = 0.3;
        }
      }
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const ragPipeline = new RagPipeline();
