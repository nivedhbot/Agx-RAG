import React from 'react';
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
  Eye,
  Trash2,
  BookOpen
} from './SwissUI';

export default function AnalyticsResults() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="bg-background border-b-thick border-foreground fixed top-0 w-full z-50 flex justify-between items-center px-4 md:px-12 py-4">
        <div className="flex items-center gap-4 md:gap-8">
          <button 
            className="md:hidden w-10 h-10 bg-accent swiss-border flex items-center justify-center text-white"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={20} />
          </button>
          <h1 className="headline-lg text-[20px] md:text-[24px] tracking-tight">AGX-RAG</h1>
          <nav className="hidden lg:flex items-center gap-4 label-bold text-xs">
            <span className="text-on-surface-variant">Dashboard</span>
            <ChevronRight size={12} className="text-on-surface-variant" />
            <span className="text-accent">Query Results</span>
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <div className="hidden sm:flex gap-4">
            <Cpu className="text-primary" size={20} />
            <Cloud className="text-primary" size={20} />
            <Network className="text-primary" size={20} />
          </div>
          <button className="flex items-center gap-2 px-4 md:px-6 py-2 border-thin border-foreground bg-primary text-background hover:bg-foreground transition-colors label-bold text-[10px] md:text-xs">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
      </header>

      <div className="flex pt-[80px] h-[calc(100vh-80px)] overflow-hidden">
        {/* Side Nav */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-surface-container border-r-thick border-foreground transition-transform duration-300 md:relative md:translate-x-0 pt-[80px] md:pt-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-6 border-b-thin border-foreground">
            <div className="headline-lg text-xl">SYSTEM</div>
            <div className="label-bold text-[10px] tracking-widest text-on-surface-variant mt-1">V.1.0.4-STABLE</div>
          </div>
          <nav className="flex-grow">
            {[
              { icon: CorpusIcon, label: 'Corpus', active: true },
              { icon: Activity, label: 'Analytics' },
              { icon: Network, label: 'Schema' },
              { icon: Settings, label: 'Settings' },
            ].map((item, i) => (
              <a 
                key={i} 
                href="#" 
                onClick={() => setIsSidebarOpen(false)}
                className={`p-4 flex items-center gap-4 transition-all ${
                  item.active 
                    ? 'bg-accent text-background border-y-2 border-foreground' 
                    : 'text-on-surface-variant border-b border-foreground/10 hover:bg-foreground hover:text-background'
                }`}
              >
                <item.icon size={20} />
                <span className="label-bold">{item.label}</span>
              </a>
            ))}
          </nav>
          <div className="p-4 border-t-thin border-foreground bg-surface-container-high">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              <span className="label-bold text-[10px]">Engine Online</span>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-foreground/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-12 overflow-y-auto">
          {/* Header Analysis */}
          <section className="mb-12">
            <span className="label-bold text-accent mb-2 block">05. QUERY ANALYSIS</span>
            <h2 className="text-xl md:text-3xl font-[900] mb-6 border-b-thin border-foreground/10 pb-4 max-w-4xl">
              What are the primary architectural patterns discussed and how do they compare?
            </h2>
            <div className="flex flex-wrap items-center gap-4 md:gap-8 text-on-surface-variant label-bold text-[10px] md:text-xs mb-8">
              <div className="flex items-center gap-2">Processed: 2024-03-15 14:32</div>
              <div className="flex items-center gap-2">Duration: 1,240ms</div>
              <div className="flex items-center gap-2">Confidence: 87%</div>
            </div>
            <div className="w-full h-8 bg-foreground flex swiss-border-thin mb-12">
              <div className="h-full bg-accent" style={{ width: '87%' }} />
              <div className="flex-grow flex items-center justify-end px-4 text-background label-bold text-[8px] md:text-[10px]">
                87% RELIABILITY SCORE
              </div>
            </div>
          </section>

          {/* Answer Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 mb-16">
            <div className="lg:col-span-7">
              <span className="label-bold mb-4 block">06. GENERATED ANSWER</span>
              <div className="border-l-thick border-accent pl-4 md:pl-8 py-2 mb-8">
                <div className="space-y-6 text-base md:text-lg leading-relaxed text-body-text">
                  <p>
                    The primary architectural patterns identified across the corpus include <strong className="text-foreground">Microservices, Event Sourcing</strong>, and <strong className="text-foreground">CQRS (Command Query Responsibility Segregation)</strong>. These patterns are often employed in tandem to manage state and scalability in complex distributed systems.
                  </p>
                  <p>
                    Comparing these, <strong className="text-foreground">Microservices</strong> focuses on the vertical decomposition of business logic into independent services, whereas <strong className="text-foreground">Event Sourcing</strong> shifts the focus to state management by treating every change as an immutable event.
                  </p>
                </div>
              </div>
              <div className="bg-surface-container border-thin swiss-border p-4 md:p-6">
                <div className="label-bold text-on-surface-variant mb-4 text-[8px] md:text-[10px]">REASONING PATH</div>
                <div className="space-y-3 label-bold text-[8px] md:text-[10px]">
                  {[
                    'RETRIEVED 12 RELEVANT CHUNKS FROM 4 DISTINCT DOCUMENTS',
                    'BUILT KNOWLEDGE GRAPH WITH 89 ENTITIES AND 142 RELATIONS',
                    'RE-RANKED CONTEXT BY F(D) FORMULA FOR THEMATIC RELEVANCE',
                    'GENERATED SYNTHETIC SYNTHESIS WITH GEMINI PRO ENGINE'
                  ].map((step, i) => (
                    <div key={i} className="flex gap-2 md:gap-4">
                      <span className="text-accent shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <span className="label-bold mb-4 block">07. ENTITY GRAPH</span>
              <div className="border-thin swiss-border bg-muted-background grid-bg relative p-4 md:p-8 min-h-[300px] md:min-h-[400px]">
                <div className="absolute top-10 left-4 md:left-10 bg-accent text-white border-thin swiss-border px-2 md:px-4 py-1 md:py-2 label-bold text-[8px] md:text-[10px]">MICROSERVICES</div>
                <div className="absolute top-1/2 left-1/4 bg-background border-thin swiss-border px-2 md:px-4 py-1 md:py-2 label-bold text-[8px] md:text-[10px]">EVENT SOURCING</div>
                <div className="absolute top-1/3 right-4 md:right-10 bg-background border-thin swiss-border px-2 md:px-4 py-1 md:py-2 label-bold text-[8px] md:text-[10px]">CQRS</div>
                
                <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none">
                  <line x1="25%" y1="15%" x2="40%" y2="50%" stroke="currentColor" strokeWidth="2" />
                  <line x1="40%" y1="50%" x2="80%" y2="35%" stroke="currentColor" strokeWidth="2" />
                </svg>

                <div className="absolute bottom-4 left-4 bg-background border-thin swiss-border p-2 md:p-3 space-y-1 md:space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent" />
                    <span className="label-bold text-[6px] md:text-[8px]">PRIMARY PIVOT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-background swiss-border-thin" />
                    <span className="label-bold text-[6px] md:text-[8px]">RELATED CONCEPT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <section className="mb-16">
            <span className="label-bold mb-4 block">08. RETRIEVED EVIDENCE (6 CHUNKS)</span>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex bg-surface-bright swiss-border group hover:border-accent transition-colors">
                  <div className="w-12 md:w-16 dot-pattern border-r border-foreground flex items-center justify-center section-number opacity-30 group-hover:opacity-100 transition-opacity text-xs md:text-base">
                    0{i}
                  </div>
                  <div className="flex-1 p-4 md:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                      <div className="flex gap-2">
                        <span className="px-2 py-1 bg-foreground text-background label-bold text-[7px] md:text-[8px]">F: 0.891</span>
                        <span className="px-2 py-1 swiss-border-thin label-bold text-[7px] md:text-[8px]">S: 0.823</span>
                      </div>
                      <div className="label-bold text-[8px] md:text-[10px] text-muted-text">Arch_Patterns_2023.pdf • Page 14</div>
                    </div>
                    <p className="text-body-text italic mb-4 text-sm md:text-base">
                      "...the implementation of event sourcing necessitates a robust append-only storage layer, often referred to as an event store. In contrast to microservices which might utilize traditional relational databases..."
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 swiss-border-thin label-bold text-[8px] md:text-[9px]">EVENT STORE</span>
                      <span className="px-2 py-1 swiss-border-thin label-bold text-[8px] md:text-[9px]">TEMPORAL</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Scoring Detail */}
          <section className="bg-foreground text-background p-6 md:p-12">
            <span className="label-bold text-background/50 mb-6 block">09. SCORING BREAKDOWN</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              <div>
                <div className="headline-lg text-lg md:text-2xl italic opacity-80 mb-4 whitespace-normal break-all">F(d) = α·S + β·Gc + γ·Rc − λ·Cp</div>
                <p className="label-bold text-[8px] md:text-[10px] opacity-60">FORMULA OPTIMIZED FOR CROSS-CONTEXTUAL INTEGRITY</p>
              </div>
              <div className="border-l-0 md:border-l border-white/20 pl-0 md:pl-8 pt-6 md:pt-0">
                <table className="w-full label-bold text-[10px]">
                  <thead>
                    <tr className="border-b border-white/10 opacity-40">
                      <th className="py-2">VARIABLE</th>
                      <th className="py-2">DESCRIPTION</th>
                      <th className="py-2 text-right text-accent">WEIGHT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { v: 'α (Alpha)', d: 'Semantic Similarity (S)', w: '0.60' },
                      { v: 'β (Beta)', d: 'Graph Centrality (Gc)', w: '0.20' }
                    ].map((row, i) => (
                      <tr key={i}>
                        <td className="py-2">{row.v}</td>
                        <td className="py-2 opacity-60">{row.d}</td>
                        <td className="py-2 text-right">{row.w}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
