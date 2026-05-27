import React, { useState } from 'react';

export interface AgentTraceEntry {
  agent: string;
  action: string;
  detail?: string;
  durationMs: number;
  meta?: Record<string, unknown>;
}

const AGENT_LABEL: Record<string, string> = {
  orchestrator: 'ORCHESTRATOR',
  retriever: 'RETRIEVER',
  verifier: 'VERIFIER',
  graphReasoner: 'GRAPH_REASONER',
  synthesizer: 'SYNTHESIZER',
};

export function AgentTrace({
  trace,
  compact = false,
}: {
  trace?: AgentTraceEntry[];
  compact?: boolean;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!trace || trace.length === 0) {
    return (
      <div className="border-thick border-foreground bg-muted-background p-6 min-h-[120px] flex items-center justify-center">
        <span className="label-bold text-[10px] tracking-widest opacity-50 uppercase">
          AGENT_TRACE_EMPTY
        </span>
      </div>
    );
  }

  return (
    <div className="border-thick border-foreground bg-surface">
      {!compact && (
        <div className="border-b-thick border-foreground bg-foreground text-background px-5 py-3 flex items-center justify-between">
          <span className="label-bold text-[11px] tracking-[0.2em]">AGENT_EXECUTION_TRACE</span>
          <span className="label-bold text-[10px] opacity-70">{trace.length} STEPS</span>
        </div>
      )}
      <ol className="divide-y divide-foreground/10">
        {trace.map((entry, i) => {
          const isOpen = openIdx === i;
          const isError = entry.detail?.startsWith('error:');
          return (
            <li key={i} className="px-4 py-3">
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-center gap-3 text-left group"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-foreground text-background text-[9px] label-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`label-bold text-[10px] tracking-[0.15em] ${
                        isError ? 'text-red-600' : 'text-accent'
                      }`}
                    >
                      {AGENT_LABEL[entry.agent] ?? entry.agent.toUpperCase()}
                    </span>
                    <span className="label-bold text-[10px] opacity-60 uppercase">
                      · {entry.action}
                    </span>
                  </div>
                  {entry.detail && !compact && (
                    <p className="text-[10px] opacity-60 mt-1 truncate uppercase">
                      {entry.detail}
                    </p>
                  )}
                </div>
                <span className="label-bold text-[9px] opacity-50 shrink-0">
                  {entry.durationMs}ms
                </span>
              </button>
              {isOpen && entry.meta && Object.keys(entry.meta).length > 0 && (
                <pre className="mt-3 ml-9 bg-muted-background border border-foreground/10 p-3 text-[10px] overflow-x-auto">
                  {JSON.stringify(entry.meta, null, 2)}
                </pre>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
