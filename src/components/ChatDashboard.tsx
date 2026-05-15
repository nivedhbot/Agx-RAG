import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Send, 
  PlusSquare, 
  Cpu, 
  Cloud, 
  LayoutDashboard,
  SwissButton,
  ChevronRight,
  Terminal
} from './SwissUI';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  latency?: string;
  sources?: string[];
  reasoningPath?: string;
  topChunks?: any[];
  isLoading?: boolean;
}

export default function ChatDashboard({ onShowAnalysis }: { 
  onShowAnalysis: (data: any) => void
}) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const handleQuery = async () => {
    if (!query.trim()) return;

    const currentQuery = query;
    const userMsg: Message = { role: 'user', content: currentQuery };
    const assistantMsg: Message = { role: 'assistant', content: '', isLoading: true };
    
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setQuery('');

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery }),
      });
      
      const data = await res.json();
      
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { 
          ...last, 
          content: data.answer, 
          confidence: data.confidence,
          latency: data.latency,
          sources: data.sources,
          reasoningPath: data.reasoningPath,
          topChunks: data.topChunks,
          isLoading: false,
          query: currentQuery // Store original query for analysis
        } as any];
      });
    } catch (err) {
      console.error('Query failed:', err);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { 
          ...last, 
          content: "System error: Failed to retrieve graph-augmented response.", 
          isLoading: false 
        }];
      });
    }
  };

  return (
    <div className="flex h-full animate-in fade-in duration-500 overflow-hidden relative border-thick border-foreground bg-surface shadow-[12px_12px_0px_#00000010]">
      {/* Main Chat Panel */}
      <section className="flex-1 flex flex-col bg-background relative border-r-thick border-foreground">
        <header className="h-14 border-b-thick border-foreground flex items-center px-6 gap-4 bg-muted-background">
          <div className="w-3 h-3 bg-accent animate-pulse" />
          <h2 className="label-bold text-xs uppercase tracking-widest">Inquiry_Buffer_Live</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-surface/50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-10 space-y-6">
              <Cpu size={120} strokeWidth={1} />
              <div className="text-center">
                <p className="headline-lg text-3xl uppercase tracking-[0.2em] mb-2">Awaiting_Instructions</p>
                <p className="label-bold text-[10px] tracking-widest">INPUT QUERY TO TRIGGER GRAPH TRAVERSAL</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`w-full ${msg.role === 'user' ? 'sm:max-w-[85%] bg-accent' : 'sm:max-w-[95%] bg-surface border-thick border-foreground shadow-sm'} p-6 md:p-8 space-y-4`}>
                {msg.isLoading ? (
                  <div className="flex items-center gap-6">
                    <div className="flex gap-1.5 items-end h-10">
                      <div className="w-2.5 bg-foreground h-full animate-pulse" style={{ animationDelay: '0ms' }} />
                      <div className="w-2.5 bg-foreground h-2/3 animate-pulse" style={{ animationDelay: '150ms' }} />
                      <div className="w-2.5 bg-foreground h-1/2 animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="headline-lg text-2xl animate-pulse tracking-widest">PROCESS_</span>
                  </div>
                ) : (
                  <>
                    <p className={`${msg.role === 'user' ? 'text-white' : 'text-foreground'} font-medium text-sm md:text-lg leading-relaxed whitespace-pre-wrap uppercase tracking-tight`}>
                      {msg.content}
                    </p>
                    {msg.role === 'assistant' && msg.confidence && (
                      <div className="flex flex-col gap-6 pt-6 border-t border-foreground/5">
                        <div className="flex flex-wrap gap-3">
                          <div className="flex flex-col">
                            <span className="label-bold text-[8px] opacity-40 mb-1">ACCURACY</span>
                            <span className="px-3 py-1 bg-accent text-white label-bold text-[10px]">{(msg.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="label-bold text-[8px] opacity-40 mb-1">LATENCY</span>
                            <span className="px-3 py-1 bg-foreground text-background label-bold text-[10px]">{msg.latency}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="label-bold text-[8px] opacity-40 mb-1">EVIDENCE</span>
                            <span className="px-3 py-1 bg-foreground text-background label-bold text-[10px]">{msg.sources?.length} NODES</span>
                          </div>
                        </div>
                        <SwissButton 
                          variant="secondary" 
                          className="w-full text-[10px] py-4 tracking-[0.2em] uppercase font-black bg-foreground text-background hover:bg-accent hover:text-white"
                          onClick={() => onShowAnalysis(msg)}
                        >
                          DECONSTRUCT_SYNTHESIS_
                        </SwissButton>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <footer className="p-6 md:p-8 bg-muted-background border-t-thick border-foreground">
          <div className="relative flex bg-surface border-thick border-foreground focus-within:ring-2 focus-within:ring-accent transition-all">
            <textarea 
              className="flex-1 p-5 bg-transparent focus:ring-0 border-none font-bold text-foreground text-sm placeholder:text-muted-text/30 resize-none h-24 uppercase" 
              placeholder="ENTER_QUERY_FOR_REASONING_ENGINE..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuery();
                }
              }}
            />
            <button 
              onClick={handleQuery}
              className="w-28 md:w-36 bg-accent hover:bg-foreground transition-all duration-300 flex flex-col items-center justify-center border-l-thick border-foreground text-white group"
            >
              <Send size={28} className="group-active:scale-90 transition-transform" />
              <span className="label-bold text-[10px] mt-2 tracking-widest">EXECUTE</span>
            </button>
          </div>
        </footer>
      </section>

      {/* Right Graph Panel */}
      <aside className="w-[450px] hidden xl:flex flex-col bg-surface overflow-hidden">
        <div className="flex border-b-thick border-foreground bg-foreground">
          <button className="flex-1 text-background p-5 label-bold text-[12px] tracking-[0.2em] relative overflow-hidden group">
            <span className="relative z-10">02. DYNAMIC_MAP</span>
            <div className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-300 opacity-20" />
          </button>
          <button className="flex-1 text-background/40 hover:text-background p-5 label-bold text-[12px] tracking-[0.2em] border-l border-white/10 transition-colors uppercase">
            03. LOGS
          </button>
        </div>

        <div className="flex-1 relative bg-surface overflow-hidden p-10 flex flex-col">
          <div className="absolute inset-0 dot-pattern opacity-10" />
          
          <div className="relative z-10 flex-grow flex flex-col justify-center">
            {/* Mock Graph Visualization */}
            <div className="w-full aspect-square border border-foreground/10 flex items-center justify-center relative">
              <div className="absolute inset-4 border border-accent/20 rounded-full animate-spin-slow opacity-20" />
              <div className="absolute inset-10 border border-foreground/20 rounded-full animate-spin-slow-reverse opacity-20" />
              
              <div className="relative z-20 flex flex-col gap-8 items-center cursor-crosshair">
                <div className="px-4 py-2 border-thick border-foreground bg-accent text-white label-bold text-[9px] tracking-widest shadow-lg">PRIMARY_NODE</div>
                <div className="flex gap-12">
                  <div className="px-4 py-2 border border-foreground/20 bg-background label-bold text-[8px] opacity-40 shadow-sm">L_VECTOR</div>
                  <div className="px-4 py-2 border border-foreground/20 bg-background label-bold text-[8px] opacity-40 shadow-sm">R_VECTOR</div>
                </div>
                <div className="px-4 py-2 border border-foreground/50 bg-background label-bold text-[9px] tracking-widest shadow-md">CONTEXTUAL_ANCHOR</div>
              </div>

              <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
                 <line x1="50%" y1="20%" x2="50%" y2="80%" stroke="currentColor" strokeWidth="1" />
                 <line x1="20%" y1="50%" x2="80%" y2="50%" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>
          </div>

          <div className="p-8 border-thick border-foreground bg-muted-background mt-4 relative overflow-hidden shadow-inner">
             <div className="absolute top-0 right-0 p-2 opacity-10"><Terminal size={40} /></div>
            <h3 className="label-bold text-[12px] mb-6 border-b border-foreground/10 pb-2 uppercase tracking-widest">Metadata_Buffer</h3>
            <div className="space-y-4 font-mono">
              <div className="flex justify-between items-center text-[10px]">
                <span className="opacity-40 uppercase tracking-tighter">Traversed_Path</span>
                <span className="label-bold text-accent">GRAPH_ROOT/SEMANTIC_01</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="opacity-40 uppercase tracking-tighter">Active_Relay</span>
                <span className="label-bold uppercase">BGE_SMALL_PROJECTOR</span>
              </div>
              <p className="text-[11px] leading-relaxed uppercase font-medium opacity-80 pt-2 border-t border-foreground/5">
                Latency optimized path detected via local index. Graph-density at query point exceeds threshold for high-fidelity synthesis.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
