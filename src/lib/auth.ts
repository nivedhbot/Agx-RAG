// Frontend auth-state helpers.
//
// The token itself lives in localStorage under `agx_token` (see api.ts, which
// owns the key and the authFetch Bearer injection). This module layers the
// higher-level questions the UI asks — am I signed in, who am I, sign me out —
// on top of that single source of truth.
//
// logout() routes through the app's existing `agx:unauthorized` event rather
// than a hard URL redirect: the app is state-navigated (App.currentView), not
// router-based, and App already listens for that event to drop back to the auth
// screen. This keeps logout working from anywhere without coupling to a router.

import { TOKEN_KEY, getToken } from './api';

export { getToken };

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  role?: 'user' | 'admin';
}

// True when a token is present. This is a cheap, synchronous check — it does
// NOT validate the token against the server (use getCurrentUser for that).
export function isAuthenticated(): boolean {
  return !!getToken();
}

// Resolve the current user from the server using the stored token. Returns null
// when there's no token or the token is rejected (401). Network/transient
// errors also resolve to null so callers can treat it as "unknown".
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.user as AuthUser) ?? null;
  } catch {
    return null;
  }
}

// Clear the session and return to the auth screen. Fires a best-effort server
// logout (the JWT is stateless, so this just 200s), removes the token, then
// dispatches `agx:unauthorized` which App handles by clearing user state and
// routing to the auth view.
export function logout(): void {
  const token = getToken();
  try {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  } catch {
    /* ignore — logout must never throw */
  }
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('agx:unauthorized'));
}
