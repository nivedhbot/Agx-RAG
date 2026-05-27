// In-memory metrics ring buffer. Survives only as long as the process.
// For a real deployment, swap for Prometheus or similar.

const MAX_LATENCY_SAMPLES = 200;

interface QuerySample {
  ts: number;
  latencyMs: number;
  confidence: number;
  contradictions: number;
  agentSteps: number;
}

interface LogEntry {
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

class MetricsStore {
  private startedAt = Date.now();
  private queries: QuerySample[] = [];
  private logs: LogEntry[] = [];
  private uploadCount = 0;

  recordQuery(sample: Omit<QuerySample, 'ts'>) {
    this.queries.push({ ...sample, ts: Date.now() });
    if (this.queries.length > MAX_LATENCY_SAMPLES) {
      this.queries = this.queries.slice(-MAX_LATENCY_SAMPLES);
    }
    this.log('info', `query ${sample.latencyMs}ms conf=${sample.confidence.toFixed(2)}`);
  }

  recordUpload(filename: string, chunks: number) {
    this.uploadCount++;
    this.log('info', `upload ${filename} → ${chunks} chunks`);
  }

  log(level: LogEntry['level'], message: string) {
    this.logs.push({ ts: Date.now(), level, message });
    if (this.logs.length > 100) this.logs = this.logs.slice(-100);
  }

  snapshot(corpusChunks: number, graphNodes: number, graphEdges: number) {
    const total = this.queries.length;
    const avgLatency = total === 0 ? 0 : this.queries.reduce((a, b) => a + b.latencyMs, 0) / total;
    const avgConfidence = total === 0 ? 0 : this.queries.reduce((a, b) => a + b.confidence, 0) / total;
    const contradictionsTotal = this.queries.reduce((a, b) => a + b.contradictions, 0);
    const series = this.queries.slice(-20).map((q, i) => ({
      time: `${i}`,
      latency: Math.round(q.latencyMs),
      confidence: Math.round(q.confidence * 100),
    }));
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      queryCount: total,
      uploadCount: this.uploadCount,
      avgLatencyMs: Math.round(avgLatency),
      avgConfidencePct: Math.round(avgConfidence * 100),
      contradictionsTotal,
      corpusChunks,
      graphNodes,
      graphEdges,
      series,
      logs: this.logs.slice(-12).map(l => ({
        ts: new Date(l.ts).toISOString(),
        level: l.level,
        message: l.message,
      })),
    };
  }
}

export const metrics = new MetricsStore();
