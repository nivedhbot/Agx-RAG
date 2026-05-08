import React, { useState } from 'react';
import { 
  Menu, 
  Send, 
  PlusSquare, 
  Cpu, 
  Cloud, 
  LayoutDashboard,
  SwissButton,
  ChevronRight
} from './SwissUI';

export default function ChatDashboard() {
  const [query, setQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden relative">
      {/* Side Sidebar: Corpus Index */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-muted-background border-r-thick border-foreground transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="absolute inset-0 dot-pattern pointer-events-none" />
        <div className="p-6 relative z-10 h-full flex flex-col">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-6 bg-accent" />
                <h1 className="headline-lg text-[24px] tracking-tight">AGX-RAG</h1>
              </div>
              <p className="label-bold text-[10px] tracking-widest text-muted-text mt-1">GRAPH-AUGMENTED RETRIEVAL</p>
            </div>
            <button className="lg:hidden p-1 bg-foreground text-background" onClick={() => setIsSidebarOpen(false)}>
              <ChevronRight className="rotate-180" size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 bg-foreground" />
            <span className="label-bold">ONLINE</span>
          </div>

          <section className="space-y-4 flex-1">
            <h2 className="section-number text-sm">00. CORPUS</h2>
            <div className="border-thin border-dashed border-foreground p-6 flex flex-col items-center justify-center gap-2 hover:bg-white/30 transition-colors cursor-pointer">
              <PlusSquare size={24} />
              <span className="label-bold text-[10px]">UPLOAD PDF</span>
            </div>
            
            <div className="space-y-0 border-t-thin border-foreground overflow-y-auto max-h-[300px]">
              {[
                { name: 'arch_patterns_v2.pdf', pg: 42, chunks: 156 },
                { name: 'system_spec_final.pdf', pg: 12, chunks: 88 },
                { name: 'event_sourcing_deep.pdf', pg: 85, chunks: 412 },
              ].map((doc, i) => (
                <div key={i} className="border-b-thin border-foreground p-3 hover:bg-accent-muted transition-colors cursor-pointer group">
                  <p className="label-bold truncate">{doc.name}</p>
                  <div className="flex justify-between mt-1 opacity-60 text-[10px] font-bold">
                    <span>PG: {doc.pg}</span>
                    <span>CHUNKS: {doc.chunks}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-auto border-t-thick border-foreground flex -mx-6 -mb-6 bg-muted-background">
            <div className="flex-1 border-r-thin border-foreground p-3 label-bold text-[10px]">DOCS: 3</div>
            <div className="flex-1 p-3 label-bold text-[10px]">QUERIES: 12</div>
          </footer>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Panel */}
      <section className="flex-1 flex flex-col bg-background relative border-r-thick border-foreground w-full">
        <header className="h-16 border-b-thick border-foreground flex items-center px-4 md:px-6 gap-4 bg-surface">
          <button 
            className="lg:hidden w-10 h-10 bg-accent swiss-border flex items-center justify-center text-white"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <button className="hidden lg:flex w-10 h-10 bg-accent swiss-border items-center justify-center text-white">
            <Menu size={20} />
          </button>
          <h2 className="headline-lg text-[18px] md:text-[20px] tracking-tight">System Inquiry_</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-8 md:space-y-12">
          {/* Messages */}
          <div className="flex justify-end">
            <div className="w-full sm:max-w-[80%] bg-accent p-4 md:p-6 border-thick border-foreground">
              <p className="text-white font-medium text-sm md:text-base">What are the key architectural patterns discussed in this paper?</p>
            </div>
          </div>

          <div className="flex justify-start">
            <div className="w-full sm:max-w-[90%] bg-muted-background p-4 md:p-6 border-thick border-foreground space-y-4">
              <p className="text-foreground font-medium text-sm md:text-base">
                The primary architectural patterns identified include Microservices, Event Sourcing, and Command Query Responsibility Segregation (CQRS). The paper emphasizes the decoupling of data storage from business logic through asynchronous event streams, ensuring high horizontal scalability.
              </p>
              <div className="flex flex-wrap gap-2 pt-4">
                <span className="swiss-border-thin px-2 md:px-3 py-1 label-bold text-[8px] md:text-[10px] bg-accent text-white">87% CONF.</span>
                <span className="swiss-border-thin px-2 md:px-3 py-1 label-bold text-[8px] md:text-[10px]">1240MS</span>
                <span className="swiss-border-thin px-2 md:px-3 py-1 label-bold text-[8px] md:text-[10px]">4 SOURCES</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:max-w-[80%] bg-accent p-4 md:p-6 border-thick border-foreground">
              <p className="text-white font-medium text-sm md:text-base">How does event sourcing compare to traditional CRUD?</p>
            </div>
          </div>

          <div className="flex justify-start">
            <div className="w-full sm:max-w-[90%] bg-muted-background p-4 md:p-6 border-thick border-foreground flex items-center gap-6">
              <div className="flex gap-1 items-end h-8">
                <div className="w-2 bg-foreground h-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 bg-foreground h-1/2 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 bg-foreground h-3/4 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="headline-lg text-[14px] md:text-[16px] animate-pulse">Processing_</span>
            </div>
          </div>
        </div>

        <footer className="p-4 md:p-8 bg-background border-t-thick border-foreground">
          <div className="relative swiss-border flex bg-surface-container-lowest">
            <textarea 
              className="flex-1 p-3 md:p-4 bg-transparent focus:ring-0 border-none font-medium text-foreground text-sm md:text-base placeholder:text-muted-text/30 resize-none h-20 md:h-24" 
              placeholder="ENTER YOUR QUERY..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="w-24 md:w-32 bg-accent hover:bg-foreground transition-all duration-150 flex flex-col items-center justify-center border-l-thick border-foreground text-white group">
              <Send size={24} className="md:w-8 md:h-8 group-active:translate-x-1 group-active:-translate-y-1 transition-transform" />
              <span className="label-bold text-[10px] md:text-[12px] mt-1">SUBMIT</span>
            </button>
          </div>
        </footer>
      </section>

      {/* Right Graph Panel */}
      <aside className="w-[400px] hidden xl:flex flex-col bg-surface overflow-hidden">
        <div className="flex border-b-thick border-foreground">
          <button className="flex-1 bg-foreground text-background p-4 label-bold text-[14px]">
            02. GRAPH
          </button>
          <button className="flex-1 bg-surface-variant text-on-surface-variant p-4 label-bold text-[14px] border-l-thick border-foreground">
            03. EVIDENCE
          </button>
        </div>

        <div className="flex-1 relative bg-background overflow-hidden p-8">
          <div className="absolute inset-0 dot-pattern opacity-10" />
          
          {/* Mock Graph */}
          <div className="relative w-full h-[400px] flex items-center justify-center">
            {/* SVG Lines */}
            <svg className="absolute inset-0 w-full h-full">
              <path d="M 200,100 L 100,200 L 200,300 L 300,200 Z" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <line x1="200" y1="100" x2="200" y2="300" stroke="currentColor" strokeWidth="2" className="text-foreground" />
            </svg>
            
            <div className="absolute top-[80px] px-4 py-2 bg-accent border-thick border-foreground label-bold text-[10px] text-white">MICROSERVICES</div>
            <div className="absolute left-[20px] top-[180px] px-4 py-2 bg-muted-background border-thin border-foreground label-bold text-[10px]">EVENT SOURCING</div>
            <div className="absolute right-[20px] top-[180px] px-4 py-2 bg-muted-background border-thin border-foreground label-bold text-[10px]">CQRS</div>
            <div className="absolute bottom-[80px] px-4 py-2 bg-border border-thin border-foreground label-bold text-[10px]">DATABASE</div>
          </div>

          <div className="absolute top-6 left-6 p-4 bg-surface-bright border-thin border-foreground z-20 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-accent" />
              <span className="label-bold text-[9px]">PRIMARY ENTITY</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted-background swiss-border-thin" />
              <span className="label-bold text-[9px]">RELATED TOPIC</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t-thick border-foreground bg-muted-background">
          <h3 className="headline-lg text-[14px] mb-4">Node Metadata_</h3>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-foreground/10 pb-2">
              <span className="label-bold text-[10px] text-muted-text">TYPE</span>
              <span className="label-bold text-[10px]">STRUCTURAL_PATTERN</span>
            </div>
            <div className="flex justify-between border-b border-foreground/10 pb-2">
              <span className="label-bold text-[10px] text-muted-text">RELEVANCE</span>
              <span className="label-bold text-[10px]">0.92</span>
            </div>
            <p className="text-[12px] leading-relaxed font-medium">
              Central concept of the document cluster. Interconnected with 14 sub-modules through temporal event streams.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
