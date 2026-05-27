import type { ClaimGraph, Scratchpad } from './types.js';
import { timed } from './types.js';

// Operates on the claim graph produced by the verifier.
// Computes per-claim reliability and returns the ordered evidence chain
// (highest-reliability claims that support the query).
export class GraphReasonerAgent {
  async traverse(scratchpad: Scratchpad): Promise<string[]> {
    if (!scratchpad.claimGraph) return [];
    return timed(scratchpad, 'graphReasoner', 'traverse', async () => {
      const graph = scratchpad.claimGraph!;
      const reliability = this.computeReliability(graph);

      const scored = graph.nodes
        .filter(n => n.id !== graph.queryNodeId)
        .map(n => ({ id: n.id, score: reliability.get(n.id) ?? 0 }))
        .filter(n => n.score > 0)
        .sort((a, b) => b.score - a.score);

      return scored.map(s => s.id);
    }, 'reliability scoring + path extraction');
  }

  private computeReliability(graph: ClaimGraph): Map<string, number> {
    const supportDegree = new Map<string, number>();
    const contradictDegree = new Map<string, number>();
    const sources = new Map<string, Set<string>>();

    for (const node of graph.nodes) {
      supportDegree.set(node.id, 0);
      contradictDegree.set(node.id, 0);
      sources.set(node.id, new Set([node.source]));
    }

    // Tally incoming support / contradict edges.
    for (const edge of graph.edges) {
      if (edge.target === graph.queryNodeId) continue;
      if (edge.relation === 'supports') {
        supportDegree.set(edge.target, (supportDegree.get(edge.target) ?? 0) + 1);
        const srcNode = graph.nodes.find(n => n.id === edge.source);
        if (srcNode) sources.get(edge.target)?.add(srcNode.source);
      } else if (edge.relation === 'contradicts') {
        contradictDegree.set(edge.target, (contradictDegree.get(edge.target) ?? 0) + 1);
      }
    }

    // Boost claims that themselves support the query.
    const supportsQuery = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.target === graph.queryNodeId && edge.relation === 'supports') {
        supportsQuery.add(edge.source);
      }
    }

    const out = new Map<string, number>();
    for (const node of graph.nodes) {
      if (node.id === graph.queryNodeId) continue;
      const support = supportDegree.get(node.id) ?? 0;
      const contradict = contradictDegree.get(node.id) ?? 0;
      const diversity = sources.get(node.id)?.size ?? 1;
      const base = (1 + support) / (1 + contradict);
      const queryBonus = supportsQuery.has(node.id) ? 1.5 : 1.0;
      out.set(node.id, base * diversity * queryBonus * node.confidence);
    }
    return out;
  }
}

export const graphReasonerAgent = new GraphReasonerAgent();
