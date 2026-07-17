import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import {
  AUTH_MODE,
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPES,
  getRedirectUri,
  PKCE_VERIFIER_KEY,
  OAUTH_STATE_KEY,
} from "@/config/auth";
import {
  computeCodeChallenge,
  decodeJwtPayload,
  randomUrlSafe,
} from "@/lib/auth/pkce";

// The identity the backend maps a verified Google account to. Mirrors the
// agreed POST /api/users/auth/verify response: { user: {...} }.
export interface GreenroomAuthUser {
  id: number;
  username: string;
  email: string;
  role: string | null;
  is_admin: boolean;
}

export type AuthStatus =
  | "idle" // logged out
  | "authenticating" // redirecting / exchanging / verifying
  | "authenticated"
  | "error";

interface AuthState {
  status: AuthStatus;
  idToken: string | null;
  expiresAt: number | null; // ms epoch
  user: GreenroomAuthUser | null;
  error: string | null;

  /** Kick off login. mock: fake it; google: redirect to Google (PKCE). */
  startLogin: () => Promise<void>;
  /** Complete the redirect: exchange ?code for tokens, then verify. */
  handleCallback: (search: string) => Promise<void>;
  /** Confirm allowlist access with the backend using the current id token. */
  verify: () => Promise<void>;
  /** Try to renew silently; resolves true if we ended up authenticated. */
  silentReauth: () => Promise<boolean>;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const VERIFY_URL = `${GREENROOM_API_BASE}/users/auth/verify`;

function expiryFromIdToken(idToken: string, fallbackSeconds = 3600): number {
  const exp = decodeJwtPayload(idToken)?.exp;
  return exp ? exp * 1000 : Date.now() + fallbackSeconds * 1000;
}

// Mock identity for AUTH_MODE=mock — reuses the dev impersonation env vars so
// mock login lands on the same user the "View as" tooling expects.
function mockUser(): GreenroomAuthUser {
  const id = Number(import.meta.env.VITE_DEV_GREENROOM_USER_ID) || 8;
  const name = import.meta.env.VITE_DEV_GREENROOM_USER_DISPLAY || "admin";
  return {
    id,
    username: name,
    email: `${name}@greenroom.dev`,
    role: "admin",
    is_admin: id === 8,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: "idle",
      idToken: null,
      expiresAt: null,
      user: null,
      error: null,

      startLogin: async () => {
        set({ status: "authenticating", error: null });

        if (AUTH_MODE === "mock") {
          // No redirect, no backend: fabricate a session so the gated desktop
          // is reachable in local dev.
          const token = `mock.${randomUrlSafe(8)}`;
          set({
            idToken: token,
            expiresAt: Date.now() + 3600_000,
            user: mockUser(),
            status: "authenticated",
          });
          return;
        }

        // Real Google PKCE: stash verifier + state, then redirect.
        const verifier = randomUrlSafe(48);
        const state = randomUrlSafe(16);
        const challenge = await computeCodeChallenge(verifier);
        sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
        sessionStorage.setItem(OAUTH_STATE_KEY, state);

        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: getRedirectUri(),
          response_type: "code",
          scope: GOOGLE_SCOPES,
          code_challenge: challenge,
          code_challenge_method: "S256",
          state,
          // Ask for a fresh id_token; access_type=online (no refresh token in
          // the browser — we renew via prompt=none instead).
          access_type: "online",
        });
        window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
      },

      handleCallback: async (search: string) => {
        set({ status: "authenticating", error: null });
        const params = new URLSearchParams(search);

        const err = params.get("error");
        if (err) {
          // e.g. login_required from a failed prompt=none attempt.
          set({ status: "idle", error: err });
          return;
        }

        const code = params.get("code");
        const state = params.get("state");
        const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
        const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);

        if (!code || !state || state !== expectedState || !verifier) {
          set({ status: "error", error: "invalid_callback" });
          return;
        }

        try {
          const body = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            code,
            code_verifier: verifier,
            grant_type: "authorization_code",
            redirect_uri: getRedirectUri(),
          });
          const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          if (!res.ok) {
            set({ status: "error", error: "token_exchange_failed" });
            return;
          }
          const tokens = (await res.json()) as { id_token?: string };
          if (!tokens.id_token) {
            set({ status: "error", error: "no_id_token" });
            return;
          }
          set({
            idToken: tokens.id_token,
            expiresAt: expiryFromIdToken(tokens.id_token),
          });
          await get().verify();
        } catch {
          set({ status: "error", error: "token_exchange_failed" });
        }
      },

      verify: async () => {
        const { idToken } = get();
        if (!idToken) {
          set({ status: "idle" });
          return;
        }

        if (AUTH_MODE === "mock") {
          set({ user: mockUser(), status: "authenticated" });
          return;
        }

        try {
          const res = await fetch(VERIFY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (res.status === 403) {
            set({ status: "error", error: "not_allowlisted", user: null });
            return;
          }
          if (!res.ok) {
            set({ status: "error", error: "verify_failed", user: null });
            return;
          }
          const data = (await res.json()) as { user: GreenroomAuthUser };
          set({ user: data.user, status: "authenticated", error: null });
        } catch {
          set({ status: "error", error: "verify_failed" });
        }
      },

      silentReauth: async () => {
        if (AUTH_MODE === "mock") {
          // Nothing expires meaningfully in mock mode — just extend.
          set({ expiresAt: Date.now() + 3600_000, status: "authenticated" });
          return true;
        }
        // Google: a full-page prompt=none redirect. Remember where we were so
        // the callback can restore it. If Google can't renew silently it
        // returns error=login_required and handleCallback drops us to idle.
        sessionStorage.setItem(
          "greenroom:return_to",
          window.location.pathname + window.location.search + window.location.hash
        );
        const verifier = randomUrlSafe(48);
        const state = randomUrlSafe(16);
        const challenge = await computeCodeChallenge(verifier);
        sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
        sessionStorage.setItem(OAUTH_STATE_KEY, state);
        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: getRedirectUri(),
          response_type: "code",
          scope: GOOGLE_SCOPES,
          code_challenge: challenge,
          code_challenge_method: "S256",
          state,
          prompt: "none",
          access_type: "online",
        });
        window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
        // Navigation is in flight; treat as not-yet-authenticated for callers.
        return false;
      },

      logout: () => {
        set({
          status: "idle",
          idToken: null,
          expiresAt: null,
          user: null,
          error: null,
        });
      },

      isAuthenticated: () => {
        const { status, user, expiresAt } = get();
        if (status !== "authenticated" || !user) return false;
        if (expiresAt && Date.now() >= expiresAt) return false;
        return true;
      },
    }),
    {
      name: "greenroom-auth",
      // Persist only the session, not transient status/error.
      partialize: (s) => ({
        idToken: s.idToken,
        expiresAt: s.expiresAt,
        user: s.user,
        status: s.status === "authenticated" ? "authenticated" : "idle",
      }),
    }
  )
);
