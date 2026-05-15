import React from 'react';
import { SwissButton, ArrowRight, Shield, Zap, Network } from './SwissUI';

import { motion } from 'motion/react';

export default function LandingPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="grid grid-cols-1 md:grid-cols-12 min-h-0 md:min-h-[819px] border-b-thick border-foreground">
        <div className="md:col-span-7 p-6 md:p-12 flex flex-col justify-center border-r-0 md:border-r-thick border-foreground bg-surface-bright">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="section-number mb-4">01. SYSTEM</span>
            <h1 className="headline-xl text-[44px] md:text-[64px] mb-6">
              GRAPH-AUGMENTED<br />EXPLAINABLE RETRIEVAL
            </h1>
            <p className="text-on-surface-variant max-w-xl mb-10 text-lg md:text-xl font-medium italic">
              Bridging the gap between raw data and verifiable intelligence through a novel graph-reasoning architecture.
            </p>
            <SwissButton 
              variant="accent" 
              className="w-full md:w-fit text-lg py-5 px-10 group"
              onClick={() => onNavigate('dashboard')}
            >
              EXPLORE THE SYSTEM
              <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
            </SwissButton>
          </motion.div>
        </div>
        <div className="md:col-span-5 relative overflow-hidden bg-surface-container flex items-center justify-center p-6 md:p-12 min-h-[300px] md:min-h-0">
          {/* Dot Pattern Overlay */}
          <div className="absolute inset-0 dot-pattern" />
          
          <div className="w-full h-full relative border-thick border-foreground p-8 bg-surface z-10 flex items-center justify-center overflow-hidden">
            <motion.div 
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1],
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }}
              className="w-64 h-64 border-thick border-accent/20 rounded-full flex items-center justify-center"
            >
               <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="w-48 h-48 border-thin border-foreground/10 rounded-full flex items-center justify-center"
               >
                 <div className="w-4 h-4 bg-accent rounded-full animate-ping" />
               </motion.div>
            </motion.div>

            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-10 left-10 w-24 h-24 bg-accent swiss-border shadow-xl z-20"
              style={{ rotate: '15deg' }}
            />
            <motion.div 
              initial={{ x: 100 }}
              animate={{ x: 0 }}
              className="absolute bottom-20 right-4 w-48 h-12 bg-foreground z-20 flex items-center px-4"
            >
              <div className="w-full h-1 bg-accent/30 overflow-hidden">
                <motion.div 
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-1/2 h-full bg-accent"
                />
              </div>
            </motion.div>

            <div className="absolute inset-0 flex items-center justify-center opacity-5">
              <Network size={400} strokeWidth={0.5} />
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
