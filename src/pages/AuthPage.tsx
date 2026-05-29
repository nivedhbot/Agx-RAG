import React, { useState } from 'react';
import { SwissButton, ArrowRight, Lock } from '../components/SwissUI';
import { TOKEN_KEY } from '../lib/api';

export { TOKEN_KEY };

// AuthPage — LOGIN / REGISTER, warm Swiss design system.
//
// On success we persist the JWT to localStorage under `agx_token` and call
// onAuthSuccess so App can route to the Terminal dashboard. Auth state lives in
// localStorage (not a router) because the app navigates via App's currentView.

type View = 'login' | 'register';

interface AuthPageProps {
  // Called with the authenticated user after a successful login/register.
  onAuthSuccess: (user: { id: string; email: string; display_name: string | null }) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [view, setView] = useState<View>('login');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirm, setConfirm] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchView = (next: View) => {
    setView(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (view === 'register' && password !== confirm) {
      setError('PASSWORDS_DO_NOT_MATCH');
      return;
    }

    const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body =
      view === 'login'
        ? { email, password }
        : { email, password, display_name: displayName };

    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data && data.error) || `REQUEST_FAILED_${res.status}`);
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(String(err.message || err).toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Wordmark header */}
      <header className="w-full bg-surface border-b-thick border-foreground px-6 md:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="headline-lg text-[24px] tracking-tighter text-accent uppercase">
            AGX-RAG
          </span>
          <span className="label-bold text-[10px] text-muted-text hidden sm:block">
            GRAPH-AUGMENTED EXPLAINABLE RETRIEVAL
          </span>
        </div>
      </header>

      {/* Centered auth card */}
      <main className="flex-1 flex items-center justify-center p-6 grid-bg">
        <div className="w-full max-w-md bg-surface border-thick border-foreground">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b-thick border-foreground">
            <TabButton active={view === 'login'} onClick={() => switchView('login')}>
              LOGIN
            </TabButton>
            <TabButton active={view === 'register'} onClick={() => switchView('register')}>
              REGISTER
            </TabButton>
          </div>

          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 bg-foreground text-background flex items-center justify-center">
                <Lock size={18} />
              </div>
              <h1 className="label-bold text-sm">
                {view === 'login' ? 'AUTHENTICATE_SESSION' : 'CREATE_NEW_ACCOUNT'}
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {view === 'register' && (
                <Field
                  label="DISPLAY_NAME"
                  type="text"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="ADA LOVELACE"
                  autoComplete="name"
                />
              )}

              <Field
                label="EMAIL"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="USER@DOMAIN.COM"
                required
                autoComplete="email"
              />

              <Field
                label="PASSWORD"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
                autoComplete={view === 'login' ? 'current-password' : 'new-password'}
              />

              {view === 'register' && (
                <Field
                  label="CONFIRM_PASSWORD"
                  type="password"
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              )}

              {error && (
                <p className="label-bold text-[11px] text-accent leading-relaxed">
                  ERROR · {error}
                </p>
              )}

              <SwissButton
                variant="accent"
                type="submit"
                disabled={busy}
                className="w-full py-4 group"
              >
                {busy
                  ? 'PROCESSING_'
                  : view === 'login'
                  ? 'SIGN_IN'
                  : 'CREATE_ACCOUNT'}
                {!busy && (
                  <ArrowRight className="ml-3 inline group-hover:translate-x-1 transition-transform" size={16} />
                )}
              </SwissButton>
            </form>

            <p className="label-bold text-[10px] text-muted-text mt-8 leading-relaxed">
              {view === 'login'
                ? 'NO ACCOUNT? SWITCH TO REGISTER ABOVE.'
                : 'PASSWORD MUST BE AT LEAST 8 CHARACTERS.'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-4 label-bold text-sm transition-colors duration-150 ${
        active
          ? 'bg-foreground text-background'
          : 'bg-surface text-muted-text hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="label-bold text-[10px] opacity-60 block mb-2">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        className="w-full border-thick border-foreground bg-background p-3 label-bold text-sm tracking-wider focus:outline-none focus:bg-surface placeholder:opacity-30"
      />
    </label>
  );
}
