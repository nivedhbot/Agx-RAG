import { llmRouter } from '../llm/router.js';
import { classifyRelation } from './nli.js';
import type {
  Claim,
  ClaimEdge,
  ClaimGraph,
  Contradiction,
  RetrievedChunk,
  Scratchpad,
} from './types.js';
import { timed } from './types.js';

const MAX_CHUNKS_FOR_CLAIMS = 5;
const MAX_CLAIMS_PER_CHUNK = 4;
const MAX_TOTAL_CLAIMS = 16;
const QUERY_NODE_ID = '__query__';
// NLI score thresholds — raised after live runs produced 1.5× contradictions per claim.
// The zero-shot model assigns top-label probabilities; below these the edge is too weak to trust.
const CONTRADICTS_THRESHOLD = 0.65;
const SUPPORTS_THRESHOLD = 0.55;

export class VerifierAgent {
  async verify(scratchpad: Scratchpad): Promise<{ graph: ClaimGraph; contradictions: Contradiction[] }> {
    return timed(scratchpad, 'verifier', 'verify', async () => {
      const chunks = scratchpad.retrievedChunks.slice(0, MAX_CHUNKS_FOR_CLAIMS);

      // Single batched LLM call across all chunks (was N sequential calls).
      const claimLists = await this.extractClaimsBatch(chunks);
      const allClaims: Claim[] = claimLists.flat().slice(0, MAX_TOTAL_CLAIMS);

      // Query node so the graph reasoner has an anchor.
      const queryNode: Claim = {
        id: QUERY_NODE_ID,
        text: scratchpad.originalQuery,
        sourceChunkId: '',
        source: 'query',
        confidence: 1.0,
      };

      const edges: ClaimEdge[] = [];
      const contradictions: Contradiction[] = [];

      // Claim ↔ claim relations.
      // Run pairs in parallel; the model handles concurrent zero-shot calls fine
      // and this was the dominant latency cost in the live run.
      const pairs: Array<{ i: number; j: number }> = [];
      for (let i = 0; i < allClaims.length; i++) {
        for (let j = 0; j < allClaims.length; j++) {
          if (i === j) continue;
          if (allClaims[i].sourceChunkId === allClaims[j].sourceChunkId) continue;
          pairs.push({ i, j });
        }
      }
      const pairResults = await Promise.all(
        pairs.map(({ i, j }) => classifyRelation(allClaims[i].text, allClaims[j].text)),
      );
      pairResults.forEach((rel, idx) => {
        const { i, j } = pairs[idx];
        if (rel.relation === 'neutral') return;
        // Drop low-confidence contradictions to cut down on false positives.
        if (rel.relation === 'contradicts' && rel.score < CONTRADICTS_THRESHOLD) return;
        if (rel.relation === 'supports' && rel.score < SUPPORTS_THRESHOLD) return;
        edges.push({
          source: allClaims[i].id,
          target: allClaims[j].id,
          relation: rel.relation,
          nliScore: rel.score,
        });
        // Only record a contradiction once per unordered pair.
        if (rel.relation === 'contradicts' && i < j) {
          contradictions.push({
            claimA: allClaims[i].id,
            claimB: allClaims[j].id,
            explanation: `NLI ${rel.score.toFixed(2)}: "${truncate(allClaims[i].text)}" ⟂ "${truncate(allClaims[j].text)}"`,
          });
        }
      });

      // Query → claim relevance: classify each claim as relevant or not.
      const queryResults = await Promise.all(
        allClaims.map(c => classifyRelation(c.text, scratchpad.originalQuery)),
      );
      queryResults.forEach((rel, idx) => {
        const claim = allClaims[idx];
        if (rel.relation === 'supports' && rel.score >= SUPPORTS_THRESHOLD) {
          edges.push({ source: claim.id, target: QUERY_NODE_ID, relation: 'supports', nliScore: rel.score });
        } else if (rel.relation === 'contradicts' && rel.score >= CONTRADICTS_THRESHOLD) {
          edges.push({ source: claim.id, target: QUERY_NODE_ID, relation: 'contradicts', nliScore: rel.score });
        } else {
          edges.push({ source: claim.id, target: QUERY_NODE_ID, relation: 'elaborates', nliScore: rel.score });
        }
      });

      const graph: ClaimGraph = {
        nodes: [queryNode, ...allClaims],
        edges,
        queryNodeId: QUERY_NODE_ID,
      };
      return { graph, contradictions };
    }, 'claim extraction + NLI');
  }

  // Batched claim extraction: single LLM call returns claims for every chunk.
  // Falls back to a per-chunk loop if the batched response is malformed.
  private async extractClaimsBatch(chunks: RetrievedChunk[]): Promise<Claim[][]> {
    if (chunks.length === 0) return [];
    try {
      const passages = chunks.map((c, i) => `### passage ${i}\n${c.text}`).join('\n\n');
      const res = await llmRouter.complete('low', {
        messages: [
          {
            role: 'system',
            content:
              'For EACH numbered passage, decompose the passage into atomic factual claims. ' +
              'Each claim must be a single, self-contained statement. ' +
              `Output at most ${MAX_CLAIMS_PER_CHUNK} claims per passage. ` +
              'Return strict JSON of the shape: {"passages": [{"index": 0, "claims": ["...", "..."]}, ...]}. ' +
              'The "index" field MUST match the passage number.',
          },
          { role: 'user', content: passages },
        ],
        temperature: 0.0,
        jsonMode: true,
      });
      const parsed = safeJson(res.text);
      const rows: any[] = Array.isArray(parsed?.passages) ? parsed.passages : [];
      const byIndex = new Map<number, string[]>();
      for (const row of rows) {
        if (typeof row?.index !== 'number') continue;
        const claims = Array.isArray(row.claims)
          ? row.claims.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
          : [];
        byIndex.set(row.index, claims);
      }
      // If the model returned nothing usable for ANY chunk, fall back to per-chunk.
      if (byIndex.size === 0) throw new Error('batched extraction returned no usable rows');
      return chunks.map((chunk, i) => {
        const raw = byIndex.get(i) ?? [];
        return raw.slice(0, MAX_CLAIMS_PER_CHUNK).map((text, k) => ({
          id: `${chunk.id}#${k}`,
          text: text.trim(),
          sourceChunkId: chunk.id,
          source: chunk.source,
          confidence: chunk.finalScore,
        }));
      });
    } catch (err) {
      console.warn('[verifier] batched extraction failed, falling back per-chunk:', (err as Error)?.message ?? err);
      return Promise.all(chunks.map(c => this.extractClaims(c)));
    }
  }

  private async extractClaims(chunk: RetrievedChunk): Promise<Claim[]> {
    try {
      const res = await llmRouter.complete('low', {
        messages: [
          {
            role: 'system',
            content:
              'Decompose the passage into atomic factual claims. Each claim must be a single, self-contained statement. Return strict JSON: {"claims": ["...", "..."]}. Output at most ' +
              MAX_CLAIMS_PER_CHUNK +
              ' claims.',
          },
          { role: 'user', content: chunk.text },
        ],
        temperature: 0.0,
        jsonMode: true,
      });
      const parsed = safeJson(res.text);
      const raw: string[] = Array.isArray(parsed?.claims)
        ? parsed.claims.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
        : [];
      return raw.slice(0, MAX_CLAIMS_PER_CHUNK).map((text, i) => ({
        id: `${chunk.id}#${i}`,
        text: text.trim(),
        sourceChunkId: chunk.id,
        source: chunk.source,
        confidence: chunk.finalScore,
      }));
    } catch (err) {
      console.warn('[verifier] claim extraction failed for chunk', chunk.id, (err as Error)?.message ?? err);
      // Fallback: treat the chunk as one claim.
      return [
        {
          id: `${chunk.id}#0`,
          text: chunk.text.slice(0, 400),
          sourceChunkId: chunk.id,
          source: chunk.source,
          confidence: chunk.finalScore,
        },
      ];
    }
  }
}

function safeJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function truncate(s: string, n = 60): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

export const verifierAgent = new VerifierAgent();
