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
            <div className="border-thick border-foreground bg-muted-background grid-bg relative p-4 md:p-8 min-h-[300px] md:min-h-[450px]">
              <div className="absolute top-10 left-4 md:left-10 bg-accent text-white border-thin swiss-border px-4 py-2 label-bold text-[10px] shadow-lg">PRIMARY_PIVOT</div>
              <div className="absolute top-1/2 left-1/4 bg-white border-thin swiss-border px-4 py-2 label-bold text-[10px] shadow-lg">RELATIONAL_BRIDGE</div>
              <div className="absolute top-1/3 right-10 bg-white border-thin swiss-border px-4 py-2 label-bold text-[10px] shadow-lg">CONTEXT_NODE</div>
              
              <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
                <line x1="25%" y1="15%" x2="40%" y2="50%" stroke="currentColor" strokeWidth="2" />
                <line x1="40%" y1="50%" x2="80%" y2="35%" stroke="currentColor" strokeWidth="2" />
                <circle cx="25%" cy="15%" r="4" fill="currentColor" />
                <circle cx="40%" cy="50%" r="4" fill="currentColor" />
                <circle cx="80%" cy="35%" r="4" fill="currentColor" />
              </svg>

              <div className="absolute bottom-6 right-6 bg-white border-thin swiss-border p-4 space-y-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-accent" />
                  <span className="label-bold text-[8px] tracking-widest">ACTIVE PIVOT</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-white swiss-border-thin" />
                  <span className="label-bold text-[8px] tracking-widest">NEIGHBOR NODE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            {['SEMANTIC_DENSITY', 'TOPOLOGICAL_FLOW', 'VECTOR_DRIFT', 'ENTITY_CLUSTERING'].map(text => (
              <div key={text} className="border border-white/20 p-6 hover:border-accent transition-all cursor-crosshair group">
                <div className="label-bold text-[9px] mb-6 text-accent tracking-widest">{text}</div>
                <div className="h-0.5 bg-white/10 overflow-hidden">
                  <div className="h-full bg-white group-hover:bg-accent transition-all duration-1000" style={{ width: `${Math.random() * 100}%` }} />
                </div>
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
