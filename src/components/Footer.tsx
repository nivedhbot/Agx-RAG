import React from 'react';

const Footer = () => (
  <footer className="bg-foreground text-background p-12 border-t-thick border-accent mt-auto relative z-10 w-full">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
        <div className="md:col-span-6">
          <h2 className="headline-lg text-white mb-6 text-4xl">AGX-RAG_</h2>
          <p className="label-bold opacity-60 text-xs leading-relaxed max-w-sm uppercase">
            A research project on high-fidelity graph augmenting search architectures. Built with precision, deployed for intelligence. 
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="label-bold text-accent mb-6 text-xs tracking-widest">SYSTEM_LINKS</p>
          <ul className="space-y-4 label-bold text-[10px] opacity-70">
            {['NEURAL_NETWORK', 'VECTOR_SPACE', 'SEMANTIC_ENGINE', 'RE-RANK_PIPELINE'].map(item => (
              <li key={item} className="hover:text-accent cursor-pointer transition-colors uppercase">{item}</li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-3">
          <p className="label-bold text-accent mb-6 text-xs tracking-widest">CONNECT_</p>
          <ul className="space-y-4 label-bold text-[10px] opacity-70">
            {['GITHUB_REPOSITORY', 'TECHNICAL_PAPER', 'SYSTEM_STATUS', 'SECURITY_POLICY'].map(item => (
              <li key={item} className="hover:text-accent cursor-pointer transition-colors uppercase">{item}</li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="label-bold text-[10px] opacity-40 uppercase">
          © 2024 AGX-RAG SYSTEMS. ALL RIGHTS RESERVED. CODEBASE: V.1.2.0-STABLE.
        </div>
        <div className="flex gap-8 label-bold text-[10px] opacity-40">
          <span>LATENCY: 0.04MS</span>
          <span>UPTIME: 100%</span>
          <span>LOAD: STABLE</span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
