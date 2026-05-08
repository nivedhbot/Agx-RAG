import { MultiDirectedGraph } from 'graphology';
import nlp from 'compromise';
import fs from 'fs-extra';
import path from 'path';

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
  private readonly graphPath = path.join(process.cwd(), 'vectorstore', 'persistent_graph.json');

  constructor() {
    this.graph = new MultiDirectedGraph();
    this.ensureDirectory();
  }

  private async ensureDirectory() {
    await fs.ensureDir(path.join(process.cwd(), 'vectorstore'));
  }

  /**
   * Update graph with new chunks.
   * Extracts entities and creates edges [Entity] -> [Chunk]
   */
  async updateGraph(chunks: Chunk[]) {
    for (const chunk of chunks) {
      if (!chunk.id) continue;

      // Add chunk node
      if (!this.graph.hasNode(chunk.id)) {
        this.graph.addNode(chunk.id, { type: 'chunk', text: chunk.text, source: chunk.source });
      }

      // Extract entities
      const doc = nlp(chunk.text);
      const entities = [
        ...doc.organizations().out('array'),
        ...doc.people().out('array'),
        ...doc.places().out('array'),
        ...doc.topics().out('array')
      ];

      // Remove duplicates and clean
      const uniqueEntities = [...new Set(entities.map(e => e.toLowerCase().trim()))].filter(e => e.length > 2);

      for (const entity of uniqueEntities) {
        // Add entity node
        if (!this.graph.hasNode(entity)) {
          this.graph.addNode(entity, { type: 'entity' });
        }

        // Add edge Entity -> Chunk (Entity is contained in Chunk)
        // We use a MultiGraph because multiple chunks can contain the same entity
        this.graph.addDirectedEdge(entity, chunk.id);
      }
    }

    await this.save();
  }

  /**
   * Calculates a "graph score" for chunks based on their connectivity to query entities.
   */
  getGraphScores(chunks: Chunk[], query: string): number[] {
    const queryDoc = nlp(query);
    const queryEntities = [
      ...queryDoc.organizations().out('array'),
      ...queryDoc.people().out('array'),
      ...queryDoc.topics().out('array')
    ].map(e => e.toLowerCase().trim());

    return chunks.map(chunk => {
      let score = 0;
      if (!chunk.id || !this.graph.hasNode(chunk.id)) return 0;

      // Find entities in this chunk that match query entities
      const chunkEntities = this.graph.inNeighbors(chunk.id);
      for (const entity of chunkEntities) {
        if (queryEntities.includes(entity)) {
          score += 1.0;
        }
      }
      return score;
    });
  }

  /**
   * Finds chunks that act as bridges between entities in the query.
   */
  getBridgingChunks(query: string): string[] {
    const queryDoc = nlp(query);
    const queryEntities = [
      ...queryDoc.organizations().out('array'),
      ...queryDoc.people().out('array'),
      ...queryDoc.topics().out('array')
    ].map(e => e.toLowerCase().trim())
     .filter(e => this.graph.hasNode(e));

    if (queryEntities.length < 2) return [];

    const bridgingChunks = new Set<string>();

    // For every pair of query entities, check if they share a chunk
    for (let i = 0; i < queryEntities.length; i++) {
      for (let j = i + 1; j < queryEntities.length; j++) {
        const e1 = queryEntities[i];
        const e2 = queryEntities[j];

        const chunks1 = new Set(this.graph.outNeighbors(e1));
        const chunks2 = this.graph.outNeighbors(e2);

        for (const c2 of chunks2) {
          if (chunks1.has(c2)) {
            bridgingChunks.add(c2);
          }
        }
      }
    }

    return Array.from(bridgingChunks);
  }

  async save() {
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
  }
}

export const graphBuilder = new GraphBuilder();
