// Greenroom authentication config.
//
// Auth is Google OAuth (Authorization Code + PKCE, S256) with the ID token
// used as the bearer for the Greenroom API. See the flow in useAuthStore.
//
// Two flags gate this so the frontend can land before the backend `/verify`
// endpoint exists:
//   VITE_AUTH_ENABLED — master switch. When false (default) the app behaves
//     exactly as before: no login gate, no bearer headers. Flip to "true" only
//     once we're ready to require login.
//   VITE_AUTH_MODE — "mock" (default) fakes the whole login without a redirect
//     or backend, so the gated desktop can be developed locally (e.g. on :5173,
//     which isn't an allowlisted redirect URI). "google" runs the real PKCE
//     redirect flow (use on :3000 / prod once the redirect URI + backend land).

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  return v === "true" || v === "1";
}

export const AUTH_ENABLED = envBool(import.meta.env.VITE_AUTH_ENABLED, false);

export type AuthMode = "mock" | "google";
export const AUTH_MODE: AuthMode =
  import.meta.env.VITE_AUTH_MODE === "google" ? "google" : "mock";

// OAuth client. The client ID is public (safe to ship); the secret must NEVER
// live in the frontend — PKCE stands in for it.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "407614724084-4joaigt2hqj86g73q7pqujnvj2p28lmq.apps.googleusercontent.com";

export const GOOGLE_SCOPES = "openid email profile";

// Google endpoints. Both support CORS for browser-based PKCE ("Web application"
// client type), so the code->token exchange happens directly browser->Google.
export const GOOGLE_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

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
