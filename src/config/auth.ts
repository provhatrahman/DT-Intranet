// Greenroom authentication config.
//
// Auth is Google OAuth (Authorization Code + PKCE, S256). The browser only
// obtains the authorization code; the code->token exchange happens server-side
// (Google web clients require the client secret), and the returned ID token is
// used as the bearer for the Greenroom API. See the flow in useAuthStore.
//
//   VITE_AUTH_ENABLED — master switch. When false (default) the app behaves
//     exactly as before: no login gate, no bearer headers. Set "true" to
//     require login (baked in at build time).

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  return v === "true" || v === "1";
}

export const AUTH_ENABLED = envBool(import.meta.env.VITE_AUTH_ENABLED, false);

// OAuth client. The client ID is public (safe to ship); the secret must NEVER
// live in the frontend — it stays server-side for the code->token exchange.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "407614724084-4joaigt2hqj86g73q7pqujnvj2p28lmq.apps.googleusercontent.com";

export const GOOGLE_SCOPES = "openid email profile";

// Google authorization endpoint (full-page redirect; no CORS). The token
// endpoint is NOT called from the browser — the backend does the exchange.
export const GOOGLE_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";

// Registered redirect URIs: prod = https://greenroom.daytimers.org/auth/callback,
// local dev = http://localhost:3000/auth/callback. Derive from the live origin
// so we never hardcode the host; the path is fixed.
export const AUTH_CALLBACK_PATH = "/auth/callback";
export function getRedirectUri(): string {
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
}

// sessionStorage keys for the in-flight PKCE handshake (not persisted long-term).
export const PKCE_VERIFIER_KEY = "greenroom:pkce_verifier";
export const OAUTH_STATE_KEY = "greenroom:oauth_state";
