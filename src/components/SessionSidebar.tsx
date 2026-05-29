import React, { useEffect, useRef, useState } from 'react';
import { PlusSquare, Trash2, FileText, Terminal, UploadCloud } from './SwissUI';
import { authFetch } from '../lib/api';

export interface SessionSummary {
  id: string;
  title: string;
  created_at: string;
  last_active: string;
  document_count: number;
  message_count: number;
}

export interface SessionDocument {
  id: string;
  filename: string;
  chunk_count: number;
}

interface SessionSidebarProps {
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  // Incrementing number — when it changes the list refetches (e.g. after a new
  // session is created or a title auto-updates from the first query).
  reloadSignal: number;
  // Documents belonging to the active session, shown under its title.
  documents: SessionDocument[];
  onUpload: (file: File) => void;
  uploading: boolean;
}

// Compact "time since" label, e.g. NOW / 4M / 3H / 2D.
function timeSince(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'NOW';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}M`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}D`;
  const weeks = Math.floor(days / 7);
  return `${weeks}W`;
}

export default function SessionSidebar({ activeSessionId, onSelect, onNew, reloadSignal, documents, onUpload, uploading }: SessionSidebarProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await authFetch('/api/sessions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setError(null);
    } catch (err: any) {
      setError(String(err.message || err).toUpperCase());
    }
  };

  useEffect(() => {
    load();
  }, [reloadSignal]);

  const handleDelete = async (id: string) => {
    setMenuFor(null);
    try {
      const res = await authFetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) onSelect(''); // signal parent the active one is gone
    } catch (err: any) {
      setError(String(err.message || err).toUpperCase());
    }
  };

  // Long-press (touch) opens the delete menu, mirroring right-click.
  const startLongPress = (id: string) => {
    longPress.current = setTimeout(() => setMenuFor(id), 550);
  };
  const cancelLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  return (
    <aside className="w-[300px] hidden lg:flex flex-col bg-surface border-r-thick border-foreground overflow-hidden">
      <div className="flex border-b-thick border-foreground bg-foreground">
        <div className="flex-1 text-background p-5 label-bold text-[12px] tracking-[0.2em]">
          01. SESSIONS
        </div>
      </div>

      <div className="p-4 border-b-thick border-foreground bg-muted-background">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 border-thick border-foreground label-bold text-[11px] tracking-widest hover:bg-foreground transition-colors"
        >
          <PlusSquare size={16} />
          NEW_SESSION
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <p className="p-4 label-bold text-[10px] text-accent leading-relaxed">ERROR · {error}</p>
        )}

        {!error && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-20 p-8 text-center">
            <Terminal size={40} strokeWidth={1} className="mb-3" />
            <span className="label-bold text-[10px] tracking-widest">NO_SESSIONS_YET</span>
          </div>
        )}

        {sessions.map(s => {
          const active = s.id === activeSessionId;
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              onContextMenu={(e) => { e.preventDefault(); setMenuFor(s.id); }}
              onTouchStart={() => startLongPress(s.id)}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              className={`relative px-4 py-3 border-b border-foreground/10 cursor-pointer transition-colors ${
                active ? 'bg-muted-background border-l-4 border-l-accent' : 'hover:bg-muted-background/50 border-l-4 border-l-transparent'
              }`}
            >
              <div className="label-bold text-[11px] tracking-wide truncate pr-2 uppercase">
                {s.title || 'NEW_SESSION'}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[9px] font-mono opacity-50">
                <span className="flex items-center gap-1">
                  <FileText size={10} />
                  {s.document_count} DOC{s.document_count === 1 ? '' : 'S'}
                </span>
                <span>·</span>
                <span>{timeSince(s.last_active)} AGO</span>
              </div>

              {/* Active session: per-session document list + upload control. */}
              {active && (
                <div className="mt-3 pt-3 border-t border-foreground/10" onClick={(e) => e.stopPropagation()}>
                  <div className="label-bold text-[8px] opacity-40 mb-2 tracking-widest">SESSION_DOCUMENTS</div>
                  {documents.length === 0 ? (
                    <p className="text-[9px] font-mono opacity-30 mb-2">NO_DOCUMENTS_YET</p>
                  ) : (
                    <ul className="space-y-1 mb-2">
                      {documents.map(d => (
                        <li key={d.id} className="flex items-center justify-between gap-2 text-[9px] font-mono">
                          <span className="flex items-center gap-1 truncate">
                            <FileText size={10} className="shrink-0 opacity-50" />
                            <span className="truncate">{d.filename}</span>
                          </span>
                          <span className="shrink-0 opacity-50">{d.chunk_count} CH</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    ref={fileInput}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(f);
                      if (fileInput.current) fileInput.current.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-2 label-bold text-[9px] tracking-widest hover:bg-accent transition-colors disabled:opacity-40"
                  >
                    <UploadCloud size={12} className={uploading ? 'animate-bounce' : ''} />
                    {uploading ? 'INGESTING...' : 'ADD_DOCUMENT'}
                  </button>
                </div>
              )}

              {menuFor === s.id && (
                <div
                  className="absolute right-2 top-2 z-10 bg-surface border-thick border-foreground shadow-[4px_4px_0px_#00000020]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="flex items-center gap-2 px-4 py-2 label-bold text-[10px] text-accent hover:bg-accent hover:text-white transition-colors"
                  >
                    <Trash2 size={12} />
                    DELETE
                  </button>
                  <button
                    onClick={() => setMenuFor(null)}
                    className="block w-full px-4 py-2 label-bold text-[9px] opacity-40 border-t border-foreground/10 hover:opacity-80"
                  >
                    CANCEL
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
