import React from 'react';
import { 
  FileText, 
  Database, 
  LayoutDashboard, 
  Activity, 
  BookOpen, 
  Settings, 
  Search, 
  UploadCloud, 
  Eye, 
  Trash2, 
  ChevronRight, 
  Cpu, 
  Cloud, 
  Network,
  Menu,
  Send,
  PlusSquare,
  ArrowRight,
  Shield,
  Zap,
  ArrowLeft,
  X,
  Terminal,
  Lock,
  Key
} from 'lucide-react';

// Common UI Components

export const SwissButton = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  onClick,
  disabled = false,
  type = 'button'
}: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const variants = {
    primary: 'bg-foreground text-background hover:bg-accent hover:text-white',
    secondary: 'bg-background text-foreground border-2 border-foreground hover:bg-foreground hover:text-background',
    accent: 'bg-accent text-white border-2 border-foreground hover:bg-foreground',
    ghost: 'bg-transparent text-muted-text hover:bg-muted-background'
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={`px-8 py-3 label-bold transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const NavSection = ({ children, active, onClick }: { children: React.ReactNode, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`label-bold pb-2 transition-colors duration-150 relative ${
      active ? 'text-accent border-b-4 border-accent' : 'text-on-surface-variant hover:text-foreground'
    }`}
  >
    {children}
  </button>
);

export const SectionTitle = ({ number, title }: { number: string, title: string }) => (
  <div className="mb-6">
    <p className="section-number mb-2">{number}</p>
    <h2 className="headline-lg">{title}</h2>
  </div>
);

// Exports of Icons to match the mockups
export { 
  FileText, 
  Database, 
  LayoutDashboard, 
  Activity, 
  BookOpen, 
  Settings, 
  Search, 
  UploadCloud, 
  Eye, 
  Trash2, 
  ChevronRight, 
  Cpu, 
  Cloud, 
  Network,
  Menu,
  Send,
  PlusSquare,
  ArrowRight,
  Shield,
  Zap,
  ArrowLeft,
  X,
  Terminal,
  Lock,
  Key
};
