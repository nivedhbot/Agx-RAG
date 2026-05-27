import { llmRouter } from '../llm/router.js';
import type { AgentRunResult, ClaimGraph, Scratchpad } from './types.js';
import { timed } from './types.js';

// Final-answer generation. Uses high-priority LLM (OpenAI by default).
// Builds a contrastive prompt that explicitly separates SUPPORTING and
// CONTRADICTING evidence so the model is forced to address conflicts.
export class SynthesizerAgent {
  async synthesize(scratchpad: Scratchpad): Promise<Omit<AgentRunResult, 'agentTrace' | 'latencyMs' | 'claimGraph' | 'contradictions' | 'evidenceChain' | 'retrievedChunks'>> {
    return timed(scratchpad, 'synthesizer', 'generate', async () => {
      const graph = scratchpad.claimGraph;
      const ordered = scratchpad.evidenceChain;
      const claimById = new Map((graph?.nodes ?? []).map(n => [n.id, n]));

      const supporting: string[] = [];
      const contradicting: string[] = [];

      const contradictTargets = new Set<string>();
      for (const c of scratchpad.contradictions) {
        contradictTargets.add(c.claimA);
        contradictTargets.add(c.claimB);
      }

      for (const id of ordered) {
        const claim = claimById.get(id);
        if (!claim) continue;
        const line = `[${id}] (${claim.source}) ${claim.text}`;
        if (contradictTargets.has(id)) contradicting.push(line);
        else supporting.push(line);
      }

      const systemPrompt = `You are AGX-RAG, an evidence-grounded answer synthesiser.
You will receive SUPPORTING evidence and (optionally) CONTRADICTING evidence as numbered claim citations [claim-id].
Rules:
- Only use facts present in the evidence. If the evidence is insufficient, say so.
- Cite the claim id in square brackets after every factual sentence, e.g. [chunk-abc#1].
- If CONTRADICTING evidence is present, you MUST acknowledge the conflict explicitly and explain which side the SUPPORTING evidence favours.
- End the response with a single line "Reasoning Path:" followed by a one-paragraph trace of how you arrived at the answer.`;

      const userPrompt = [
        `QUERY: ${scratchpad.originalQuery}`,
        '',
        'SUPPORTING EVIDENCE:',
        supporting.length > 0 ? supporting.join('\n') : '(none)',
        '',
        'CONTRADICTING EVIDENCE:',
        contradicting.length > 0 ? contradicting.join('\n') : '(none)',
      ].join('\n');

      const res = await llmRouter.complete('high', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      });

      const fullResponse = res.text;
      const match = fullResponse.match(/Reasoning Path:?\s*([\s\S]+)$/i);
      const reasoningPath = match
        ? match[1].trim()
        : 'Synthesised directly from the supporting evidence chain.';
      const answer = fullResponse.replace(/Reasoning Path:?[\s\S]+$/i, '').trim();

      const confidence = this.computeConfidence(answer, graph, ordered, scratchpad.contradictions.length);

      const sources = [...new Set(
        ordered
          .map(id => claimById.get(id)?.source)
          .filter((s): s is string => Boolean(s) && s !== 'query'),
      )];

      return { answer, confidence, reasoningPath, sources };
    }, 'contrastive synthesis');
  }

  // Blended confidence: citation coverage + contradiction-free ratio + source diversity.
  // - Parses single OR multi-citation blocks: [a#1] AND [a#1; b#2; c#3].
  // - Coverage saturates at 6 cited claims (don't penalise long evidence chains).
  // - Contradiction penalty caps at -0.3 to avoid zeroing real answers.
  private computeConfidence(
    answer: string,
    graph: ClaimGraph | undefined,
    ordered: string[],
    contradictionCount: number,
  ): number {
    if (ordered.length === 0) return 0;
    const cited = this.extractCitations(answer);
    const overlap = ordered.filter(id => cited.has(id)).length;
    const coverage = Math.min(1, overlap / Math.min(ordered.length, 6));

    const claimById = new Map((graph?.nodes ?? []).map(n => [n.id, n]));
    const orderedSources = new Set(
      ordered.map(id => claimById.get(id)?.source).filter((s): s is string => Boolean(s) && s !== 'query'),
    );
    const diversity = orderedSources.size === 0 ? 0 : Math.min(1, orderedSources.size / 3);

    const contradictionRate = Math.min(1, contradictionCount / Math.max(1, ordered.length));
    const contradictionPenalty = Math.min(0.3, contradictionRate * 0.6);

    const blended = 0.65 * coverage + 0.25 * diversity + 0.10 - contradictionPenalty;
    return Math.min(1, Math.max(0, blended));
  }

  // Pull every "id#n" reference out of the answer, including multi-citation
  // blocks like [a#1; b#2, c#3].
  private extractCitations(answer: string): Set<string> {
    const cited = new Set<string>();
    const blockRe = /\[([^\]]+)\]/g;
    let block: RegExpExecArray | null;
    while ((block = blockRe.exec(answer)) !== null) {
      const parts = block[1].split(/[;,]/);
      for (const part of parts) {
        const m = part.trim().match(/^([\w-]+#\d+)$/);
        if (m) cited.add(m[1]);
      }
    }
    return cited;
  }
}

export const synthesizerAgent = new SynthesizerAgent();
