import React, { useState } from 'react';
import { NavSection, SwissButton, Menu, X } from './components/SwissUI';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import ChatDashboard, { Message } from './components/ChatDashboard';
import AnalyticsResults from './components/AnalyticsResults';
import SettingsPage from './components/SettingsPage';
import SystemHealth from './components/SystemHealth';
import PageLayout from './components/PageLayout';
import Footer from './components/Footer';

export default function App() {
  const [currentView, setCurrentView] = React.useState('landing');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);

  // Lifted chat state — survives tab navigation so the conversation, last
  // response, and right-hand panels (Pipeline Metadata / Agent Trace) restore
  // when returning to the Reasoning Lab.
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  const navigateTo = (view: string) => {
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': 
        return (
          <PageLayout activeView="dashboard" onNavigate={navigateTo} title="SOURCE NODES" showBackButton={false}>
            <Dashboard />
          </PageLayout>
        );
      case 'chat': 
        return (
          <PageLayout activeView="chat" onNavigate={navigateTo} title="REASONING LAB">
            <ChatDashboard
              query={chatQuery}
              setQuery={setChatQuery}
              messages={chatMessages}
              setMessages={setChatMessages}
              onShowAnalysis={(data) => {
                setSelectedAnalysis(data);
                setSelectedAnalysis(prev => ({ ...prev, isCorpus: false }));
                navigateTo('analytics');
              }} />
          </PageLayout>
        );
      case 'analytics': 
        return (
          <PageLayout activeView="analytics" onNavigate={navigateTo} title="KNOWLEDGE MAP" subtitle={selectedAnalysis?.query ? "QUERY ANALYSIS" : "CORPUS ANALYTICS"}>
            <AnalyticsResults queryData={selectedAnalysis} />
          </PageLayout>
        );
      case 'health':
        return (
          <PageLayout activeView="health" onNavigate={navigateTo} title="SYSTEM HEALTH">
            <SystemHealth />
          </PageLayout>
        );
      case 'settings':
        return (
          <PageLayout activeView="settings" onNavigate={navigateTo} title="CONFIGURATION">
            <SettingsPage />
          </PageLayout>
        );
      default: return (
        <div className="flex flex-col min-h-screen">
          <LandingPage onNavigate={navigateTo} />
          <Footer />
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navigation - Only show on landing */}
      {currentView === 'landing' && (
        <nav className="sticky top-0 z-50 w-full bg-surface border-b-thick border-foreground px-6 md:px-12 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div 
              className="headline-lg text-[24px] tracking-tighter text-accent transition-transform active:scale-95 cursor-pointer uppercase"
              onClick={() => navigateTo('landing')}
            >
              AGX-RAG
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex gap-8 items-center">
              <NavSection active={currentView === 'landing'} onClick={() => navigateTo('landing')}>RESEARCH</NavSection>
              <NavSection onClick={() => navigateTo('chat')}>LAB</NavSection>
              <NavSection onClick={() => navigateTo('dashboard')}>TERMINAL</NavSection>
              
              <SwissButton 
                variant="accent" 
                className="ml-4 py-2 px-6"
                onClick={() => navigateTo('dashboard')}
              >
                INITIALIZE_
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
                <NavSection active={currentView === 'landing'} onClick={() => navigateTo('landing')}>RESEARCH</NavSection>
                <NavSection onClick={() => navigateTo('chat')}>LAB</NavSection>
                <NavSection onClick={() => navigateTo('dashboard')}>TERMINAL</NavSection>
              </div>
              <SwissButton 
                variant="accent" 
                className="w-full py-4 text-center"
                onClick={() => navigateTo('dashboard')}
              >
                INITIALIZE_
              </SwissButton>
            </div>
          )}
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {renderView()}
      </main>
    </div>
  );
}
