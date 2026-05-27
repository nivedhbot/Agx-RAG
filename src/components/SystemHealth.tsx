import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Database,
  Zap,
  Network,
} from './SwissUI';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface MetricsSnapshot {
  uptimeSeconds: number;
  queryCount: number;
  uploadCount: number;
  avgLatencyMs: number;
  avgConfidencePct: number;
  contradictionsTotal: number;
  corpusChunks: number;
  graphNodes: number;
  graphEdges: number;
  series: Array<{ time: string; latency: number; confidence: number }>;
  logs: LogEntry[];
}

const POLL_MS = 5000;

export default function SystemHealth() {
  const [data, setData] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/health/metrics');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    };
    fetchMetrics();
    const id = window.setInterval(fetchMetrics, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!data) {
    return (
      <div className="animate-in fade-in duration-500 pb-20">
        <p className="label-bold text-[10px] tracking-widest opacity-50 uppercase">
          {error ? `ERROR: ${error}` : 'LOADING_METRICS...'}
        </p>
      </div>
    );
  }

  const stats = [
    { icon: Activity, label: 'UPTIME', val: formatUptime(data.uptimeSeconds), trend: `${data.queryCount} QUERIES` },
    { icon: Zap, label: 'AVG_LATENCY', val: `${data.avgLatencyMs}MS`, trend: data.queryCount > 0 ? `${data.avgConfidencePct}% CONF` : 'NO_DATA' },
    { icon: Database, label: 'CORPUS_CHUNKS', val: `${data.corpusChunks}`, trend: `${data.uploadCount} UPLOADS` },
    { icon: Network, label: 'GRAPH', val: `${data.graphNodes} NODES`, trend: `${data.graphEdges} EDGES` },
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <section className="mb-12">
        <span className="label-bold text-accent mb-2 block">11. TELEMETRY DATA</span>
        <h2 className="headline-lg text-4xl mb-4">Diagnostics_Panel</h2>
        <p className="text-on-surface-variant max-w-xl label-bold text-xs uppercase tracking-wider">
          LIVE METRICS POLLED FROM /API/HEALTH/METRICS EVERY 5S.
          {data.contradictionsTotal > 0 && (
            <span className="block mt-2 text-red-600">
              ⚠ {data.contradictionsTotal} TOTAL CONTRADICTIONS DETECTED ACROSS SESSION.
            </span>
          )}
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <div key={i} className="border-thick border-foreground p-6 bg-surface group hover:bg-foreground hover:text-background transition-colors">
            <div className="flex justify-between items-start mb-6">
              <stat.icon className="text-accent group-hover:text-white" size={24} />
              <span className="label-bold text-[10px] text-accent group-hover:text-white">{stat.trend}</span>
            </div>
            <p className="label-bold text-[10px] mb-1 opacity-60">{stat.label}</p>
            <p className="text-3xl font-[900] tracking-tighter">{stat.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div className="border-thick border-foreground p-8 bg-surface overflow-hidden">
          <h3 className="label-bold mb-8 border-b border-foreground/10 pb-2 flex justify-between">
            <span>LATENCY_VS_CONFIDENCE_</span>
            <span className="text-accent">LIVE_FEED</span>
          </h3>
          <div className="h-[300px] w-full min-h-[300px]">
            {data.series.length === 0 ? (
              <div className="flex items-center justify-center h-full opacity-40 label-bold text-[10px] tracking-widest uppercase">
                NO_QUERIES_YET
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <AreaChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="time" hide />
                  <YAxis fontSize={10} tick={{ fill: '#000' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="latency" name="Latency (ms)" stroke="#FF4D00" fill="#FF4D00" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="confidence" name="Confidence (%)" stroke="#000000" fill="#000000" fillOpacity={0.05} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="border-thick border-foreground p-8 bg-surface">
          <h3 className="label-bold mb-8 border-b border-foreground/10 pb-2 flex justify-between">
            <span>RECENT_LOGS_</span>
            <span className="text-accent">{data.logs.length}_ENTRIES</span>
          </h3>
          <div className="space-y-2 font-mono text-[10px] uppercase max-h-[300px] overflow-y-auto">
            {data.logs.length === 0 ? (
              <div className="opacity-40">NO_EVENTS_YET</div>
            ) : (
              data.logs.slice().reverse().map((log, i) => (
                <div key={i} className="flex gap-3 border-b border-foreground/5 pb-2">
                  <span className="opacity-40 shrink-0">{log.ts.slice(11, 19)}</span>
                  <span
                    className={`shrink-0 label-bold ${
                      log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-yellow-600' : 'text-foreground/60'
                    }`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}S`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  return `${h}H ${m % 60}M`;
}
