// Shared types for the 5-agent CGoT-MARS pipeline.

export type ClaimRelation = 'supports' | 'contradicts' | 'elaborates';

export interface Claim {
  id: string;
  text: string;
  sourceChunkId: string;
  source: string;
  page?: number;
  confidence: number;
}

export interface ClaimEdge {
  source: string;
  target: string;
  relation: ClaimRelation;
  nliScore: number;
}

export interface ClaimGraph {
  nodes: Claim[];
  edges: ClaimEdge[];
  queryNodeId: string;
}

export interface Contradiction {
  claimA: string;
  claimB: string;
  explanation: string;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  source: string;
  page?: number;
  embedding?: number[];
  score: number;
  graphScore: number;
  relationalScore: number;
  contradictionPenalty: number;
  finalScore: number;
}

export interface AgentTraceEntry {
  agent: string;
  action: string;
  detail?: string;
  durationMs: number;
  meta?: Record<string, unknown>;
}

export interface Scratchpad {
  originalQuery: string;
  // Optional session scope. When set, retrieval + graph operations are limited
  // to this session's documents; when undefined they fall back to the global
  // corpus (preserving the legacy single-corpus behaviour).
  sessionId?: string;
  subQueries: string[];
  expandedQueries: string[];
  retrievedChunks: RetrievedChunk[];
  claimGraph?: ClaimGraph;
  evidenceChain: string[];
  contradictions: Contradiction[];
  iteration: number;
  maxIterations: number;
  confidenceThreshold: number;
  trace: AgentTraceEntry[];
}

export interface AgentRunResult {
  answer: string;
  confidence: number;
  reasoningPath: string;
  sources: string[];
  claimGraph: ClaimGraph;
  contradictions: Contradiction[];
  evidenceChain: string[];
  agentTrace: AgentTraceEntry[];
  retrievedChunks: RetrievedChunk[];
  latencyMs: number;
}

export function newScratchpad(query: string, sessionId?: string): Scratchpad {
  return {
    originalQuery: query,
    sessionId,
    subQueries: [],
    expandedQueries: [],
    retrievedChunks: [],
    evidenceChain: [],
    contradictions: [],
    iteration: 0,
    maxIterations: Number(process.env.AGENT_MAX_ITERATIONS ?? 2),
    confidenceThreshold: Number(process.env.AGENT_CONFIDENCE_THRESHOLD ?? 0.55),
    trace: [],
  };
}

export async function timed<T>(
  scratchpad: Scratchpad,
  agent: string,
  action: string,
  fn: () => Promise<T>,
  detail?: string,
  meta?: Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    const out = await fn();
    const durationMs = Date.now() - start;
    scratchpad.trace.push({ agent, action, detail, durationMs, meta });
    console.log(`[step] ${agent.toUpperCase()} ${action} ${durationMs}ms`);
    return out;
  } catch (err) {
    const durationMs = Date.now() - start;
    scratchpad.trace.push({
      agent,
      action,
      detail: `error: ${(err as Error)?.message ?? String(err)}`,
      durationMs,
      meta,
    });
    console.log(`[step] ${agent.toUpperCase()} ${action} ${durationMs}ms (error)`);
    throw err;
  }
}
