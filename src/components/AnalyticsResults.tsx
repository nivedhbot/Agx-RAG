import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  Cpu,
  Cloud,
  LayoutDashboard,
  Menu,
  ChevronRight,
  ArrowLeft,
  LayoutDashboard as CorpusIcon,
  Activity,
  Network,
  Settings,
} from './SwissUI';
import { AgentTrace } from './AgentTrace';
import { ClaimGraphPanel } from './ClaimGraphPanel';

type KGNode = { id: string; label: string; type: string; confidence: number; centrality: number };
type KGEdge = { id: string; source: string; target: string; label: string; weight: number };
type KnowledgeGraph = { nodes: KGNode[]; edges: KGEdge[]; query_entity: string | null };

function KnowledgeGraphPanel({ graph }: { graph?: KnowledgeGraph }) {
  const layout = useMemo(() => {
    if (!graph || !graph.nodes?.length) return null;

    const W = 520, H = 460, CX = W / 2, CY = H / 2;
    const RING = { query_entity: 0, entity: 140, chunk: 215, bridge_chunk: 215 };

    const groups: Record<string, KGNode[]> = {
      query_entity: [],
      entity: [],
      chunk: [],
      bridge_chunk: []
    };
    for (const n of graph.nodes) {
      const key = groups[n.type] ? n.type : 'entity';
      groups[key].push(n);
    }

    const positions = new Map<string, { x: number; y: number; type: string }>();

    const placeRing = (nodes: KGNode[], radius: number, phase = 0) => {
      const n = nodes.length;
      if (n === 0) return;
      if (n === 1 && radius === 0) {
        positions.set(nodes[0].id, { x: CX, y: CY, type: nodes[0].type });
        return;
      }
      nodes.forEach((node, i) => {
        const a = phase + (2 * Math.PI * i) / Math.max(n, 1);
        positions.set(node.id, {
          x: CX + radius * Math.cos(a),
          y: CY + radius * Math.sin(a),
          type: node.type
        });
      });
    };

    if (groups.query_entity.length > 1) {
      placeRing(groups.query_entity, 55, -Math.PI / 2);
    } else {
      placeRing(groups.query_entity, 0);
    }
    placeRing(groups.entity, RING.entity, -Math.PI / 2);
    placeRing([...groups.bridge_chunk, ...groups.chunk], RING.chunk, -Math.PI / 2 + 0.15);

    return { W, H, positions, nodes: graph.nodes, edges: graph.edges };
  }, [graph]);

  if (!layout) {
    return (
      <div className="border-thick border-foreground bg-muted-background grid-bg relative p-8 min-h-[460px] flex items-center justify-center">
        <span className="label-bold text-[10px] tracking-widest text-muted-text uppercase opacity-50">
          NO_GRAPH_DATA · RUN_A_QUERY
        </span>
      </div>
    );
  }

  const { W, H, positions, nodes, edges } = layout;

  const NODE_W: Record<string, number> = { query_entity: 110, entity: 90, chunk: 96, bridge_chunk: 96 };
  const NODE_H = 26;

  const truncate = (s: string, n: number) =>
    s.length > n ? s.substring(0, n - 1) + '…' : s;

  return (
    <div className="border-thick border-foreground bg-muted-background grid-bg relative p-4 md:p-6 min-h-[460px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Edges */}
        <g>
          {edges.map(e => {
            const a = positions.get(e.source);
            const b = positions.get(e.target);
            if (!a || !b) return null;
            const isBridgeEdge = b.type === 'bridge_chunk' || a.type === 'query_entity';
            return (
              <line
                key={e.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isBridgeEdge ? '#C4501A' : '#1C1410'}
                strokeWidth={isBridgeEdge ? 1.2 : 0.6}
                strokeOpacity={isBridgeEdge ? 0.55 : 0.18}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map(n => {
            const p = positions.get(n.id);
            if (!p) return null;
            const w = NODE_W[n.type] || 90;
            const isQuery = n.type === 'query_entity';
            const isBridge = n.type === 'bridge_chunk';
            const isChunk = n.type === 'chunk' || isBridge;

            const fill = isQuery ? '#C4501A' : isBridge ? '#F5F0E8' : isChunk ? '#FFFFFF' : '#FFFFFF';
            const stroke = isBridge ? '#C4501A' : '#1C1410';
            const textColor = isQuery ? '#FFFFFF' : '#1C1410';

            return (
              <g key={n.id}>
                <rect
                  x={p.x - w / 2}
                  y={p.y - NODE_H / 2}
                  width={w}
                  height={NODE_H}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isQuery || isBridge ? 2 : 1}
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fontFamily="Inter, Arial, sans-serif"
                  fontSize={isQuery ? 10 : 9}
                  fontWeight={700}
                  fill={textColor}
                  style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {truncate(n.label, isChunk ? 14 : 13)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white border-thin swiss-border p-3 space-y-2 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-accent" />
          <span className="label-bold text-[8px] tracking-widest">QUERY_ENTITY</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-white swiss-border-thin" style={{ border: '1px solid #1C1410' }} />
          <span className="label-bold text-[8px] tracking-widest">ENTITY · CHUNK</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3" style={{ background: '#F5F0E8', border: '2px solid #C4501A' }} />
          <span className="label-bold text-[8px] tracking-widest">BRIDGE_CHUNK</span>
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 left-4 bg-foreground text-background px-3 py-2 label-bold text-[9px] tracking-widest">
        {nodes.length} NODES · {edges.length} EDGES
      </div>
    </div>
  );
}

export default function AnalyticsResults({ queryData }: {
  queryData?: any
}) {
  const [corpusStats, setCorpusStats] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch('/api/documents')
      .then(res => res.json())
      .then(data => {
        setCorpusStats(data);
      });
  }, []);

  const chartData = useMemo(() => {
    if (!corpusStats.length) return [];
    return corpusStats.slice(0, 8).map(doc => ({
      name: doc.name.substring(0, 10) + '...',
      chunks: doc.chunks || 0,
      entities: Math.floor((doc.chunks || 0) * 2.5) // Simulation
    }));
  }, [corpusStats]);

  const COLORS = ['#FF4D00', '#000000', '#666666', '#AAAAAA'];

  const renderQueryAnalysis = () => {
    const data = queryData || {
      query: "What are the primary architectural patterns discussed and how do they compare?",
      answer: "The primary architectural patterns identified across the corpus include Microservices, Event Sourcing, and CQRS. These patterns are often employed in tandem to manage state and scalability in complex distributed systems.",
      confidence: 0.87,
      latency: "1,240ms",
      reasoningPath: "Direct inference from evidence nodes.",
      topChunks: []
    };

    const reasoningSteps = data.reasoningPath ? data.reasoningPath.split('. ').filter(Boolean) : [
      'Retrieved relevant chunks from corpus',
      'Extracted semantic entities for graph construction',
      'Re-ranked context using hybrid F(d) formula',
      'Optimized synthesis via generation engine'
    ];

    return (
      <div className="animate-in fade-in duration-500">
        {/* Header Analysis */}
        <section className="mb-12">
          <span className="label-bold text-accent mb-2 block">05. QUERY ANALYSIS</span>
          <h2 className="text-xl md:text-3xl font-[900] mb-6 border-b-thick border-foreground/10 pb-4 max-w-4xl">
            {data.query}
          </h2>
          <div className="flex flex-wrap items-center gap-4 md:gap-8 text-on-surface-variant label-bold text-[10px] md:text-xs mb-8">
            <div className="flex items-center gap-2 uppercase">Processed: {new Date().toLocaleTimeString()}</div>
            <div className="flex items-center gap-2 uppercase">Duration: {data.latency || 'N/A'}</div>
            <div className="flex items-center gap-2 uppercase">Confidence: {(data.confidence * 100).toFixed(0)}%</div>
          </div>
          <div className="w-full h-8 bg-foreground flex swiss-border-thin mb-12 shadow-sm">
            <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${(data.confidence || 0.8) * 100}%` }} />
            <div className="flex-grow flex items-center justify-end px-4 text-background label-bold text-[8px] md:text-[10px]">
              {(data.confidence * 100).toFixed(0)}% RELIABILITY SCORE
            </div>
          </div>
        </section>

        {/* Answer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 mb-16">
          <div className="lg:col-span-7">
            <span className="label-bold mb-4 block text-xs">06. GENERATED_RESPONSE</span>
            <div className="border-l-thick border-accent pl-4 md:pl-8 py-2 mb-8 bg-surface/30">
              <div className="space-y-6 text-base md:text-lg leading-relaxed text-body-text whitespace-pre-wrap font-medium">
                {data.answer}
              </div>
            </div>
            <div className="bg-surface border-thick border-foreground p-6 md:p-8 grid-bg">
              <div className="label-bold text-on-surface-variant mb-6 text-[10px] tracking-widest border-b border-foreground/10 pb-2">PROCESS_REASONING_CHAIN</div>
              <div className="space-y-4">
                {reasoningSteps.map((step: string, i: number) => (
                  <div key={i} className="flex gap-4 items-center group">
                    <span className="w-6 h-6 flex items-center justify-center bg-foreground text-background text-[10px] label-bold shrink-0 group-hover:bg-accent transition-colors">{i + 1}</span>
                    <span className="label-bold text-[10px] tracking-wide opacity-80 uppercase">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <span className="label-bold mb-4 block text-xs">07. ENTITY_MAPPING</span>
            <KnowledgeGraphPanel graph={data.knowledgeGraph} />
          </div>
        </div>

        {/* Contrastive Claim Graph + Agent Trace */}
        {(data.claimGraph || data.agentTrace) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 mb-16">
            <div className="lg:col-span-7">
              <span className="label-bold mb-4 block text-xs">
                07b. CONTRASTIVE_CLAIM_GRAPH
                {data.contradictions?.length > 0 && (
                  <span className="ml-3 px-2 py-1 bg-red-600 text-white text-[9px]">
                    {data.contradictions.length} CONFLICT{data.contradictions.length > 1 ? 'S' : ''}
                  </span>
                )}
              </span>
              <ClaimGraphPanel
                graph={data.claimGraph}
                contradictionsCount={data.contradictions?.length ?? 0}
              />
            </div>
            <div className="lg:col-span-5">
              <span className="label-bold mb-4 block text-xs">07c. AGENT_EXECUTION_TRACE</span>
              <AgentTrace trace={data.agentTrace} />
            </div>
          </div>
        )}

        {/* Contradictions detail */}
        {data.contradictions?.length > 0 && (
          <section className="mb-16">
            <span className="label-bold mb-6 block text-xs text-red-700">
              07d. DETECTED_CONTRADICTIONS ({data.contradictions.length})
            </span>
            <div className="space-y-3">
              {data.contradictions.map((c: any, i: number) => {
                const findClaim = (id: string) => data.claimGraph?.nodes.find((n: any) => n.id === id);
                const a = findClaim(c.claimA);
                const b = findClaim(c.claimB);
                return (
                  <div key={i} className="border-l-thick border-red-600 bg-red-50 p-4">
                    <div className="label-bold text-[9px] tracking-widest text-red-700 mb-2">
                      CONFLICT #{i + 1} · {c.explanation}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      <div className="bg-white p-3 border border-foreground/10">
                        <div className="label-bold text-[8px] opacity-50 mb-1">{a?.source ?? '?'}</div>
                        <p className="uppercase tracking-tight">{a?.text ?? c.claimA}</p>
                      </div>
                      <div className="bg-white p-3 border border-foreground/10">
                        <div className="label-bold text-[8px] opacity-50 mb-1">{b?.source ?? '?'}</div>
                        <p className="uppercase tracking-tight">{b?.text ?? c.claimB}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Evidence */}
        <section className="mb-16">
          <span className="label-bold mb-6 block text-xs">08. GROUNDED_EVIDENCE_NODES ({data.topChunks?.length || 0})</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.topChunks?.map((chunk: any, i: number) => (
              <div key={i} className={`flex bg-surface swiss-border border-thin group hover:border-accent transition-all ${chunk.isContradiction ? 'border-red-500 border-2' : ''}`}>
                <div className="w-12 dot-pattern border-r border-foreground flex items-center justify-center section-number opacity-20 group-hover:opacity-100 transition-opacity text-xs">
                  {i + 1}
                </div>
                <div className="flex-1 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2">
                      <span className="px-2 py-1 bg-foreground text-background label-bold text-[8px]">F_SCORE: {chunk.score.toFixed(3)}</span>
                      {chunk.isContradiction && (
                        <span className="px-2 py-1 bg-red-600 text-white label-bold text-[8px]">CONTRADICTION</span>
                      )}
                    </div>
                  </div>
                  <p className="text-body-text italic mb-4 text-xs leading-relaxed uppercase opacity-80">
                    "{chunk.text.substring(0, 200)}..."
                  </p>
                  <p className="label-bold text-[8px] text-accent truncate border-t border-foreground/5 pt-3">
                    SOURCE: {chunk.source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  const renderCorpusAnalytics = () => {
    return (
      <div className="space-y-12 animate-in fade-in duration-500">
        <section>
          <span className="label-bold text-accent mb-2 block">01. CORPUS OVERVIEW</span>
          <h2 className="headline-lg text-4xl mb-4">Vector_Space_Topography</h2>
          <p className="text-on-surface-variant max-w-xl label-bold text-xs uppercase tracking-wider mb-10">
            Statistical distribution of embedded semi-structured tokens across the local repository.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { label: 'TOTAL_STORAGE', val: `${corpusStats.length} NODES` },
              { label: 'TOKEN_VOLUME', val: `${corpusStats.reduce((a, b) => a + (b.chunks || 0), 0) * 300} TKN` },
              { label: 'GRAPH_EDGES', val: '2.84M CONN' },
            ].map((stat, i) => (
              <div key={i} className="border-thick border-foreground p-8 bg-surface grid-bg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-foreground text-white flex items-center justify-center opacity-5 group-hover:opacity-100 transition-opacity">
                  <Network size={32} />
                </div>
                <p className="label-bold text-[10px] text-muted-text mb-2 tracking-widest uppercase">{stat.label}</p>
                <p className="text-3xl font-[900] text-accent tracking-tighter">{stat.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="border-thick border-foreground p-8 bg-surface overflow-hidden">
              <h3 className="label-bold mb-8 border-b border-foreground/10 pb-2 text-xs">CHUNKS_PER_SOURCE_MAP_</h3>
              <div className="h-[300px] w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" fontSize={9} tick={{ fill: '#000' }} axisLine={{ stroke: '#000' }} />
                    <YAxis fontSize={9} tick={{ fill: '#000' }} axisLine={{ stroke: '#000' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', color: '#FFF', border: 'none', borderRadius: 0, padding: '12px' }}
                      itemStyle={{ color: '#FF4D00', fontSize: '10px', textTransform: 'uppercase' }}
                      labelStyle={{ marginBottom: '8px', opacity: 0.5 }}
                    />
                    <Bar dataKey="chunks" fill="#FF4D00">
                      {chartData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border-thick border-foreground p-8 bg-surface overflow-hidden">
              <h3 className="label-bold mb-8 border-b border-foreground/10 pb-2 text-xs">ENTITY_DENSITY_ANALYSIS_</h3>
              <div className="h-[300px] w-full flex items-center justify-center min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="entities"
                      stroke="none"
                    >
                      {chartData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-foreground text-background p-10 md:p-16 border-l-thick border-accent relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 dot-pattern opacity-10 pointer-events-none" />
          <h3 className="headline-lg text-white mb-6 text-3xl">Latent_Distribution_</h3>
          <p className="label-bold opacity-60 mb-12 max-w-xl text-[11px] leading-relaxed">
            Each source node is projected into a 384-dimensional vector space using BGE-small embeddings. This topological view visualizes meaning clusters across the repository.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'SEMANTIC_DENSITY', value: 0.74 },
              { label: 'TOPOLOGICAL_FLOW', value: 0.61 },
              { label: 'VECTOR_DRIFT', value: 0.18 },
              { label: 'ENTITY_CLUSTERING', value: 0.83 },
            ].map(({ label, value }) => (
              <div key={label} className="border border-white/20 p-6 hover:border-accent transition-all cursor-crosshair group">
                <div className="flex items-baseline justify-between mb-4">
                  <div className="label-bold text-[9px] text-accent tracking-widest">{label}</div>
                  <div className="label-bold text-[11px] text-white tabular-nums">{value.toFixed(2)}</div>
                </div>
                <div className="h-1.5 bg-white/10 overflow-hidden">
                  <div className="h-full bg-white group-hover:bg-accent transition-all duration-1000" style={{ width: `${value * 100}%` }} />
                </div>
                <div className="label-bold text-[8px] mt-3 tracking-widest text-white/40">CORPUS_RELATIVE</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-full">
      {queryData ? renderQueryAnalysis() : renderCorpusAnalytics()}
    </div>
  );
}
