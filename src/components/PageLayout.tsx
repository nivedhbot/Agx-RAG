import React, { useState } from 'react';
import { 
  Menu, 
  X, 
  ArrowLeft, 
  Database, 
  Activity, 
  Network, 
  Settings, 
  ChevronRight,
  Shield,
  Zap,
  LayoutDashboard,
  Terminal,
  Lock
} from './SwissUI';

import Footer from './Footer';

interface PageLayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onLogout?: () => void;
  userName?: string | null;
  isAdmin?: boolean;
}

export default function PageLayout({
  children,
  activeView,
  onNavigate,
  title,
  subtitle,
  showBackButton = true,
  onLogout,
  userName,
  isAdmin = false
}: PageLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'SOURCE_NODES', icon: Database },
    { id: 'chat', label: 'REASONING_LAB', icon: Zap },
    { id: 'analytics', label: 'KNOWLEDGE_MAP', icon: Network },
    { id: 'health', label: 'SYSTEM_HEALTH', icon: Activity },
    { id: 'settings', label: 'ENGINE_CONFIG', icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Header */}
      <header className="bg-background border-b-thick border-foreground fixed top-0 w-full z-50 flex justify-between items-center px-4 md:px-12 py-4">
        <div className="flex items-center gap-4 md:gap-8">
          <button 
            className="lg:hidden w-10 h-10 flex items-center justify-center border-thin border-foreground bg-foreground text-background"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 
            className="headline-lg text-[20px] md:text-[24px] tracking-tight cursor-pointer"
            onClick={() => onNavigate('landing')}
          >
            AGX-RAG
          </h1>
          <nav className="hidden lg:flex items-center gap-4 label-bold text-xs uppercase">
            <span className="text-on-surface-variant cursor-pointer hover:text-foreground" onClick={() => onNavigate('dashboard')}>Terminal</span>
            <ChevronRight size={12} className="text-on-surface-variant" />
            <span className="text-accent">{title}</span>
            {subtitle && (
              <>
                <ChevronRight size={12} className="text-on-surface-variant" />
                <span className="text-accent">{subtitle}</span>
              </>
            )}
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 px-4 md:px-6 py-2 border-thin border-foreground bg-primary text-background hover:bg-foreground transition-colors label-bold text-[10px] md:text-xs shadow-[4px_4px_0px_#00000020]"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">BACK TO TERMINAL</span>
              <span className="sm:hidden">BACK</span>
            </button>
          )}

          {onLogout && (
            <div className="flex items-center gap-3">
              {/* Logged-in user indicator — display name (falls back to a
                  generic label). Hidden on small screens to preserve the
                  header's single-row layout. */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 border-thin border-foreground bg-muted-background label-bold text-[10px] md:text-xs">
                <span className="w-2 h-2 bg-accent rounded-full" />
                <span className="text-on-surface-variant">{isAdmin ? 'ADMIN' : 'USER'}</span>
                <span className="text-foreground tracking-tight uppercase max-w-[160px] truncate">
                  {userName || 'OPERATOR'}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 md:px-6 py-2 border-thin border-foreground bg-surface text-foreground hover:bg-foreground hover:text-background transition-colors label-bold text-[10px] md:text-xs"
              >
                <Lock size={14} />
                <span className="hidden sm:inline">LOGOUT</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 pt-[76px]">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-[76px] h-[calc(100vh-76px)] z-40 bg-surface border-r-thick border-foreground
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'left-0 w-64' : '-left-64 lg:left-0 w-64'}
          flex flex-col
        `}>
          <div className="p-6 md:p-8 bg-muted-background border-b-thick border-foreground">
            <h2 className="headline-lg text-lg mb-1">SYSTEM</h2>
            <p className="label-bold text-[10px] tracking-widest opacity-40">V.1.2.0-STABLE_</p>
          </div>
          
          <nav className="flex-grow overflow-y-auto">
            {navItems.map((item) => (
              <button 
                key={item.id} 
                onClick={() => {
                  onNavigate(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full p-6 flex items-center gap-6 transition-all border-b border-foreground/10 ${
                  activeView === item.id 
                    ? 'bg-accent text-background' 
                    : 'text-on-surface-variant hover:bg-foreground hover:text-background'
                }`}
              >
                <item.icon size={20} />
                <span className="label-bold uppercase tracking-widest text-[11px]">{item.label}</span>
              </button>
            ))}
          </nav>
          
          <div className="p-6 border-t-thick border-foreground bg-surface-container-high">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="label-bold text-[10px] tracking-tight">ENGINE_ONLINE_</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-x-hidden flex flex-col">
          <div className="flex-1 p-6 md:p-12">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
