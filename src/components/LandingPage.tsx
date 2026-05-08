import React from 'react';
import { SwissButton, ArrowRight, Shield, Zap, Network } from './SwissUI';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="grid grid-cols-1 md:grid-cols-12 min-h-0 md:min-h-[819px] border-b-thick border-foreground">
        <div className="md:col-span-7 p-6 md:p-12 flex flex-col justify-center border-r-0 md:border-r-thick border-foreground bg-surface-bright">
          <span className="section-number mb-4">01. SYSTEM</span>
          <h1 className="headline-xl text-[44px] md:text-[64px] mb-6">
            GRAPH-AUGMENTED<br />EXPLAINABLE RETRIEVAL
          </h1>
          <p className="text-on-surface-variant max-w-xl mb-10 text-lg md:text-xl font-medium italic">
            Bridging the gap between raw data and verifiable intelligence through a novel graph-reasoning architecture.
          </p>
          <SwissButton variant="accent" className="w-full md:w-fit text-lg py-5 px-10">
            EXPLORE THE SYSTEM
          </SwissButton>
        </div>
        <div className="md:col-span-5 relative overflow-hidden bg-surface-container flex items-center justify-center p-6 md:p-12 min-h-[300px] md:min-h-0">
          {/* Dot Pattern Overlay */}
          <div className="absolute inset-0 dot-pattern" />
          
          <div className="w-full h-full relative border-thick border-foreground p-8 bg-surface z-10">
            <div className="absolute top-10 left-10 w-40 h-40 bg-accent swiss-border" />
            <div className="absolute bottom-20 right-10 w-60 h-20 bg-foreground" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-thick border-accent flex items-center justify-center">
              <div className="w-24 h-24 bg-surface-container-highest border-thin swiss-border" />
            </div>
          </div>
        </div>
      </section>

      {/* Method Section */}
      <section className="p-6 md:p-12 bg-surface">
        <div className="mb-12 border-b-thick border-foreground pb-6">
          <span className="section-number">02. METHOD</span>
          <h2 className="headline-lg text-[32px] md:text-[40px]">THE PIPELINE</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-0 md:border-thick border-foreground">
          {[
            { id: '01.', title: 'Document Upload', desc: 'Ingestion of multi-modal sources into a unified latent space for initial vectorization.' },
            { id: '02.', title: 'Semantic Retrieval', desc: 'Cross-attention mechanisms filtering the top-k relevant nodes based on contextual intent.' },
            { id: '03.', title: 'Graph Construction', desc: 'Dynamic mapping of relationships and knowledge triplets to build a localized context graph.' },
            { id: '04.', title: 'Answer Generation', desc: 'Synthesizing human-readable responses with citation-backed evidential trajectories.' },
          ].map((item, i) => (
            <div 
              key={i} 
              className={`p-8 bg-surface-container-low border-thin md:border-none md:border-b-0 ${i < 3 ? 'md:border-r-thin' : ''} border-foreground hover:bg-surface transition-colors group`}
            >
              <span className="section-number text-3xl mb-6 block text-primary">{item.id}</span>
              <h3 className="label-bold text-xl mb-4 text-foreground">{item.title}</h3>
              <p className="text-on-surface-variant font-body-base">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring Section */}
      <section className="p-6 md:p-12 bg-background border-y-thick border-foreground">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <div className="w-full md:w-5/12">
            <span className="section-number">03. SCORING</span>
            <h2 className="headline-lg text-[32px] md:text-[40px] mb-6">WEIGHTED TRUTH</h2>
            <p className="text-on-surface-variant text-base md:text-lg">
              Our proprietary scoring algorithm ensures that every response is calculated against a rigorous set of graph-theoretic and semantic benchmarks.
            </p>
          </div>
          <div className="w-full md:w-7/12 bg-foreground p-6 md:p-12 border-thick border-accent">
            <div className="font-mono text-surface-container-highest text-xl md:text-3xl mb-8 border-b border-muted-text pb-6 overflow-x-auto whitespace-nowrap">
              F(d) = α·S + β·G_c + γ·R_c − λ·C_p
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-surface">
              <div className="flex items-start gap-4">
                <span className="text-accent font-bold">α·S</span>
                <span className="text-sm label-bold tracking-tight">Semantic similarity</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-accent font-bold">β·G_c</span>
                <span className="text-sm label-bold tracking-tight">Graph centrality</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-accent font-bold">γ·R_c</span>
                <span className="text-sm label-bold tracking-tight">Relation confidence</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-accent font-bold">λ·C_p</span>
                <span className="text-sm label-bold tracking-tight">Contradiction penalty</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="p-6 md:p-12 bg-surface relative overflow-hidden">
        <div className="relative z-10">
          <div className="mb-12 border-b-thick border-foreground pb-6">
            <span className="section-number">04. ADVANTAGES</span>
            <h2 className="headline-lg text-[32px] md:text-[40px]">ENGINEERED CLARITY</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col gap-6">
              <div className="w-16 h-16 swiss-border border-accent bg-surface flex items-center justify-center">
                <Network className="text-accent" size={32} />
              </div>
              <h3 className="headline-lg text-2xl">Explainable Reasoning</h3>
              <p className="text-on-surface-variant">Trace every claim back to its source node in the knowledge graph. Complete transparency in decision logic.</p>
            </div>
            <div className="flex flex-col gap-6">
              <div className="w-16 h-16 swiss-border border-accent bg-surface flex items-center justify-center">
                <Shield className="text-accent" size={32} />
              </div>
              <h3 className="headline-lg text-2xl">Reduced Hallucination</h3>
              <p className="text-on-surface-variant">Multi-hop verification cycles ensure that generative outputs remain grounded within the validated document corpus.</p>
            </div>
            <div className="flex flex-col gap-6">
              <div className="w-16 h-16 swiss-border border-accent bg-surface flex items-center justify-center">
                <Zap className="text-accent" size={32} />
              </div>
              <h3 className="headline-lg text-2xl">Graph-Enhanced Retrieval</h3>
              <p className="text-on-surface-variant">Leverage structured relationships that traditional semantic search misses, capturing the "connective tissue" of your data.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
