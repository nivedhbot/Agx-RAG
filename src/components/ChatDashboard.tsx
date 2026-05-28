import React, { useState } from 'react';
import {
  Send,
  Cpu,
  SwissButton,
  Terminal,
} from './SwissUI';
import { AgentTrace, AgentTraceEntry } from './AgentTrace';
import { ClaimGraph } from './ClaimGraphPanel';

interface Contradiction {
  claimA: string;
  claimB: string;
  explanation: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  latency?: string;
  sources?: string[];
  reasoningPath?: string;
  topChunks?: any[];
  knowledgeGraph?: { nodes: any[]; edges: any[]; query_entity: string | null };
  claimGraph?: ClaimGraph;
  contradictions?: Contradiction[];
  evidenceChain?: string[];
  agentTrace?: AgentTraceEntry[];
  query?: string;
  isLoading?: boolean;
}

export default function ChatDashboard({ onShowAnalysis }: {
  onShowAnalysis: (data: any) => void;
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
          knowledgeGraph: data.knowledgeGraph,
          claimGraph: data.claimGraph,
          contradictions: data.contradictions,
          evidenceChain: data.evidenceChain,
          agentTrace: data.agentTrace,
          isLoading: false,
          query: currentQuery,
        } as any];
      });
    } catch (err) {
      console.error('Query failed:', err);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), {
          ...last,
          content: 'System error: Failed to retrieve graph-augmented response.',
          isLoading: false,
        }];
      });
    }
  };

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && !m.isLoading);

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
                    <span className="headline-lg text-2xl animate-pulse tracking-widest">AGENTS_RUNNING_</span>
                  </div>
                ) : (
                  <>
                    <p className={`${msg.role === 'user' ? 'text-white' : 'text-foreground'} font-medium text-sm md:text-lg leading-relaxed whitespace-pre-wrap tracking-tight`}>
                      {msg.content}
                    </p>
                    {msg.role === 'assistant' && msg.confidence !== undefined && (
                      <div className="flex flex-col gap-6 pt-6 border-t border-foreground/5">
                        <div className="flex flex-wrap gap-3">
                          <Stat label="ACCURACY" value={`${(msg.confidence * 100).toFixed(0)}%`} accent />
                          <Stat label="LATENCY" value={msg.latency ?? ''} />
                          <Stat label="EVIDENCE" value={`${msg.sources?.length ?? 0} SRC`} />
                          <Stat
                            label="CLAIMS"
                            value={`${msg.claimGraph?.nodes ? Math.max(msg.claimGraph.nodes.length - 1, 0) : 0}`}
                          />
                          {msg.contradictions && msg.contradictions.length > 0 && (
                            <Stat label="CONFLICTS" value={`${msg.contradictions.length}`} danger />
                          )}
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

      {/* Right Panel: live agent trace + metadata */}
      <aside className="w-[450px] hidden xl:flex flex-col bg-surface overflow-hidden">
        <div className="flex border-b-thick border-foreground bg-foreground">
          <div className="flex-1 text-background p-5 label-bold text-[12px] tracking-[0.2em]">
            02. AGENT_PIPELINE_LIVE
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface">
          {!lastAssistant ? (
            <div className="border-thick border-foreground bg-muted-background p-8 grid-bg flex flex-col items-center justify-center min-h-[300px]">
              <Terminal size={48} className="opacity-20 mb-4" />
              <span className="label-bold text-[10px] tracking-widest opacity-50 uppercase">
                AWAITING_QUERY
              </span>
            </div>
          ) : (
            <>
              <AgentTrace trace={lastAssistant.agentTrace} />

              {lastAssistant.contradictions && lastAssistant.contradictions.length > 0 && (
                <div className="border-thick border-red-600 bg-red-50 p-4">
                  <div className="label-bold text-[10px] tracking-widest text-red-700 mb-2">
                    ⚠ {lastAssistant.contradictions.length} CONTRADICTION{lastAssistant.contradictions.length > 1 ? 'S' : ''}_DETECTED
                  </div>
                  <p className="text-[10px] uppercase opacity-70">
                    Synthesizer addressed conflict in the response.
                  </p>
                </div>
              )}

              <div className="border-thick border-foreground bg-muted-background p-5">
                <div className="label-bold text-[10px] tracking-widest mb-3 border-b border-foreground/10 pb-2">
                  PIPELINE_METADATA
                </div>
                <dl className="space-y-2 font-mono text-[10px]">
                  <Row k="EVIDENCE_CHAIN" v={`${lastAssistant.evidenceChain?.length ?? 0} CLAIMS`} />
                  <Row k="CLAIM_NODES" v={`${Math.max((lastAssistant.claimGraph?.nodes.length ?? 1) - 1, 0)}`} />
                  <Row k="CLAIM_EDGES" v={`${lastAssistant.claimGraph?.edges.length ?? 0}`} />
                  <Row k="ENTITY_GRAPH_NODES" v={`${lastAssistant.knowledgeGraph?.nodes.length ?? 0}`} />
                  <Row k="TOP_CHUNKS" v={`${lastAssistant.topChunks?.length ?? 0}`} />
                  <Row k="LATENCY" v={lastAssistant.latency ?? ''} />
                </dl>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  const bg = danger ? 'bg-red-600 text-white' : accent ? 'bg-accent text-white' : 'bg-foreground text-background';
  return (
    <div className="flex flex-col">
      <span className="label-bold text-[8px] opacity-40 mb-1">{label}</span>
      <span className={`px-3 py-1 label-bold text-[10px] ${bg}`}>{value}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="opacity-40 uppercase tracking-tighter">{k}</span>
      <span className="label-bold">{v}</span>
    </div>
  );
}
