import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Search, 
  Eye, 
  Trash2, 
  Network,
  SwissButton
} from './SwissUI';
import { authFetch } from '../lib/api';

export default function Dashboard({ activeSessionId, onSessionDocsChanged }: {
  activeSessionId?: string | null;
  onSessionDocsChanged?: () => void;
}) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    // Documents are session-scoped — without an active session there is nothing
    // to show (and the endpoint requires session_id).
    if (!activeSessionId) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`/api/documents?session_id=${encodeURIComponent(activeSessionId)}`);
      if (!res.ok) {
        setDocuments([]);
        return;
      }
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!activeSessionId) {
      alert('Open the Reasoning Lab and start a session before uploading documents.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', activeSessionId);

    try {
      const res = await authFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchDocuments();
        onSessionDocsChanged?.();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearCorpus = async () => {
    if (!confirm('Are you sure you want to clear the entire corpus?')) return;
    try {
      await fetch('/api/clear', { method: 'POST' });
      await fetchDocuments();
    } catch (err) {
      console.error('Clear failed:', err);
    }
  };

  const totalChunks = documents.reduce((acc, doc) => acc + (doc.chunks || 0), 0);

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {/* Hero Section */}
      <section className="mb-12">
        <p className="label-bold text-accent mb-2 tracking-widest">00. CORPUS_MANAGEMENT_TERMINAL</p>
        <h1 className="text-4xl md:text-7xl font-[900] mb-6 tracking-tighter uppercase leading-[0.9]">Documentation_Repository</h1>
        <p className="text-on-surface-variant max-w-2xl label-bold text-xs leading-relaxed opacity-80 uppercase tracking-widest">
          The ingestion core maps raw PDF buffers into high-dimensional vector spaces. 
          Monitor edge-distribution and graph-density in real-time.
        </p>
      </section>

      {/* Stats Panel */}
      <section className="grid grid-cols-2 md:grid-cols-4 border-thick border-foreground mb-12 shadow-[8px_8px_0px_#00000010]">
        {[
          { label: 'SOURCE_NODES', value: documents.length.toString() },
          { label: 'CHUNK_DENSITY', value: totalChunks.toString() },
          { label: 'GRAPH_VERTICES', value: (totalChunks * 4.2).toFixed(0) },
          { label: 'TRAVERSAL_SPEED', value: '0.84S' },
        ].map((stat, i) => (
          <div key={i} className={`p-6 md:p-8 grid-bg bg-surface border-foreground ${i < 3 ? 'border-r-thin' : ''} ${i < 2 ? 'border-b-thin md:border-b-0 text-foreground' : 'text-accent'}`}>
            <p className="label-bold text-[9px] mb-2 uppercase opacity-60">{stat.label}</p>
            <p className="text-3xl md:text-5xl font-[900] tracking-tighter">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
        {/* Upload Zone */}
        <aside className="xl:col-span-4 xl:sticky xl:top-[120px]">
          <div className="border-thick border-foreground p-8 bg-surface shadow-sm">
            <h2 className="label-bold text-xs mb-6 border-b border-foreground/10 pb-2">INGESTION_MODULE_</h2>
            <div 
              className="border-thick border-dashed border-muted-text/30 p-10 text-center mb-6 hover:bg-muted-background transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".pdf" 
                onChange={handleFileUpload} 
              />
              <div className="w-16 h-16 bg-accent mx-auto mb-6 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                <UploadCloud size={32} className={uploading ? 'animate-bounce' : ''} />
              </div>
              <p className="label-bold text-xs mb-2 uppercase">{uploading ? 'INGESTING...' : 'DROP_SOURCE_NODES'}</p>
              <p className="label-bold text-[8px] opacity-40 uppercase">OR CLICK TO BROWSE LOCAL FILES</p>
            </div>
            <SwissButton 
              variant="accent" 
              className="w-full py-5 mb-4 text-xs tracking-widest shadow-md"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'SYNCHRONIZING...' : 'UPLOAD NEW SOURCE'}
            </SwissButton>
            <p className="text-center label-bold text-[8px] opacity-40 uppercase">MAX_FILE_SIZE: 50.00MB_PDF</p>
          </div>
          
          <div className="mt-8 border-thin swiss-border bg-foreground text-background p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 dot-pattern opacity-10 pointer-events-none" />
            <p className="label-bold mb-4 text-accent text-xs tracking-widest uppercase">System_State_</p>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="label-bold text-xs uppercase tracking-tighter">Corpus_Interface_Active</span>
            </div>
            <button 
              onClick={handleClearCorpus}
              className="w-full py-3 border border-white/20 text-[9px] label-bold hover:bg-red-600 hover:border-red-600 transition-all uppercase tracking-widest"
            >
              PURGE_SYSTEM_CORE
            </button>
          </div>
        </aside>

        {/* Document Table */}
        <section className="xl:col-span-8">
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-end gap-4">
            <div className="w-full sm:w-auto">
              <p className="label-bold text-accent mb-2 text-xs tracking-widest">01. SOURCE_INVENTORY</p>
              <h2 className="text-3xl md:text-5xl font-[900] tracking-tighter uppercase">Corpus_Nodes</h2>
            </div>
            <div className="flex border-thick border-foreground w-full sm:w-auto bg-surface">
              <input 
                className="bg-transparent border-none focus:ring-0 label-bold px-6 py-3 w-full sm:w-64 text-xs" 
                placeholder="SEARCH_INDICES..." 
                type="text"
              />
              <button className="bg-foreground text-background px-6 py-3 hover:bg-accent transition-colors">
                <Search size={20} />
              </button>
            </div>
          </div>

          <div className="border-thick border-foreground overflow-hidden shadow-sm bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-foreground text-white label-bold text-[10px] tracking-widest uppercase">
                  <tr>
                    <th className="p-6 border-r border-white/10">ID</th>
                    <th className="p-6 border-r border-white/10">SOURCE_NAME</th>
                    <th className="p-6 border-r border-white/10 text-center">SEGMENTS</th>
                    <th className="p-6 border-r border-white/10">INGEST_DATE</th>
                    <th className="p-6 border-r border-white/10">STATE</th>
                    <th className="p-6">COMMANDS</th>
                  </tr>
                </thead>
                <tbody className="label-bold text-[11px] uppercase tracking-tighter">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-16 text-center opacity-30 text-xs">BUFFERING_SYSTEM_DATA...</td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-16 text-center opacity-30 text-xs">
                        {activeSessionId
                          ? 'EMPTY_REPOSITORY. UPLOAD_DOCUMENTS_TO_COMMENCE.'
                          : 'NO_ACTIVE_SESSION. OPEN_REASONING_LAB_TO_SELECT_A_SESSION.'}
                      </td>
                    </tr>
                  ) : documents.map((doc, i) => (
                    <tr 
                      key={i} 
                      className={`${i % 2 === 0 ? 'bg-surface' : 'bg-muted-background/50'} border-b border-foreground/10 hover:bg-muted-background transition-colors group`}
                    >
                      <td className="p-6 border-r border-foreground/10 text-accent font-[900]">#{doc.id?.substring(0, 4) || 'NULL'}</td>
                      <td className="p-6 border-r border-foreground/10 font-[900] truncate max-w-[200px]">{doc.name}</td>
                      <td className="p-6 border-r border-foreground/10 text-center">{doc.chunks || 0}</td>
                      <td className="p-6 border-r border-foreground/10 whitespace-nowrap opacity-60">{doc.date}</td>
                      <td className="p-6 border-r border-foreground/10">
                        <span className={`px-3 py-1 text-[9px] tracking-widest ${doc.status === 'Processed' ? 'bg-foreground text-background' : 'bg-accent text-white'}`}>
                          {doc.status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex gap-4">
                          <button className="opacity-30 hover:opacity-100 hover:text-accent transition-all">
                            <Eye size={18} />
                          </button>
                          <button className="opacity-30 hover:opacity-100 hover:text-red-600 transition-all">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 p-10 border-thick border-foreground bg-accent text-white relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 bg-white dot-pattern group-hover:scale-110 transition-transform duration-1000" />
            <div className="relative z-10">
              <p className="label-bold text-white/60 mb-2 text-xs tracking-widest uppercase">Optimization_Routine</p>
              <h3 className="text-3xl md:text-5xl font-[900] mb-4 tracking-tighter uppercase">Graph_Vertex_Refinement</h3>
              <p className="label-bold text-xs uppercase max-w-xl mb-8 leading-relaxed opacity-80">
                Current system utilizes hybrid re-ranking f(d) = αS + βGc. Edge clustering increases cross-document recall by 42% on aggregate benchmarks.
              </p>
              <SwissButton variant="secondary" className="bg-transparent border-white text-white hover:bg-white hover:text-accent">RE-CALCULATE_GRAPH</SwissButton>
            </div>
            <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-20 hidden md:block">
              <Network size={160} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
