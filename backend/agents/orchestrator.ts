import { llmRouter } from '../llm/router.js';
import { retrieverAgent } from './retriever.js';
import { verifierAgent } from './verifier.js';
import { graphReasonerAgent } from './graphReasoner.js';
import { synthesizerAgent } from './synthesizer.js';
import type { AgentRunResult, Scratchpad } from './types.js';
import { newScratchpad, timed } from './types.js';

// Top-level coordinator. Plans → loops (retrieve, verify, traverse) →
// synthesises → self-reflects. The loop bails as soon as confidence /
// contradiction signals look stable.
export class OrchestratorAgent {
  async run(query: string, sessionId?: string): Promise<AgentRunResult> {
    const start = Date.now();
    const scratchpad = newScratchpad(query, sessionId);

    // 1. Decompose into sub-queries (single LLM call, cheap).
    scratchpad.subQueries = await this.decompose(scratchpad);
    // 2. Pick the working query: original or first sub-query.
    const workingQuery = scratchpad.subQueries[0] ?? query;

    // 3. Expand for recall.
    scratchpad.expandedQueries = await retrieverAgent.expandQuery(workingQuery);

    // 4. Reasoning loop.
    let result: AgentRunResult | null = null;
    while (scratchpad.iteration < scratchpad.maxIterations) {
      scratchpad.iteration++;

      scratchpad.retrievedChunks = await retrieverAgent.retrieve(
        scratchpad,
        scratchpad.expandedQueries,
      );

      if (scratchpad.retrievedChunks.length === 0) {
        scratchpad.trace.push({
          agent: 'orchestrator',
          action: 'abort',
          detail: 'no chunks retrieved',
          durationMs: 0,
        });
        break;
      }

      const { graph, contradictions } = await verifierAgent.verify(scratchpad);
      scratchpad.claimGraph = graph;
      scratchpad.contradictions = contradictions;

      scratchpad.evidenceChain = await graphReasonerAgent.traverse(scratchpad);

      const synth = await synthesizerAgent.synthesize(scratchpad);

      const confident = synth.confidence >= scratchpad.confidenceThreshold;
      const goodEnough = confident && contradictions.length === 0;

      result = {
        ...synth,
        claimGraph: scratchpad.claimGraph,
        contradictions: scratchpad.contradictions,
        evidenceChain: scratchpad.evidenceChain,
        agentTrace: scratchpad.trace,
        retrievedChunks: scratchpad.retrievedChunks,
        latencyMs: Date.now() - start,
      };

      if (goodEnough) break;

      // Latency optimisation: once confidence clears the threshold, skip the
      // second retrieve→verify→synthesize pass entirely. The extra pass rarely
      // changes a confident answer and roughly doubles query latency. Any
      // contradictions found this pass are still returned to the UI.
      if (confident) {
        console.log(
          `[orchestrator] confidence ${synth.confidence.toFixed(2)} >= threshold ` +
            `${scratchpad.confidenceThreshold} after pass ${scratchpad.iteration} — skipping second retriever pass`,
        );
        break;
      }

      // Refine the query for the next iteration if any room left.
      if (scratchpad.iteration < scratchpad.maxIterations) {
        const refined = await this.refine(scratchpad, synth.answer);
        if (refined) scratchpad.expandedQueries = [refined, ...scratchpad.expandedQueries];
        else break;
      }
    }

    if (!result) {
      return {
        answer: 'No evidence was retrieved for this query.',
        confidence: 0,
        reasoningPath: 'Retriever returned zero chunks.',
        sources: [],
        claimGraph: { nodes: [], edges: [], queryNodeId: '__query__' },
        contradictions: [],
        evidenceChain: [],
        agentTrace: scratchpad.trace,
        retrievedChunks: [],
        latencyMs: Date.now() - start,
      };
    }
    return result;
  }

  private async decompose(scratchpad: Scratchpad): Promise<string[]> {
    return timed(scratchpad, 'orchestrator', 'decompose', async () => {
      try {
        const res = await llmRouter.complete('low', {
          messages: [
            {
              role: 'system',
              content:
                'Decompose the user query into 1-3 sub-questions that together fully answer it. If the query is already atomic, return it as the single item. Return strict JSON: {"sub_queries": ["..."]}.',
            },
            { role: 'user', content: scratchpad.originalQuery },
          ],
          temperature: 0.0,
          jsonMode: true,
        });
        const parsed = safeJson(res.text);
        const subs: string[] = Array.isArray(parsed?.sub_queries)
          ? parsed.sub_queries.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
          : [];
        return subs.length > 0 ? subs.slice(0, 3) : [scratchpad.originalQuery];
      } catch {
        return [scratchpad.originalQuery];
      }
    }, 'sub-query decomposition');
  }

  private async refine(scratchpad: Scratchpad, lastAnswer: string): Promise<string | null> {
    return timed(scratchpad, 'orchestrator', 'refine', async () => {
      try {
        const res = await llmRouter.complete('low', {
          messages: [
            {
              role: 'system',
              content:
                'Given an answer that may be incomplete or low-confidence, produce ONE follow-up search query that would surface the missing evidence. Return strict JSON: {"query": "..."}.',
            },
            {
              role: 'user',
              content: `ORIGINAL QUERY: ${scratchpad.originalQuery}\n\nCURRENT ANSWER:\n${lastAnswer}`,
            },
          ],
          temperature: 0.2,
          jsonMode: true,
        });
        const parsed = safeJson(res.text);
        const q = typeof parsed?.query === 'string' ? parsed.query.trim() : '';
        return q.length > 0 ? q : null;
      } catch {
        return null;
      }
    }, 'self-reflective query refinement');
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

export const orchestratorAgent = new OrchestratorAgent();
