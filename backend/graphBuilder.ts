import { MultiDirectedGraph } from 'graphology';
import nlp from 'compromise';
import fs from 'fs-extra';
import path from 'path';
import { pipeline } from '@huggingface/transformers';

interface Chunk {
  text: string;
  source: string;
  page: number;
  id?: string;
}

/**
 * TASK 4: Persistent Knowledge Graph
 * Uses graphology for DiGraph and compromise for NER.
 * Extracts entities and links them to chunks.
 */
export class GraphBuilder {
  private graph: MultiDirectedGraph;
  // Per-session graphs for the multi-session Reasoning Lab. The global `graph`
  // above is used when no sessionId is supplied (legacy / Dashboard corpus).
  private sessionGraphs = new Map<string, MultiDirectedGraph>();
  private readonly graphPath = path.join(process.cwd(), 'vectorstore', 'persistent_graph.json');
  private readonly sessionDir = path.join(process.cwd(), 'vectorstore', 'graphs');
  private nerPipeline: any = null;
  private nerInitPromise: Promise<any> | null = null;

  constructor() {
    this.graph = new MultiDirectedGraph();
    this.ensureDirectory();
  }

  private async ensureDirectory() {
    await fs.ensureDir(path.join(process.cwd(), 'vectorstore'));
    await fs.ensureDir(this.sessionDir);
  }

  private sessionPath(sessionId: string): string {
    // Guard against path traversal — session ids are UUIDs, but be safe.
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(this.sessionDir, `${safe}.json`);
  }

  // Resolve the graph for a scope: the session graph when sessionId is given
  // (creating an empty one if needed), else the global graph.
  private graphFor(sessionId?: string): MultiDirectedGraph {
    if (!sessionId) return this.graph;
    let g = this.sessionGraphs.get(sessionId);
    if (!g) {
      g = new MultiDirectedGraph();
      this.sessionGraphs.set(sessionId, g);
    }
    return g;
  }

  // Lazily load a session graph from disk into memory if not already present.
  // No-op for the global scope (loaded once at startup via load()).
  async ensureLoaded(sessionId?: string): Promise<void> {
    if (!sessionId || this.sessionGraphs.has(sessionId)) return;
    const g = new MultiDirectedGraph();
    const file = this.sessionPath(sessionId);
    if (await fs.pathExists(file)) {
      try {
        g.import(await fs.readJson(file));
      } catch {
        /* corrupt/partial file — start empty */
      }
    }
    this.sessionGraphs.set(sessionId, g);
  }

  // Node/edge counts for a scope — used by the upload toast.
  stats(sessionId?: string): { node_count: number; edge_count: number } {
    const g = this.graphFor(sessionId);
    return { node_count: g.order, edge_count: g.size };
  }

  private useBertNer(): boolean {
    return process.env.USE_BERT_NER === 'true';
  }

  private async getNer() {
    if (this.nerPipeline) return this.nerPipeline;
    if (!this.nerInitPromise) {
      const model = process.env.BERT_NER_MODEL ?? 'Xenova/bert-base-NER';
      this.nerInitPromise = (async () => {
        console.log(`Initializing BERT NER model (${model})...`);
        this.nerPipeline = await pipeline('token-classification', model);
        return this.nerPipeline;
      })();
    }
    return this.nerInitPromise;
  }

  // Returns lowercase, deduped entities. Bert path merges WordPiece tokens by
  // their IOB tags. Compromise path is the original behaviour.
  private async extractEntities(text: string): Promise<string[]> {
    if (this.useBertNer()) {
      try {
        const ner = await this.getNer();
        const tokens: any[] = await ner(text);
        const merged = mergeBertTokens(tokens);
        return uniqueLower(merged);
      } catch (err) {
        console.warn('[ner] BERT failed, falling back to compromise:', (err as Error).message);
      }
    }
    const doc = nlp(text);
    const entities = [
      ...doc.organizations().out('array'),
      ...doc.people().out('array'),
      ...doc.places().out('array'),
      ...doc.topics().out('array'),
    ];
    return uniqueLower(entities);
  }

  /**
   * Update graph with new chunks.
   * Extracts entities and creates edges [Entity] -> [Chunk]
   */
  async updateGraph(chunks: Chunk[], sessionId?: string) {
    await this.ensureLoaded(sessionId);
    const graph = this.graphFor(sessionId);

    for (const chunk of chunks) {
      if (!chunk.id) continue;

      if (!graph.hasNode(chunk.id)) {
        graph.addNode(chunk.id, { type: 'chunk', text: chunk.text, source: chunk.source });
      }

      const entities = (await this.extractEntities(chunk.text)).filter(e => e.length > 2);
      for (const entity of entities) {
        if (!graph.hasNode(entity)) {
          graph.addNode(entity, { type: 'entity' });
        }
        graph.addDirectedEdge(entity, chunk.id);
      }
    }

    await this.save(sessionId);
  }

  /**
   * Calculates a "graph score" for chunks based on their connectivity to query entities.
   */
  getGraphScores(chunks: Chunk[], query: string, sessionId?: string): number[] {
    const graph = this.graphFor(sessionId);
    const queryDoc = nlp(query);
    const queryEntities = [
      ...queryDoc.organizations().out('array'),
      ...queryDoc.people().out('array'),
      ...queryDoc.topics().out('array')
    ].map(e => e.toLowerCase().trim());

    return chunks.map(chunk => {
      let score = 0;
      if (!chunk.id || !graph.hasNode(chunk.id)) return 0;

      // Find entities in this chunk that match query entities
      const chunkEntities = graph.inNeighbors(chunk.id);
      for (const entity of chunkEntities) {
        if (queryEntities.includes(entity)) {
          score += 1.0;
        }
      }
      return score;
    });
  }

  /**
   * Extract entities from a query string using the same NER as updateGraph.
   */
  private extractQueryEntities(query: string): string[] {
    const queryDoc = nlp(query);
    return [
      ...queryDoc.organizations().out('array'),
      ...queryDoc.people().out('array'),
      ...queryDoc.topics().out('array')
    ].map(e => e.toLowerCase().trim()).filter(e => e.length > 2);
  }

  /**
   * Build the evidence-chain subgraph for a query: query entities + the top chunks
   * (passed in) + every entity node connected to those chunks + the entity->chunk
   * edges between them. Returns {nodes, edges} ready for the UI.
   */
  getQuerySubgraph(
    query: string,
    topChunks: { id?: string; text: string; source: string }[],
    sessionId?: string
  ) {
    const graph = this.graphFor(sessionId);
    const queryEntities = new Set(this.extractQueryEntities(query));
    const bridgingChunkIds = new Set(this.getBridgingChunks(query, sessionId));

    const includedEntityIds = new Set<string>();
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const chunk of topChunks) {
      if (!chunk.id || !graph.hasNode(chunk.id)) continue;

      const inboundEntities = graph.inNeighbors(chunk.id);
      const centrality = inboundEntities.length;
      const isBridge = bridgingChunkIds.has(chunk.id);

      nodes.push({
        id: chunk.id,
        label: `${chunk.source} · ${chunk.text.substring(0, 40).replace(/\s+/g, ' ')}…`,
        type: isBridge ? 'bridge_chunk' : 'chunk',
        confidence: 1.0,
        centrality
      });

      for (const entity of inboundEntities) {
        if (!includedEntityIds.has(entity)) {
          includedEntityIds.add(entity);
          const entityCentrality = graph.outDegree(entity);
          nodes.push({
            id: entity,
            label: entity,
            type: queryEntities.has(entity) ? 'query_entity' : 'entity',
            confidence: queryEntities.has(entity) ? 1.0 : 0.7,
            centrality: entityCentrality
          });
        }
        edges.push({
          id: `${entity}->${chunk.id}`,
          source: entity,
          target: chunk.id,
          label: 'mentions',
          weight: 1.0
        });
      }
    }

    return {
      nodes,
      edges,
      query_entity: queryEntities.size > 0 ? Array.from(queryEntities)[0] : null
    };
  }

  /**
   * Export the full persistent graph as plain {nodes, edges} for /api/graph.
   */
  exportFull(sessionId?: string) {
    const graph = this.graphFor(sessionId);
    const nodes: any[] = [];
    const edges: any[] = [];

    graph.forEachNode((id, attrs) => {
      nodes.push({
        id,
        label: attrs.type === 'chunk'
          ? `${attrs.source} · ${(attrs.text || '').substring(0, 40)}…`
          : id,
        type: attrs.type,
        // Source document of a chunk node — lets the UI attribute each entity
        // to the document(s) it was mentioned in (per-document provenance).
        source: attrs.type === 'chunk' ? (attrs.source ?? null) : undefined,
        centrality: attrs.type === 'entity' ? graph.outDegree(id) : graph.inDegree(id),
        confidence: 1.0
      });
    });

    graph.forEachEdge((edgeId, _attrs, source, target) => {
      edges.push({ id: edgeId, source, target, label: 'mentions', weight: 1.0 });
    });

    return {
      nodes,
      edges,
      node_count: graph.order,
      edge_count: graph.size
    };
  }

  /**
   * Finds chunks that act as bridges between entities in the query.
   */
  getBridgingChunks(query: string, sessionId?: string): string[] {
    const graph = this.graphFor(sessionId);
    const queryDoc = nlp(query);
    const queryEntities = [
      ...queryDoc.organizations().out('array'),
      ...queryDoc.people().out('array'),
      ...queryDoc.topics().out('array')
    ].map(e => e.toLowerCase().trim())
     .filter(e => graph.hasNode(e));

    if (queryEntities.length < 2) return [];

    const bridgingChunks = new Set<string>();

    // For every pair of query entities, check if they share a chunk
    for (let i = 0; i < queryEntities.length; i++) {
      for (let j = i + 1; j < queryEntities.length; j++) {
        const e1 = queryEntities[i];
        const e2 = queryEntities[j];

        const chunks1 = new Set(graph.outNeighbors(e1));
        const chunks2 = graph.outNeighbors(e2);

        for (const c2 of chunks2) {
          if (chunks1.has(c2)) {
            bridgingChunks.add(c2);
          }
        }
      }
    }

    return Array.from(bridgingChunks);
  }

  // Remove one document's chunks from a session graph, then drop any entity
  // that is left with no chunks at all (i.e. appeared ONLY in this document).
  // Entities still linked to other documents' chunks are kept — this is the
  // "keep entities that appear in multiple documents" requirement.
  //
  // Returns how much was removed plus the resulting graph size, for the toast.
  async removeChunks(chunkIds: string[], sessionId?: string): Promise<{
    nodes_removed: number;
    edges_removed: number;
    node_count: number;
    edge_count: number;
  }> {
    await this.ensureLoaded(sessionId);
    const graph = this.graphFor(sessionId);

    const beforeNodes = graph.order;
    const beforeEdges = graph.size;

    // Entities pointing at the chunks we're about to remove — candidates for
    // orphan cleanup once their edges to these chunks are gone.
    const candidateEntities = new Set<string>();
    for (const id of chunkIds) {
      if (!graph.hasNode(id)) continue;
      for (const entity of graph.inNeighbors(id)) candidateEntities.add(entity);
      // Dropping the node also drops its incident edges.
      graph.dropNode(id);
    }

    // An entity that now has no outgoing edges (no remaining chunk references)
    // appeared only in the deleted document — remove it. One that still points
    // at another document's chunk stays.
    for (const entity of candidateEntities) {
      if (graph.hasNode(entity) && graph.outDegree(entity) === 0) {
        graph.dropNode(entity);
      }
    }

    await this.save(sessionId);

    return {
      nodes_removed: beforeNodes - graph.order,
      edges_removed: beforeEdges - graph.size,
      node_count: graph.order,
      edge_count: graph.size,
    };
  }

  async save(sessionId?: string) {
    if (sessionId) {
      const g = this.graphFor(sessionId);
      await fs.writeJson(this.sessionPath(sessionId), g.export());
      return;
    }
    const data = this.graph.export();
    await fs.writeJson(this.graphPath, data);
  }

  async load() {
    if (await fs.pathExists(this.graphPath)) {
      const data = await fs.readJson(this.graphPath);
      this.graph.import(data);
      console.log(`Loaded graph with ${this.graph.order} nodes and ${this.graph.size} edges.`);
    }
  }

  async clear() {
    this.graph.clear();
    if (await fs.pathExists(this.graphPath)) {
      await fs.remove(this.graphPath);
    }
    // Drop all session graphs too — /api/clear is a full purge.
    this.sessionGraphs.clear();
    if (await fs.pathExists(this.sessionDir)) {
      await fs.emptyDir(this.sessionDir);
    }
  }

  // Remove a single session's graph (used when a session is deleted).
  async clearSession(sessionId: string) {
    this.sessionGraphs.delete(sessionId);
    const file = this.sessionPath(sessionId);
    if (await fs.pathExists(file)) await fs.remove(file);
  }
}

export const graphBuilder = new GraphBuilder();

// Merge IOB-tagged WordPiece tokens (B-PER, I-PER, ...) back into entity spans.
function mergeBertTokens(tokens: any[]): string[] {
  const out: string[] = [];
  let current: { type: string; word: string } | null = null;
  for (const tok of tokens) {
    const entityType: string = (tok.entity ?? tok.entity_group ?? '').toString();
    const word: string = (tok.word ?? '').toString();
    if (!entityType || entityType === 'O') {
      if (current) {
        out.push(current.word);
        current = null;
      }
      continue;
    }
    const type = entityType.replace(/^[BI]-/, '');
    const isContinuation = word.startsWith('##');
    const piece = isContinuation ? word.slice(2) : word;
    if (current && current.type === type && (isContinuation || entityType.startsWith('I-'))) {
      current.word = isContinuation ? current.word + piece : `${current.word} ${piece}`;
    } else {
      if (current) out.push(current.word);
      current = { type, word: piece };
    }
  }
  if (current) out.push(current.word);
  return out;
}

function uniqueLower(entities: string[]): string[] {
  return [
    ...new Set(
      entities
        .map(e => e.toLowerCase().trim())
        .filter(e => e.length > 0 && !/^[\W_]+$/.test(e)),
    ),
  ];
}
