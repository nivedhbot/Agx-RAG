import React, { useMemo } from 'react';

export interface Claim {
  id: string;
  text: string;
  sourceChunkId: string;
  source: string;
  confidence: number;
}

export interface ClaimEdge {
  source: string;
  target: string;
  relation: 'supports' | 'contradicts' | 'elaborates';
  nliScore: number;
}

export interface ClaimGraph {
  nodes: Claim[];
  edges: ClaimEdge[];
  queryNodeId: string;
}

const EDGE_COLOR: Record<ClaimEdge['relation'], string> = {
  supports: '#1F8A3D',
  contradicts: '#C42626',
  elaborates: '#1F4FAD',
};

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function ClaimGraphPanel({
  graph,
  contradictionsCount = 0,
}: {
  graph?: ClaimGraph;
  contradictionsCount?: number;
}) {
  const layout = useMemo(() => {
    if (!graph || !graph.nodes?.length) return null;
    const W = 540, H = 460, CX = W / 2, CY = H / 2;

    const claims = graph.nodes.filter(n => n.id !== graph.queryNodeId);
    const positions = new Map<string, { x: number; y: number; isQuery: boolean }>();

    positions.set(graph.queryNodeId, { x: CX, y: CY, isQuery: true });

    const radius = 180;
    claims.forEach((node, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(claims.length, 1);
      positions.set(node.id, {
        x: CX + radius * Math.cos(a),
        y: CY + radius * Math.sin(a),
        isQuery: false,
      });
    });

    return { W, H, positions };
  }, [graph]);

  if (!graph || !layout) {
    return (
      <div className="border-thick border-foreground bg-muted-background grid-bg relative p-8 min-h-[460px] flex items-center justify-center">
        <span className="label-bold text-[10px] tracking-widest opacity-50 uppercase">
          NO_CLAIM_GRAPH · RUN_A_QUERY
        </span>
      </div>
    );
  }

  const { W, H, positions } = layout;
  const NODE_W_CLAIM = 130;
  const NODE_H = 30;

  return (
    <div className="border-thick border-foreground bg-muted-background grid-bg relative p-4 md:p-6 min-h-[460px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow-supports" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR.supports} />
          </marker>
          <marker id="arrow-contradicts" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR.contradicts} />
          </marker>
          <marker id="arrow-elaborates" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR.elaborates} />
          </marker>
        </defs>

        <g>
          {graph.edges.map((e, idx) => {
            const a = positions.get(e.source);
            const b = positions.get(e.target);
            if (!a || !b) return null;
            const stroke = EDGE_COLOR[e.relation];
            return (
              <line
                key={idx}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={e.relation === 'contradicts' ? 1.6 : 1.0}
                strokeOpacity={0.7}
                markerEnd={`url(#arrow-${e.relation})`}
                strokeDasharray={e.relation === 'elaborates' ? '4 3' : undefined}
              />
            );
          })}
        </g>

        <g>
          {graph.nodes.map(n => {
            const p = positions.get(n.id);
            if (!p) return null;
            const w = p.isQuery ? 150 : NODE_W_CLAIM;
            const fill = p.isQuery ? '#C4501A' : '#FFFFFF';
            const stroke = '#1C1410';
            const textColor = p.isQuery ? '#FFFFFF' : '#1C1410';
            const label = p.isQuery
              ? `QUERY · ${truncate(n.text, 14)}`
              : `${n.source.slice(0, 8)} · ${truncate(n.text, 18)}`;
            return (
              <g key={n.id}>
                <rect
                  x={p.x - w / 2}
                  y={p.y - NODE_H / 2}
                  width={w}
                  height={NODE_H}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={p.isQuery ? 2.5 : 1}
                />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fontFamily="Inter, Arial, sans-serif"
                  fontSize={p.isQuery ? 10 : 9}
                  fontWeight={700}
                  fill={textColor}
                  style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 bg-white border border-foreground p-3 space-y-2 shadow-md">
        <Legend color={EDGE_COLOR.supports} label="SUPPORTS" />
        <Legend color={EDGE_COLOR.contradicts} label="CONTRADICTS" />
        <Legend color={EDGE_COLOR.elaborates} label="ELABORATES" dashed />
      </div>

      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <div className="bg-foreground text-background px-3 py-2 label-bold text-[9px] tracking-widest">
          {graph.nodes.length} CLAIMS · {graph.edges.length} EDGES
        </div>
        {contradictionsCount > 0 && (
          <div className="bg-red-600 text-white px-3 py-2 label-bold text-[9px] tracking-widest">
            ⚠ {contradictionsCount} CONTRADICTION{contradictionsCount > 1 ? 'S' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg width="20" height="6" className="shrink-0">
        <line
          x1="0"
          y1="3"
          x2="20"
          y2="3"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
      <span className="label-bold text-[8px] tracking-widest">{label}</span>
    </div>
  );
}
