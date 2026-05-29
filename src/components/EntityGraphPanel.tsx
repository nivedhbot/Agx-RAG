import React, { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../lib/api';

type RawNode = { id: string; label: string; type: string; source?: string | null; centrality: number; confidence: number };
type RawEdge = { id: string; source: string; target: string; label: string; weight: number };
type RawGraph = { nodes: RawNode[]; edges: RawEdge[] };

// chunkIds: every chunk this entity is mentioned in. docs: the set of distinct
// source documents those chunks belong to (per-document provenance). An entity
// with docs.size > 1 bridges documents.
type EntityNode = { id: string; centrality: number; chunkIds: string[]; docs: string[] };
type EntityEdge = { id: string; source: string; target: string; label: string; sharedChunks: string[] };

const MAX_RENDERED = 80;
const TRIM_THRESHOLD = 200;

const HIGH_COLOR = '#C4501A';
const LOW_COLOR = '#D9D2C4';
// Per-document filter palette. SIENNA highlights entities in the selected doc;
// a deeper shade marks entities that also appear in other docs (bridges);
// muted gray fades out entities absent from the selection.
const DOC_HIGHLIGHT = '#A0522D';
const DOC_BRIDGE = '#6B2E12';
const DOC_MUTED = '#C9C3B6';

const ALL_DOCUMENTS = '__ALL__';

export default function EntityGraphPanel({ activeSessionId }: { activeSessionId?: string | null }) {
  const [raw, setRaw] = useState<RawGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<{ id: string; x: number; y: number; label: string } | null>(null);
  const [hoverNode, setHoverNode] = useState<{ id: string; x: number; y: number } | null>(null);
  const [reasoningIds, setReasoningIds] = useState<Set<string>>(new Set());
  const [reasoningQuery, setReasoningQuery] = useState<string | null>(null);
  const [highlightOn, setHighlightOn] = useState(true);
  // Per-document filter: ALL_DOCUMENTS (merged) or one document's source name.
  const [docFilter, setDocFilter] = useState<string>(ALL_DOCUMENTS);

  useEffect(() => {
    // The entity graph is session-scoped; /api/graph requires session_id.
    if (!activeSessionId) {
      setRaw({ nodes: [], edges: [] });
      setError(null);
      return;
    }
    setRaw(null);
    setError(null);
    authFetch(`/api/graph?session_id=${encodeURIComponent(activeSessionId)}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(json => setRaw(json))
      .catch(err => setError(err.message));
  }, [activeSessionId]);

  useEffect(() => {
    try {
      const ids = sessionStorage.getItem('agx_reasoning_entity_ids');
      const q = sessionStorage.getItem('agx_reasoning_query');
      if (ids) setReasoningIds(new Set(JSON.parse(ids)));
      if (q) setReasoningQuery(q);
    } catch {
      /* ignore */
    }
  }, []);

  const hasReasoning = reasoningIds.size > 0;
  const highlightActive = highlightOn && hasReasoning;

  // chunkId -> source document name, derived from the chunk nodes.
  const chunkSourceById = useMemo(() => {
    const map = new Map<string, string>();
    raw?.nodes.forEach(n => {
      if (n.type === 'chunk' && n.source) map.set(n.id, n.source);
    });
    return map;
  }, [raw]);

  // Distinct source documents present in this session's graph (for the filter).
  const documents = useMemo(() => {
    const set = new Set<string>();
    chunkSourceById.forEach(src => set.add(src));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [chunkSourceById]);

  const projection = useMemo(
    () => projectEntityGraph(raw, reasoningIds, chunkSourceById),
    [raw, reasoningIds, chunkSourceById],
  );
  const chunkLabelById = useMemo(() => {
    const map = new Map<string, string>();
    raw?.nodes.forEach(n => {
      if (n.type === 'chunk') map.set(n.id, n.label);
    });
    return map;
  }, [raw]);

  // A document selected in the graph that no longer exists (e.g. after a delete)
  // falls back to the merged view.
  useEffect(() => {
    if (docFilter !== ALL_DOCUMENTS && !documents.includes(docFilter)) {
      setDocFilter(ALL_DOCUMENTS);
    }
  }, [documents, docFilter]);

  if (error) {
    return (
      <PanelShell>
        <div className="flex items-center justify-center min-h-[420px]">
          <span className="label-bold text-[10px] tracking-widest text-red-600 uppercase">
            ENTITY_GRAPH_LOAD_FAILED · {error}
          </span>
        </div>
      </PanelShell>
    );
  }

  if (!raw) {
    return (
      <PanelShell>
        <div className="flex items-center justify-center min-h-[420px]">
          <span className="label-bold text-[10px] tracking-widest opacity-40 uppercase">LOADING_ENTITY_GRAPH...</span>
        </div>
      </PanelShell>
    );
  }

  if (!projection || projection.entities.length === 0) {
    return (
      <PanelShell>
        <div className="flex items-center justify-center min-h-[420px]">
          <span className="label-bold text-[10px] tracking-widest opacity-50 uppercase">
            NO_ENTITIES_EXTRACTED · INGEST_DOCUMENTS_TO_BUILD_GRAPH
          </span>
        </div>
      </PanelShell>
    );
  }

  const { entities, edges, totalEntities, trimmed } = projection;
  const W = 720;
  const H = 520;
  const positions = layoutNodes(entities, W, H);
  const maxCentrality = Math.max(1, ...entities.map(e => e.centrality));
  const selected = selectedId ? entities.find(e => e.id === selectedId) ?? null : null;
  const adjacency = buildAdjacency(edges);

  // Per-document filter state. When a document is selected, entities mentioned
  // in it are highlighted (sienna, larger); entities that ALSO appear in other
  // documents are bridges (deeper sienna); everything else is muted and its
  // edges faded. inSelectedDoc(id) answers "is this entity in the selected doc".
  const docFiltered = docFilter !== ALL_DOCUMENTS;
  const inSelectedDoc = (e: EntityNode) => e.docs.includes(docFilter);
  const isBridge = (e: EntityNode) => docFiltered && inSelectedDoc(e) && e.docs.length > 1;

  return (
    <PanelShell>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-foreground/10 bg-surface flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="label-bold text-[10px] tracking-widest opacity-60">
            {hasReasoning
              ? `LAST_QUERY · ${truncate(reasoningQuery ?? '', 48)}`
              : 'NO_QUERY_YET · RUN_A_REASONING_LAB_QUERY_TO_HIGHLIGHT_PATH'}
          </div>
          {documents.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="label-bold text-[9px] tracking-widest opacity-50">VIEW_BY_DOCUMENT</span>
              <select
                value={docFilter}
                onChange={e => { setDocFilter(e.target.value); setSelectedId(null); }}
                className="label-bold text-[9px] tracking-widest bg-surface border-thick border-foreground px-2 py-1.5 uppercase max-w-[220px] focus:outline-none focus:bg-muted-background"
              >
                <option value={ALL_DOCUMENTS}>ALL_DOCUMENTS</option>
                {documents.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {hasReasoning && (
          <button
            type="button"
            onClick={() => setHighlightOn(v => !v)}
            className={`label-bold text-[10px] tracking-[0.2em] px-4 py-2 border-thick border-foreground transition-colors ${
              highlightActive
                ? 'bg-accent text-white'
                : 'bg-surface text-foreground hover:bg-foreground hover:text-background'
            }`}
          >
            {highlightActive ? 'HIDE_REASONING_PATH' : 'SHOW_REASONING_PATH'}
          </button>
        )}
      </div>
      <div className="flex flex-col lg:flex-row gap-0">
        <div className="flex-1 relative bg-muted-background grid-bg border-r-0 lg:border-r border-foreground/10 min-h-[520px]">
          {trimmed && (
            <div className="absolute top-4 left-4 right-4 bg-foreground text-background px-3 py-2 label-bold text-[9px] tracking-widest z-10">
              SHOWING TOP 80 NODES BY CENTRALITY · TOTAL_ENTITIES {totalEntities}
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            <g>
              {edges.map(e => {
                const a = positions.get(e.source);
                const b = positions.get(e.target);
                if (!a || !b) return null;
                const isHover = hoverEdge?.id === e.id;
                // In doc-filtered view, an edge is "active" only when BOTH
                // endpoints are in the selected document; others fade to 20%.
                const srcNode = entities.find(n => n.id === e.source);
                const tgtNode = entities.find(n => n.id === e.target);
                const edgeActive = !docFiltered
                  || (!!srcNode && !!tgtNode && inSelectedDoc(srcNode) && inSelectedDoc(tgtNode));
                const baseOpacity = docFiltered ? (edgeActive ? 0.35 : 0.05) : 0.18;
                return (
                  <line
                    key={e.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={isHover ? HIGH_COLOR : '#1C1410'}
                    strokeWidth={isHover ? 1.6 : 0.5}
                    strokeOpacity={isHover ? 0.9 : baseOpacity}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {
                      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                      setHoverEdge({ id: e.id, x: mid.x, y: mid.y, label: `${e.label} · ${e.sharedChunks.length} CHUNK${e.sharedChunks.length > 1 ? 'S' : ''}` });
                    }}
                    onMouseLeave={() => setHoverEdge(prev => (prev?.id === e.id ? null : prev))}
                  />
                );
              })}
            </g>

            <g>
              {entities.map(node => {
                const p = positions.get(node.id);
                if (!p) return null;
                const ratio = node.centrality / maxCentrality;
                const baseRadius = 5 + ratio * 14;
                const isOnPath = highlightActive && reasoningIds.has(node.id);
                const inDoc = docFiltered && inSelectedDoc(node);
                const bridge = isBridge(node);
                // Doc-filtered view overrides centrality colouring: highlight
                // in-doc entities (larger + sienna; deeper sienna if they also
                // appear in other docs), mute the rest.
                const r = docFiltered
                  ? (inDoc ? baseRadius + 4 : Math.max(3, baseRadius - 2))
                  : (isOnPath ? baseRadius + 3 : baseRadius);
                const fill = docFiltered
                  ? (inDoc ? (bridge ? DOC_BRIDGE : DOC_HIGHLIGHT) : DOC_MUTED)
                  : (ratio > 0.5 ? HIGH_COLOR : LOW_COLOR);
                const isSelected = selectedId === node.id;
                const stroke = docFiltered
                  ? (inDoc ? (bridge ? DOC_BRIDGE : DOC_HIGHLIGHT) : '#B0A99C')
                  : (isOnPath ? HIGH_COLOR : isSelected ? HIGH_COLOR : '#1C1410');
                const strokeWidth = isSelected ? 3 : (docFiltered ? (inDoc ? 2 : 0.5) : (isOnPath ? 3 : 1));
                const nodeOpacity = docFiltered && !inDoc ? 0.4 : 1;
                const showLabel = docFiltered ? inDoc : (ratio > 0.35 || isOnPath);
                const labelFill = docFiltered
                  ? (bridge ? DOC_BRIDGE : DOC_HIGHLIGHT)
                  : (isOnPath ? HIGH_COLOR : '#1C1410');
                return (
                  <g
                    key={node.id}
                    style={{ cursor: 'pointer' }}
                    opacity={nodeOpacity}
                    onClick={() => setSelectedId(prev => (prev === node.id ? null : node.id))}
                    onMouseEnter={() => setHoverNode({ id: node.id, x: p.x, y: p.y - r - 6 })}
                    onMouseLeave={() => setHoverNode(prev => (prev?.id === node.id ? null : prev))}
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                    {showLabel && (
                      <text
                        x={p.x}
                        y={p.y + r + 10}
                        textAnchor="middle"
                        fontFamily="Inter, Arial, sans-serif"
                        fontSize={9}
                        fontWeight={700}
                        fill={labelFill}
                        style={{ letterSpacing: '0.05em', textTransform: 'uppercase', pointerEvents: 'none' }}
                      >
                        {truncate(node.id, 16)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {hoverEdge && (
              <g pointerEvents="none">
                <rect
                  x={hoverEdge.x - 80}
                  y={hoverEdge.y - 22}
                  width={160}
                  height={18}
                  fill="#1C1410"
                />
                <text
                  x={hoverEdge.x}
                  y={hoverEdge.y - 9}
                  textAnchor="middle"
                  fontFamily="Inter, Arial, sans-serif"
                  fontSize={9}
                  fontWeight={700}
                  fill="#FFFFFF"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  {truncate(hoverEdge.label, 28)}
                </text>
              </g>
            )}

            {hoverNode && (() => {
              const full = hoverNode.id.toUpperCase();
              const tw = Math.max(40, full.length * 6 + 16);
              return (
                <g pointerEvents="none">
                  <rect
                    x={hoverNode.x - tw / 2}
                    y={hoverNode.y - 18}
                    width={tw}
                    height={18}
                    fill="#1C1410"
                  />
                  <text
                    x={hoverNode.x}
                    y={hoverNode.y - 5}
                    textAnchor="middle"
                    fontFamily="Inter, Arial, sans-serif"
                    fontSize={9}
                    fontWeight={700}
                    fill="#FFFFFF"
                    style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    {full}
                  </text>
                </g>
              );
            })()}
          </svg>

          <div className="absolute bottom-4 left-4 bg-white border border-foreground/20 p-3 space-y-2 shadow-md">
            {docFiltered ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: DOC_HIGHLIGHT }} />
                  <span className="label-bold text-[8px] tracking-widest">IN_THIS_DOCUMENT</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: DOC_BRIDGE }} />
                  <span className="label-bold text-[8px] tracking-widest">SHARED_ACROSS_DOCS</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: DOC_MUTED, border: '1px solid #B0A99C' }} />
                  <span className="label-bold text-[8px] tracking-widest opacity-60">OTHER_DOCUMENTS</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: HIGH_COLOR }} />
                  <span className="label-bold text-[8px] tracking-widest">HIGH_CENTRALITY</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: LOW_COLOR, border: '1px solid #1C1410' }} />
                  <span className="label-bold text-[8px] tracking-widest">LOW_CENTRALITY</span>
                </div>
                {highlightActive && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-white" style={{ border: `3px solid ${HIGH_COLOR}` }} />
                    <span className="label-bold text-[8px] tracking-widest">REASONING_PATH</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="absolute bottom-4 right-4 bg-foreground text-background px-3 py-2 label-bold text-[9px] tracking-widest">
            {entities.length} NODES · {edges.length} EDGES
          </div>
        </div>

        <aside className="w-full lg:w-[300px] bg-surface p-6 space-y-5 min-h-[300px]">
          <div className="label-bold text-[10px] tracking-widest text-accent border-b border-foreground/10 pb-2">
            ENTITY_DETAIL
          </div>
          {!selected ? (
            <p className="label-bold text-[10px] opacity-50 tracking-widest uppercase leading-relaxed">
              CLICK A NODE TO INSPECT
            </p>
          ) : (
            <>
              <div>
                <div className="label-bold text-[9px] opacity-50 mb-1">ENTITY</div>
                <div className="label-bold text-sm tracking-tight uppercase break-words">{selected.id}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="RELATIONS" value={`${adjacency.get(selected.id)?.size ?? 0}`} />
                <Stat label="CENTRALITY" value={`${selected.centrality}`} />
              </div>

              {/* Per-document provenance. In a filtered view we scope to the
                  selected document; otherwise we list every document the entity
                  appears in (and flag cross-document bridges). */}
              <div>
                <div className="label-bold text-[9px] opacity-50 mb-2">
                  MENTIONED_IN · {docFiltered ? 1 : selected.docs.length} DOC{(docFiltered ? 1 : selected.docs.length) === 1 ? '' : 'S'}
                </div>
                <ul className="space-y-1.5">
                  {(docFiltered ? [docFilter] : selected.docs).map(d => (
                    <li key={d} className="font-mono text-[10px] leading-snug border-l-2 border-accent pl-2 break-all">
                      {d}
                    </li>
                  ))}
                  {!docFiltered && selected.docs.length === 0 && (
                    <li className="label-bold text-[9px] opacity-40 tracking-widest">NO_SOURCE_RECORDED</li>
                  )}
                </ul>
                {!docFiltered && selected.docs.length > 1 && (
                  <div className="label-bold text-[8px] tracking-widest mt-2 px-2 py-1 inline-block" style={{ background: DOC_BRIDGE, color: '#fff' }}>
                    BRIDGES_{selected.docs.length}_DOCUMENTS
                  </div>
                )}
              </div>

              {(() => {
                // Chunks to show: scoped to the selected document when filtering,
                // otherwise every chunk the entity appears in.
                const shownChunks = docFiltered
                  ? selected.chunkIds.filter(cid => chunkSourceById.get(cid) === docFilter)
                  : selected.chunkIds;
                return (
                  <div>
                    <div className="label-bold text-[9px] opacity-50 mb-2">
                      {docFiltered ? 'CHUNKS_IN_DOCUMENT' : 'MENTIONED_IN_CHUNKS'} · {shownChunks.length}
                    </div>
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {shownChunks.slice(0, 12).map(cid => (
                        <li key={cid} className="font-mono text-[10px] leading-snug border-l-2 border-accent pl-2 opacity-80">
                          {chunkLabelById.get(cid) ?? cid}
                        </li>
                      ))}
                      {shownChunks.length > 12 && (
                        <li className="label-bold text-[9px] opacity-40 tracking-widest pt-1">
                          +{shownChunks.length - 12} MORE
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })()}
            </>
          )}
        </aside>
      </div>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-thick border-foreground bg-surface overflow-hidden">
      <div className="flex items-center justify-between bg-foreground text-background px-5 py-3">
        <div className="label-bold text-[11px] tracking-[0.2em]">ENTITY_GRAPH_</div>
        <div className="label-bold text-[9px] opacity-60 tracking-widest">CO_MENTION_PROJECTION</div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-foreground/10 p-3">
      <div className="label-bold text-[8px] opacity-50 mb-1">{label}</div>
      <div className="text-xl font-[900] tracking-tighter text-accent">{value}</div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.substring(0, n - 1) + '…' : s;
}

function projectEntityGraph(
  raw: RawGraph | null,
  reasoningIds: Set<string> = new Set(),
  chunkSourceById: Map<string, string> = new Map(),
) {
  if (!raw) return null;

  const entityChunks = new Map<string, Set<string>>();
  for (const node of raw.nodes) {
    if (node.type === 'entity') entityChunks.set(node.id, new Set());
  }

  for (const edge of raw.edges) {
    if (entityChunks.has(edge.source)) {
      entityChunks.get(edge.source)!.add(edge.target);
    }
  }

  const totalEntities = entityChunks.size;
  let entries = Array.from(entityChunks.entries()).map(([id, chunks]) => {
    const chunkIds = Array.from(chunks);
    // Distinct documents this entity is mentioned in (per-document provenance).
    const docs = new Set<string>();
    for (const cid of chunkIds) {
      const src = chunkSourceById.get(cid);
      if (src) docs.add(src);
    }
    return {
      id,
      centrality: chunks.size,
      chunkIds,
      docs: Array.from(docs),
    };
  });
  entries.sort((a, b) => b.centrality - a.centrality);

  const trimmed = totalEntities > TRIM_THRESHOLD;
  if (trimmed) {
    const top = entries.slice(0, MAX_RENDERED);
    const keptIdSet = new Set(top.map(e => e.id));
    const reasoningExtras = entries.filter(e => reasoningIds.has(e.id) && !keptIdSet.has(e.id));
    entries = [...top, ...reasoningExtras];
  }

  const keptIds = new Set(entries.map(e => e.id));
  const chunkToEntities = new Map<string, string[]>();
  for (const e of entries) {
    for (const cid of e.chunkIds) {
      if (!chunkToEntities.has(cid)) chunkToEntities.set(cid, []);
      chunkToEntities.get(cid)!.push(e.id);
    }
  }

  const edgeMap = new Map<string, EntityEdge>();
  for (const [chunkId, ents] of chunkToEntities.entries()) {
    if (ents.length < 2) continue;
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = ents[i];
        const b = ents[j];
        if (!keptIds.has(a) || !keptIds.has(b)) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const existing = edgeMap.get(key);
        if (existing) {
          existing.sharedChunks.push(chunkId);
        } else {
          edgeMap.set(key, {
            id: key,
            source: a < b ? a : b,
            target: a < b ? b : a,
            label: 'co-mentioned',
            sharedChunks: [chunkId],
          });
        }
      }
    }
  }

  return {
    entities: entries as EntityNode[],
    edges: Array.from(edgeMap.values()),
    totalEntities,
    trimmed,
  };
}

function layoutNodes(entities: EntityNode[], W: number, H: number) {
  const positions = new Map<string, { x: number; y: number }>();
  const cx = W / 2;
  const cy = H / 2;
  const n = entities.length;
  if (n === 0) return positions;

  if (n === 1) {
    positions.set(entities[0].id, { x: cx, y: cy });
    return positions;
  }

  const sorted = [...entities].sort((a, b) => b.centrality - a.centrality);
  const ringSize = Math.ceil(Math.sqrt(n));
  const rings: EntityNode[][] = [];
  let cursor = 0;
  let ring = 0;
  while (cursor < sorted.length) {
    const count = ring === 0 ? Math.min(1 + ring, sorted.length - cursor) : Math.min(ringSize + ring * 2, sorted.length - cursor);
    rings.push(sorted.slice(cursor, cursor + count));
    cursor += count;
    ring++;
  }

  const maxRadius = Math.min(W, H) / 2 - 40;
  // Spread the central cluster so inner-ring nodes don't overlap. This panel
  // uses a deterministic ring layout rather than d3-force, so the requested
  // "charge strength -300" repulsion is expressed here as (a) a minimum radius
  // floor that pushes the first populated ring well off centre and (b) a
  // power-curve distribution that fans the inner rings outward.
  const MIN_RING_RADIUS = 70;
  rings.forEach((ringNodes, idx) => {
    let radius: number;
    if (rings.length === 1) {
      radius = 0;
    } else {
      const t = Math.pow(idx / Math.max(rings.length - 1, 1), 0.7);
      radius = idx === 0 ? 0 : MIN_RING_RADIUS + t * (maxRadius - MIN_RING_RADIUS);
    }
    const phase = -Math.PI / 2 + (idx % 2) * 0.18;
    ringNodes.forEach((node, i) => {
      if (radius === 0) {
        positions.set(node.id, { x: cx, y: cy });
      } else {
        const angle = phase + (2 * Math.PI * i) / Math.max(ringNodes.length, 1);
        positions.set(node.id, {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      }
    });
  });

  return positions;
}

function buildAdjacency(edges: EntityEdge[]) {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}
