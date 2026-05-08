import React, { useState } from 'react';
import { NavSection, SwissButton, Menu, X } from './components/SwissUI';

export default function App() {
  const [currentView, setCurrentView] = React.useState('landing');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'chat': return <ChatDashboard />;
      case 'analytics': return <AnalyticsResults />;
      default: return <LandingPage />;
    }
  };

  const navigateTo = (view: string) => {
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-surface border-b-thick border-foreground px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div 
            className="headline-lg text-[24px] tracking-tighter text-accent transition-transform active:scale-95 cursor-pointer"
            onClick={() => navigateTo('landing')}
          >
            AGX-RAG
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex gap-8 items-center">
            <NavSection active={currentView === 'landing'} onClick={() => navigateTo('landing')}>Research</NavSection>
            <NavSection active={currentView === 'dashboard'} onClick={() => navigateTo('dashboard')}>Corpus</NavSection>
            <NavSection active={currentView === 'chat'} onClick={() => navigateTo('chat')}>Inquiry</NavSection>
            <NavSection active={currentView === 'analytics'} onClick={() => navigateTo('analytics')}>Analytics</NavSection>
            
            <SwissButton 
              variant="accent" 
              className="ml-4 py-2 px-6"
              onClick={() => navigateTo('dashboard')}
            >
              Get Started
            </SwissButton>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden w-10 h-10 bg-foreground text-background flex items-center justify-center border-thick border-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-surface border-b-thick border-foreground p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-200 z-50 shadow-2xl">
            <div className="flex flex-col gap-4">
              <NavSection active={currentView === 'landing'} onClick={() => navigateTo('landing')}>Research</NavSection>
              <NavSection active={currentView === 'dashboard'} onClick={() => navigateTo('dashboard')}>Corpus</NavSection>
              <NavSection active={currentView === 'chat'} onClick={() => navigateTo('chat')}>Inquiry</NavSection>
              <NavSection active={currentView === 'analytics'} onClick={() => navigateTo('analytics')}>Analytics</NavSection>
            </div>
            <SwissButton 
              variant="accent" 
              className="w-full py-4 text-center"
              onClick={() => navigateTo('dashboard')}
            >
              Get Started
            </SwissButton>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main>
        {renderView()}
      </main>

      {/* Footer */}
      <footer className="bg-foreground text-background p-6 md:p-12 border-t-thick border-accent mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="md:w-1/2">
            <h2 className="headline-lg text-white mb-4">AGX-RAG</h2>
            <p className="label-bold opacity-70 max-w-sm mb-8 leading-relaxed">
              © 2024 AGX-RAG SYSTEMS. ALL RIGHTS RESERVED. BUILT ON GRAPH-REASONING LOGIC AND SWISS PRECISION.
            </p>
            <div className="flex flex-wrap gap-6 border-t border-muted-text pt-8">
              {['PRIVACY POLICY', 'TERMS OF SERVICE', 'GITHUB', 'CONTACT'].map(link => (
                <a key={link} href="#" className="label-bold hover:text-accent transition-colors">{link}</a>
              ))}
            </div>
          </div>
          <div className="md:w-1/4">
            <p className="label-bold text-accent mb-4">Newsletter</p>
            <div className="flex swiss-border-thin border-white">
              <input className="bg-transparent border-none text-white focus:ring-0 w-full label-bold p-2" placeholder="ENTER EMAIL" />
              <button className="bg-white text-foreground px-4 py-2 hover:bg-accent transition-colors">
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Internal imports for the App component
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import ChatDashboard from './components/ChatDashboard';
import AnalyticsResults from './components/AnalyticsResults';
import { ArrowRight } from 'lucide-react';
