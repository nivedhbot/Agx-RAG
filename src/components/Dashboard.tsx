import React from 'react';
import { 
  UploadCloud, 
  Search, 
  Eye, 
  Trash2, 
  Network,
  SwissButton 
} from './SwissUI';

export default function Dashboard() {
  const documents = [
    { id: '01.', name: 'research_paper_2024.pdf', pages: 24, chunks: 142, entities: 89, uploaded: '2024-10-12', status: 'PROCESSED' },
    { id: '02.', name: 'system_architecture.pdf', pages: 12, chunks: 64, entities: 45, uploaded: '2024-10-14', status: 'PROCESSING' },
    { id: '03.', name: 'methodology_review.pdf', pages: 45, chunks: 210, entities: 112, uploaded: '2024-10-15', status: 'PROCESSED' },
    { id: '04.', name: 'benchmark_results.pdf', pages: 8, chunks: 32, entities: 24, uploaded: '2024-10-16', status: 'PROCESSED' },
    { id: '05.', name: 'literature_survey.pdf', pages: 60, chunks: 110, entities: 77, uploaded: '2024-10-17', status: 'PROCESSING' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-12">
      {/* Hero Section */}
      <section className="mb-16">
        <p className="label-bold text-accent mb-4">00. CORPUS MANAGEMENT</p>
        <h1 className="headline-xl text-[44px] md:text-[72px] mb-6">YOUR DOCUMENTS</h1>
        <p className="text-on-surface-variant max-w-2xl text-base md:text-lg">
          Upload, manage, and monitor your document corpus for graph-augmented retrieval. Our system processes high-volume PDF data into queryable knowledge graphs.
        </p>
      </section>

      {/* Stats Panel */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-0 border-thick border-foreground mb-16">
        {[
          { label: 'TOTAL DOCUMENTS', value: '5' },
          { label: 'TOTAL CHUNKS', value: '558' },
          { label: 'TOTAL ENTITIES', value: '347' },
          { label: 'AVG PROCESSING', value: '2.4S' },
        ].map((stat, i) => (
          <div key={i} className={`p-4 md:p-8 grid-bg bg-surface border-foreground ${i % 2 === 0 ? 'border-r-thin' : (i < 2 ? 'md:border-r-thin' : '')} ${i < 2 && 'border-b-thin md:border-b-0'} ${i === 2 ? 'md:border-r-thin' : ''}`}>
            <p className="label-bold text-[8px] md:text-[10px] text-on-surface-variant mb-2">{stat.label}</p>
            <p className="text-[32px] md:text-[48px] font-[900] text-accent uppercase">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Upload Zone */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="border-thick border-foreground p-6 md:p-8 bg-surface">
            <div className="border-thick border-dashed border-border p-8 md:p-12 text-center mb-6 hover:bg-surface-container transition-colors">
              <div className="w-16 h-16 bg-accent mx-auto mb-4 flex items-center justify-center text-surface">
                <UploadCloud size={32} />
              </div>
              <p className="label-bold mb-2">DROP PDF FILES HERE</p>
              <p className="text-on-surface-variant label-bold text-[10px]">or click to browse</p>
            </div>
            <SwissButton variant="accent" className="w-full py-6 mb-4">
              UPLOAD
            </SwissButton>
            <p className="text-center text-on-surface-variant label-bold text-[10px]">PDF files up to 50MB</p>
          </div>
          
          <div className="mt-8 border-thin swiss-border bg-muted-background p-6">
            <p className="label-bold mb-4 text-on-surface-variant">System Status</p>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-accent animate-pulse" />
              <span className="label-bold">INGESTION ENGINE ACTIVE</span>
            </div>
          </div>
        </aside>

        {/* Document Table */}
        <section className="lg:col-span-8">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <p className="label-bold text-accent mb-2">01. UPLOADED DOCUMENTS</p>
              <h2 className="headline-lg text-[24px] md:text-[32px] lg:text-[40px]">Corpus Index</h2>
            </div>
            <div className="flex border-thin swiss-border w-full sm:w-auto">
              <input 
                className="bg-surface border-none focus:ring-0 label-bold px-4 py-2 w-full sm:w-64" 
                placeholder="SEARCH DOCUMENTS..." 
                type="text"
              />
              <button className="bg-foreground text-background px-4 py-2 hover:bg-accent transition-colors">
                <Search size={20} />
              </button>
            </div>
          </div>

          <div className="border-thick swiss-border overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-foreground text-background label-bold text-[11px]">
                <tr>
                  <th className="p-4 border-r-thin border-surface">#</th>
                  <th className="p-4 border-r-thin border-surface">Filename</th>
                  <th className="p-4 border-r-thin border-surface text-center">Pages</th>
                  <th className="p-4 border-r-thin border-surface text-center">Chunks</th>
                  <th className="p-4 border-r-thin border-surface text-center">Entities</th>
                  <th className="p-4 border-r-thin border-surface">Uploaded</th>
                  <th className="p-4 border-r-thin border-surface">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="label-bold text-[12px]">
                {documents.map((doc, i) => (
                  <tr 
                    key={i} 
                    className={`${i % 2 === 0 ? 'bg-surface' : 'bg-muted-background'} border-b-thin border-foreground hover:bg-surface-container-high transition-colors`}
                  >
                    <td className="p-4 border-r-thin border-foreground text-accent">{doc.id}</td>
                    <td className="p-4 border-r-thin border-foreground font-[900] truncate max-w-[200px]">{doc.name}</td>
                    <td className="p-4 border-r-thin border-foreground text-center">{doc.pages}</td>
                    <td className="p-4 border-r-thin border-foreground text-center">{doc.chunks}</td>
                    <td className="p-4 border-r-thin border-foreground text-center">{doc.entities}</td>
                    <td className="p-4 border-r-thin border-foreground whitespace-nowrap">{doc.uploaded}</td>
                    <td className="p-4 border-r-thin border-foreground">
                      <span className={`px-2 py-1 text-[10px] ${doc.status === 'PROCESSED' ? 'bg-foreground text-background' : 'bg-accent text-white'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      <button className="swiss-border-thin p-1 hover:bg-accent hover:text-white transition-colors">
                        <Eye size={14} />
                      </button>
                      <button className="swiss-border-thin p-1 hover:bg-red-600 hover:text-white transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 p-8 swiss-border-thin bg-surface relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="label-bold text-accent mb-2">Automated Optimization</h3>
              <p className="headline-lg text-2xl mb-4">Graph Enrichment</p>
              <p className="text-on-surface-variant font-body-base max-w-lg mb-6">
                Our pipeline automatically extracts cross-document entities and creates semantic relationships in the background to improve your RAG accuracy.
              </p>
              <SwissButton variant="secondary" className="px-6 py-2">Manage Entities</SwissButton>
            </div>
            <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 bg-on-surface flex items-center justify-center p-8">
              <Network size={120} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
