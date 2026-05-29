// Authenticated fetch helper.
//
// Every call to a requireAuth-gated endpoint must carry the JWT that AuthPage
// stored under `agx_token`. authFetch injects the Bearer header and, on a 401,
// clears the stale token and dispatches an `agx:unauthorized` event so App can
// drop back to the auth screen instead of leaving the UI in a broken state.
//
// FormData bodies (file uploads) are passed through untouched — we must NOT set
// Content-Type for those, the browser sets the multipart boundary itself.

export const TOKEN_KEY = 'agx_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});

  if (token) headers.set('Authorization', `Bearer ${token}`);

  // Only set JSON content-type when there's a non-FormData body and the caller
  // hasn't already specified one.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('agx:unauthorized'));
  }

  return res;
}
