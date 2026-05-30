import { llmRouter } from '../llm/router.js';
import { ragPipeline } from '../ragPipeline.js';
import { graphBuilder } from '../graphBuilder.js';
import type { RetrievedChunk, Scratchpad } from './types.js';
import { timed } from './types.js';

const BASE_TOP_K = 10;
const MAX_TOP_K = 25;
const LOW_SCORE_THRESHOLD = 0.45;

export class RetrieverAgent {
  // Generates 2-3 reformulations of the query for broader recall.
  async expandQuery(query: string): Promise<string[]> {
    try {
      const res = await llmRouter.complete('low', {
        messages: [
          {
            role: 'system',
            content:
              'Generate exactly 3 alternative phrasings of the user query that preserve intent but vary vocabulary. Return strict JSON: {"queries": ["...", "...", "..."]}.',
          },
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        jsonMode: true,
      });
      const parsed = safeJson(res.text);
      const queries: string[] = Array.isArray(parsed?.queries) ? parsed.queries.filter((q: any) => typeof q === 'string' && q.trim().length > 0) : [];
      return [query, ...queries.slice(0, 3)];
    } catch {
      return [query];
    }
  }

  // Runs the existing hybrid pipeline across all expansions and merges.
  // Bumps top-K when scores look weak.
  async retrieve(scratchpad: Scratchpad, queries: string[]): Promise<RetrievedChunk[]> {
    return timed(scratchpad, 'retriever', 'search', async () => {
      const sessionId = scratchpad.sessionId;
      let topK = BASE_TOP_K;
      let merged = await this.searchAll(queries, topK, sessionId);
      const topScore = merged[0]?.finalScore ?? 0;
      if (topScore < LOW_SCORE_THRESHOLD && topK < MAX_TOP_K) {
        topK = MAX_TOP_K;
        merged = await this.searchAll(queries, topK, sessionId);
      }
      // Cross-document bridging: boost chunks that the entity graph flags as
      // bridging between query entities. Earlier inversion (`if (ids.has(id)) continue`)
      // meant we only inspected IDs NOT in merged, where the `find` could never match.
      const bridging = graphBuilder.getBridgingChunks(scratchpad.originalQuery, sessionId);
      if (bridging.length > 0) {
        const bridgeSet = new Set(bridging);
        for (const chunk of merged) {
          if (bridgeSet.has(chunk.id)) chunk.relationalScore = 1.0;
        }
      }
      return merged;
    }, `${queries.length} query variants, returned chunks`, { topK_initial: BASE_TOP_K });
  }

  private async searchAll(queries: string[], topK: number, sessionId?: string): Promise<RetrievedChunk[]> {
    const seen = new Map<string, RetrievedChunk>();
    const results = await Promise.all(queries.map(q => ragPipeline.process(q, topK, sessionId)));
    for (const chunks of results) {
      for (const c of chunks) {
        const existing = seen.get(c.id);
        if (!existing || c.finalScore > existing.finalScore) {
          seen.set(c.id, {
            id: c.id,
            text: c.text,
            source: c.source,
            embedding: c.embedding,
            score: c.score,
            graphScore: c.graphScore,
            relationalScore: c.relationalScore,
            contradictionPenalty: c.contradictionPenalty,
            finalScore: c.finalScore,
          });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.finalScore - a.finalScore);
  }
}

function safeJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract the first {...} block.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export const retrieverAgent = new RetrieverAgent();
