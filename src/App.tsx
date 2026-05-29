import React, { useState, useEffect } from 'react';
import { NavSection, SwissButton, Menu, X } from './components/SwissUI';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import ChatDashboard, { Message } from './components/ChatDashboard';
import AnalyticsResults from './components/AnalyticsResults';
import SettingsPage from './components/SettingsPage';
import SystemHealth from './components/SystemHealth';
import PageLayout from './components/PageLayout';
import Footer from './components/Footer';
import AuthPage, { TOKEN_KEY } from './pages/AuthPage';
import { authFetch } from './lib/api';
import { logout as authLogout } from './lib/auth';

interface User {
  id: string;
  email: string;
  display_name: string | null;
}

// Views that require a valid JWT. Landing is public.
const PROTECTED_VIEWS = ['dashboard', 'chat', 'analytics', 'health', 'settings'];

export default function App() {
  const [currentView, setCurrentView] = React.useState('landing');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);

  // Lifted chat state — survives tab navigation so the conversation, last
  // response, and right-hand panels (Pipeline Metadata / Agent Trace) restore
  // when returning to the Reasoning Lab.
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  // Multi-session state for the Reasoning Lab. activeSessionId is the session
  // whose messages are shown; sessionReload bumps to refetch the sidebar list.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionReload, setSessionReload] = useState(0);
  const bumpSessionReload = () => setSessionReload(n => n + 1);

  // Auth state. `user` null = signed out. `authChecked` gates the first render
  // until we've validated any stored token, avoiding a redirect race.
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Validate a stored token once on mount via /api/auth/me. Only an explicit
  // 401 clears the token; transient errors (DB down / network) leave it intact.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      })
      .catch(() => {
        /* network/transient error — keep the token, stay on landing */
      })
      .finally(() => setAuthChecked(true));
  }, []);

  // A 401 from any authFetch call (expired/cleared token) bounces back to auth.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setCurrentView('auth');
    };
    window.addEventListener('agx:unauthorized', onUnauthorized);
    return () => window.removeEventListener('agx:unauthorized', onUnauthorized);
  }, []);

  // Entering the Reasoning Lab with no active session creates one so the very
  // first query has somewhere to persist (and gets an auto-generated title).
  useEffect(() => {
    if (currentView === 'chat' && user && !activeSessionId) {
      handleNewSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, user]);

  const navigateTo = (view: string) => {
    // Gate protected views behind a valid session.
    if (PROTECTED_VIEWS.includes(view) && !user) {
      setCurrentView('auth');
      setIsMenuOpen(false);
      return;
    }
    setCurrentView(view);
    setIsMenuOpen(false);
  };

  const handleAuthSuccess = (u: User) => {
    setUser(u);
    setCurrentView('dashboard'); // Terminal dashboard
  };

  const handleLogout = () => {
    // Centralised in lib/auth: best-effort server logout, clears the token,
    // and dispatches `agx:unauthorized`. The listener above resets user state
    // and routes to auth; we also send the view to landing for a clean exit.
    authLogout();
    setUser(null);
    setCurrentView('landing');
  };

  // Label for the nav user indicator: display name, then email, then a generic
  // fallback so the chip never renders empty.
  const userName = user?.display_name || user?.email || 'OPERATOR';

  // Create a fresh session and switch to it (empty conversation).
  const handleNewSession = async () => {
    try {
      const res = await authFetch('/api/sessions', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setActiveSessionId(data.session.id);
      setChatMessages([]);
      setChatQuery('');
      bumpSessionReload();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  // Load a session's stored messages into the chat view. An empty id means the
  // active session was deleted — clear the view.
  const handleSelectSession = async (id: string) => {
    if (!id) {
      setActiveSessionId(null);
      setChatMessages([]);
      bumpSessionReload();
      return;
    }
    setActiveSessionId(id);
    try {
      const res = await authFetch(`/api/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      // Rehydrate the full message shape from the persisted metadata so a
      // reloaded session restores the metadata strip, right-hand Pipeline
      // panel, and the DECONSTRUCT_SYNTHESIS view — not just the answer text.
      const rows: any[] = data.messages || [];
      const restored: Message[] = rows.map((m: any, i: number) => {
        const md = m.metadata || {};
        // An assistant message's `query` (used as the analysis title) is the
        // preceding user message, not its own answer text.
        const priorUser = m.role === 'assistant'
          ? [...rows.slice(0, i)].reverse().find(r => r.role === 'user')?.content
          : m.content;
        return {
          role: m.role,
          content: m.content,
          confidence: md.confidence,
          latency: md.latency,
          sources: md.sources,
          reasoningPath: md.reasoningPath,
          topChunks: md.topChunks,
          knowledgeGraph: md.knowledgeGraph,
          claimGraph: md.claimGraph,
          contradictions: md.contradictions,
          evidenceChain: md.evidenceChain,
          agentTrace: md.agentTrace,
          query: priorUser,
        };
      });
      setChatMessages(restored);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  // Hold the first paint until the stored token has been checked.
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="label-bold text-xs text-muted-text">INITIALIZING_SESSION...</span>
      </div>
    );
  }

  const renderView = () => {
    // Defense-in-depth: never render a protected view without a session.
    if (PROTECTED_VIEWS.includes(currentView) && !user) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }

    switch (currentView) {
      case 'auth':
        return <AuthPage onAuthSuccess={handleAuthSuccess} />;
      case 'dashboard':
        return (
          <PageLayout activeView="dashboard" onNavigate={navigateTo} onLogout={handleLogout} userName={userName} title="SOURCE NODES" showBackButton={false}>
            <Dashboard />
          </PageLayout>
        );
      case 'chat':
        return (
          <PageLayout activeView="chat" onNavigate={navigateTo} onLogout={handleLogout} userName={userName} title="REASONING LAB">
            <ChatDashboard
              query={chatQuery}
              setQuery={setChatQuery}
              messages={chatMessages}
              setMessages={setChatMessages}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              sessionReloadSignal={sessionReload}
              bumpSessionReload={bumpSessionReload}
              onShowAnalysis={(data) => {
                setSelectedAnalysis(data);
                setSelectedAnalysis(prev => ({ ...prev, isCorpus: false }));
                navigateTo('analytics');
              }} />
          </PageLayout>
        );
      case 'analytics':
        return (
          <PageLayout activeView="analytics" onNavigate={navigateTo} onLogout={handleLogout} userName={userName} title="KNOWLEDGE MAP" subtitle={selectedAnalysis?.query ? "QUERY ANALYSIS" : "CORPUS ANALYTICS"}>
            <AnalyticsResults queryData={selectedAnalysis} />
          </PageLayout>
        );
      case 'health':
        return (
          <PageLayout activeView="health" onNavigate={navigateTo} onLogout={handleLogout} userName={userName} title="SYSTEM HEALTH">
            <SystemHealth />
          </PageLayout>
        );
      case 'settings':
        return (
          <PageLayout activeView="settings" onNavigate={navigateTo} onLogout={handleLogout} userName={userName} title="CONFIGURATION">
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

              {user ? (
                <SwissButton
                  variant="secondary"
                  className="ml-4 py-2 px-6"
                  onClick={handleLogout}
                >
                  LOGOUT_
                </SwissButton>
              ) : (
                <SwissButton
                  variant="accent"
                  className="ml-4 py-2 px-6"
                  onClick={() => navigateTo('dashboard')}
                >
                  INITIALIZE_
                </SwissButton>
              )}
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
              {user ? (
                <SwissButton
                  variant="secondary"
                  className="w-full py-4 text-center"
                  onClick={handleLogout}
                >
                  LOGOUT_
                </SwissButton>
              ) : (
                <SwissButton
                  variant="accent"
                  className="w-full py-4 text-center"
                  onClick={() => navigateTo('dashboard')}
                >
                  INITIALIZE_
                </SwissButton>
              )}
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
